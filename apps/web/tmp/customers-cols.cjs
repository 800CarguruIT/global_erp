const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL || 'postgres://autoguru:autoguru@localhost:5432/global_erp');
(async()=>{
  const rows = await sql`select column_name from information_schema.columns where table_name='customers' order by ordinal_position`;
  console.log(rows.map(r=>r.column_name).join(','));
  await sql.end({ timeout: 1 });
})();
