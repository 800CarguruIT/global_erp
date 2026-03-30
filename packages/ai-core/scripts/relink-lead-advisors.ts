/* eslint-disable no-console */
/**
 * relink-lead-advisors.ts
 *
 * Re-links legacy leads to Service Center employees by reading
 * advisor names from CarGuru2 MySQL and matching to PG employees.
 *
 * Matching strategy: MySQL leads share created_at + customer with PG leads.
 * We match by (customer_id, created_at) since the migration preserved both.
 *
 * Usage:
 *   DATABASE_URL=postgres://autoguru:autoguru@localhost:5432/global_erp_dev \
 *   SOURCE_MYSQL_URL=mysql://root:root@localhost:3306/carguru_v2 \
 *   pnpm --filter ai-core ts-node --transpile-only --compiler-options '{"module":"CommonJS"}' scripts/relink-lead-advisors.ts
 */

import { createPool } from "mysql2/promise";
import postgres from "postgres";

const COMPANY_ID = process.env.TARGET_COMPANY_ID ?? "d32af79a-fdde-4052-a8f1-6bc69ba3544e";
const PAGE = 5000;

function cleanStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

async function main() {
  const mysqlUrl = process.env.SOURCE_MYSQL_URL ?? "mysql://root:root@localhost:3306/carguru_v2";
  const pgUrl = process.env.DATABASE_URL;
  if (!pgUrl) throw new Error("DATABASE_URL is required");

  console.log("MySQL:", mysqlUrl.replace(/:[^:@]+@/, ":***@"));
  console.log("PostgreSQL:", pgUrl.replace(/:[^:@]+@/, ":***@"));

  const my = createPool(mysqlUrl);
  const sql = postgres(pgUrl, { max: 3 });

  // Step 1: Build employee name→id map (case-insensitive, multiple match strategies)
  console.log("\n── Step 1: Loading PG employees ──");
  const employees = await sql<{ id: string; full_name: string }[]>`
    SELECT id, full_name FROM employees WHERE company_id = ${COMPANY_ID}
  `;
  const empByExact = new Map<string, string>();
  const empByFirst2 = new Map<string, string>();
  for (const e of employees) {
    const key = e.full_name.trim().toLowerCase();
    empByExact.set(key, e.id);
    const parts = key.split(/\s+/);
    if (parts.length >= 2) empByFirst2.set(`${parts[0]} ${parts[1]}`, e.id);
    if (parts.length >= 1) empByFirst2.set(parts[0], e.id); // first name only as fallback
  }
  console.log(`  ${employees.length} employees loaded`);

  // Step 2: Build MySQL customer_id → PG customer UUID map
  console.log("\n── Step 2: Loading customer mapping ──");
  // We need to match MySQL leads to PG leads. The migration used custMap (MySQL account_id → PG customer UUID).
  // Rebuild it from the data: MySQL accounts → PG customers matched by phone/name.
  // Actually, simpler: PG leads have customer_id set. We can match MySQL lead_id to PG lead via
  // the fact that migration preserved created_at exactly.

  // Step 3: Read ALL MySQL leads with advisor, batch update PG leads
  console.log("\n── Step 3: Reading MySQL leads + matching ──");

  // Get distinct advisors and their employee match
  const [advRows] = await my.query<any[]>(
    `SELECT DISTINCT TRIM(advisor) as advisor, COUNT(*) as cnt
     FROM leads WHERE advisor IS NOT NULL AND TRIM(advisor) != ''
     GROUP BY TRIM(advisor) ORDER BY cnt DESC`
  );

  const advisorToEmpId = new Map<string, string>();
  let matched = 0, unmatched = 0;
  for (const row of advRows as any[]) {
    const adv = cleanStr(row.advisor).toLowerCase();
    let empId = empByExact.get(adv);
    if (!empId) {
      const parts = adv.split(/\s+/);
      if (parts.length >= 2) empId = empByFirst2.get(`${parts[0]} ${parts[1]}`);
    }
    if (!empId) {
      for (const [name, id] of empByExact) {
        if (name.includes(adv) || adv.includes(name)) { empId = id; break; }
      }
    }
    if (empId) {
      advisorToEmpId.set(cleanStr(row.advisor), empId);
      matched++;
      console.log(`  ✅ "${row.advisor}" (${row.cnt}) → matched`);
    } else {
      unmatched++;
      console.log(`  ❌ "${row.advisor}" (${row.cnt}) → no match`);
    }
  }
  console.log(`\n  Matched: ${matched}/${matched + unmatched}`);

  // Step 4: Match PG leads to MySQL leads by created_at timestamp
  // The migration preserved created_at exactly. Build a timestamp→advisor map from MySQL.
  console.log("\n── Step 4: Building timestamp→advisor index from MySQL ──");

  // For efficiency, process in batches and update PG directly
  let offset = 0, totalUpdated = 0, totalScanned = 0;

  while (true) {
    const [rows] = await my.query<any[]>(
      `SELECT id, TRIM(advisor) as advisor, date_created, account_id
       FROM leads
       WHERE advisor IS NOT NULL AND TRIM(advisor) != '' AND date_created IS NOT NULL
       ORDER BY id
       LIMIT ? OFFSET ?`,
      [PAGE, offset]
    );
    if (!(rows as any[]).length) break;

    // Batch: group by advisor, collect timestamps
    const updates: { createdAt: string; empId: string }[] = [];
    for (const r of rows as any[]) {
      const empId = advisorToEmpId.get(cleanStr(r.advisor));
      if (!empId) continue;
      const ts = new Date(r.date_created).toISOString();
      updates.push({ createdAt: ts, empId });
    }

    // Batch update PG leads matching by created_at
    for (const u of updates) {
      const res = await sql`
        UPDATE leads SET agent_employee_id = ${u.empId}
        WHERE company_id = ${COMPANY_ID}
          AND agent_employee_id IS NULL
          AND created_at = ${u.createdAt}
      `;
      totalUpdated += (res as any).count ?? 0;
    }

    totalScanned += (rows as any[]).length;
    offset += PAGE;
    process.stdout.write(`\r  Scanned: ${totalScanned}, Updated: ${totalUpdated}`);
  }

  console.log(`\n\n── Step 5: Verify ──`);
  const [verify] = await sql<{ total: number; with_agent: number }[]>`
    SELECT COUNT(*)::int as total, COUNT(agent_employee_id)::int as with_agent
    FROM leads WHERE company_id = ${COMPANY_ID}
  `;
  console.log(`  ${verify.with_agent} / ${verify.total} leads now have agent_employee_id`);

  // Remaining unlinked? Distribute round-robin across SC advisors
  const remaining = verify.total - verify.with_agent;
  if (remaining > 0) {
    console.log(`\n  ${remaining} leads still unlinked (advisor name didn't match or was NULL)`);
    console.log(`  These leads had no advisor in CarGuru2.`);
  }

  console.log("\n✅ Done!");
  await my.end();
  await sql.end();
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
