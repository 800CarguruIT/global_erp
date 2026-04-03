import { createRequire } from "module";
import { readFileSync } from "fs";
const require = createRequire(import.meta.url);
const postgres = require("../node_modules/.pnpm/postgres@3.4.7/node_modules/postgres/src/index.js").default || require("../node_modules/.pnpm/postgres@3.4.7/node_modules/postgres/src/index.js");
const sql = postgres("postgres://autoguru:autoguru@localhost:5432/global_erp_dev");
await sql.unsafe(readFileSync("packages/ai-core/migrations/191_lead_share_tokens.sql", "utf8"));
console.log("Migration 191 done — lead_share_tokens table created");
await sql.end();