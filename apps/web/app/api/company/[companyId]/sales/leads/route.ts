import { NextRequest, NextResponse } from "next/server";
import {
  listLeadsForCompany,
  createLead,
  updateLeadPartial,
  getLeadById,
  releaseExpiredAssignments,
  deleteLead,
} from "@repo/ai-core/crm/leads/repository";
import type { LeadType } from "@repo/ai-core/crm/leads/types";
import { createCustomer, createCar, linkCustomerToCar } from "@repo/ai-core/crm/service";
import { createInspection } from "@repo/ai-core/workshop/inspections/repository";
import { createEstimateForLead } from "@repo/ai-core/workshop/estimates/repository";
import { createWorkOrderFromEstimate, createWorkOrderForInspection } from "@repo/ai-core/workshop/workorders/repository";
import { getSql } from "@repo/ai-core/db";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.toLowerCase() ?? null;
  const status = searchParams.get("status");

  const leads = await listLeadsForCompany(companyId);
  const filtered = leads.filter((l) => {
    if (status && l.leadStatus !== status) return false;
    if (!q) return true;
    const hay = `${l.customerName ?? ""} ${l.customerPhone ?? ""} ${l.customerEmail ?? ""} ${l.source ?? ""}`.toLowerCase();
    return hay.includes(q);
  });
  return NextResponse.json({ data: filtered });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));
  const {
    name,
    phone,
    email,
    source,
    status,
    ownerId,
    customerId,
    leadType: leadTypeInput,
    serviceType,
    recoveryDirection,
    recoveryFlow,
    pickupFrom,
    pickupGoogleLocation,
    dropoffTo,
    dropoffGoogleLocation,
    branchId: requestedBranchId,
    workshopFlow: rawWorkshopFlow,
    workshopVisitType: rawVisitType,
    appointmentAt,
    pickupLocation,
    pickupLocationGoogle,
    workshopInquiry,
    car: carPayload,
  } = body ?? {};

  let customer_id = customerId ?? null;
  if (!customer_id && name) {
    const customer = await createCustomer({
      companyId,
      customerType: "individual",
      name,
      phone: phone ?? null,
      email: email ?? null,
    });
    customer_id = customer.id;
  }

  let carId = (carPayload as any)?.id ?? null;
  const hasCarDetails =
    carPayload &&
    (carPayload.plateNumber ||
      carPayload.vin ||
      carPayload.make ||
      carPayload.model ||
      carPayload.modelYear ||
      carPayload.plateCode);
  if (!carId && hasCarDetails) {
    const createdCar = await createCar({
      companyId,
      plateCode: carPayload.plateCode ?? null,
      plateNumber: carPayload.plateNumber ?? null,
      plateCountry: carPayload.plateCountry ?? null,
      plateState: carPayload.plateState ?? null,
      plateCity: carPayload.plateCity ?? null,
      plateLocationMode: carPayload.plateLocationMode ?? null,
      vin: carPayload.vin ?? null,
      make: carPayload.make ?? null,
      model: carPayload.model ?? null,
      modelYear: carPayload.year ? Number(carPayload.year) : carPayload.modelYear ?? null,
      mileage: carPayload.mileage ? Number(carPayload.mileage) : null,
      tyreSizeFront: carPayload.tyreSizeFront ?? null,
      tyreSizeBack: carPayload.tyreSizeBack ?? null,
      registrationExpiry: carPayload.registrationExpiry ?? null,
      registrationCardFileId: carPayload.registrationCardFileId ?? null,
      vinPhotoFileId: carPayload.vinPhotoFileId ?? null,
    });
    carId = createdCar.id;
  }
  if (carId && customer_id) {
    try {
      await linkCustomerToCar({
        companyId,
        carId,
        customerId: customer_id,
        relationType: "owner",
        isPrimary: true,
      });
    } catch {
      // ignore linking errors
    }
  }

  const leadType: LeadType = (leadTypeInput as LeadType) ?? "rsa";
  const isWorkshop = leadType === "workshop";
  const workshopFlow =
    (rawWorkshopFlow ??
      body?.workshopWorkflow ??
      null) as "direct_estimate" | "inspection" | "inspection_oil_change" | null;
  const visitType = (rawVisitType ?? body?.visitType ?? body?.workshopVisit ?? null) as "pickup" | "walkin" | null;
  const pickupNote = (pickupLocation ?? pickupFrom ?? "") as string;
  const pickupGoogle = pickupGoogleLocation ?? pickupLocationGoogle ?? pickupNote ?? null;

  async function getBranchLocation(
    branchId: string | null | undefined
  ): Promise<{ label: string | null; googleLocation: string | null } | null> {
    if (!branchId) return null;
    try {
      const sql = getSql();
      const rows = await sql/* sql */ `
        SELECT display_name, name, code, address_line1, google_location
        FROM branches
        WHERE id = ${branchId} AND company_id = ${companyId}
        LIMIT 1
      `;
      const branch = rows[0];
      const label =
        branch?.address_line1 ??
        branch?.display_name ??
        branch?.name ??
        branch?.code ??
        null;
      const googleLocation = branch?.google_location ?? null;
      return { label, googleLocation };
    } catch {
      return { label: null, googleLocation: null };
    }
  }

  let initialLeadStage: string | null = null;
  if (isWorkshop) {
    if (!workshopFlow) {
      return NextResponse.json({ error: "Workshop flow is required" }, { status: 400 });
    }
    if (workshopFlow === "direct_estimate") {
      initialLeadStage = "estimate_pending";
    } else if (workshopFlow === "inspection" || workshopFlow === "inspection_oil_change") {
      initialLeadStage = "inspection_queue";
    } else {
      initialLeadStage = "checkin";
    }
  }

  const lead = await createLead({
    companyId,
    customerId: customer_id,
    carId: carId ?? null,
    agentEmployeeId: ownerId ?? null,
    source: source ?? null,
    leadType,
    serviceType: serviceType ?? null,
    recoveryDirection: leadType === "recovery" ? recoveryDirection ?? null : null,
    recoveryFlow: leadType === "recovery" ? recoveryFlow ?? null : null,
    pickupFrom: pickupFrom ?? null,
    pickupGoogleLocation: pickupGoogle ?? pickupFrom ?? null,
    dropoffTo: leadType === "recovery" ? dropoffTo ?? null : null,
    dropoffGoogleLocation: leadType === "recovery" ? dropoffGoogleLocation ?? dropoffTo ?? null : null,
    branchId: leadType === "recovery" ? null : requestedBranchId ?? null,
    leadStage: initialLeadStage ?? "new",
  });

  let agentRemark = body?.agentRemarks ?? null;
  let customerRemark = body?.customerRemarks ?? null;
  const meta: Record<string, any> = {};

  if (isWorkshop && workshopFlow === "direct_estimate") {
    const estimate = await createEstimateForLead({
      companyId,
      leadId: lead.id,
      carId: (lead as any).carId ?? null,
      customerId: (lead as any).customerId ?? null,
      status: "draft",
      meta: {
        flow: workshopFlow,
        inquiry: workshopInquiry ?? null,
        appointmentAt: appointmentAt ?? null,
        visitType: visitType ?? null,
        pickupLocation: pickupNote || null,
      },
    });
    meta.estimateId = estimate.id;

    try {
      const wo = await createWorkOrderFromEstimate(companyId, estimate.id);
      meta.workOrderId = wo.workOrder?.id ?? null;
    } catch (err) {
      console.error("Failed to auto-create work order from estimate", err);
    }
  }

  if (isWorkshop && (workshopFlow === "inspection" || workshopFlow === "inspection_oil_change")) {
    const inspection = await createInspection({
      companyId,
      leadId: lead.id,
      carId: (lead as any).carId ?? null,
      customerId: (lead as any).customerId ?? null,
      status: "draft",
      agentRemark: workshopInquiry ?? null,
      draftPayload: workshopFlow === "inspection_oil_change" ? { oilChangeRequested: true } : null,
    });
    meta.inspectionId = inspection.id;

    try {
      const wo = await createWorkOrderForInspection(
        companyId,
        inspection.id,
        lead.id,
        (lead as any).carId ?? null,
        (lead as any).customerId ?? null
      );
      meta.workOrderId = wo.id;
    } catch (err) {
      console.error("Failed to auto-create work order for inspection", err);
    }
  }

    if (isWorkshop && visitType === "pickup" && pickupNote) {
      const mapUrl = `https://www.google.com/maps?q=${encodeURIComponent(pickupNote)}`;
      const branchLoc = await getBranchLocation(requestedBranchId);
      const dropoffLocation = branchLoc?.label ?? dropoffTo ?? requestedBranchId ?? null;
      const dropoffGoogle = branchLoc?.googleLocation ?? dropoffGoogleLocation ?? dropoffLocation ?? null;
      const recoveryLead = await createLead({
        companyId,
        customerId: (lead as any).customerId ?? null,
        carId: (lead as any).carId ?? null,
        branchId: requestedBranchId ?? null,
        leadType: "recovery",
        serviceType: recoveryDirection ?? "recovery",
      leadStage: "new",
      recoveryDirection: "pickup",
      recoveryFlow: "customer_to_branch",
      pickupFrom: pickupNote,
      pickupGoogleLocation: pickupGoogle ?? pickupNote ?? null,
      dropoffTo: dropoffLocation,
      dropoffGoogleLocation: dropoffGoogle,
      source: "workshop_pickup",
    });
    meta.pickupRecoveryLeadId = recoveryLead.id;
    meta.pickupRecoveryLeadLink = mapUrl;
  }

  if ((status && status !== lead.leadStatus) || agentRemark || customerRemark) {
    await updateLeadPartial(companyId, lead.id, {
      leadStatus: status ?? undefined,
      agentRemark: agentRemark ?? undefined,
      customerRemark: customerRemark ?? undefined,
      branchId: requestedBranchId ?? undefined,
    });
  }

  // Clean up stale assignments for other leads (safety)
  await releaseExpiredAssignments(companyId, 5);

  const refreshed = await getLeadById(companyId, lead.id);
  return NextResponse.json({ data: refreshed ?? lead, meta }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body?.ids) ? body.ids : [];
  const action: "archive" | "delete" = body?.action === "archive" ? "archive" : "delete";

  if (!ids.length) {
    return NextResponse.json({ error: "No lead ids provided" }, { status: 400 });
  }

  try {
    if (action === "archive") {
      for (const id of ids) {
        await updateLeadPartial(companyId, id, { isArchived: true });
      }
    } else {
      for (const id of ids) {
        await deleteLead(companyId, id);
      }
    }
  } catch (err) {
    console.error("Failed to process bulk lead action", err);
    return NextResponse.json({ error: "Failed to process bulk action" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
