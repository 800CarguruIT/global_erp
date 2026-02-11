import { NextRequest } from "next/server";
import { getSql } from "@repo/ai-core/db";
import {
  createInspection,
  listInspectionsForCompany,
} from "@repo/ai-core/workshop/inspections/repository";
import type { InspectionStatus } from "@repo/ai-core/workshop/inspections/types";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as InspectionStatus | null;

    const inspections = await listInspectionsForCompany(companyId, {
      status: status ?? undefined,
    });

    const sql = getSql();
    const carIds = inspections.map((i) => i.carId).filter(Boolean) as string[];
    const customerIds = inspections
      .map((i) => i.customerId)
      .filter(Boolean) as string[];
    const branchIds = inspections
      .map((i) => i.branchId)
      .filter(Boolean) as string[];
    const carsById = new Map<string, any>();
    const customersById = new Map<string, any>();
    const branchesById = new Map<string, any>();

    if (carIds.length) {
      const rows = await sql`
        SELECT id, plate_number, make, model, model_year, body_type
        FROM cars
        WHERE id IN ${sql(carIds)}
      `;
      rows.forEach((row: any) => carsById.set(row.id, row));
    }
    if (customerIds.length) {
      const rows = await sql`
        SELECT id, code, name, phone, email
        FROM customers
        WHERE id IN ${sql(customerIds)}
      `;
      rows.forEach((row: any) => customersById.set(row.id, row));
    }
    if (branchIds.length) {
      const rows = await sql`
        SELECT id, display_name, name, code
        FROM branches
        WHERE id IN ${sql(branchIds)}
      `;
      rows.forEach((row: any) => branchesById.set(row.id, row));
    }

    const enriched = inspections.map((inspection) => ({
      ...inspection,
      car: inspection.carId ? carsById.get(inspection.carId) ?? null : null,
      customer: inspection.customerId
        ? customersById.get(inspection.customerId) ?? null
        : null,
      branch: inspection.branchId
        ? branchesById.get(inspection.branchId) ?? null
        : null,
    }));

    return createMobileSuccessResponse({ inspections: enriched });
  } catch (error) {
    console.error("GET /api/mobile/company/[companyId]/inspections error:", error);
    return handleMobileError(error);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId } = await params;
    await ensureCompanyAccess(userId, companyId);

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

    return createMobileSuccessResponse({ inspection }, 201);
  } catch (error) {
    console.error("POST /api/mobile/company/[companyId]/inspections error:", error);
    return handleMobileError(error);
  }
}
