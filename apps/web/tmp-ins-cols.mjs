import postgres from "postgres";
const sql = postgres("postgres://autoguru:autoguru@localhost:5432/global_erp_dev");
const cols = await sql`
  select column_name, data_type
  from information_schema.columns
  where table_schema='public' and table_name='insurance_data'
  order by ordinal_position
`;
console.log(cols);
await sql.end();
