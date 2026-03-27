import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSql } from "@repo/ai-core";

type ParamsCtx = { params: Promise<{ companyId: string }> };

const bodySchema = z.object({
  callSessionId: z.string().uuid(),
  notes: z.string().max(2000),
});

export async function POST(req: NextRequest, ctx: ParamsCtx) {
  const { companyId } = await ctx.params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.format() }, { status: 400 });
  }

  const { callSessionId, notes } = parsed.data;
  const sql = getSql();

  try {
    const result = await sql<{ id: string }[]>`
      UPDATE call_sessions
      SET
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('notes', ${notes}::text),
        updated_at = NOW()
      WHERE id = ${callSessionId}
        AND company_id = ${companyId}
      RETURNING id
    `;
    const rows = (result as any).rows ?? result;
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "Call session not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("POST /call-center/history/notes error:", err);
    return NextResponse.json({ error: err?.message ?? "Failed to save notes" }, { status: 500 });
  }
}
