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
    const branchId = searchParams.get("branchId");
    const q = searchParams.get("q")?.trim().toLowerCase() ?? "";
    const dateFrom = searchParams.get("dateFrom") ?? searchParams.get("from");
    const dateTo = searchParams.get("dateTo") ?? searchParams.get("to");
    const limitValue = Number(searchParams.get("limit") ?? 20);
    const offsetValue = Number(searchParams.get("offset") ?? 0);
    const limit = Number.isFinite(limitValue)
      ? Math.max(1, Math.min(100, limitValue))
      : 20;
    const offset = Number.isFinite(offsetValue) ? Math.max(0, offsetValue) : 0;

    let inspections = await listInspectionsForCompany(companyId, {
      status: status ?? undefined,
    });

    const sql = getSql();
    const leadIds = inspections.map((i) => i.leadId).filter(Boolean) as string[];
    const leadById = new Map<
      string,
      {
        id: string;
        branchId: string | null;
        customerRemark: string | null;
        carInVideo: string | null;
        carOutVideo: string | null;
        source: string | null;
      }
    >();
    if (leadIds.length) {
      const leadRows = await sql`
        SELECT id, branch_id, customer_remark, carin_video, carout_video, source
        FROM leads
        WHERE company_id = ${companyId}
          AND id IN ${sql(leadIds)}
      `;
      leadRows.forEach((row: any) => {
        leadById.set(row.id, {
          id: row.id,
          branchId: row.branch_id ?? null,
          customerRemark: row.customer_remark ?? null,
          carInVideo: row.carin_video ?? null,
          carOutVideo: row.carout_video ?? null,
          source: row.source ?? null,
        });
      });
    }

    if (branchId) {
      inspections = inspections.filter((inspection) => {
        const lead = inspection.leadId ? leadById.get(inspection.leadId) ?? null : null;
        const effectiveBranchId = inspection.branchId ?? lead?.branchId ?? null;
        return effectiveBranchId === branchId;
      });
    }

    const carIds = inspections.map((i) => i.carId).filter(Boolean) as string[];
    const customerIds = inspections
      .map((i) => i.customerId)
      .filter(Boolean) as string[];
    const branchIds = inspections
      .map((i) => {
        const lead = i.leadId ? leadById.get(i.leadId) ?? null : null;
        return i.branchId ?? lead?.branchId ?? null;
      })
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
      branch: (() => {
        const lead = inspection.leadId
          ? leadById.get(inspection.leadId) ?? null
          : null;
        const effectiveBranchId = inspection.branchId ?? lead?.branchId ?? null;
        return effectiveBranchId ? branchesById.get(effectiveBranchId) ?? null : null;
      })(),
      lead: inspection.leadId
        ? leadById.get(inspection.leadId) ?? null
        : null,
    }));

    const filteredByQuery = !q
      ? enriched
      : enriched.filter((inspection) => {
          const branchLabel = inspection?.branch
            ? (inspection.branch.display_name ??
              inspection.branch.name ??
              inspection.branch.code ??
              "")
            : "";
          const haystack = [
            inspection.id,
            inspection.status,
            inspection.car?.plate_number,
            inspection.car?.make,
            inspection.car?.model,
            inspection.customer?.name,
            inspection.customer?.phone,
            inspection.customer?.email,
            inspection.lead?.source,
            branchLabel,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(q);
        });

    const fromTs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTs = dateTo ? new Date(dateTo).getTime() : null;
    const normalizedFrom = Number.isFinite(fromTs) ? fromTs : null;
    const normalizedTo = Number.isFinite(toTs) ? toTs : null;
    const filtered = filteredByQuery.filter((inspection: any) => {
      const raw =
        inspection?.createdAt ??
        inspection?.created_at ??
        inspection?.startAt ??
        inspection?.start_at ??
        null;
      if (!raw) return true;
      const ts = new Date(raw).getTime();
      if (!Number.isFinite(ts)) return true;
      if (normalizedFrom !== null && ts < normalizedFrom) return false;
      if (normalizedTo !== null && ts > normalizedTo) return false;
      return true;
    });

    const total = filtered.length;
    const paged = filtered.slice(offset, offset + limit);

    return createMobileSuccessResponse({
      inspections: paged,
      meta: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
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
    let resolvedBranchId = body.branchId ?? null;
    if (!resolvedBranchId && body.leadId) {
      const sql = getSql();
      const leadRows = await sql`
        SELECT branch_id
        FROM leads
        WHERE id = ${body.leadId}
          AND company_id = ${companyId}
        LIMIT 1
      `;
      resolvedBranchId = leadRows[0]?.branch_id ?? null;
    }

    const inspection = await createInspection({
      companyId,
      leadId: body.leadId ?? null,
      carId: body.carId ?? null,
      customerId: body.customerId ?? null,
      branchId: resolvedBranchId,
      inspectorEmployeeId: body.inspectorEmployeeId ?? null,
      advisorEmployeeId: body.advisorEmployeeId ?? null,
      status: body.status ?? "pending",
      startAt: body.startAt ?? body.start_at ?? null,
      completeAt: body.completeAt ?? body.complete_at ?? null,
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
