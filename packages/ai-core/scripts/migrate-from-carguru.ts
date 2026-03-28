/* eslint-disable no-console */
/**
 * migrate-from-carguru.ts
 *
 * Migrates CarGuru v2 MySQL data → Global ERP PostgreSQL.
 * All records are scoped to TARGET_COMPANY_ID.
 *
 * Usage:
 *   Set in .env (or environment):
 *     DATABASE_URL=postgresql://...
 *     SOURCE_MYSQL_URL=mysql://root:root@localhost:3306/carguru_v2
 *     TARGET_COMPANY_ID=d32af79a-fdde-4052-a8f1-6bc69ba3544e
 *
 *   Then run:
 *     pnpm --filter ai-core migrate:carguru
 *
 * Phases:
 *   1.  Employees
 *   2.  Employee Allowances
 *   3.  CHSC Packages (service_contract_packages)
 *   4.  Customers
 *   5.  Cars + customer_car_links
 *   6.  Leads
 *   7.  Inspections
 *   8.  Estimates (+ stub inspections for estimates without one)
 *   9.  Estimate Items (from source line_items where estimate_id IS set)
 *  10.  Work Orders (one stub per estimate — required FK bridge for invoices)
 *  11.  Invoices
 *  12.  Line Items (inspection-scoped items)
 *  13.  Transactions → customer_wallet_transactions
 *  14.  CHSC Service Contracts + Entitlements
 */

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv/config");
} catch {}

import path from "path";
import fs from "fs/promises";
import { createPool } from "mysql2/promise";
import { randomUUID } from "crypto";
import { getSql } from "../src/db";
import type postgres from "postgres";

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDate(val: unknown): string | null {
  if (!val) return null;
  const s = String(val).slice(0, 10);
  if (!s || s === "0000-00-00" || s <= "1900-01-01") return null;
  return s;
}

function parseSalary(val: unknown): number {
  const n = parseFloat(String(val ?? "0"));
  return isNaN(n) || n < 0 ? 0 : n;
}

/** Strip null bytes and trim — PostgreSQL rejects 0x00 in text fields. */
function cleanStr(val: unknown): string {
  return String(val ?? "").replace(/\0/g, "").trim();
}

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "Unknown", last: "Unknown" };
  if (parts.length === 1) return { first: parts[0], last: parts[0] };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

function parseMysqlUrl(url: string) {
  // mysql://user:pass@host:port/dbname
  const m = url.match(/^mysql:\/\/([^:]+):([^@]*)@([^:/]+):?(\d+)?\/(.+)$/);
  if (!m) throw new Error(`Invalid SOURCE_MYSQL_URL: ${url}`);
  return { user: m[1], password: m[2], host: m[3], port: parseInt(m[4] ?? "3306"), database: m[5] };
}

function mapLeadType(type: string): string {
  const t = (type ?? "").toLowerCase();
  if (t.includes("rsa")) return "rsa";
  if (t.includes("recovery")) return "recovery";
  return "workshop"; // Workshop, CHSC, Onsite, Inquiry → workshop
}

function mapLeadStatus(status: string): string {
  const s = (status ?? "").toLowerCase();
  if (s.includes("won") || s.includes("closed_won") || s.includes("done") || s === "closed") return "closed_won";
  if (s.includes("lost") || s.includes("cancel")) return "lost";
  if (s.includes("process") || s.includes("progress") || s.includes("open")) return "processing";
  if (s === "new" || s === "pending" || s === "inquiry") return "open";
  return "open";
}

function mapInspStatus(status: string): string {
  const s = (status ?? "").toLowerCase();
  if (s === "completed" || s === "done" || s === "approved") return "completed";
  if (s === "cancelled" || s === "canceled") return "cancelled";
  return "pending"; // Pending / In Progress / draft → pending (migration 061 normalized these)
}

function mapContractStatus(status: string, active: unknown): string {
  if (!active || active === "0") return "cancelled";
  const s = (status ?? "").toLowerCase();
  if (s === "expired") return "expired";
  if (s === "cancelled" || s === "canceled") return "cancelled";
  if (s === "completed") return "completed";
  return "active";
}

const PAGE = 1000; // rows per batch for large tables

// ─── ID Maps ─────────────────────────────────────────────────────────────────
// source int id → target uuid
const empMap = new Map<number, string>();
const custMap = new Map<number, string>();
const carMap = new Map<number, string>();
const leadMap = new Map<number, string>();
const inspMap = new Map<number, string>(); // keyed by source lead_id
const estMap = new Map<number, string>(); // source estimate_id → uuid
const wrkMap = new Map<number, string>(); // source estimate_id → work_order uuid
const invMap = new Map<number, string>();
const pkgMap = new Map<number, string>(); // source chsc_package id → uuid
const contractMap = new Map<string, string>(); // "account_id:car_id:package_id" → contract uuid

// ─── Stub counters ────────────────────────────────────────────────────────────
let stubInspCount = 0;
let stubEstCount = 0;
let stubWrkCount = 0;

// ─── Auto-code helpers ────────────────────────────────────────────────────────
function makeCounter(prefix: string, start: number) {
  let n = start;
  return () => `${prefix}-${String(++n).padStart(6, "0")}`;
}

// ─── PostgreSQL helpers ───────────────────────────────────────────────────────
function row0<T>(res: T[]): T | undefined {
  return (res as unknown as { rows?: T[] }).rows?.[0] ?? res[0];
}

async function maxCode(
  sql: postgres.Sql,
  table: string,
  prefix: string,
  colName = "code"
): Promise<number> {
  const q = `
    SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(${colName}, '\\D', '', 'g') AS int)), 0) AS n
    FROM ${table}
    WHERE company_id = $1 AND ${colName} LIKE $2
  `;
  const res = await sql.unsafe(q, [COMPANY_ID, `${prefix}-%`]);
  return Number(row0<{ n: number }>(res as unknown as { n: number }[])?.n ?? 0);
}

// ─── Stub helpers: ensure inspection / estimate / work_order exist ─────────────

async function ensureInspection(
  sql: postgres.Sql,
  srcLeadId: number,
  leadUuid: string | undefined,
  carUuid: string | undefined,
  custUuid: string | undefined
): Promise<string> {
  if (inspMap.has(srcLeadId)) return inspMap.get(srcLeadId)!;
  const id = randomUUID();
  await sql`
    INSERT INTO inspections (id, company_id, lead_id, car_id, customer_id, status, created_at, updated_at)
    VALUES (${id}, ${COMPANY_ID}, ${leadUuid ?? null}, ${carUuid ?? null}, ${custUuid ?? null},
            'completed', now(), now())
    ON CONFLICT DO NOTHING
  `;
  inspMap.set(srcLeadId, id);
  stubInspCount++;
  return id;
}

