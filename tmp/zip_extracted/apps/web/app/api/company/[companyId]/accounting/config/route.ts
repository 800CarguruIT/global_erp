import { NextRequest, NextResponse } from "next/server";
import { AccountingConfig } from "@repo/ai-core";

import { requireAuth } from "@/lib/auth/requireAuth";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId } = await params;
  const settings = await AccountingConfig.getCompanySettings(companyId);
  if (!settings) {
    return NextResponse.json({ data: { companyId } });
  }
  return NextResponse.json({ data: settings });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));
  const saved = await AccountingConfig.upsertCompanySettings(companyId, body);
  return NextResponse.json({ data: saved });
}

export const PUT = PATCH;
