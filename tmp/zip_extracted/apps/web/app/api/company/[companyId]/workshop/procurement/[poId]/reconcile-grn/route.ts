import { NextRequest, NextResponse } from "next/server";
import { reconcilePoGrn } from "@repo/ai-core/workshop/procurement/repository";

import { requireAuth } from "@/lib/auth/requireAuth";

type Params = { params: Promise<{ companyId: string; poId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId, poId } = await params;
  if (!companyId || !poId) {
    return new NextResponse("companyId and poId are required", { status: 400 });
  }

  try {
    const data = await reconcilePoGrn(companyId, poId);
    return NextResponse.json({ data });
  } catch (err: unknown) {
    const message = err instanceof Error && err.message ? err.message : "Failed to reconcile GRN";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