async function ensureEstimate(
  sql: postgres.Sql,
  srcLeadId: number,
  inspUuid: string,
  leadUuid: string | undefined,
  carUuid: string | undefined,
  custUuid: string | undefined
): Promise<string> {
  // Dummy key: use negative srcLeadId to avoid collision with real estimate IDs
  const dummyKey = -srcLeadId;
  if (estMap.has(dummyKey)) return estMap.get(dummyKey)!;
  const id = randomUUID();
  await sql`
    INSERT INTO estimates (id, company_id, inspection_id, lead_id, car_id, customer_id,
                           status, vat_rate, total_cost, total_sale, total_discount,
                           final_price, vat_amount, grand_total, created_at, updated_at)
    VALUES (${id}, ${COMPANY_ID}, ${inspUuid}, ${leadUuid ?? null}, ${carUuid ?? null},
            ${custUuid ?? null}, 'approved', 5.00, 0, 0, 0, 0, 0, 0, now(), now())
    ON CONFLICT DO NOTHING
  `;
  estMap.set(dummyKey, id);
  stubEstCount++;
  return id;
}

async function ensureWorkOrder(
  sql: postgres.Sql,
  estUuid: string,
  srcEstimateId: number,
  leadUuid: string | undefined,
  carUuid: string | undefined,
  custUuid: string | undefined
): Promise<string> {
  if (wrkMap.has(srcEstimateId)) return wrkMap.get(srcEstimateId)!;
  const id = randomUUID();
  await sql`
    INSERT INTO work_orders (id, company_id, estimate_id, lead_id, car_id, customer_id,
                              status, created_at, updated_at)
    VALUES (${id}, ${COMPANY_ID}, ${estUuid}, ${leadUuid ?? null}, ${carUuid ?? null},
            ${custUuid ?? null}, 'completed', now(), now())
    ON CONFLICT DO NOTHING
  `;
  wrkMap.set(srcEstimateId, id);
  stubWrkCount++;
  return id;
}

// ─── COMPANY_ID ───────────────────────────────────────────────────────────────
let COMPANY_ID: string;

// ═══════════════════════════════════════════════════════════════════════════════
// PHASES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Phase 1: Employees ───────────────────────────────────────────────────────
async function migrateEmployees(
  my: Awaited<ReturnType<typeof createPool>>,
  sql: postgres.Sql
) {
  console.log("\n── Phase 1: Employees ──────────────────────────────────────");
  const startN = await maxCode(sql, "employees", "EMP", "auto_code");
  const nextCode = makeCounter("EMP", startN);

  // Load existing for dedup
  const existing = await sql<{ id: string; doc_passport_number: string | null; doc_id_number: string | null }[]>`
    SELECT id, doc_passport_number, doc_id_number FROM employees
    WHERE scope = 'company' AND company_id = ${COMPANY_ID}
  `;
  const passportIdx = new Map<string, string>();
  const emiratesIdx = new Map<string, string>();
  for (const e of existing) {
    if (e.doc_passport_number) passportIdx.set(e.doc_passport_number.toUpperCase(), e.id);
    if (e.doc_id_number) emiratesIdx.set(e.doc_id_number, e.id);
  }

  let offset = 0, inserted = 0, skipped = 0;
  while (true) {
    const [rows] = await my.query<any[]>(
      `SELECT id, name, basic_salary, salary, phone, personal_phone, email,
              department, designation, division, join_date, passport_number,
              emirates_id, emirates_id_expiry, passport_expiry, nationality,
              dob, address, day_off, status
       FROM employees WHERE status = 1
       LIMIT ? OFFSET ?`,
      [PAGE, offset]
    );
    if (!(rows as any[]).length) break;

    for (const r of rows as any[]) {
      const { first, last } = splitName(cleanStr(r.name) || "Unknown");
      const passport = cleanStr(r.passport_number).toUpperCase() || null;
      const emirates = cleanStr(r.emirates_id) || null;

      // Check for existing employee
      let existingId = (passport ? passportIdx.get(passport) : undefined)
        ?? (emirates ? emiratesIdx.get(emirates) : undefined);

      if (existingId) {
        empMap.set(r.id, existingId);
        skipped++;
        continue;
      }

      const code = nextCode();
      const id = randomUUID();
      await sql`
        INSERT INTO employees (
          id, auto_code, scope, company_id, first_name, last_name, full_name,
          phone_company, phone_personal, email_company,
          doc_passport_number, doc_passport_expiry,
          doc_id_number, doc_id_expiry,
          nationality, title, department, division,
          start_date, date_of_birth,
          basic_salary, salary_grand_total,
          perm_address, official_day_off,
          employee_type, accommodation_type, transport_type,
          visa_required, created_at, updated_at
        ) VALUES (
          ${id}, ${code}, 'company', ${COMPANY_ID},
          ${first}, ${last}, ${cleanStr(r.name) || "Unknown"},
          ${cleanStr(r.phone) || null},
          ${cleanStr(r.personal_phone) || null},
          ${cleanStr(r.email) || null},
          ${passport}, ${parseDate(r.passport_expiry)},
          ${emirates}, ${parseDate(r.emirates_id_expiry)},
          ${cleanStr(r.nationality) || null},
          ${cleanStr(r.designation) || null},
          ${cleanStr(r.department) || null},
          ${cleanStr(r.division) || null},
          ${parseDate(r.join_date)}, ${parseDate(r.dob)},
          ${parseSalary(r.basic_salary)},
          ${parseSalary(r.salary) || parseSalary(r.basic_salary)},
          ${cleanStr(r.address) || null},
          ${cleanStr(r.day_off) || "Sunday"},
          'full_time', 'self', 'self', false, now(), now()
        )
        ON CONFLICT DO NOTHING
        RETURNING id
      `;
      empMap.set(r.id, id);
      if (passport) passportIdx.set(passport, id);
      if (emirates) emiratesIdx.set(emirates, id);
      inserted++;
    }
    offset += PAGE;
    process.stdout.write(`\r  ${offset} rows processed — inserted: ${inserted}, skipped: ${skipped}`);
  }
  console.log(`\n  Done: ${inserted} inserted, ${skipped} mapped to existing`);
}

