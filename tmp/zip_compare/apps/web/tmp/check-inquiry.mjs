import { getSql } from "@repo/ai-core";

const sql = getSql();
const id = "9c9c2623-1543-4996-bd49-0e1596db00db";
const q = "select id, company_id, inquiry_status, updated_at, ai_payload from call_ai_inquiries where id = '" + id + "' limit 1";
const rows = await sql.unsafe(q);
console.log(JSON.stringify(rows?.[0] ?? null, null, 2));
await sql.end({ timeout: 1 });