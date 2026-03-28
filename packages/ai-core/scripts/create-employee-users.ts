/* eslint-disable no-console */
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv/config");
} catch {}

import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { getSql } from "../src/db";

const COMPANY_ID    = "d32af79a-fdde-4052-a8f1-6bc69ba3544e";
const EMAIL_DOMAIN  = "@800carguru.ae";
const DEFAULT_PASSWORD = "1234";

// ─── Env loader ───────────────────────────────────────────────────────────────

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

// ─── MySQL parser (reused from import-employees.ts) ───────────────────────────

function parseRowsAt(sqlText: string, startIdx: number): string[][] {
  let i = startIdx;
  const len = sqlText.length;
  const rows: string[][] = [];
  const skipWs = () => { while (i < len && "\n\r \t".includes(sqlText[i])) i++; };
  skipWs();
  while (i < len) {
    if (sqlText[i] !== "(") break;
    i++;
    const row: string[] = [];
    while (i < len) {
      while (i < len && sqlText[i] === " ") i++;
      if (sqlText.slice(i, i + 4) === "NULL") {
        row.push(""); i += 4;
      } else if (sqlText[i] === "'") {
        i++;
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
            else if (nx === "0")  { i += 2; }
            else                  { str += ch; i++; }
          } else if (ch === "'") {
            if (sqlText[i + 1] === "'") { str += "'"; i += 2; }
            else { i++; break; }
          } else { str += ch; i++; }
        }
        row.push(str);
      } else {
        let val = "";
        while (i < len && sqlText[i] !== "," && sqlText[i] !== ")") { val += sqlText[i]; i++; }
        row.push(val.trim());
      }
      while (i < len && sqlText[i] === " ") i++;
      if (i < len && sqlText[i] === ",") { i++; } else break;
    }
    if (i < len && sqlText[i] === ")") i++;
    rows.push(row);
    skipWs();
    if (i < len && sqlText[i] === ",") { i++; skipWs(); } else break;
  }
  return rows;
}