// ─── Phase 2: Employee Allowances ─────────────────────────────────────────────
async function migrateEmployeeAllowances(
  my: Awaited<ReturnType<typeof createPool>>,
  sql: postgres.Sql
) {
  console.log("\n── Phase 2: Employee Allowances ────────────────────────────");
  const [rows] = await my.query<any[]>(
    `SELECT employee_id, allowence_name, allowence_amount
     FROM emloyee_allowences
     WHERE allowence_name != '' AND allowence_amount > 0
     ORDER BY employee_id, id`
  );

  let inserted = 0, skipped = 0;
  const counters = new Map<string, number>(); // empUuid → sort_order counter

  for (const r of rows as any[]) {
    const empUuid = empMap.get(r.employee_id);
    if (!empUuid) { skipped++; continue; }
    const cnt = (counters.get(empUuid) ?? 0) + 1;
    counters.set(empUuid, cnt);
    await sql`
      INSERT INTO employee_allowances (id, employee_id, kind, label, amount, sort_order)
      VALUES (${randomUUID()}, ${empUuid}, 'allowance',
              ${cleanStr(r.allowence_name)},
              ${parseSalary(r.allowence_amount)}, ${cnt})
      ON CONFLICT DO NOTHING
    `;
    inserted++;
  }
  console.log(`  Done: ${inserted} inserted, ${skipped} skipped (employee not migrated)`);
}

// ─── Phase 3: CHSC Packages ───────────────────────────────────────────────────
async function migrateChscPackages(
  my: Awaited<ReturnType<typeof createPool>>,
  sql: postgres.Sql
) {
  console.log("\n── Phase 3: CHSC Packages ──────────────────────────────────");
  const [rows] = await my.query<any[]>(
    `SELECT id, name, type, minor, major, cylinder, mileage, cost, solo_count, terms
     FROM chsc_packages ORDER BY id`
  );

  let inserted = 0, skipped = 0;
  for (const r of rows as any[]) {
    const code = `CHSC-PKG-${String(r.id).padStart(4, "0")}`;

    // Check if already migrated (partial index can't be used in ON CONFLICT)
    const existing = await sql<{ id: string }[]>`
      SELECT id FROM service_contract_packages
      WHERE company_id = ${COMPANY_ID} AND legacy_package_id = ${r.id}
      LIMIT 1
    `;
    if (existing.length) {
      pkgMap.set(r.id, existing[0].id);
      skipped++;
      continue;
    }

    const id = randomUUID();
    await sql`
      INSERT INTO service_contract_packages (
        id, company_id, legacy_package_id, code, name, plan_type,
        cylinder, mileage_limit, minor_count, major_count,
        base_price, solo_count, terms, is_active, created_at, updated_at
      ) VALUES (
        ${id}, ${COMPANY_ID}, ${r.id}, ${code},
        ${cleanStr(r.name)},
        ${cleanStr(r.type) || null},
        ${r.cylinder ?? null}, ${r.mileage ?? null},
        ${r.minor ?? 0}, ${r.major ?? 0},
        ${parseSalary(r.cost)},
        ${r.solo_count != null ? parseSalary(r.solo_count) : null},
        ${cleanStr(r.terms) || null},
        true, now(), now()
      )
    `;
    const returnedId = id;
    pkgMap.set(r.id, returnedId);
    inserted++;
  }
  console.log(`  Done: ${inserted} packages, ${skipped} skipped`);
}

// ─── Phase 4: Customers ───────────────────────────────────────────────────────
async function migrateCustomers(
  my: Awaited<ReturnType<typeof createPool>>,
  sql: postgres.Sql
) {
  console.log("\n── Phase 4: Customers ──────────────────────────────────────");
  const startN = await maxCode(sql, "customers", "CUS");
  const nextCode = makeCounter("CUS", startN);

  // Pre-load existing customers by phone for deduplication against ERP-native records
  const existingByPhone = new Map<string, string>(); // normalised phone → UUID
  const existingRows = await sql<{ id: string; phone: string | null }[]>`
    SELECT id, phone FROM customers WHERE company_id = ${COMPANY_ID} AND phone IS NOT NULL
  `;
  for (const e of existingRows) {
    if (e.phone) existingByPhone.set(e.phone.trim().replace(/\D/g, ""), e.id);
  }
  console.log(`  Existing customers loaded: ${existingByPhone.size}`);

  let offset = 0, inserted = 0, skipped = 0;
  while (true) {
    const [rows] = await my.query<any[]>(
      `SELECT id, name, phone, phone2, email, type, status, wallet_amount
       FROM customers LIMIT ? OFFSET ?`,
      [PAGE, offset]
    );
    if (!(rows as any[]).length) break;

    for (const r of rows as any[]) {
      const phone = cleanStr(r.phone) || null;
      const phoneNorm = phone ? phone.replace(/\D/g, "") : null;

      // Deduplicate: if a customer with same phone already exists, map and skip
      if (phoneNorm && existingByPhone.has(phoneNorm)) {
        custMap.set(r.id, existingByPhone.get(phoneNorm)!);
        skipped++;
        continue;
      }

      const id = randomUUID();
      const { first, last } = splitName(cleanStr(r.name) || "Unknown");
      const custType = cleanStr(r.type).toLowerCase().includes("corp") ? "corporate" : "individual";

      const res = await sql`
        INSERT INTO customers (
          id, company_id, customer_type, code, name,
          first_name, last_name, phone, phone_alt, email,
          is_active, created_at, updated_at
        ) VALUES (
          ${id}, ${COMPANY_ID}, ${custType}, ${nextCode()},
          ${cleanStr(r.name) || "Unknown"},
          ${first}, ${last}, ${phone},
          ${cleanStr(r.phone2) || null},
          ${cleanStr(r.email) || null},
          true, now(), now()
        )
        ON CONFLICT DO NOTHING
        RETURNING id
      `;
      const returnedId = row0<{ id: string }>(res as unknown as { id: string }[])?.id;
      if (!returnedId) { skipped++; continue; } // code conflict on re-run
      custMap.set(r.id, returnedId);
      if (phoneNorm) existingByPhone.set(phoneNorm, returnedId);

      // Seed wallet balance as a single transaction if > 0
      const wallet = parseSalary(r.wallet_amount);
      if (wallet > 0) {
        await sql`
          INSERT INTO customer_wallet_transactions (
            id, company_id, customer_id, amount, payment_method,
            payment_date, notes, created_at, updated_at
          ) VALUES (
            ${randomUUID()}, ${COMPANY_ID}, ${returnedId}, ${wallet},
            'migration_balance', current_date, 'Opening balance from CarGuru v2', now(), now()
          )
          ON CONFLICT DO NOTHING
        `;
      }
      inserted++;
    }
    offset += PAGE;
    process.stdout.write(`\r  ${offset} rows processed — inserted: ${inserted}, skipped: ${skipped}`);
  }
  console.log(`\n  Done: ${inserted} customers inserted, ${skipped} skipped (duplicate phone or re-run)`);
}

