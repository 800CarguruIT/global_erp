const aiCore = require('@repo/ai-core');
const getSql = aiCore.getSql || (aiCore.default && aiCore.default.getSql);
(async()=>{
  const sql = getSql();
  const inquiryId = '9c9c2623-1543-4996-bd49-0e1596db00db';
  const rows = await sql`SELECT id, company_id, inquiry_status, updated_at, ai_payload FROM call_ai_inquiries WHERE id = ${inquiryId} LIMIT 1`;
  console.log(JSON.stringify(rows?.[0] || null, null, 2));
  await sql.end({ timeout: 1 });
})().catch((e)=>{ console.error(e); process.exit(1); });
