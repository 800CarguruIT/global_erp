/**
 * Migration script: carguru2 employees → Global ERP employees + users
 *
 * Usage (from apps/web/):
 *   node tmp-migrate-employees.mjs
 *
 * What it does:
 *   1. Parses the MySQL dump at ~/Downloads/carguru2.sql
 *   2. Inserts employee HR records into `employees`
 *   3. Creates linked `users` accounts (temp password: Welcome@123)
 *   4. Skips employees with duplicate emails (logs them)
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import postgres from "postgres";

const require = createRequire(import.meta.url);
const bcrypt = require("bcryptjs");

const DB_URL = "postgres://autoguru:autoguru@localhost:5432/global_erp_dev";
const SQL_DUMP = path.join(process.env.USERPROFILE || process.env.HOME, "Downloads", "carguru2.sql");
const COMPANY_ID = "d32af79a-fdde-4052-a8f1-6bc69ba3544e";
const TEMP_PASSWORD = "Welcome@123";
const DRY_RUN = process.argv.includes("--dry-run");

// ─── MySQL Value Parser ────────────────────────────────────────────────────────

/**
 * Parses a single MySQL row string like:
 *   (1, 'foo', NULL, 'bar\'s', 3.14)
 * into an array of JS values (string | null | number).
 */
function parseRowValues(line) {
  // Strip leading/trailing whitespace, remove trailing comma or semicolon
  const clean = line.trim().replace(/[,;]+$/, "").trim();
  if (!clean.startsWith("(") || !clean.endsWith(")")) return null;

  const inner = clean.slice(1, -1);
  const values = [];
  let i = 0;

  while (i <= inner.length) {
    // skip leading whitespace
    while (i < inner.length && (inner[i] === " " || inner[i] === "\t")) i++;
    if (i >= inner.length) break;

    if (inner[i] === "'") {
      // quoted string
      let str = "";
      i++; // skip opening quote
      while (i < inner.length) {
        if (inner[i] === "\\") {
          i++;
          const ch = inner[i] ?? "";
          if (ch === "n") str += "\n";
          else if (ch === "t") str += "\t";
          else if (ch === "r") str += "\r";
          else if (ch === "0") str += "\0";
          else str += ch;
          i++;
        } else if (inner[i] === "'" && inner[i + 1] === "'") {
          str += "'";
          i += 2;
        } else if (inner[i] === "'") {
          i++; // closing quote
          break;
        } else {
          str += inner[i];
          i++;
        }
      }
      values.push(str);
    } else if (inner.substring(i, i + 4).toUpperCase() === "NULL") {
      values.push(null);
      i += 4;
    } else {
      // numeric or unquoted literal
      let val = "";
      while (i < inner.length && inner[i] !== ",") {
        val += inner[i];
        i++;
      }
      const trimmed = val.trim();
      values.push(trimmed === "" ? null : trimmed);
    }

    // skip comma separator
    while (i < inner.length && (inner[i] === " " || inner[i] === "\t")) i++;
    if (i < inner.length && inner[i] === ",") i++;
  }

  return values;
}

// ─── Parse the SQL Dump ────────────────────────────────────────────────────────

