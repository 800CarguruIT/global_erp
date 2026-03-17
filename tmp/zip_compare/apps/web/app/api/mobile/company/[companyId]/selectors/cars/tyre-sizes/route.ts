import { NextRequest } from "next/server";
import { getSql } from "@repo/ai-core/db";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileSuccessResponse,
  handleMobileError,
} from "../../../../../utils";

type Params = { params: Promise<{ companyId: string }> };

function mapRowToSize(row: any) {
  if (!row || !row.size) return null;
  return String(row.size);
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const sql = getSql();
    const frontRows = await sql`
      SELECT DISTINCT tyre_size_front AS size
      FROM cars
      WHERE company_id = ${companyId}
        AND COALESCE(tyre_size_front, '') <> ''
      ORDER BY tyre_size_front ASC
    `;
    const rearRows = await sql`
      SELECT DISTINCT tyre_size_back AS size
      FROM cars
      WHERE company_id = ${companyId}
        AND COALESCE(tyre_size_back, '') <> ''
      ORDER BY tyre_size_back ASC
    `;

    const frontSizes = frontRows.map(mapRowToSize).filter((value): value is string => Boolean(value));
    const rearSizes = rearRows.map(mapRowToSize).filter((value): value is string => Boolean(value));

    return createMobileSuccessResponse({
      front: Array.from(new Set(frontSizes)),
      rear: Array.from(new Set(rearSizes)),
    });
  } catch (error) {
    console.error("GET /api/mobile/company/[companyId]/selectors/cars/tyre-sizes error:", error);
    return handleMobileError(error);
  }
}
