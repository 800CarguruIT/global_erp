import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSql } from "@repo/ai-core/db";
import { buildScopeContextFromRoute, requirePermission } from "@/lib/auth/permissions";

type Params = { params: { companyId: string; requestId: string } | Promise<{ companyId: string; requestId: string }> };

const payloadSchema = z.object({
  cost: z.number().nonnegative(),
  sale: z.number().nonnegative(),
});

export async function POST(req: NextRequest, { params }: Params) {
  const resolved = await Promise.resolve(params);
  const companyId = resolved?.companyId;
  const requestId = resolved?.requestId;
  if (!companyId || !requestId) {
    return NextResponse.json({ error: "Missing ids" }, { status: 400 });
  }
  const scopeCtx = buildScopeContextFromRoute({ companyId }, "company");
  const perm = await requirePermission(req, "jobs.view", scopeCtx);
  if (perm) return perm;

  const body = await req.json().catch(() => ({}));
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.format() }, { status: 400 });
  }

  const sql = getSql();
  await sql/* sql */ `
    UPDATE recovery_requests
    SET
      verification_cost = ${parsed.data.cost},
      verification_sale = ${parsed.data.sale},
      verified_at = now(),
      updated_at = now()
    WHERE id = ${requestId}
  `;

  return NextResponse.json({ success: true });
}