function parseMysqlInsert(sqlText: string): { columns: string[]; rows: string[][] } {
  const insertRegex = /INSERT INTO `employees` \(([^)]+)\) VALUES/g;
  let match: RegExpExecArray | null;
  let columns: string[] = [];
  const allRows: string[][] = [];
  while ((match = insertRegex.exec(sqlText)) !== null) {
    if (columns.length === 0) {
      columns = match[1].split(",").map((c) => c.trim().replace(/`/g, ""));
    }
    allRows.push(...parseRowsAt(sqlText, match.index + match[0].length));
  }
  if (columns.length === 0) throw new Error("Could not find INSERT INTO employees ... VALUES");
  return { columns, rows: allRows };
}

function isValidId(val: string): boolean {
  if (!val) return false;
  const v = val.trim().toLowerCase();
  return v !== "" && v !== "n/a" && v !== "na" && v !== "000" && v !== "0" && v !== "null" && v !== "select status";
}

// ─── Build username lookup: passport/emirates → username ──────────────────────

function buildUsernameMaps(sqlText: string): {
  passportToUsername: Map<string, string>;
  emiratesToUsername: Map<string, string>;
  activePassports: Set<string>;
  activeEmirates: Set<string>;
} {
  const { columns, rows } = parseMysqlInsert(sqlText);
  const colIdx: Record<string, number> = {};
  for (const [i, c] of columns.entries()) colIdx[c] = i;
  const get = (row: string[], name: string) => row[colIdx[name]] ?? "";

  const passportToUsername = new Map<string, string>();
  const emiratesToUsername = new Map<string, string>();
  const activePassports = new Set<string>();
  const activeEmirates = new Set<string>();

  for (const row of rows) {
    const username = get(row, "username").trim();
    const status = get(row, "status").trim();
    const isActive = status === "1";

    const passport = get(row, "passport_number").trim();
    const emirates = get(row, "emirates_id").trim();

    if (username) {
      if (isValidId(passport)) passportToUsername.set(passport.toUpperCase(), username);
      if (isValidId(emirates)) emiratesToUsername.set(emirates, username);
    }

    if (isActive) {
      if (isValidId(passport)) activePassports.add(passport.toUpperCase());
      if (isValidId(emirates)) activeEmirates.add(emirates);
    }
  }

  return { passportToUsername, emiratesToUsername, activePassports, activeEmirates };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rowsFrom<T>(result: T[] | { rows: T[] }): T[] {
  return (result as any).rows ?? (result as T[]);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  await loadEnvFromRoot();
  const sql = getSql();

  // Parse employees.sql to build passport/emirates → username maps
  const sqlFilePath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(__dirname, "employees.sql");

  console.log(`Parsing ${sqlFilePath} for usernames...`);
  const fileContents = await fs.readFile(sqlFilePath, "utf8");
  const { passportToUsername, emiratesToUsername, activePassports, activeEmirates } = buildUsernameMaps(fileContents);
  console.log(`Username map: ${passportToUsername.size} by passport, ${emiratesToUsername.size} by emirates ID`);
  console.log(`Active employees in source: ${activePassports.size} by passport, ${activeEmirates.size} by emirates ID`);

  // Fetch all employees for this company (include doc fields for matching)
  console.log("Fetching employees from DB...");
  const empResult = await sql<{
    id: string;
    auto_code: string;
    full_name: string;
    doc_passport_number: string | null;
    doc_id_number: string | null;
  }[]>`
    SELECT id, auto_code, full_name, doc_passport_number, doc_id_number
    FROM employees
    WHERE company_id = ${COMPANY_ID}
    ORDER BY auto_code
  `;
  const employees = rowsFrom(empResult);
  console.log(`Found ${employees.length} employees.`);

  // Find employees that already have a linked user account
  const empIds = employees.map((e) => e.id);
  const linkedResult = await sql<{ employee_id: string }[]>`
    SELECT employee_id FROM users WHERE employee_id = ANY(${empIds as any})
  `;
  const alreadyLinked = new Set(rowsFrom(linkedResult).map((r) => r.employee_id));
  console.log(`Already have user accounts: ${alreadyLinked.size}`);

  // Filter to only active employees from the source dump
  const isActiveInSource = (emp: typeof employees[0]): boolean => {
    if (emp.doc_passport_number) {
      const p = emp.doc_passport_number.trim().toUpperCase();
      if (activePassports.has(p)) return true;
    }
    if (emp.doc_id_number) {
      const e = emp.doc_id_number.trim();
      if (activeEmirates.has(e)) return true;
    }
    return false;
  };

  const toCreate = employees.filter((e) => !alreadyLinked.has(e.id) && isActiveInSource(e));
  const skippedInactive = employees.filter((e) => !alreadyLinked.has(e.id) && !isActiveInSource(e)).length;
  console.log(`Active employees needing accounts: ${toCreate.length}`);
  console.log(`Skipped (inactive or no doc match): ${skippedInactive}`);

  if (toCreate.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  console.log("Hashing default password...");
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  let created = 0;
  let errors = 0;
  const noUsernameFallback: string[] = [];

  for (const emp of toCreate) {
    try {
      // Resolve username from source dump via passport or emirates ID
      let username: string | undefined;
      if (emp.doc_passport_number) username = passportToUsername.get(emp.doc_passport_number.trim().toUpperCase());
      if (!username && emp.doc_id_number)  username = emiratesToUsername.get(emp.doc_id_number.trim());

      let email: string;
      if (username) {
        email = `${username.trim().toLowerCase()}${EMAIL_DOMAIN}`;
      } else {
        // Fallback: use auto_code (e.g. emp-0042@800carguru.ae)
        email = `${emp.auto_code.toLowerCase()}${EMAIL_DOMAIN}`;
        noUsernameFallback.push(`${emp.auto_code} "${emp.full_name}"`);
      }

      await sql`
        INSERT INTO users (id, email, password_hash, full_name, is_active, employee_id, company_id)
        VALUES (
          ${randomUUID()},
          ${email},
          ${passwordHash},
          ${emp.full_name},
          ${true},
          ${emp.id},
          ${COMPANY_ID}
        )
        ON CONFLICT (email) DO UPDATE
          SET employee_id = COALESCE(users.employee_id, EXCLUDED.employee_id),
              updated_at  = NOW()
      `;
      created++;
    } catch (err) {
      errors++;
      console.error(`  Error for ${emp.auto_code} "${emp.full_name}": ${(err as Error).message}`);
    }
  }

  console.log("\n=== Done ===");
  console.log(`  Created  : ${created}`);
  console.log(`  Errors   : ${errors}`);
  console.log(`  Password : ${DEFAULT_PASSWORD}`);
  console.log(`  Domain   : ${EMAIL_DOMAIN}`);

  if (noUsernameFallback.length > 0) {
    console.log(`\n  ⚠  ${noUsernameFallback.length} employees had no username in source — used auto_code instead:`);
    for (const label of noUsernameFallback) console.log(`     ${label}`);
  }
}

main()
  .catch((err) => { console.error("Failed:", err); process.exit(1); })
  .finally(() => { process.exit(0); });
