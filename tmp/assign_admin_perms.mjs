import { createRequire } from "module";
const require = createRequire(import.meta.url);
const postgres = require("../node_modules/.pnpm/postgres@3.4.7/node_modules/postgres/src/index.js").default || require("../node_modules/.pnpm/postgres@3.4.7/node_modules/postgres/src/index.js");
const sql = postgres("postgres://autoguru:autoguru@localhost:5432/global_erp_dev");

// Find all Company Admin roles
const adminRoles = await sql`SELECT id, name, company_id FROM roles WHERE name = 'Company Admin' AND scope = 'company'`;
console.log("Company Admin roles:", adminRoles.length);

// Get all new sidebar permissions
const newPerms = await sql`SELECT id, key FROM permissions WHERE key LIKE 'sales.%' OR key LIKE 'service.%' OR key LIKE 'ops.%' OR key LIKE 'parts.%' OR key LIKE 'tech.%' OR key LIKE 'people.%'`;
console.log("New permissions:", newPerms.length);

// Assign all new permissions to each Company Admin role
let added = 0;
for (const role of adminRoles) {
  for (const perm of newPerms) {
    await sql`INSERT INTO role_permissions (role_id, permission_id) VALUES (${role.id}, ${perm.id}) ON CONFLICT DO NOTHING`;
    added++;
  }
}
console.log("Role-permission links added:", added);

const total = await sql`SELECT count(*) as cnt FROM role_permissions`;
console.log("Total role-permission links:", total[0].cnt);
await sql.end();
