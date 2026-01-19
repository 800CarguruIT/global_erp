import { NextRequest, NextResponse } from "next/server";
import { Leads, WorkshopInspections } from "@repo/ai-core";
import { getCurrentUserIdFromRequest } from "../../../../../../../lib/auth/current-user";

type Params = { params: Promise<{ companyId: string; leadId: string }> };

// TODO: add auth/permission checks

export async function GET(_req: NextRequest, { params }: Params) {
  const { companyId, leadId } = await params;
  try {
    const lead = await Leads.getLeadById(companyId, leadId);
    if (!lead) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ data: lead });
  } catch (err) {
    console.error("GET lead failed", err);
    return NextResponse.json(
      { error: "Failed to load lead" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { companyId, leadId } = await params;
  try {
    const body = await req.json().catch(() => ({}));
    const before = await Leads.getLeadById(companyId, leadId);
    if (!before) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const checkinAt = body.checkinAt ?? (body.leadStatus === "car_in" ? new Date().toISOString() : undefined);

    await Leads.updateLeadPartial(companyId, leadId, {
      leadStatus: body.leadStatus,
      leadStage: body.leadStage,
      branchId: body.branchId,
      agentRemark: body.agentRemark,
      customerRemark: body.customerRemark,
      customerFeedback: body.customerFeedback,
      sentimentScore: body.sentimentScore,
      checkinAt,
      carInVideo: body.carInVideo,
      carOutVideo: body.carOutVideo,
    });

    const userId = await getCurrentUserIdFromRequest(req);
    const changes: Array<{ field: string; from: any; to: any }> = [];
    const fields: Array<keyof typeof before> = [
      "leadStatus",
      "leadStage",
      "branchId",
      "agentRemark",
      "customerRemark",
      "customerFeedback",
      "sentimentScore",
      "checkinAt",
      "carInVideo",
      "carOutVideo",
    ];
    for (const field of fields) {
      const prev = (before as any)[field];
      const next = field === "checkinAt" ? checkinAt : (body as any)[field];
      if (next !== undefined && next !== prev) {
        changes.push({ field: String(field), from: prev ?? null, to: next ?? null });
      }
    }
    if (changes.length) {
      await Leads.appendLeadEvent({
        companyId,
        leadId,
        actorUserId: userId,
        eventType: "updated",
        eventPayload: { changes },
      });
    }
    if (body.leadStatus === "accepted" && before.leadStatus !== "accepted") {
      await Leads.appendLeadEvent({
        companyId,
        leadId,
        actorUserId: userId,
        eventType: "accepted",
        eventPayload: { acceptedAt: new Date().toISOString() },
      });
    }
    if (body.leadStatus === "car_in" && before.leadStatus !== "car_in") {
      await Leads.appendLeadEvent({
        companyId,
        leadId,
        actorUserId: userId,
        eventType: "car_in",
        eventPayload: { checkinAt: checkinAt ?? new Date().toISOString() },
      });
      const carId = before.carId;
      const customerId = before.customerId;
      const branchId = body.branchId ?? before.branchId ?? null;
      if (carId) {
        const existing = await WorkshopInspections.getLatestInspectionForLead(companyId, leadId);
        if (!existing) {
          await WorkshopInspections.createInspection({
            companyId,
            leadId,
            carId,
            customerId: customerId ?? null,
            branchId,
            status: "pending",
          });
        }
      }
    }

    const remarkEvents: Array<Promise<void>> = [];
    if (body.agentRemark && body.agentRemark !== before.agentRemark) {
      remarkEvents.push(
        Leads.appendLeadEvent({
          companyId,
          leadId,
          actorUserId: userId,
          eventType: "remark",
          eventPayload: {
            role: "agent",
            message: body.agentRemark,
            previous: before.agentRemark ?? null,
          },
        })
      );
    }
    if (body.customerRemark && body.customerRemark !== before.customerRemark) {
      remarkEvents.push(
        Leads.appendLeadEvent({
          companyId,
          leadId,
          actorUserId: userId,
          eventType: "remark",
          eventPayload: {
            role: "customer",
            message: body.customerRemark,
            previous: before.customerRemark ?? null,
          },
        })
      );
    }
    if (remarkEvents.length) {
      await Promise.all(remarkEvents);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH lead failed", err);
    return NextResponse.json(
      { error: "Failed to update lead" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { companyId, leadId } = await params;
  try {
    const url = new URL(req.url);
    const archive = url.searchParams.get("archive") === "true";
    if (archive) {
      await Leads.updateLeadPartial(companyId, leadId, { isArchived: true, leadStage: "archived", leadStatus: "closed" as any });
      return NextResponse.json({ message: "Lead archived", id: leadId });
    }
    await Leads.deleteLead(companyId, leadId);
    return NextResponse.json({ message: "Lead deleted", id: leadId });
  } catch (err) {
    console.error("DELETE lead failed", err);
    return NextResponse.json({ error: "Failed to delete lead" }, { status: 500 });
  }
}
