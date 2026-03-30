/* eslint-disable no-console */
/**
 * distribute-leads-to-advisors.ts
 *
 * Distributes all unlinked leads (agent_employee_id IS NULL) evenly
 * across Service Center Sales Department employees using round-robin.
 *
 * This is a quick fix for legacy data that was migrated without advisor mapping.
 * For production, use relink-lead-advisors.ts with MySQL access for accurate matching.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... pnpm --filter ai-core ts-node --transpile-only --compiler-options '{"module":"CommonJS"}' scripts/distribute-leads-to-advisors.ts
 */

import postgres from "postgres";

const COMPANY_ID = process.env.TARGET_COMPANY_ID ?? "d32af79a-fdde-4052-a8f1-6bc69ba3544e";

async function main() {
  const pgUrl = process.env.DATABASE_URL;
  if (!pgUrl) throw new Error("DATABASE_URL is required");

  const sql = postgres(pgUrl, { max: 3 });

  // Get SC advisors
  const advisors = await sql<{ id: string; full_name: string }[]>`
    SELECT e.id, e.full_name FROM employees e
    WHERE e.company_id = ${COMPANY_ID} AND e.department = 'Service Center Sales Department'
    ORDER BY e.full_name
  `;

  if (!advisors.length) {
    console.log("No Service Center Sales Department employees found!");
    await sql.end();
    return;
  }
  console.log(`Found ${advisors.length} advisors:`);
  advisors.forEach((a, i) => console.log(`  ${i + 1}. ${a.full_name}`));

  // Count unlinked leads
  const [{ count }] = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int as count FROM leads
    WHERE company_id = ${COMPANY_ID} AND agent_employee_id IS NULL
  `;
  console.log(`\n${count} unlinked leads to distribute`);

  if (count === 0) {
    console.log("Nothing to do!");
    await sql.end();
    return;
  }

  // Use a single SQL UPDATE with row_number to distribute round-robin
  console.log("\nDistributing leads round-robin across advisors...");

  // Build advisor array for SQL
  const advisorIds = advisors.map(a => a.id);

  // Process in batches of 10K for progress feedback
  const BATCH = 10000;
  let totalUpdated = 0;

  for (let i = 0; i < advisorIds.length; i++) {
    const empId = advisorIds[i];
    const advisorName = advisors[i].full_name;

    // Assign every Nth lead to this advisor using modulo
    const result = await sql`
      UPDATE leads SET agent_employee_id = ${empId}
      WHERE id IN (
        SELECT id FROM (
          SELECT id, (ROW_NUMBER() OVER (ORDER BY created_at))::int as rn
          FROM leads
          WHERE company_id = ${COMPANY_ID} AND agent_employee_id IS NULL
        ) sub
        WHERE (sub.rn % ${advisorIds.length}) = ${i}
      )
    `;

    const affected = (result as any).count ?? 0;
    totalUpdated += affected;
    console.log(`  ${advisorName}: ${affected} leads assigned`);
  }

  // Verify
  const [verify] = await sql<{ total: number; with_agent: number }[]>`
    SELECT COUNT(*)::int as total, COUNT(agent_employee_id)::int as with_agent
    FROM leads WHERE company_id = ${COMPANY_ID}
  `;
  console.log(`\n✅ Done! ${verify.with_agent} / ${verify.total} leads now have advisors`);

  await sql.end();
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
