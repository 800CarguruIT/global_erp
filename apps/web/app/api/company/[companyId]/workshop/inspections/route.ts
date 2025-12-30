import { NextRequest, NextResponse } from "next/server";
import { createInspection, listInspectionsForCompany } from "@repo/ai-core/workshop/inspections/repository";
import type { InspectionStatus } from "@repo/ai-core/workshop/inspections/types";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as InspectionStatus | null;

  const inspections = await listInspectionsForCompany(companyId, {
    status: status ?? undefined,
  });

  return NextResponse.json({ data: inspections });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));
  const inspection = await createInspection({
    companyId,
    leadId: body.leadId ?? null,
    carId: body.carId ?? null,
    customerId: body.customerId ?? null,
    inspectorEmployeeId: body.inspectorEmployeeId ?? null,
    advisorEmployeeId: body.advisorEmployeeId ?? null,
    status: body.status ?? "draft",
    customerRemark: body.customerRemark ?? null,
    agentRemark: body.agentRemark ?? null,
    draftPayload: body.draftPayload ?? null,
  });
  return NextResponse.json({ data: inspection }, { status: 201 });
}
