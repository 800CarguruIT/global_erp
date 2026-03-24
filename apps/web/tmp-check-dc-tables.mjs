import postgres from "postgres";
const sql = postgres("postgres://autoguru:autoguru@localhost:5432/global_erp_dev");
const checks = await sql`
select
  to_regclass('public.customer_assignments') as customer_assignments,
  to_regclass('public.customer_assignment_history') as customer_assignment_history,
  to_regclass('public.customers') as customers,
  to_regclass('public.call_sessions') as call_sessions
`;
console.log(checks[0]);
const ccols = await sql`
select column_name from information_schema.columns where table_name='customers' order by ordinal_position
`;
console.log('customers cols count', ccols.length);
console.log(ccols.map(c=>c.column_name).slice(0,40));
await sql.end();
