import { createRequire } from "module";
const require = createRequire(import.meta.url);
const postgres = require("../node_modules/.pnpm/postgres@3.4.7/node_modules/postgres/src/index.js").default || require("../node_modules/.pnpm/postgres@3.4.7/node_modules/postgres/src/index.js");
const sql = postgres("postgres://autoguru:autoguru@localhost:5432/global_erp_dev");
const rows = await sql`SELECT * FROM lead_share_tokens ORDER BY created_at DESC LIMIT 5`;
for (const r of rows) console.log(r.token, "|", r.lead_id, "|", r.company_id);
if (!rows.length) console.log("No tokens found");
await sql.end();
