import postgres from "postgres";
async function main() {
const sql = postgres("postgres://autoguru:autoguru@localhost:5432/global_erp_dev");
const rows = await sql`
  SELECT cr.url, cr.duration_seconds, cs.provider_call_id, cr.created_at
  FROM call_recordings cr
  JOIN call_sessions cs ON cs.id = cr.call_session_id
  WHERE cs.company_id = 'd32af79a-fdde-4052-a8f1-6bc69ba3544e'
  ORDER BY cr.created_at DESC LIMIT 5
`;
for (const r of rows) {
  console.log(r.provider_call_id, "|", r.url, "|", r.duration_seconds, "|", r.created_at);
}
if (!rows.length) console.log("No recordings found");
await sql.end();
}
main();
