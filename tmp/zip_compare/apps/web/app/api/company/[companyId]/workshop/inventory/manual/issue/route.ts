import { NextRequest, NextResponse } from "next/server";
import { manualIssue } from "@repo/ai-core/workshop/inventory/repository";

import { requireAuth } from "@/lib/auth/requireAuth";

type Params = { params: Promise<{ companyId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));
  if (!body.locationId || !Array.isArray(body.items)) {
    return new NextResponse("locationId and items required", { status: 400 });
  }
  await manualIssue(companyId, body.locationId, body.items, null);
  return NextResponse.json({ ok: true });
}
