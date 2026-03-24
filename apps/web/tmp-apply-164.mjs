import fs from "node:fs";
import postgres from "postgres";

const sql = postgres("postgres://autoguru:autoguru@localhost:5432/global_erp_dev", { max: 1 });
const migration = fs.readFileSync("../../packages/ai-core/migrations/164_customer_data_center_assignments.sql", "utf8");
await sql.unsafe(migration);
console.log("Applied migration 164_customer_data_center_assignments.sql");
const check = await sql`select to_regclass('public.customer_assignments') as customer_assignments, to_regclass('public.customer_assignment_history') as customer_assignment_history`;
console.log(check[0]);
await sql.end();
