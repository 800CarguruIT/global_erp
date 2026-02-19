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

    const scopedLeads = leads.filter((lead) => lead.branchId === branchId);
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

    const jobCards = await sql`
      SELECT
        jc.*,
        e.inspection_id,
        l.branch_id,
        COALESCE(b.display_name, b.name, b.code) AS branch_name,
        c.name AS customer_name,
        c.phone AS customer_phone,
        car.plate_number,
        car.make,
        car.model
      FROM job_cards jc
      LEFT JOIN estimates e ON e.id = jc.estimate_id
      LEFT JOIN leads l ON l.id = jc.lead_id
      LEFT JOIN branches b ON b.id = l.branch_id
      LEFT JOIN inspections i ON i.id = e.inspection_id
      LEFT JOIN customers c ON c.id = i.customer_id
      LEFT JOIN cars car ON car.id = i.car_id
      WHERE e.company_id = ${companyId}
        AND l.branch_id = ${branchId}
      ORDER BY jc.created_at DESC
    `;

    const quotes = await sql`
      SELECT
        id,
        company_id,
        estimate_id,
        lead_id,
        branch_id,
        'branch_labor'::text AS quote_type,
        status,
        currency,
        total_amount,
        quoted_amount,
        accepted_amount,
        additional_amount,
        eta_preset,
        eta_hours,
        remarks,
        meta,
        created_at,
        updated_at
      FROM workshop_quotes
      WHERE company_id = ${companyId}
        AND branch_id = ${branchId}
      ORDER BY updated_at DESC
    `;

    return createMobileSuccessResponse({
      branch,
      leads: scopedLeads,
      inspections: enrichedInspections,
      jobCards,
      quotes,
    });
  } catch (error) {
    console.error(
      "GET /api/mobile/company/[companyId]/branches/[branchId]/workshop error:",
      error,
    );
    return handleMobileError(error);
  }
}
