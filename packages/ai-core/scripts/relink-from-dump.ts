/* eslint-disable no-console */
/**
 * relink-from-dump.ts
 *
 * Reads the CarGuru2 MySQL dump (.gz), extracts lead→advisor mappings,
 * matches advisor names to PG employees, and updates leads.agent_employee_id.
 * Also reads adv_collections for revenue data.
 *
 * Usage:
 *   DATABASE_URL=postgres://autoguru:autoguru@localhost:5432/global_erp_dev \
 *   pnpm --filter ai-core ts-node --transpile-only --compiler-options '{"module":"CommonJS"}' scripts/relink-from-dump.ts
 */

import * as fs from "fs";
import * as zlib from "zlib";
import * as readline from "readline";
import postgres from "postgres";
import * as path from "path";

const COMPANY_ID = process.env.TARGET_COMPANY_ID ?? "d32af79a-fdde-4052-a8f1-6bc69ba3544e";
const DUMP_DIR = path.resolve(__dirname, "../../../db");

async function main() {
  const pgUrl = process.env.DATABASE_URL;
  if (!pgUrl) throw new Error("DATABASE_URL is required");
  const sql = postgres(pgUrl, { max: 3 });

  // Find the gz dump
  const files = fs.readdirSync(DUMP_DIR);
  const gzFile = files.find(f => f.endsWith(".sql.gz") && f.includes("carguru"));
  if (!gzFile) throw new Error("No carguru .sql.gz dump found in " + DUMP_DIR);
  const gzPath = path.join(DUMP_DIR, gzFile);
  console.log("Dump file:", gzPath);

  // Step 1: Load PG employees
  console.log("\n── Step 1: Loading PG employees ──");
  const employees = await sql<{ id: string; full_name: string }[]>`
    SELECT id, full_name FROM employees WHERE company_id = ${COMPANY_ID}
  `;
  const empByName = new Map<string, string>();
  const empByFirstName = new Map<string, string>();
  for (const e of employees) {
    const key = e.full_name.trim().toLowerCase();
    empByName.set(key, e.id);
    const firstName = key.split(/\s+/)[0];
    if (firstName && !empByFirstName.has(firstName)) {
      empByFirstName.set(firstName, e.id);
    }
  }
  console.log(`  ${employees.length} employees, ${empByFirstName.size} first names indexed`);

  // Step 2: Parse the dump to extract lead_id→advisor and lead_id→date_created
  console.log("\n── Step 2: Parsing dump for leads ──");
  const leadAdvisorMap = new Map<string, string>(); // date_created → advisor name
  const advisorCounts = new Map<string, number>();

  const stream = fs.createReadStream(gzPath).pipe(zlib.createGunzip());
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let inLeadsInsert = false;
  let buffer = "";
  let linesRead = 0;

  for await (const line of rl) {
    linesRead++;
    if (linesRead % 100000 === 0) process.stdout.write(`\r  ${linesRead} lines read...`);

    if (line.startsWith("INSERT INTO `leads`")) {
      inLeadsInsert = true;
      buffer = line;
      continue;
    }

    if (inLeadsInsert) {
      buffer += line;
      if (line.endsWith(";")) {
        // Parse the INSERT statement
        parseLeadsInsert(buffer, leadAdvisorMap, advisorCounts);
        inLeadsInsert = false;
        buffer = "";
      }
      continue;
    }
  }

  console.log(`\n  Parsed ${leadAdvisorMap.size} leads with advisors`);
  console.log("  Top advisors:");
  const sortedAdvisors = Array.from(advisorCounts.entries()).sort((a, b) => b[1] - a[1]);
  for (const [name, count] of sortedAdvisors.slice(0, 20)) {
    const empId = matchAdvisor(name, empByName, empByFirstName);
    console.log(`    ${empId ? "✅" : "❌"} "${name}": ${count} leads`);
  }

  // Step 3: Match and update PG leads
  console.log("\n── Step 3: Updating PG leads ──");
  let updated = 0, notMatched = 0;

  // Process by advisor for efficiency
  for (const [advisorName, count] of sortedAdvisors) {
    const empId = matchAdvisor(advisorName, empByName, empByFirstName);
    if (!empId) { notMatched += count; continue; }

    // Collect all date_created values for this advisor
    const dates: string[] = [];
    for (const [dateStr, adv] of leadAdvisorMap) {
      if (adv === advisorName) dates.push(dateStr);
    }

    // Batch update: match PG leads by created_at timestamp
    const BATCH = 500;
    for (let i = 0; i < dates.length; i += BATCH) {
      const batch = dates.slice(i, i + BATCH);
      const result = await sql`
        UPDATE leads SET agent_employee_id = ${empId}
        WHERE company_id = ${COMPANY_ID}
          AND agent_employee_id IS NULL
          AND created_at IN ${sql(batch.map(d => new Date(d)))}
      `;
      updated += (result as any).count ?? 0;
    }
    process.stdout.write(`\r  ${advisorName}: ${dates.length} leads → ${empId.slice(0, 8)}...`);
  }

  console.log(`\n\n── Step 4: Verify ──`);
  const [verify] = await sql<{ total: number; with_agent: number }[]>`
    SELECT COUNT(*)::int as total, COUNT(agent_employee_id)::int as with_agent
    FROM leads WHERE company_id = ${COMPANY_ID}
  `;
  console.log(`  ${verify.with_agent} / ${verify.total} leads now have agent_employee_id`);
  console.log(`  Updated: ${updated}, Not matched: ${notMatched}`);

  console.log("\n✅ Done!");
  await sql.end();
}

