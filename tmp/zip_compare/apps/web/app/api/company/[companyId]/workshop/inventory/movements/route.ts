import { NextRequest, NextResponse } from "next/server";
import { listMovements } from "@repo/ai-core/workshop/inventory/repository";

import { requireAuth } from "@/lib/auth/requireAuth";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId } = await params;
  const { searchParams } = new URL(req.url);
  const partId = searchParams.get("partId");
  const locationId = searchParams.get("locationId");
  const data = await listMovements(companyId, {
    partId: partId ?? undefined,
    locationId: locationId ?? undefined,
    limit: 200,
  });
  return NextResponse.json({ data });
}
