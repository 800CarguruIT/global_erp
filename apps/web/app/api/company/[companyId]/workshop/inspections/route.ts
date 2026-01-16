import { NextRequest, NextResponse } from "next/server";
import { createInspection, listInspectionsForCompany } from "@repo/ai-core/workshop/inspections/repository";
import { getSql } from "@repo/ai-core/db";
import type { InspectionStatus } from "@repo/ai-core/workshop/inspections/types";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as InspectionStatus | null;

  const inspections = await listInspectionsForCompany(companyId, {
    status: status ?? undefined,
  });

  const sql = getSql();
  const carIds = inspections.map((i) => i.carId).filter(Boolean) as string[];
  const customerIds = inspections.map((i) => i.customerId).filter(Boolean) as string[];
  const branchIds = inspections.map((i) => i.branchId).filter(Boolean) as string[];
  const carsById = new Map<string, any>();
  const customersById = new Map<string, any>();
  const branchesById = new Map<string, any>();

  if (carIds.length) {
    const rows = await sql/* sql */ `
      SELECT id, plate_number, make, model, model_year, body_type
      FROM cars
      WHERE id IN ${sql(carIds)}
    `;
    rows.forEach((row: any) => carsById.set(row.id, row));
  }
  if (customerIds.length) {
    const rows = await sql/* sql */ `
      SELECT id, code, name, phone, email
      FROM customers
      WHERE id IN ${sql(customerIds)}
    `;
    rows.forEach((row: any) => customersById.set(row.id, row));
  }
  if (branchIds.length) {
    const rows = await sql/* sql */ `
      SELECT id, display_name, name, code
      FROM branches
      WHERE id IN ${sql(branchIds)}
    `;
    rows.forEach((row: any) => branchesById.set(row.id, row));
  }

  const enriched = inspections.map((insp) => ({
    ...insp,
    car: insp.carId ? carsById.get(insp.carId) ?? null : null,
    customer: insp.customerId ? customersById.get(insp.customerId) ?? null : null,
    branch: insp.branchId ? branchesById.get(insp.branchId) ?? null : null,
  }));

  return NextResponse.json({ data: enriched });
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
    status: body.status ?? "pending",
    customerRemark: body.customerRemark ?? null,
    agentRemark: body.agentRemark ?? null,
    draftPayload: body.draftPayload ?? null,
  });
  return NextResponse.json({ data: inspection }, { status: 201 });
}