function matchAdvisor(name: string, exact: Map<string, string>, firstName: Map<string, string>): string | null {
  const key = name.trim().toLowerCase();
  if (!key) return null;
  let id = exact.get(key);
  if (id) return id;
  // Try first name match
  id = firstName.get(key);
  if (id) return id;
  // Try contains
  for (const [eName, eId] of exact) {
    if (eName.startsWith(key) || key.startsWith(eName.split(/\s+/)[0])) return eId;
  }
  return null;
}

function parseLeadsInsert(sql: string, map: Map<string, string>, counts: Map<string, number>) {
  // Extract VALUES tuples from INSERT INTO `leads` VALUES (...),(...),...;
  const valuesStart = sql.indexOf("VALUES ");
  if (valuesStart === -1) return;

  const valuesStr = sql.slice(valuesStart + 7, -1); // remove trailing ;

  // Parse each row tuple — field 20 is advisor (0-indexed), field at end has date_created
  // Fields: id(0), account_id(1), car_id(2), name(3), customer_type(4), phone(5), phone2(6),
  //         email(7), car_plate(8), car_make(9), car_model(10), car_year(11), car_vin(12),
  //         car_mileage(13), source(14), subsource(15), type(16), department(17), division(18),
  //         status(19), advisor(20), ...

  // Simple parser: split by "),(" but handle quoted strings
  let depth = 0;
  let inQuote = false;
  let escaping = false;
  let current = "";
  let tuples: string[] = [];

  for (let i = 0; i < valuesStr.length; i++) {
    const ch = valuesStr[i];
    if (escaping) { current += ch; escaping = false; continue; }
    if (ch === "\\") { current += ch; escaping = true; continue; }
    if (ch === "'") { inQuote = !inQuote; current += ch; continue; }
    if (inQuote) { current += ch; continue; }
    if (ch === "(") { depth++; if (depth === 1) { current = ""; continue; } }
    if (ch === ")") { depth--; if (depth === 0) { tuples.push(current); current = ""; continue; } }
    current += ch;
  }

  for (const tuple of tuples) {
    const fields = parseTupleFields(tuple);
    if (fields.length < 21) continue;
    const advisor = unquote(fields[20]);
    const dateCreated = fields.length > 50 ? unquote(fields[fields.length - 3]) : null; // near end
    // Actually date_created is a known position — let's find it
    // Look for a datetime-like field near the end
    let dateStr: string | null = null;
    for (let j = fields.length - 1; j >= fields.length - 10 && j >= 0; j--) {
      const v = unquote(fields[j]);
      if (/^\d{4}-\d{2}-\d{2}/.test(v)) { dateStr = v; break; }
    }

    if (advisor && advisor !== "NULL" && advisor !== "" && dateStr) {
      map.set(dateStr, advisor);
      counts.set(advisor, (counts.get(advisor) ?? 0) + 1);
    }
  }
}

function parseTupleFields(tuple: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuote = false;
  let escaping = false;

  for (let i = 0; i < tuple.length; i++) {
    const ch = tuple[i];
    if (escaping) { current += ch; escaping = false; continue; }
    if (ch === "\\") { current += ch; escaping = true; continue; }
    if (ch === "'") { inQuote = !inQuote; current += ch; continue; }
    if (inQuote) { current += ch; continue; }
    if (ch === ",") { fields.push(current.trim()); current = ""; continue; }
    current += ch;
  }
  if (current.trim()) fields.push(current.trim());
  return fields;
}

function unquote(s: string): string {
  if (!s) return "";
  s = s.trim();
  if (s === "NULL") return "";
  if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1);
  return s;
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