// ─── Phase 5: Cars + customer_car_links ────────────────���──────────────────────
async function migrateCars(
  my: Awaited<ReturnType<typeof createPool>>,
  sql: postgres.Sql
) {
  console.log("\n── Phase 5: Cars + customer_car_links ──────────────────────");
  const startN = await maxCode(sql, "cars", "CAR");
  const nextCode = makeCounter("CAR", startN);

  let offset = 0, inserted = 0, linked = 0, skipped = 0;
  while (true) {
    const [rows] = await my.query<any[]>(
      `SELECT id, account_id, car_plate, car_make, car_model, car_year,
              car_vin, reg_expiry
       FROM cars LIMIT ? OFFSET ?`,
      [PAGE, offset]
    );
    if (!(rows as any[]).length) break;

    for (const r of rows as any[]) {
      const id = randomUUID();
      const plate = cleanStr(r.car_plate) || `UNKNOWN-${r.id}`;

      const res = await sql`
        INSERT INTO cars (
          id, company_id, code, plate_number, vin,
          make, model, model_year, registration_expiry,
          is_active, created_at, updated_at
        ) VALUES (
          ${id}, ${COMPANY_ID}, ${nextCode()}, ${plate},
          ${cleanStr(r.car_vin) || null},
          ${cleanStr(r.car_make) || null},
          ${cleanStr(r.car_model) || null},
          ${r.car_year ? parseInt(String(r.car_year)) : null},
          ${parseDate(r.reg_expiry)},
          true, now(), now()
        )
        ON CONFLICT DO NOTHING
        RETURNING id
      `;
      const returnedId = row0<{ id: string }>(res as unknown as { id: string }[])?.id;
      if (!returnedId) { skipped++; continue; } // car already exists (ON CONFLICT), skip
      carMap.set(r.id, returnedId);

      // Link to customer — guard against custUuid pointing to a deleted customer
      const custUuid = custMap.get(r.account_id);
      if (custUuid) {
        try {
          await sql`
            INSERT INTO customer_car_links (
              id, company_id, customer_id, car_id,
              relation_type, is_primary, created_at, updated_at
            ) VALUES (
              ${randomUUID()}, ${COMPANY_ID}, ${custUuid}, ${returnedId},
              'owner', true, now(), now()
            )
            ON CONFLICT DO NOTHING
          `;
          linked++;
        } catch {
          // custUuid no longer in customers table — skip link silently
        }
      }
      inserted++;
    }
    offset += PAGE;
    process.stdout.write(`\r  ${offset} rows processed — inserted: ${inserted}, linked: ${linked}`);
  }
  console.log(`\n  Done: ${inserted} cars, ${linked} customer links`);
}

// ─── Phase 6: Leads ───────────────────────────────────────────────────────────
async function migrateLeads(
  my: Awaited<ReturnType<typeof createPool>>,
  sql: postgres.Sql
) {
  console.log("\n── Phase 6: Leads ──────────────────────────────────────────");

  // Build name→employee_id index for advisor lookup
  const empByName = new Map<string, string>();
  const empRows = await sql<{ id: string; full_name: string }[]>`
    SELECT id, full_name FROM employees WHERE company_id = ${COMPANY_ID}
  `;
  for (const e of empRows) {
    empByName.set(e.full_name.trim().toLowerCase(), e.id);
  }

  let offset = 0, inserted = 0;
  while (true) {
    const [rows] = await my.query<any[]>(
      `SELECT id, account_id, car_id, type, status, source, advisor, date_created
       FROM leads LIMIT ? OFFSET ?`,
      [PAGE, offset]
    );
    if (!(rows as any[]).length) break;

    for (const r of rows as any[]) {
      const id = randomUUID();
      const custUuid = custMap.get(r.account_id) ?? null;
      const carUuid = carMap.get(r.car_id) ?? null;
      const agentUuid = empByName.get(cleanStr(r.advisor).toLowerCase()) ?? null;
      const leadType = mapLeadType(String(r.type ?? ""));
      const leadStatus = mapLeadStatus(String(r.status ?? ""));
      const createdAt = r.date_created ? new Date(r.date_created).toISOString() : new Date().toISOString();

      const res = await sql`
        INSERT INTO leads (
          id, company_id, customer_id, car_id, agent_employee_id,
          lead_type, lead_status, lead_stage, source,
          created_at, updated_at
        ) VALUES (
          ${id}, ${COMPANY_ID}, ${custUuid}, ${carUuid}, ${agentUuid},
          ${leadType}, ${leadStatus}, ${leadStatus},
          ${cleanStr(r.source) || null},
          ${createdAt}, ${createdAt}
        )
        ON CONFLICT DO NOTHING
        RETURNING id
      `;
      const returnedId = row0<{ id: string }>(res as unknown as { id: string }[])?.id ?? id;
      leadMap.set(r.id, returnedId);
      inserted++;
    }
    offset += PAGE;
    process.stdout.write(`\r  ${offset} rows processed — inserted: ${inserted}`);
  }
  console.log(`\n  Done: ${inserted} leads`);
}

