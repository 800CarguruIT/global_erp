import { NextRequest } from "next/server";
import { getSql } from "@repo/ai-core/db";
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
    const estimateId = searchParams.get("estimateId");
    const includeAll =
      searchParams.get("all") === "1" || searchParams.get("all") === "true";
    const status = searchParams.get("status")?.trim().toLowerCase() ?? "";
    const q = searchParams.get("q")?.trim().toLowerCase() ?? "";
    const plate = searchParams.get("plate")?.trim().toLowerCase() ?? "";
    const dateFrom = searchParams.get("dateFrom") ?? searchParams.get("from");
    const dateTo = searchParams.get("dateTo") ?? searchParams.get("to");
    const limitValue = Number(searchParams.get("limit") ?? 20);
    const offsetValue = Number(searchParams.get("offset") ?? 0);
    const limit = Number.isFinite(limitValue)
      ? Math.max(1, Math.min(100, limitValue))
      : 20;
    const offset = Number.isFinite(offsetValue) ? Math.max(0, offsetValue) : 0;

    const sql = getSql();
    if (!estimateId) {
      const rows = await sql`
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
        ORDER BY jc.created_at DESC
      `;

      const fromTs = dateFrom ? new Date(dateFrom).getTime() : null;
      const toTs = dateTo ? new Date(dateTo).getTime() : null;
      const normalizedFrom = Number.isFinite(fromTs) ? fromTs : null;
      const normalizedTo = Number.isFinite(toTs) ? toTs : null;

      const filtered = rows.filter((row: any) => {
        const createdAtRaw = row?.created_at ?? null;
        const createdAtTs = createdAtRaw ? new Date(createdAtRaw).getTime() : null;
        if (
          normalizedFrom !== null &&
          typeof createdAtTs === "number" &&
          createdAtTs < normalizedFrom
        ) {
          return false;
        }
        if (
          normalizedTo !== null &&
          typeof createdAtTs === "number" &&
          createdAtTs > normalizedTo
        ) {
          return false;
        }

        const rowStatus = String(row?.status ?? "").trim().toLowerCase();
        if (status && rowStatus !== status) return false;

        const rowPlate = String(row?.plate_number ?? "").trim().toLowerCase();
        if (plate && !rowPlate.includes(plate)) return false;

        if (q) {
          const haystack = [
            row?.id,
            row?.status,
            row?.branch_name,
            row?.customer_name,
            row?.customer_phone,
            row?.plate_number,
            row?.make,
            row?.model,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(q)) return false;
        }

        return true;
      });

      const total = filtered.length;
      const paged = filtered.slice(offset, offset + limit);
      return createMobileSuccessResponse({
        jobCards: paged,
        meta: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      });
    }

    if (includeAll) {
      const rows = await sql`
        SELECT *
        FROM job_cards
        WHERE estimate_id = ${estimateId}
        ORDER BY created_at DESC
      `;

      return createMobileSuccessResponse({ jobCards: rows });
    }

    const rows = await sql`
      SELECT *
      FROM job_cards
      WHERE estimate_id = ${estimateId}
        AND status IN ('Pending', 'Re-Assigned')
      LIMIT 1
    `;

    return createMobileSuccessResponse({ jobCard: rows[0] ?? null });
  } catch (error) {
    console.error("GET /api/mobile/company/[companyId]/workshop/job-cards error:", error);
    return handleMobileError(error);
  }
}
