const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL || 'postgres://autoguru:autoguru@localhost:5432/global_erp');
(async()=>{
  const id = '9c9c2623-1543-4996-bd49-0e1596db00db';
  const rows = await sql`select id, company_id, inquiry_status, updated_at, ai_payload from call_ai_inquiries where id = ${id} limit 1`;
  console.log(JSON.stringify(rows[0] || null, null, 2));
  await sql.end({ timeout: 1 });
})();
