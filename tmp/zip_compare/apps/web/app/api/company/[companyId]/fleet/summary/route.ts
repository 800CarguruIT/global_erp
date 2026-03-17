import { NextRequest, NextResponse } from "next/server";
import { Fleet } from "@repo/ai-core";

import { requireAuth } from "@/lib/auth/requireAuth";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId } = await params;
  const data = await Fleet.summarizeFleetByBranch(companyId);
  return NextResponse.json({ data });
}
