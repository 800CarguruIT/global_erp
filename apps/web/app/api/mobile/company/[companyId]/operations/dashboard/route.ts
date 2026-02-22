import { NextRequest } from "next/server";
import { getSql } from "@repo/ai-core/db";
import { listLeadsForCompany } from "@repo/ai-core/crm/leads/repository";
import { listInspectionsForCompany } from "@repo/ai-core/workshop/inspections/repository";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = { params: Promise<{ companyId: string }> };

type JobCardRow = {
  id: string;
  status?: string | null;
  estimate_id?: string | null;
  lead_id?: string | null;
  created_at?: string | null;
  complete_at?: string | null;
  workshop_quote_id?: string | null;
  workshop_quote_status?: string | null;
  workshop_quote_total_amount?: number | null;
  workshop_quote_currency?: string | null;
  branch_name?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  plate_number?: string | null;
  make?: string | null;
  model?: string | null;
};

const toLower = (value?: string | null) => String(value ?? "").trim().toLowerCase();

const matchesQuery = (query: string, fields: unknown[]) => {
  if (!query) return true;
  const haystack = fields
    .filter(Boolean)
    .map((value) => String(value).toLowerCase())
    .join(" ");
  return haystack.includes(query);
};

const matchesDateRange = (
  rawDate: unknown,
  fromTs: number | null,
  toTs: number | null,
) => {
  if (fromTs === null && toTs === null) return true;
  if (!rawDate) return true;

  const ts = new Date(String(rawDate)).getTime();
  if (!Number.isFinite(ts)) return true;
  if (fromTs !== null && ts < fromTs) return false;
  if (toTs !== null && ts > toTs) return false;
  return true;
};

const byCreatedAtDesc = (a: any, b: any) => {
  const at = new Date(String(a?.createdAt ?? a?.created_at ?? 0)).getTime();
  const bt = new Date(String(b?.createdAt ?? b?.created_at ?? 0)).getTime();
  return bt - at;
};

const toMeta = (total: number, limit: number, offset: number) => ({
  total,
  limit,
  offset,
  hasMore: offset + limit < total,
});

