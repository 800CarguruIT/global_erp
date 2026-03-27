/* eslint-disable no-console */
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv/config");
} catch {}

import fs from "fs/promises";
import path from "path";
import { getSql } from "../src/db";
import { insertEmployee, updateEmployee } from "../src/hr/employees/repository";

// ─── Env loader (same pattern as migrate.ts) ──────────────────────────────────

async function loadEnvFromRoot() {
  if (process.env.DATABASE_URL) return;
  const envPath = path.resolve(__dirname, "..", "..", "..", ".env");
  try {
    const contents = await fs.readFile(envPath, "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // ignore missing .env
  }
}

// ─── MySQL parser ─────────────────────────────────────────────────────────────
// Handles multiple INSERT statements (phpMyAdmin splits large dumps into batches).
// Parses NULL, single-quoted strings (with \' \\ \n \r \t \" '' escapes),
// numbers, and bare keywords. Each row must be on one line (standard mysqldump).

function parseRowsAt(sqlText: string, startIdx: number): string[][] {
  let i = startIdx;
  const len = sqlText.length;
  const rows: string[][] = [];

  const skipWs = () => { while (i < len && "\n\r \t".includes(sqlText[i])) i++; };
  skipWs();

  while (i < len) {
    if (sqlText[i] !== "(") break;
    i++; // skip opening (

    const row: string[] = [];

    while (i < len) {
      while (i < len && sqlText[i] === " ") i++;

      if (sqlText.slice(i, i + 4) === "NULL") {
        row.push("");
        i += 4;
      } else if (sqlText[i] === "'") {
        i++; // skip opening quote
        let str = "";
        while (i < len) {
          const ch = sqlText[i];
          if (ch === "\\") {
            const nx = sqlText[i + 1];
            if      (nx === "'")  { str += "'";  i += 2; }
            else if (nx === '"')  { str += '"';  i += 2; }
            else if (nx === "n")  { str += "\n"; i += 2; }
            else if (nx === "r")  { str += "\r"; i += 2; }
            else if (nx === "t")  { str += "\t"; i += 2; }
            else if (nx === "\\") { str += "\\"; i += 2; }
            else if (nx === "0")  { i += 2; } // null byte → skip
            else                  { str += ch; i++; }
          } else if (ch === "'") {
            if (sqlText[i + 1] === "'") { str += "'"; i += 2; } // '' → '
            else { i++; break; } // closing quote
          } else {
            str += ch;
            i++;
          }
        }
        row.push(str);
      } else {
        // Unquoted: number or keyword
        let val = "";
        while (i < len && sqlText[i] !== "," && sqlText[i] !== ")") {
          val += sqlText[i];
          i++;
        }
        row.push(val.trim());
      }

      while (i < len && sqlText[i] === " ") i++;
      if (i < len && sqlText[i] === ",") { i++; }
      else break;
    }

    if (i < len && sqlText[i] === ")") i++;
    rows.push(row);

    skipWs();
    if (i < len && sqlText[i] === ",") { i++; skipWs(); }
    else break;
  }

  return rows;
}

function parseMysqlInsert(sqlText: string): { columns: string[]; rows: string[][] } {
  // phpMyAdmin may split large tables into multiple INSERT statements — collect all of them
  const insertRegex = /INSERT INTO `employees` \(([^)]+)\) VALUES/g;
  let match: RegExpExecArray | null;
  let columns: string[] = [];
  const allRows: string[][] = [];

  while ((match = insertRegex.exec(sqlText)) !== null) {
    if (columns.length === 0) {
      columns = match[1].split(",").map((c) => c.trim().replace(/`/g, ""));
    }
    const batchRows = parseRowsAt(sqlText, match.index + match[0].length);
    allRows.push(...batchRows);
  }

  if (columns.length === 0) throw new Error("Could not find INSERT INTO employees ... VALUES statement");
  return { columns, rows: allRows };
}

// ─── Field helpers ────────────────────────────────────────────────────────────

function rows<T>(result: T[] | { rows: T[] }): T[] {
  return (result as any).rows ?? (result as T[]);
}

/** Normalise a MySQL date/timestamp to YYYY-MM-DD, or null for invalid values. */
function parseDate(val: string): string | null {
  if (!val) return null;
  const d = val.slice(0, 10);
  if (d === "0000-00-00" || d <= "1900-01-01") return null;
  return d;
}

function parseSalary(val: string): number {
  const n = parseFloat(val);
  return isNaN(n) || n < 0 ? 0 : n;
}

/** Returns false for empty, 'N/A', '000', '0' – common placeholders in the source data. */
function isValidId(val: string): boolean {
  if (!val) return false;
  const v = val.trim().toLowerCase();
  return v !== "" && v !== "n/a" && v !== "na" && v !== "000" && v !== "0" && v !== "null" && v !== "select status";
}

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "Unknown", last: "Unknown" };
  if (parts.length === 1) return { first: parts[0], last: parts[0] };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

/** Convert any undefined values to null so postgres doesn't throw UNDEFINED_VALUE. */
function noUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, v === undefined ? null : v])
  ) as T;
}

function mapAccommodation(val: string): string {
  const v = val.trim().toLowerCase();
  return v === "yes" || v === "company" || v === "1" ? "company" : "self";
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  await loadEnvFromRoot();
  const sql = getSql();

  const sqlFilePath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(__dirname, "employees.sql");

  console.log(`Reading: ${sqlFilePath}`);
  const fileContents = await fs.readFile(sqlFilePath, "utf8");

  console.log("Parsing MySQL INSERT statement...");
  const { columns, rows: sourceRows } = parseMysqlInsert(fileContents);
  console.log(`Found ${sourceRows.length} rows, ${columns.length} columns.`);

  // Helper: get value by column name
  const colIdx: Record<string, number> = {};
  for (const [i, c] of columns.entries()) colIdx[c] = i;
  const get = (row: string[], name: string) => row[colIdx[name]] ?? "";

  // ── Pre-load existing employees for O(1) upsert matching ──────────────────
  console.log("Loading existing employees from target DB...");
  const existingResult = await sql<
    { id: string; doc_passport_number: string | null; doc_id_number: string | null; full_name: string; start_date: string | null }[]
  >`SELECT id, doc_passport_number, doc_id_number, full_name, start_date FROM employees WHERE scope = 'company' AND company_id = 'd32af79a-fdde-4052-a8f1-6bc69ba3544e'`;

  const existing = rows(existingResult);
  const passportMap = new Map<string, string>(); // passport_upper → id
  const emiratesMap = new Map<string, string>(); // emirates_id → id

  for (const e of existing) {
    if (e.doc_passport_number) passportMap.set(e.doc_passport_number.trim().toUpperCase(), e.id);
    if (e.doc_id_number)       emiratesMap.set(e.doc_id_number.trim(), e.id);
  }
  console.log(`Existing employees in DB: ${existing.length}`);

  // ── Starting auto_code counter ─────────────────────────────────────────────
  const codeResult = await sql<{ max_num: number | null }[]>`
    SELECT MAX(CAST(REGEXP_REPLACE(auto_code, '\\D', '', 'g') AS int)) AS max_num
    FROM employees
    WHERE auto_code LIKE 'EMP-%'
  `;
  let autoCodeCounter = Number(rows(codeResult)[0]?.max_num ?? 0);
  const nextAutoCode = () => `EMP-${String(++autoCodeCounter).padStart(4, "0")}`;

  // ── Process each source row ────────────────────────────────────────────────
  let created = 0, updated = 0, errors = 0;
  let matchedByPassport = 0, matchedByEmirates = 0;
  const updatedIds = new Set<string>(); // prevent same existing record absorbing two source rows

  for (let rowIdx = 0; rowIdx < sourceRows.length; rowIdx++) {
    const row = sourceRows[rowIdx];

    try {
      const fullName  = get(row, "name").trim() || "Unknown";
      const { first, last } = splitName(fullName);
      const startDate = parseDate(get(row, "join_date"));

      const passportRaw = get(row, "passport_number").trim();
      const passport    = isValidId(passportRaw) ? passportRaw.toUpperCase() : null;

      const emiratesRaw = get(row, "emirates_id").trim();
      const emirates    = isValidId(emiratesRaw) ? emiratesRaw : null;

      // Resolve existing employee ID — only match by document ID, never by name.
      // If the matched target was already updated this run, insert as new instead
      // (prevents two source rows collapsing onto the same existing record).
      let existingId: string | undefined;
      if (passport) { const id = passportMap.get(passport); if (id && !updatedIds.has(id)) { existingId = id; matchedByPassport++; } }
      if (!existingId && emirates) { const id = emiratesMap.get(emirates); if (id && !updatedIds.has(id)) { existingId = id; matchedByEmirates++; } }

      const basicSalary = parseSalary(get(row, "basic_salary"));
      const totalSalary = parseSalary(get(row, "salary"));
      // Use total salary as grand_total; if not set use basic_salary
      const grandTotal  = totalSalary > 0 ? totalSalary : basicSalary;

      const personalPhoneRaw = get(row, "personal_phone").trim();
      const personalPhone    = personalPhoneRaw && personalPhoneRaw !== "0" ? personalPhoneRaw : null;

      const empRef       = get(row, "emp_refernece").trim();
      const emailPersonal = empRef.includes("@") ? empRef : null;

      const mappedData = {
        auto_code:          null as string | null, // preserved via COALESCE on update; overridden on insert
        scope:              "company" as const,
        company_id:         "d32af79a-fdde-4052-a8f1-6bc69ba3544e",
        branch_id:          null,
        vendor_id:          null,
        first_name:         first,
        last_name:          last,
        full_name:          fullName,
        temp_address:       null,
        perm_address:       get(row, "address").trim() || null,
        current_location:   null,
        phone_personal:     personalPhone,
        phone_company:      get(row, "phone").trim() || null,
        email_personal:     emailPersonal,
        email_company:      get(row, "email").trim() || null,
        doc_id_number:      emirates,
        doc_id_issue:       null as string | null,
        doc_id_expiry:      parseDate(get(row, "emirates_id_expiry")),
        doc_passport_number:  passport,
        doc_passport_issue:   null as string | null,
        doc_passport_expiry:  parseDate(get(row, "passport_expiry")),
        doc_id_file_id:       null,
        doc_passport_file_id: null,
        nationality:        get(row, "nationality").trim() || null,
        title:              get(row, "designation").trim() || null,
        division:           get(row, "division").trim() || null,
        department:         get(row, "department").trim() || null,
        start_date:         startDate,
        date_of_birth:      parseDate(get(row, "dob")),
        basic_salary:       basicSalary,
        pension_amount:     0,
        gratuity_amount:    0,
        allowance_total:    0,
        gov_fee_total:      0,
        salary_grand_total: grandTotal,
        visa_required:      false,
        visa_fee:           0,
        immigration_fee:    0,
        work_permit_fee:    0,
        admin_fee:          0,
        insurance_fee:      0,
        employee_type:      "full_time" as const,
        accommodation_type: mapAccommodation(get(row, "company_accom")),
        transport_type:     "self" as const,
        working_days_per_week:  null as number | null,
        working_hours_per_day:  null as number | null,
        official_day_off:   get(row, "day_off").trim() || null,
        emergency_name:     null,
        emergency_phone:    null,
        emergency_email:    null,
        emergency_relation: null,
        emergency_address:  null,
        image_file_id:      null,
      };

      if (existingId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await updateEmployee(existingId, noUndefined(mappedData) as any);
        updatedIds.add(existingId);
        updated++;
      } else {
        const autoCode = nextAutoCode();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const inserted = await insertEmployee(noUndefined({ ...mappedData, auto_code: autoCode }) as any);
        created++;
        // Register in maps to avoid creating duplicates from later rows
        if (passport)  passportMap.set(passport, inserted.id);
        if (emirates)  emiratesMap.set(emirates, inserted.id);
      }
    } catch (err) {
      errors++;
      const name = get(row, "name").trim();
      console.error(`  [Row ${rowIdx + 1}] Error for "${name}": ${(err as Error).message}`);
    }

    if ((rowIdx + 1) % 50 === 0 || rowIdx + 1 === sourceRows.length) {
      console.log(`  ${rowIdx + 1}/${sourceRows.length} — created: ${created}, updated: ${updated}, errors: ${errors}`);
    }
  }

  console.log("\n=== Import complete ===");
  console.log(`  Created          : ${created}`);
  console.log(`  Updated          : ${updated}`);
  console.log(`    (by passport)  : ${matchedByPassport}`);
  console.log(`    (by emirates)  : ${matchedByEmirates}`);
  console.log(`  Errors           : ${errors}`);
  console.log(`  Source rows      : ${sourceRows.length}`);
}

main()
  .catch((err) => {
    console.error("Import failed:", err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
