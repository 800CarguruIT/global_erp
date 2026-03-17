import { NextRequest } from "next/server";
import { getSql } from "@repo/ai-core/db";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import { createMobileSuccessResponse, handleMobileError } from "@/app/api/mobile/utils";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") ?? "").trim();
    const typeFilter = (searchParams.get("type") ?? "").trim();
    const sql = getSql();

    const whereClause =
      search && typeFilter
        ? sql`WHERE (name ILIKE ${"%" + search + "%"} OR type ILIKE ${"%" + search + "%"}) AND type = ${typeFilter}`
        : search
        ? sql`WHERE name ILIKE ${"%" + search + "%"} OR type ILIKE ${"%" + search + "%"}`
        : typeFilter
        ? sql`WHERE type = ${typeFilter}`
        : sql``;

    const rows = await sql`
      SELECT id, name, cost, type, description
      FROM products
      ${whereClause}
      ORDER BY name ASC
      LIMIT 500
    `;

    return createMobileSuccessResponse({ products: rows });
  } catch (error) {
    console.error("GET /api/mobile/company/[companyId]/products error:", error);
    return handleMobileError(error);
  }
}