// ─── Phase 7: Inspections ─────────────────────────────────────────────────────
async function migrateInspections(
  my: Awaited<ReturnType<typeof createPool>>,
  sql: postgres.Sql
) {
  console.log("\n── Phase 7: Inspections ────────────────────────────────────");
  let offset = 0, inserted = 0, skipped = 0;

  while (true) {
    const [rows] = await my.query<any[]>(
      `SELECT id, lead_id, car_id, engine, gear, brakes, suspension, battery,
              lead_remarks, inspector_remarks, inspector_name, status, date_created
       FROM inspections LIMIT ? OFFSET ?`,
      [PAGE, offset]
    );
    if (!(rows as any[]).length) break;

    for (const r of rows as any[]) {
      const leadUuid = leadMap.get(r.lead_id);
      if (!leadUuid) { skipped++; continue; }
      if (inspMap.has(r.lead_id)) { skipped++; continue; } // already created as stub

      const id = randomUUID();
      const carUuid = carMap.get(r.car_id) ?? null;
      const score = (v: unknown) => {
        const n = parseInt(String(v ?? "0"));
        return isNaN(n) ? null : Math.min(100, Math.max(0, n));
      };
      const createdAt = r.date_created ? new Date(r.date_created).toISOString() : new Date().toISOString();

      await sql`
        INSERT INTO inspections (
          id, company_id, lead_id, car_id,
          health_engine, health_transmission, health_brakes, health_suspension, health_electrical,
          overall_health, inspector_remark, agent_remark,
          status, created_at, updated_at
        ) VALUES (
          ${id}, ${COMPANY_ID}, ${leadUuid}, ${carUuid},
          ${score(r.engine)}, ${score(r.gear)}, ${score(r.brakes)},
          ${score(r.suspension)}, ${score(r.battery)},
          ${score(r.engine)},
          ${cleanStr(r.inspector_remarks) || null},
          ${cleanStr(r.lead_remarks) || null},
          ${mapInspStatus(String(r.status ?? ""))},
          ${createdAt}, ${createdAt}
        )
        ON CONFLICT DO NOTHING
        RETURNING id
      `;
      inspMap.set(r.lead_id, id);
      inserted++;
    }
    offset += PAGE;
    process.stdout.write(`\r  ${offset} rows processed — inserted: ${inserted}, skipped: ${skipped}`);
  }
  console.log(`\n  Done: ${inserted} inspections, ${skipped} skipped`);
}

// ─── Phase 8: Estimates + Work Orders ────────────────────────────────────────
async function migrateEstimates(
  my: Awaited<ReturnType<typeof createPool>>,
  sql: postgres.Sql
) {
  console.log("\n── Phase 8: Estimates + Work Orders ────────────────────────");
  let offset = 0, inserted = 0, skipped = 0;

  while (true) {
    const [rows] = await my.query<any[]>(
      `SELECT id, lead_id, car_id, account_id,
              total_cost, total_sale, total_discount, total_vat, grand_total,
              estimate_status, date_created
       FROM estimates LIMIT ? OFFSET ?`,
      [PAGE, offset]
    );
    if (!(rows as any[]).length) break;

    for (const r of rows as any[]) {
      const leadUuid = leadMap.get(r.lead_id) ?? null;
      const carUuid = carMap.get(r.car_id) ?? null;
      const custUuid = custMap.get(r.account_id) ?? null;

      // Ensure inspection exists
      const inspUuid = await ensureInspection(sql, r.lead_id, leadUuid ?? undefined, carUuid ?? undefined, custUuid ?? undefined);

      const estId = randomUUID();
      const status = cleanStr(r.estimate_status) || "approved";
      const grandTotal = parseSalary(r.grand_total);
      const totalSale = parseSalary(r.total_sale);
      const totalDiscount = parseSalary(r.total_discount);
      const vatAmount = parseSalary(r.total_vat);
      const finalPrice = totalSale - totalDiscount;
      const createdAt = r.date_created ? new Date(r.date_created).toISOString() : new Date().toISOString();

      const res = await sql`
        INSERT INTO estimates (
          id, company_id, inspection_id, lead_id, car_id, customer_id,
          status, vat_rate, total_cost, total_sale, total_discount,
          final_price, vat_amount, grand_total,
          created_at, updated_at
        ) VALUES (
          ${estId}, ${COMPANY_ID}, ${inspUuid}, ${leadUuid}, ${carUuid}, ${custUuid},
          ${status}, 5.00,
          ${parseSalary(r.total_cost)}, ${totalSale}, ${totalDiscount},
          ${finalPrice > 0 ? finalPrice : grandTotal},
          ${vatAmount}, ${grandTotal},
          ${createdAt}, ${createdAt}
        )
        ON CONFLICT DO NOTHING
        RETURNING id
      `;
      const estUuid = row0<{ id: string }>(res as unknown as { id: string }[])?.id ?? estId;
      estMap.set(r.id, estUuid);

      // Create work order for this estimate
      const wrkId = randomUUID();
      await sql`
        INSERT INTO work_orders (
          id, company_id, estimate_id, lead_id, car_id, customer_id,
          status, created_at, updated_at
        ) VALUES (
          ${wrkId}, ${COMPANY_ID}, ${estUuid}, ${leadUuid}, ${carUuid}, ${custUuid},
          'completed', ${createdAt}, ${createdAt}
        )
        ON CONFLICT DO NOTHING
      `;
      wrkMap.set(r.id, wrkId);
      inserted++;
    }
    offset += PAGE;
    process.stdout.write(`\r  ${offset} rows processed — inserted: ${inserted}, skipped: ${skipped}`);
  }
  console.log(`\n  Done: ${inserted} estimates + work_orders`);
}

// ─── Phase 9: Estimate Items (from source line_items) ─────────────────────────
async function migrateEstimateItems(
  my: Awaited<ReturnType<typeof createPool>>,
  sql: postgres.Sql
) {
  console.log("\n── Phase 9: Estimate Items ─────────────────────────────────");
  let offset = 0, inserted = 0, skipped = 0;

  while (true) {
    const [rows] = await my.query<any[]>(
      `SELECT id, estimate_id, lead_id, name, type, quantity, cost, sale, discount, status
       FROM line_items
       WHERE estimate_id IS NOT NULL AND estimate_id != 0
         AND (date_deleted IS NULL OR date_deleted = '0000-00-00 00:00:00')
       LIMIT ? OFFSET ?`,
      [PAGE, offset]
    );
    if (!(rows as any[]).length) break;

    // Group by estimate to assign line_no
    const lineCounters = new Map<string, number>();

    for (const r of rows as any[]) {
      const estUuid = estMap.get(r.estimate_id);
      if (!estUuid) { skipped++; continue; }

      const lineNo = (lineCounters.get(estUuid) ?? 0) + 1;
      lineCounters.set(estUuid, lineNo);

      const partName = cleanStr(r.name) || "Part";
      const qty = parseSalary(r.quantity) || 1;
      const cost = parseSalary(r.cost);
      const sale = parseSalary(r.sale);

      await sql`
        INSERT INTO estimate_items (
          id, estimate_id, line_no, part_name,
          type, quantity, cost, sale, status,
          created_at, updated_at
        ) VALUES (
          ${randomUUID()}, ${estUuid}, ${lineNo}, ${partName},
          ${cleanStr(r.type) || "genuine"},
          ${qty}, ${cost}, ${sale},
          ${cleanStr(r.status) || "pending".toLowerCase() || "pending"},
          now(), now()
        )
        ON CONFLICT DO NOTHING
      `;
      inserted++;
    }
    offset += PAGE;
    process.stdout.write(`\r  ${offset} rows processed — inserted: ${inserted}, skipped: ${skipped}`);
  }
  console.log(`\n  Done: ${inserted} estimate items`);
}

