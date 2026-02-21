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
    const rows = await sql`
      SELECT
        e.*,
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
    `;

    const fromTs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTs = dateTo ? new Date(dateTo).getTime() : null;
    const normalizedFrom = Number.isFinite(fromTs) ? fromTs : null;
    const normalizedTo = Number.isFinite(toTs) ? toTs : null;

    const filtered = rows.filter((row: any) => {
      const rowStatus = String(row?.status ?? "").trim().toLowerCase();
      if (status && rowStatus !== status) return false;

      const rowPlate = String(row?.car_plate ?? "").trim().toLowerCase();
      if (plate && !rowPlate.includes(plate)) return false;

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

      if (q) {
        const haystack = [
          row?.id,
          row?.status,
          row?.currency,
          row?.car_plate,
          row?.car_make,
          row?.car_model,
          row?.customer_name,
          row?.customer_phone,
          row?.branch_name,
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
    const estimates = paged.map((row: any) => ({
      id: row.id,
      inspectionId: row.inspection_id ?? null,
      leadId: row.lead_id ?? null,
      carId: row.car_id ?? null,
      customerId: row.customer_id ?? null,
      status: row.status,
      currency: row.currency ?? null,
      totalCost: row.total_cost != null ? Number(row.total_cost) : 0,
      totalSale: row.total_sale != null ? Number(row.total_sale) : 0,
      grandTotal: row.grand_total != null ? Number(row.grand_total) : 0,
      createdAt: row.created_at ?? null,
      updatedAt: row.updated_at ?? null,
      branchName: row.branch_name ?? null,
      car: {
        plateNumber: row.car_plate ?? null,
        make: row.car_make ?? null,
        model: row.car_model ?? null,
      },
      customer: {
        name: row.customer_name ?? null,
        phone: row.customer_phone ?? null,
      },
    }));

    return createMobileSuccessResponse({
      estimates,
      meta: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("GET /api/mobile/company/[companyId]/workshop/estimates error:", error);
    return handleMobileError(error);
  }
}
