import { NextRequest, NextResponse } from "next/server";
import { getLeadById, appendLeadEvent, updateLeadPartial } from "@repo/ai-core/crm/leads/repository";

type Params = { params: Promise<{ companyId: string; id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId, id } = await params;
  const lead = await getLeadById(companyId, id);
  if (!lead) return new NextResponse("Not found", { status: 404 });

  const actorUserId = req.headers.get("x-user-id") || null;
  await appendLeadEvent({
    companyId,
    leadId: id,
    actorUserId,
    eventType: "customer_details_requested",
    eventPayload: { requestedAt: new Date().toISOString() },
  });
  await updateLeadPartial(companyId, id, { customerDetailsRequested: true, customerDetailsApproved: false });

  return NextResponse.json({ ok: true });
}