// ─── Phase 10: Invoices ───────────────────────────────────────────────────────
async function migrateInvoices(
  my: Awaited<ReturnType<typeof createPool>>,
  sql: postgres.Sql
) {
  console.log("\n── Phase 10: Invoices ──────────────────────────────────────");
  // Source: estimates WHERE estimate_status = 'Invoiced' — these are the actual invoices in CarGuru v2.
  // The empty `invoices` table is unused; invoice fields (invoice_status, invoice_date, payment_mode)
  // live directly on the estimate row.

  let offset = 0, inserted = 0, skipped = 0;
  while (true) {
    const [rows] = await my.query<any[]>(
      `SELECT id, lead_id, account_id, car_id,
              total_sale, total_discount, total_vat, grand_total,
              invoice_status, payment_mode, invoice_date, payment_date, date_created
       FROM estimates WHERE estimate_status = 'Invoiced' LIMIT ? OFFSET ?`,
      [PAGE, offset]
    );
    if (!(rows as any[]).length) break;

    for (const r of rows as any[]) {
      const leadUuid = leadMap.get(r.lead_id) ?? null;
      const carUuid = carMap.get(r.car_id) ?? null;
      const custUuid = custMap.get(r.account_id) ?? null;

      // The estimate row IS the invoice — look up its work_order directly
      let wrkUuid: string | null = wrkMap.get(r.id) ?? null;

      // If no work_order, fabricate the chain
      if (!wrkUuid) {
        const inspUuid = await ensureInspection(sql, r.lead_id, leadUuid ?? undefined, carUuid ?? undefined, custUuid ?? undefined);
        const estUuid = await ensureEstimate(sql, r.lead_id, inspUuid, leadUuid ?? undefined, carUuid ?? undefined, custUuid ?? undefined);
        const stubEstKey = -r.lead_id;
        wrkUuid = await ensureWorkOrder(sql, estUuid, stubEstKey, leadUuid ?? undefined, carUuid ?? undefined, custUuid ?? undefined);
      }

      const totalSale = parseSalary(r.total_sale);
      const totalDiscount = parseSalary(r.total_discount);
      const vatAmount = parseSalary(r.total_vat);
      const grandTotal = parseSalary(r.grand_total);
      const finalAmount = totalSale - totalDiscount;
      const isPaid = cleanStr(r.invoice_status).toLowerCase() === "paid";
      const invDate = parseDate(r.invoice_date) ?? parseDate(r.date_created) ?? new Date().toISOString().slice(0, 10);
      const createdAt = r.date_created ? new Date(r.date_created).toISOString() : new Date().toISOString();
      const invNumber = `INV-${String(r.id).padStart(8, "0")}`;
      // Link back to the ERP estimate UUID so the legacy_invoiced_estimates dedup join works
      const estUuid = estMap.get(r.id) ?? null;

      const res = await sql`
        INSERT INTO invoices (
          id, company_id, work_order_id, estimate_id, lead_id, car_id, customer_id,
          invoice_number, invoice_date, status, payment_method,
          paid_at, due_date,
          total_sale, total_discount, final_amount,
          vat_rate, vat_amount, grand_total,
          created_at, updated_at
        ) VALUES (
          ${randomUUID()}, ${COMPANY_ID}, ${wrkUuid}, ${estUuid}, ${leadUuid}, ${carUuid}, ${custUuid},
          ${invNumber}, ${invDate},
          ${isPaid ? "paid" : "draft"},
          ${cleanStr(r.payment_mode) || null},
          ${isPaid && r.payment_date ? new Date(r.payment_date).toISOString() : null},
          ${parseDate(r.payment_date)},
          ${totalSale}, ${totalDiscount},
          ${finalAmount > 0 ? finalAmount : grandTotal},
          5.00, ${vatAmount}, ${grandTotal},
          ${createdAt}, ${createdAt}
        )
        ON CONFLICT (company_id, invoice_number) DO NOTHING
        RETURNING id
      `;
      const invUuid = row0<{ id: string }>(res as unknown as { id: string }[])?.id;
      if (invUuid) { invMap.set(r.id, invUuid); inserted++; } else { skipped++; }
    }
    offset += PAGE;
    process.stdout.write(`\r  ${offset} rows processed — inserted: ${inserted}, skipped: ${skipped}`);
  }
  console.log(`\n  Done: ${inserted} invoices, ${skipped} skipped (already existed)`);
}

// ─── Phase 11: Line Items (inspection-scoped) ─────────────────────────────────
async function migrateLineItems(
  my: Awaited<ReturnType<typeof createPool>>,
  sql: postgres.Sql
) {
  console.log("\n── Phase 11: Line Items ────────────────────────────────────");
  let offset = 0, inserted = 0, skipped = 0;

  while (true) {
    const [rows] = await my.query<any[]>(
      `SELECT id, lead_id, account_id, name, type, description, quantity, status, date_created
       FROM line_items
       WHERE (estimate_id IS NULL OR estimate_id = 0)
         AND (date_deleted IS NULL OR date_deleted = '0000-00-00 00:00:00')
         AND lead_id IS NOT NULL AND lead_id != 0
       LIMIT ? OFFSET ?`,
      [PAGE, offset]
    );
    if (!(rows as any[]).length) break;

    for (const r of rows as any[]) {
      const leadUuid = leadMap.get(r.lead_id) ?? null;
      const custUuid = custMap.get(r.account_id) ?? null;

      // Ensure inspection exists for this lead
      let inspUuid = inspMap.get(r.lead_id);
      if (!inspUuid) {
        inspUuid = await ensureInspection(sql, r.lead_id, leadUuid ?? undefined, undefined, custUuid ?? undefined);
      }

      const createdAt = r.date_created ? new Date(r.date_created).toISOString() : new Date().toISOString();

      await sql`
        INSERT INTO line_items (
          id, company_id, lead_id, inspection_id,
          product_name, description, quantity, reason, status,
          created_at, updated_at
        ) VALUES (
          ${randomUUID()}, ${COMPANY_ID}, ${leadUuid}, ${inspUuid},
          ${cleanStr(r.name) || null},
          ${cleanStr(r.description) || null},
          ${parseInt(String(r.quantity ?? "1")) || 1},
          ${cleanStr(r.type) || null},
          ${cleanStr(r.status) || "Pending"},
          ${createdAt}, ${createdAt}
        )
        ON CONFLICT DO NOTHING
      `;
      inserted++;
    }
    offset += PAGE;
    process.stdout.write(`\r  ${offset} rows processed — inserted: ${inserted}, skipped: ${skipped}`);
  }
  console.log(`\n  Done: ${inserted} line items`);
}