const toPaged = <T,>(rows: T[], limit: number, offset: number) => ({
  total: rows.length,
  rows: rows.slice(offset, offset + limit),
});

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const { searchParams } = new URL(req.url);
    const q = toLower(searchParams.get("q"));
    const dateFrom = searchParams.get("dateFrom") ?? searchParams.get("from");
    const dateTo = searchParams.get("dateTo") ?? searchParams.get("to");
    const limitValue = Number(searchParams.get("limit") ?? 50);
    const offsetValue = Number(searchParams.get("offset") ?? 0);
    const limit = Number.isFinite(limitValue)
      ? Math.max(1, Math.min(200, limitValue))
      : 50;
    const offset = Number.isFinite(offsetValue) ? Math.max(0, offsetValue) : 0;

    const fromTsRaw = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTsRaw = dateTo ? new Date(dateTo).getTime() : null;
    const fromTs = Number.isFinite(fromTsRaw) ? fromTsRaw : null;
    const toTs = Number.isFinite(toTsRaw) ? toTsRaw : null;

    const sql = getSql();

    const [inspections, leads, jobCardsRows, estimatesRows] = await Promise.all([
      listInspectionsForCompany(companyId),
      listLeadsForCompany(companyId),
      sql<JobCardRow[]>`
        SELECT
          jc.*,
          e.inspection_id,
          l.branch_id,
          wq.id AS workshop_quote_id,
          wq.status AS workshop_quote_status,
          wq.total_amount AS workshop_quote_total_amount,
          wq.currency AS workshop_quote_currency,
          COALESCE(b.display_name, b.name, b.code) AS branch_name,
          c.name AS customer_name,
          c.phone AS customer_phone,
          car.plate_number,
          car.make,
          car.model
        FROM job_cards jc
        LEFT JOIN estimates e ON e.id = jc.estimate_id
        LEFT JOIN leads l ON l.id = jc.lead_id
        LEFT JOIN LATERAL (
          SELECT id, status, total_amount, currency, approved_at, updated_at
          FROM workshop_quotes
          WHERE company_id = ${companyId}
            AND (
              job_card_id = jc.id
              OR (
                job_card_id IS NULL
                AND estimate_id = jc.estimate_id
                AND branch_id IS NOT DISTINCT FROM l.branch_id
              )
            )
          ORDER BY
            CASE
              WHEN status = 'verified' THEN 3
              WHEN status = 'accepted' THEN 2
              WHEN status = 'pending' THEN 1
              ELSE 0
            END DESC,
            approved_at DESC NULLS LAST,
            updated_at DESC NULLS LAST
          LIMIT 1
        ) wq ON TRUE
        LEFT JOIN branches b ON b.id = l.branch_id
        LEFT JOIN inspections i ON i.id = e.inspection_id
        LEFT JOIN customers c ON c.id = i.customer_id
        LEFT JOIN cars car ON car.id = i.car_id
        WHERE e.company_id = ${companyId}
        ORDER BY jc.created_at DESC
      `,
      sql<any[]>`
        SELECT
          e.id,
          e.status,
          e.currency,
          e.total_cost,
          e.total_sale,
          e.grand_total,
          e.created_at,
          e.updated_at,
          car.plate_number AS car_plate,
          car.make AS car_make,
          car.model AS car_model,
          c.name AS customer_name,
          c.phone AS customer_phone,
          COALESCE(b.display_name, b.name, b.code) AS branch_name
        FROM estimates e
        LEFT JOIN cars car ON car.id = e.car_id
        LEFT JOIN customers c ON c.id = e.customer_id
        LEFT JOIN leads l ON l.id = e.lead_id
        LEFT JOIN branches b ON b.id = l.branch_id
        WHERE e.company_id = ${companyId}
        ORDER BY e.created_at DESC
      `,
    ]);
    const latestInspectionByLead = new Map<string, any>();
    [...inspections].sort(byCreatedAtDesc).forEach((row: any) => {
      const leadId = String(row?.leadId ?? "");
      if (!leadId || latestInspectionByLead.has(leadId)) return;
      latestInspectionByLead.set(leadId, row);
    });

    const pendingInspectionsRaw = leads
      .filter((lead: any) => toLower(lead?.leadStatus) === "car_in")
      .map((lead: any) => {
        const leadId = String(lead?.id ?? "");
        const latest = leadId ? latestInspectionByLead.get(leadId) ?? null : null;
        const latestStatus = toLower(latest?.status);

        if (!latest || latestStatus === "pending" || latestStatus === "cancelled") {
          return {
            id: latest?.id ?? leadId,
            leadId,
            status: latest?.status ?? "pending",
            createdAt: latest?.createdAt ?? lead?.createdAt ?? null,
            updatedAt: latest?.updatedAt ?? lead?.updatedAt ?? null,
            car: {
              plate_number: latest?.car?.plate_number ?? lead?.carPlateNumber ?? null,
              make: latest?.car?.make ?? null,
              model: latest?.car?.model ?? lead?.carModel ?? null,
            },
            customer: {
              name: latest?.customer?.name ?? lead?.customerName ?? null,
              phone: latest?.customer?.phone ?? lead?.customerPhone ?? null,
            },
            branch: {
              display_name: latest?.branch?.display_name ?? lead?.branchName ?? null,
              name: latest?.branch?.name ?? null,
              code: latest?.branch?.code ?? null,
            },
            hasInspection: Boolean(latest?.id),
          };
        }

        return null;
      })
      .filter(Boolean)
      .filter((row: any) =>
        matchesQuery(q, [
          row?.id,
          row?.status,
          row?.car?.plate_number,
          row?.car?.make,
          row?.car?.model,
          row?.customer?.name,
          row?.customer?.phone,
          row?.branch?.display_name,
          row?.branch?.name,
          row?.branch?.code,
        ]),
      )
      .filter((row: any) =>
        matchesDateRange(row?.createdAt ?? row?.updatedAt, fromTs, toTs),
      )
      .sort(byCreatedAtDesc);

    const completedInspectionsRaw = inspections
      .filter((row: any) => toLower(row?.status) === "completed")
      .filter((row: any) =>
        matchesQuery(q, [
          row?.id,
          row?.status,
          row?.car?.plate_number,
          row?.car?.make,
          row?.car?.model,
          row?.customer?.name,
          row?.customer?.phone,
          row?.branch?.display_name,
          row?.branch?.name,
          row?.branch?.code,
        ]),
      )
      .filter((row: any) =>
        matchesDateRange(row?.createdAt ?? row?.updatedAt, fromTs, toTs),
      )
      .sort(byCreatedAtDesc);

    const quotedJobsRaw = jobCardsRows
      .filter((row: JobCardRow) => Boolean(row?.workshop_quote_id))
      .filter((row: JobCardRow) =>
        matchesQuery(q, [
          row?.id,
          row?.status,
          row?.workshop_quote_status,
          row?.branch_name,
          row?.customer_name,
          row?.customer_phone,
          row?.plate_number,
          row?.make,
          row?.model,
        ]),
      )
      .filter((row: JobCardRow) =>
        matchesDateRange(row?.created_at ?? row?.complete_at, fromTs, toTs),
      )
      .sort(byCreatedAtDesc);

    const pendingJobStatuses = new Set(["pending", "re-assigned", "in progress", "in_progress"]);
    const pendingJobsRaw = jobCardsRows
      .filter((row: JobCardRow) => pendingJobStatuses.has(toLower(row?.status)))
      .filter((row: JobCardRow) =>
        matchesQuery(q, [
          row?.id,
          row?.status,
          row?.branch_name,
          row?.customer_name,
          row?.customer_phone,
          row?.plate_number,
          row?.make,
          row?.model,
        ]),
      )
      .filter((row: JobCardRow) =>
        matchesDateRange(row?.created_at ?? row?.complete_at, fromTs, toTs),
      )
      .sort(byCreatedAtDesc);

    const estimatesRaw = estimatesRows
      .filter((row: any) =>
        matchesQuery(q, [
          row?.id,
          row?.status,
          row?.currency,
          row?.car_plate,
          row?.car_make,
          row?.car_model,
          row?.customer_name,
          row?.customer_phone,
          row?.branch_name,
        ]),
      )
      .filter((row: any) => matchesDateRange(row?.created_at ?? row?.updated_at, fromTs, toTs));

    const pendingInspections = toPaged(pendingInspectionsRaw, limit, offset);
    const completedInspections = toPaged(completedInspectionsRaw, limit, offset);
    const quotedJobs = toPaged(quotedJobsRaw, limit, offset);
    const pendingJobs = toPaged(pendingJobsRaw, limit, offset);
    const estimates = toPaged(estimatesRaw, limit, offset);

    return createMobileSuccessResponse({
      summary: {
        pendingInspections: pendingInspectionsRaw.length,
        completedInspections: completedInspectionsRaw.length,
        quotedJobs: quotedJobsRaw.length,
        pendingJobs: pendingJobsRaw.length,
        estimates: estimatesRaw.length,
      },
      pendingInspections: pendingInspections.rows,
      completedInspections: completedInspections.rows,
      quotedJobs: quotedJobs.rows,
      pendingJobs: pendingJobs.rows,
      estimates: estimates.rows,
      meta: {
        pendingInspections: toMeta(pendingInspections.total, limit, offset),
        completedInspections: toMeta(completedInspections.total, limit, offset),
        quotedJobs: toMeta(quotedJobs.total, limit, offset),
        pendingJobs: toMeta(pendingJobs.total, limit, offset),
        estimates: toMeta(estimates.total, limit, offset),
      },
    });
  } catch (error) {
    console.error(
      "GET /api/mobile/company/[companyId]/operations/dashboard error:",
      error,
    );
    return handleMobileError(error);
  }
}
