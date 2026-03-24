import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL || "postgres://autoguru:autoguru@localhost:5432/global_erp_dev");

const roles = await sql`select id,name from roles order by name limit 30`;
console.log("roles", roles);

const users = await sql`
  select u.id,u.email,u.full_name,u.is_active,
         array_remove(array_agg(r.name),null) as roles
  from users u
  left join user_roles ur on ur.user_id=u.id
  left join roles r on r.id=ur.role_id
  group by u.id
  order by u.created_at desc
  limit 15
`;
console.log("users", users);

await sql.end();