// ─── Phase 12: Transactions → customer_wallet_transactions ────────────────────
async function migrateTransactions(
  my: Awaited<ReturnType<typeof createPool>>,
  sql: postgres.Sql
) {
  console.log("\n── Phase 12: Transactions ──────────────────────────────────");
  let offset = 0, inserted = 0, skipped = 0;

  while (true) {
    const [rows] = await my.query<any[]>(
      `SELECT id, account_id, payment_mode, payment_amount, pay_date,
              direction, verified, remarks, date_created
       FROM transactions
       WHERE deleted = 0
       LIMIT ? OFFSET ?`,
      [PAGE, offset]
    );
    if (!(rows as any[]).length) break;

    for (const r of rows as any[]) {
      const custUuid = custMap.get(r.account_id);
      if (!custUuid) { skipped++; continue; }

      const amount = parseSalary(r.payment_amount);
      // Outbound/debit → negative amount
      const dir = cleanStr(r.direction).toLowerCase();
      const signedAmount = (dir === "out" || dir === "debit") ? -amount : amount;
      const isApproved = true; // All historical CarGuru transactions are treated as approved
      const createdAt = r.date_created ? new Date(r.date_created).toISOString() : new Date().toISOString();

      await sql`
        INSERT INTO customer_wallet_transactions (
          id, company_id, customer_id, amount,
          payment_method, payment_date,
          approved_at, notes,
          created_at, updated_at
        ) VALUES (
          ${randomUUID()}, ${COMPANY_ID}, ${custUuid}, ${signedAmount},
          ${cleanStr(r.payment_mode) || null},
          ${parseDate(r.pay_date)},
          ${isApproved ? createdAt : null},
          ${cleanStr(r.remarks) || null},
          ${createdAt}, ${createdAt}
        )
        ON CONFLICT DO NOTHING
      `;
      inserted++;
    }
    offset += PAGE;
    process.stdout.write(`\r  ${offset} rows processed — inserted: ${inserted}, skipped: ${skipped}`);
  }
  console.log(`\n  Done: ${inserted} transactions, ${skipped} skipped (customer not found)`);
}

// ─── Phase 13: CHSC Service Contracts ────────────────────────────────────────
async function migrateChscContracts(
  my: Awaited<ReturnType<typeof createPool>>,
  sql: postgres.Sql
) {
  console.log("\n── Phase 13: CHSC Service Contracts ───────────────────────");
  const [rows] = await my.query<any[]>(
    `SELECT id, account_id, car_id, lead_id, invoice_id, package_id,
            package_cost, discount, package_summary,
            major, minor, status, chsc_status, active,
            advisor, emirates, car_plate, pay_mode, date_sold, date_created
     FROM chsc_customers ORDER BY id`
  );

  let inserted = 0, skipped = 0;
  for (const r of rows as any[]) {
    const pkgUuid = pkgMap.get(r.package_id);
    if (!pkgUuid) { skipped++; continue; } // package not found

    const custUuid = custMap.get(r.account_id) ?? null;
    const carUuid = carMap.get(r.car_id) ?? null;
    const leadUuid = leadMap.get(r.lead_id) ?? null;
    const invUuid = invMap.get(r.invoice_id) ?? null;

    const packageCost = parseSalary(r.package_cost);
    const discount = parseSalary(r.discount);
    const finalAmount = packageCost - discount;
    const contractStatus = mapContractStatus(String(r.status ?? ""), r.active);
    const soldAt = parseDate(r.date_sold);
    const createdAt = parseDate(r.date_created) ?? new Date().toISOString().slice(0, 10);

    // Check if already migrated (partial index can't be used in ON CONFLICT)
    const existingContract = await sql<{ id: string }[]>`
      SELECT id FROM service_contracts
      WHERE company_id = ${COMPANY_ID} AND legacy_chsc_customer_id = ${r.id}
      LIMIT 1
    `;
    if (existingContract.length) {
      contractMap.set(`${r.account_id}:${r.car_id}:${r.package_id}`, existingContract[0].id);
      skipped++;
      continue;
    }

    const contractId = randomUUID();
    await sql`
      INSERT INTO service_contracts (
        id, company_id, customer_id, car_id, lead_id, invoice_id,
        package_id, legacy_chsc_customer_id, legacy_account_id, legacy_car_id,
        legacy_lead_id, legacy_invoice_id,
        status, chsc_status, active,
        package_summary, minor_quota, major_quota,
        package_price, discount_amount, final_amount,
        sold_at, payment_mode, advisor_name, region, car_plate,
        created_at, updated_at
      ) VALUES (
        ${contractId}, ${COMPANY_ID}, ${custUuid}, ${carUuid}, ${leadUuid}, ${invUuid},
        ${pkgUuid}, ${r.id}, ${r.account_id}, ${r.car_id},
        ${r.lead_id}, ${r.invoice_id},
        ${contractStatus}, ${cleanStr(r.chsc_status) || null},
        ${r.active === 1 || r.active === "1"},
        ${cleanStr(r.package_summary) || null},
        ${r.minor ?? 0}, ${r.major ?? 0},
        ${packageCost}, ${discount}, ${finalAmount > 0 ? finalAmount : packageCost},
        ${soldAt}, ${cleanStr(r.pay_mode) || null},
        ${cleanStr(r.advisor) || null},
        ${cleanStr(r.emirates) || null},
        ${cleanStr(r.car_plate) || null},
        ${createdAt}, ${createdAt}
      )
    `;
    const retId = contractId;
    contractMap.set(`${r.account_id}:${r.car_id}:${r.package_id}`, retId);
    inserted++;
  }
  console.log(`  Done: ${inserted} contracts, ${skipped} skipped`);
}

