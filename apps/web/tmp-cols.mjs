import postgres from "postgres";
const sql = postgres("postgres://autoguru:autoguru@localhost:5432/global_erp_dev");
const cols = await sql`
select column_name, data_type
from information_schema.columns
where table_name='users'
order by ordinal_position`;
console.log(cols);
const ccols = await sql`
select column_name, data_type
from information_schema.columns
where table_name='companies'
order by ordinal_position`;
console.log('companies', ccols);
await sql.end();
