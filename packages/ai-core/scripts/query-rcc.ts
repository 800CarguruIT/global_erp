import { getSql } from "../src/db";
async function main() {
  const sql = getSql();
  const cid = "d32af79a-fdde-4052-a8f1-6bc69ba3544e";
  const cols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='employees' ORDER BY ordinal_position`;
  for (const c of cols) console.log(`  ${c.column_name} (${c.data_type})`);
  const stats = await sql`SELECT status, COUNT(*)::int as cnt FROM employees WHERE company_id=${cid} AND department='RSA Sales Department' GROUP BY status`;
  console.log("\nRSA Sales by status:", stats);
  const active = await sql`SELECT id, full_name, status FROM employees WHERE company_id=${cid} AND department='RSA Sales Department' AND status='active' ORDER BY full_name LIMIT 30`;
  console.log("\nActive RSA Sales agents:", active.length);
  for (const r of active) console.log(`  ${r.full_name} (status=${r.status})`);
  await sql.end();
}
main().catch(e => { console.error(e); process.exit(1); });
