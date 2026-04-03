import postgres from "postgres";
async function main() {
  const sql = postgres("postgres://autoguru:autoguru@localhost:5432/global_erp_dev");
  const roles = await sql`SELECT count(*) as cnt FROM roles`;
  const companyRoles = await sql`SELECT count(*) as cnt FROM roles WHERE scope = 'company'`;
  const userRoles = await sql`SELECT count(*) as cnt FROM user_roles`;
  const perms = await sql`SELECT count(*) as cnt FROM permissions`;
  const rolePerms = await sql`SELECT count(*) as cnt FROM role_permissions`;
  const roleNames = await sql`SELECT name, scope FROM roles ORDER BY scope, name`;
  console.log("Total roles:", roles[0].cnt);
  console.log("Company roles:", companyRoles[0].cnt);
  console.log("User-role assignments:", userRoles[0].cnt);
  console.log("Permissions:", perms[0].cnt);
  console.log("Role-permission links:", rolePerms[0].cnt);
  console.log("\nRoles:");
  for (const r of roleNames) console.log(`  [${r.scope}] ${r.name}`);
  await sql.end();
}
main();
