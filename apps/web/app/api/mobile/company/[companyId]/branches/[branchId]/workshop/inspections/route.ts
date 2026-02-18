import { NextRequest } from "next/server";
import { listLeadsForCompany } from "@repo/ai-core/crm/leads/repository";
import { getSql } from "@repo/ai-core/db";
import { listInspectionsForCompany } from "@repo/ai-core/workshop/inspections/repository";
import type { InspectionStatus } from "@repo/ai-core/workshop/inspections/types";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileErrorResponse,
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = { params: Promise<{ companyId: string; branchId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, branchId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const sql = getSql();
    const branchRows = await sql`
      SELECT id, display_name, name, code
      FROM branches
      WHERE id = ${branchId} AND company_id = ${companyId}
      LIMIT 1
    `;
    const branch = branchRows[0] ?? null;
    if (!branch) {
      return createMobileErrorResponse("Branch not found", 404);
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as InspectionStatus | null;

    const [leads, inspections] = await Promise.all([
      listLeadsForCompany(companyId),
      listInspectionsForCompany(companyId, { status: status ?? undefined }),
    ]);

    const leadBranchById = new Map<string, string | null>();
    for (const lead of leads) {
      leadBranchById.set(lead.id, lead.branchId ?? null);
    }

    const scopedInspections = inspections.filter((inspection) => {
      const leadBranchId = inspection.leadId
        ? (leadBranchById.get(inspection.leadId) ?? null)
        : null;
      const effectiveBranchId = inspection.branchId ?? leadBranchId ?? null;
      return effectiveBranchId === branchId;
    });

    const carIds = scopedInspections.map((i) => i.carId).filter(Boolean) as string[];
    const customerIds = scopedInspections
      .map((i) => i.customerId)
      .filter(Boolean) as string[];

    const carsById = new Map<string, any>();
    const customersById = new Map<string, any>();

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

    const enrichedInspections = scopedInspections.map((inspection) => ({
      ...inspection,
      car: inspection.carId ? carsById.get(inspection.carId) ?? null : null,
      customer: inspection.customerId
        ? customersById.get(inspection.customerId) ?? null
        : null,
      branch,
    }));

    return createMobileSuccessResponse({ inspections: enrichedInspections });
  } catch (error) {
    console.error(
      "GET /api/mobile/company/[companyId]/branches/[branchId]/workshop/inspections error:",
      error,
    );
    return handleMobileError(error);
  }
}

