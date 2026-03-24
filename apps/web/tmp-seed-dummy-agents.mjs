import postgres from "postgres";

const companyId = "d32af79a-fdde-4052-a8f1-6bc69ba3544e";
const sql = postgres("postgres://autoguru:autoguru@localhost:5432/global_erp_dev");

const roleKey = `call_center_agent_${companyId}`;
const roleName = "Call Center Agent";

const roleRes = await sql`
  INSERT INTO roles (id, name, key, scope, company_id, description, is_system)
  VALUES (gen_random_uuid(), ${roleName}, ${roleKey}, 'company', ${companyId}, 'Dummy call center agent role', false)
  ON CONFLICT (key) DO UPDATE
    SET name = EXCLUDED.name,
        company_id = EXCLUDED.company_id,
        updated_at = now()
  RETURNING id
`;
const roleId = roleRes[0]?.id;

if (!roleId) throw new Error("Failed to create/find agent role");

for (let i = 1; i <= 5; i += 1) {
  const email = `dummy.agent${i}@800carguru.local`;
  const fullName = `Dummy Agent ${i}`;
  const mobile = `100${i}`;

  const userRes = await sql`
    INSERT INTO users (id, email, password_hash, full_name, is_active, company_id, mobile)
    VALUES (gen_random_uuid(), ${email}, 'dummy-hash', ${fullName}, true, ${companyId}, ${mobile})
    ON CONFLICT (email) DO UPDATE
      SET full_name = EXCLUDED.full_name,
          is_active = true,
          company_id = EXCLUDED.company_id,
          mobile = EXCLUDED.mobile,
          updated_at = now()
    RETURNING id, email
  `;

  const userId = userRes[0]?.id;
  if (!userId) continue;

  await sql`
    INSERT INTO user_roles (user_id, role_id)
    VALUES (${userId}, ${roleId})
    ON CONFLICT (user_id, role_id) DO NOTHING
  `;
}

const verify = await sql`
  select u.id, u.email, u.full_name, u.mobile, r.name as role_name
  from users u
  join user_roles ur on ur.user_id = u.id
  join roles r on r.id = ur.role_id
  where u.company_id = ${companyId}
    and u.email like 'dummy.agent%@800carguru.local'
  order by u.email
`;

console.log(JSON.stringify({ roleId, agents: verify }, null, 2));
await sql.end();
