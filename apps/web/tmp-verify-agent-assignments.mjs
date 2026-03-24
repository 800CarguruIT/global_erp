import postgres from "postgres";
const sql = postgres("postgres://autoguru:autoguru@localhost:5432/global_erp_dev");
const companyId = "d32af79a-fdde-4052-a8f1-6bc69ba3544e";

const rows = await sql`
  select
    u.full_name,
    u.email,
    u.mobile,
    count(ca.*)::int as total_assigned,
    count(*) filter (where ca.segment='chsc')::int as chsc,
    count(*) filter (where ca.segment='non_chsc')::int as non_chsc,
    count(*) filter (where ca.segment='insurance')::int as insurance,
    count(*) filter (where ca.segment='warranty')::int as warranty
  from users u
  left join customer_assignments ca
    on ca.agent_user_id = u.id
   and ca.company_id = ${companyId}
   and ca.status = 'active'
  where u.email like 'dummy.agent%@800carguru.local'
  group by u.id
  order by u.email
`;
console.log(rows);

const totals = await sql`
  select count(*)::int as total_active_assignments
  from customer_assignments
  where company_id = ${companyId} and status='active'
`;
console.log(totals[0]);

await sql.end();
