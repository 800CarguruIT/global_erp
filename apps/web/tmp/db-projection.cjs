const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL || 'postgres://autoguru:autoguru@localhost:5432/global_erp');
(async()=>{
  const id = '9c9c2623-1543-4996-bd49-0e1596db00db';
  const rows = await sql`
    WITH x AS (
      SELECT id,
      CASE
        WHEN jsonb_typeof(ai_payload)='object' THEN ai_payload
        WHEN jsonb_typeof(ai_payload)='array' AND jsonb_array_length(ai_payload)>0 THEN
          CASE WHEN jsonb_typeof(ai_payload->-1)='object' THEN ai_payload->-1 ELSE '{}'::jsonb END
        ELSE '{}'::jsonb
      END AS p
      FROM call_ai_inquiries
      WHERE id = ${id}
    )
    SELECT id,
      (p->'aiRecordingAnalysis'->>'analyzedAt')::text AS nested_analyzed,
      (p->>'analysis_analyzed_at')::text AS flat_analyzed,
      (p->'aiRecordingAnalysis'->>'transcript')::text AS transcript
    FROM x
  `;
  console.log(JSON.stringify(rows[0] || null, null, 2));
  await sql.end({ timeout: 1 });
})();
