import postgres from "postgres";
const sql = postgres("postgres://autoguru:autoguru@localhost:5432/global_erp_dev");
const rows = await sql`
  select u.id,u.email,u.company_id, r.key as role_key, r.scope, r.company_id as role_company_id
  from users u
  left join user_roles ur on ur.user_id=u.id
  left join roles r on r.id=ur.role_id
  where u.is_active = true
  order by u.email
`;
console.log(rows);
await sql.end();