function parseDump(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");

  const employees = [];
  let inEmployees = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (/^INSERT INTO `employees`/.test(line)) {
      inEmployees = true;
      continue;
    }

    if (inEmployees) {
      if (line.startsWith("(")) {
        const values = parseRowValues(line);
        if (values) employees.push(values);
        // If line ends with ); the INSERT block is done but next line may be
        // another INSERT or blank — we stay inEmployees=true until next INSERT header resets it
        if (line.endsWith(");") || line.endsWith(") ;")) {
          inEmployees = false;
        }
      } else if (line.startsWith("INSERT ") || line.startsWith("--") || line.trim() === "") {
        inEmployees = false;
      }
    }
  }

  return employees;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeDate(val) {
  if (!val || val === "NULL" || val === "0000-00-00" || val.startsWith("0000-")) return null;
  try {
    const d = new Date(val);
    if (isNaN(d.getTime()) || d.getFullYear() < 1900 || d.getFullYear() > 2100) return null;
    return d.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function safeName(val) {
  return (val || "").trim() || null;
}

function splitName(fullName) {
  const name = (fullName || "").trim();
  if (!name) return { first: "Unknown", last: "Unknown" };
  const idx = name.indexOf(" ");
  if (idx === -1) return { first: name, last: "-" };
  return { first: name.slice(0, idx), last: name.slice(idx + 1).trim() || "-" };
}

function mapAccommodation(val) {
  if (!val) return "self";
  const v = val.toLowerCase().trim();
  if (v === "yes" || v === "company") return "company";
  return "self";
}

function mapEmployeeType(currentStatus) {
  const s = (currentStatus || "").toLowerCase().trim();
  if (s === "terminated") return "terminated";
  return "full_time";
}

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function autoCode(legacyId) {
  return `EMP-${String(legacyId).padStart(4, "0")}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Reading dump from: ${SQL_DUMP}`);
  const rows = parseDump(SQL_DUMP);
  console.log(`Parsed ${rows.length} employee rows`);

  if (DRY_RUN) {
    console.log("\n[DRY RUN] First 3 rows parsed:");
    for (const r of rows.slice(0, 3)) {
      console.log("  id:", r[0], "name:", r[1], "email:", r[7], "status:", r[39]);
    }
    return;
  }

  const sql = postgres(DB_URL, { max: 1 });
  const tempPasswordHash = await bcrypt.hash(TEMP_PASSWORD, 10);

  let inserted = 0;
  let usersCreated = 0;
  let skippedDuplicateEmail = 0;
  let errors = 0;
  const usedEmails = new Set();

  // Pre-load already-used emails in users table to avoid duplicates
  const existingEmails = await sql`SELECT email FROM users WHERE email IS NOT NULL`;
  for (const row of existingEmails) usedEmails.add(row.email.toLowerCase());

  await sql.begin(async (trx) => {
    for (const r of rows) {
      const legacyId    = r[0];
      const fullName    = (r[1] || "").trim();
      const username    = (r[3] || "").trim();
      const designation = (r[5] || "").trim();
      const phone       = (r[6] || "").trim();
      const email       = (r[7] || "").trim();
      const salary      = parseFloat(r[8]) || 0;
      const basicSalary = parseFloat(r[9]) || 0;
      const department  = (r[11] || "").trim();
      const division    = (r[12] || "").trim();
      const joinDate    = safeDate(r[13]);
      const passportNo  = (r[23] || "").trim();
      const passportExp = safeDate(r[25]);
      const nationality = (r[29] || "").trim();
      const dob         = safeDate(r[31]);
      const emiratesId  = (r[32] || "").trim();
      const emiratesExp = safeDate(r[33]);
      const currentStatus = (r[36] || "").trim();
      const isActive    = r[39] == null ? true : String(r[39]) !== "0";
      const address     = (r[52] || "").trim();
      const dayOff      = (r[57] || "Sunday").trim();
      const companyAccom = r[66];

      const { first: firstName, last: lastName } = splitName(fullName);
      const allowanceTotal = Math.max(0, salary - basicSalary);
      const accommodationType = mapAccommodation(companyAccom);
      const employeeType = mapEmployeeType(currentStatus);
      const code = autoCode(legacyId);

      try {
        // Insert employee
        const empResult = await trx`
          INSERT INTO employees (
            auto_code, scope, company_id,
            first_name, last_name, full_name,
            phone_personal, email_personal,
            doc_id_number, doc_id_expiry,
            doc_passport_number, doc_passport_expiry,
            nationality, title, division, department,
            start_date, date_of_birth,
            basic_salary, allowance_total,
            employee_type, accommodation_type,
            official_day_off, temp_address,
            created_at, updated_at
          ) VALUES (
            ${code}, 'company', ${COMPANY_ID},
            ${firstName}, ${lastName}, ${fullName || "Unknown"},
            ${phone || null}, ${email || null},
            ${emiratesId || null}, ${emiratesExp},
            ${passportNo || null}, ${passportExp},
            ${nationality || null}, ${designation || null},
            ${division || null}, ${department || null},
            ${joinDate}, ${dob},
            ${basicSalary}, ${allowanceTotal},
            ${employeeType}, ${accommodationType},
            ${dayOff || null}, ${address || null},
            now(), now()
          )
          ON CONFLICT (auto_code) DO NOTHING
          RETURNING id
        `;

        if (!empResult.length) {
          console.warn(`  SKIP (already exists): ${code} — ${fullName}`);
          continue;
        }

        const empId = empResult[0].id;
        inserted++;

        // Determine user email
        let userEmail = null;
        if (isValidEmail(email) && !usedEmails.has(email.toLowerCase())) {
          userEmail = email.toLowerCase();
        } else if (username && !usedEmails.has(`${username.toLowerCase()}@carguru-migrated.local`)) {
          userEmail = `${username.toLowerCase()}@carguru-migrated.local`;
        }

        if (userEmail) {
          usedEmails.add(userEmail);
          await trx`
            INSERT INTO users (email, full_name, password_hash, employee_id, is_active, company_id)
            VALUES (
              ${userEmail}, ${fullName || null}, ${tempPasswordHash},
              ${empId}, ${isActive}, ${COMPANY_ID}
            )
            ON CONFLICT (email) DO NOTHING
          `;
          usersCreated++;
        } else {
          skippedDuplicateEmail++;
          console.warn(`  NO USER for ${code} ${fullName} — email '${email}' already taken, no username fallback`);
        }
      } catch (err) {
        errors++;
        console.error(`  ERROR on legacy id=${legacyId} (${fullName}):`, err.message);
      }
    }
  });

  console.log("\n══ Migration Complete ══");
  console.log(`  Employees inserted : ${inserted}`);
  console.log(`  Users created      : ${usersCreated}`);
  console.log(`  Skipped (dup email): ${skippedDuplicateEmail}`);
  console.log(`  Errors             : ${errors}`);
  console.log(`\n  Temp password for all users: ${TEMP_PASSWORD}`);

  await sql.end();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
