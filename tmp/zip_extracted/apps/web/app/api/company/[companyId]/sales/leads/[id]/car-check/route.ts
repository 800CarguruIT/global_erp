import { NextRequest, NextResponse } from "next/server";
import { appendLeadEvent, getLeadById } from "@repo/ai-core/crm/leads/repository";

import { requireAuth } from "@/lib/auth/requireAuth";

type Params = { params: Promise<{ companyId: string; id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId, id } = await params;
  const lead = await getLeadById(companyId, id);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  await appendLeadEvent({
    companyId,
    leadId: id,
    eventType: "car_check",
    eventPayload: body ?? {},
  });

  return NextResponse.json({ ok: true });
}