// ─── Phase 14: CHSC Service Entitlements ─────────────────────────────────────
async function migrateChscEntitlements(
  my: Awaited<ReturnType<typeof createPool>>,
  sql: postgres.Sql
) {
  console.log("\n── Phase 14: CHSC Entitlements ─────────────────────────────");
  const [rows] = await my.query<any[]>(
    `SELECT id, account_id, car_id, package_id, service_type,
            service_mileage, service_date, date_created
     FROM chsc_services ORDER BY account_id, car_id, package_id, id`
  );

  let inserted = 0, skipped = 0;
  // Track sequence numbers per contract+kind
  const seqCounters = new Map<string, number>();

  for (const r of rows as any[]) {
    const contractKey = `${r.account_id}:${r.car_id}:${r.package_id}`;
    const contractUuid = contractMap.get(contractKey);
    if (!contractUuid) { skipped++; continue; }

    const kind = cleanStr(r.service_type).toLowerCase().includes("major") ? "major" : "minor";
    const seqKey = `${contractUuid}:${kind}`;
    const seqNo = (seqCounters.get(seqKey) ?? 0) + 1;
    seqCounters.set(seqKey, seqNo);

    // service_date present → consumed/done; null or 0000-00-00 → pending
    const serviceDate = parseDate(r.service_date);
    const isDone = !!serviceDate;
    const mileage = r.service_mileage ? parseInt(String(r.service_mileage)) : null;
    const entStatus = isDone ? "done" : "pending";
    const createdAt = parseDate(r.date_created) ?? new Date().toISOString().slice(0, 10);

    // Check if already migrated (partial index can't be used in ON CONFLICT)
    const existingEnt = await sql<{ id: string }[]>`
      SELECT id FROM service_contract_entitlements
      WHERE company_id = ${COMPANY_ID} AND legacy_service_id = ${r.id}
      LIMIT 1
    `;
    if (existingEnt.length) {
      // Fix status on existing rows in case of prior incorrect migration
      await sql`
        UPDATE service_contract_entitlements
        SET status       = ${entStatus},
            consumed_at  = ${isDone ? serviceDate : null},
            consumed_mileage = ${isDone ? mileage : null}
        WHERE company_id = ${COMPANY_ID} AND legacy_service_id = ${r.id}
      `;
      inserted++;
      continue;
    }

    await sql`
      INSERT INTO service_contract_entitlements (
        id, company_id, contract_id, service_kind, sequence_no,
        planned_mileage, planned_date, status,
        consumed_mileage, consumed_at,
        legacy_service_id, created_at, updated_at
      ) VALUES (
        ${randomUUID()}, ${COMPANY_ID}, ${contractUuid},
        ${kind}, ${seqNo},
        ${!isDone ? mileage : null},
        ${!isDone ? serviceDate : null},
        ${entStatus},
        ${isDone ? mileage : null},
        ${isDone ? serviceDate : null},
        ${r.id},
        ${createdAt}, ${createdAt}
      )
    `;
    inserted++;
  }
  console.log(`  Done: ${inserted} entitlements, ${skipped} skipped`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
async function main() {
  await loadEnvFromRoot();

  COMPANY_ID = process.env.TARGET_COMPANY_ID ?? "d32af79a-fdde-4052-a8f1-6bc69ba3544e";
  const mysqlUrl = process.env.SOURCE_MYSQL_URL;
  if (!mysqlUrl) throw new Error("SOURCE_MYSQL_URL is not set");

  console.log(`\n${"═".repeat(60)}`);
  console.log("  CarGuru v2 → Global ERP Migration");
  console.log(`  Company ID : ${COMPANY_ID}`);
  console.log(`  MySQL      : ${mysqlUrl.replace(/:([^@]+)@/, ":***@")}`);
  console.log(`${"═".repeat(60)}\n`);

  const sql = getSql();
  const mysqlCfg = parseMysqlUrl(mysqlUrl);
  const my = createPool({ ...mysqlCfg, waitForConnections: true, connectionLimit: 5, dateStrings: true });

  // Verify company exists
  const companyCheck = await sql<{ id: string; display_name: string }[]>`
    SELECT id, display_name FROM companies WHERE id = ${COMPANY_ID}
  `;
  if (!companyCheck.length) {
    throw new Error(`Company ${COMPANY_ID} not found in target DB. Run migrations first.`);
  }
  console.log(`Target company: "${companyCheck[0].display_name}"\n`);

  const t0 = Date.now();

  await migrateEmployees(my, sql);
  await migrateEmployeeAllowances(my, sql);
  await migrateChscPackages(my, sql);
  await migrateCustomers(my, sql);
  await migrateCars(my, sql);
  await migrateLeads(my, sql);
  await migrateInspections(my, sql);
  await migrateEstimates(my, sql);
  await migrateEstimateItems(my, sql);
  await migrateInvoices(my, sql);
  await migrateLineItems(my, sql);
  await migrateTransactions(my, sql);
  await migrateChscContracts(my, sql);
  await migrateChscEntitlements(my, sql);

  // Mark customers with service contracts as customer_type='CHSC'
  const chscUpdated = await sql`
    UPDATE customers c
    SET customer_type = 'CHSC'
    WHERE c.company_id = ${COMPANY_ID}
      AND EXISTS (
        SELECT 1 FROM service_contracts sc
        WHERE sc.company_id = ${COMPANY_ID} AND sc.customer_id = c.id
      )
      AND customer_type <> 'CHSC'
  `;
  console.log(`\n  CHSC customer_type updated: ${chscUpdated.count}`);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`\n${"═".repeat(60)}`);
  console.log("  Migration Complete");
  console.log(`  Time      : ${elapsed}s`);
  console.log(`  Stub insp : ${stubInspCount}`);
  console.log(`  Stub est  : ${stubEstCount}`);
  console.log(`  Stub wrkO : ${stubWrkCount}`);
  console.log(`${"═".repeat(60)}\n`);

  await my.end();
}

main()
  .catch((err) => {
    console.error("\nMigration failed:", err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });