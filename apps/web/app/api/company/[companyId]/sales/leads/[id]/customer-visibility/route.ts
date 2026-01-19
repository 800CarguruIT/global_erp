import { NextRequest, NextResponse } from "next/server";
import { getLeadById, updateLeadPartial, appendLeadEvent } from "@repo/ai-core/crm/leads/repository";

type Params = { params: Promise<{ companyId: string; id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId, id } = await params;
  const lead = await getLeadById(companyId, id);
  if (!lead) return new NextResponse("Not found", { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { approved } = body ?? {};
  if (typeof approved !== "boolean") {
    return NextResponse.json({ error: "approved flag required" }, { status: 400 });
  }

  await updateLeadPartial(companyId, id, {
    customerDetailsApproved: approved,
    customerDetailsRequested: approved ? true : false,
  });

  await appendLeadEvent({
    companyId,
    leadId: id,
    eventType: approved ? "customer_details_approved" : "customer_details_hidden",
    eventPayload: { at: new Date().toISOString() },
  });

  return NextResponse.json({ ok: true });
}
