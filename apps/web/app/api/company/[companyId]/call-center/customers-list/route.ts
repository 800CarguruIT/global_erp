import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core";

type ParamsCtx = { params: Promise<{ companyId: string }> };
type TabKey = "chsc" | "non-chsc" | "insurance" | "battery-warranty";

function normalizeTab(value: string | null): TabKey {
  if (value === "non-chsc" || value === "insurance" || value === "battery-warranty") return value;
  return "chsc";
}

function filterSqlForTab(sql: ReturnType<typeof getSql>, tab: TabKey) {
  if (tab === "chsc") {
    return sql`AND UPPER(TRIM(COALESCE(c.customer_type, ''))) = 'CHSC'`;
  }
  if (tab === "non-chsc") {
    return sql`AND UPPER(TRIM(COALESCE(c.customer_type, ''))) <> 'CHSC'`;
  }
  if (tab === "insurance") {
    return sql`AND UPPER(TRIM(COALESCE(c.customer_type, ''))) IN ('INSURANCE', 'INSURANCE CUSTOMER', 'INSURANCE CUSTOMERS')`;
  }
  return sql`AND UPPER(TRIM(COALESCE(c.customer_type, ''))) IN ('BATTERY WARRANTY', 'BATTERY WARRANTY CUSTOMER', 'BATTERY WARRANTY CUSTOMERS')`;
}

export async function GET(req: NextRequest, ctx: ParamsCtx) {
  const { companyId } = await ctx.params;
  const url = new URL(req.url);
  const tab = normalizeTab(url.searchParams.get("tab"));
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.max(10, Math.min(100, Number(url.searchParams.get("pageSize") ?? 25) || 25));
  const searchRaw = (url.searchParams.get("search") ?? "").trim();
  const search = searchRaw ? `%${searchRaw}%` : null;
  const sortBy = url.searchParams.get("sortBy") === "name" ? "name" : "created_at";
  const sortDir = url.searchParams.get("sortDir") === "asc" ? "asc" : "desc";
  const includeCounts = (url.searchParams.get("includeCounts") ?? "0") === "1";
  const offset = (page - 1) * pageSize;
  const sql = getSql();
  const searchSql = search
    ? sql`AND (
      c.code ILIKE ${search}
      OR c.name ILIKE ${search}
      OR c.phone ILIKE ${search}
      OR c.email ILIKE ${search}
    )`
    : sql``;
  const sortDirSql = sortDir === "asc" ? sql`ASC` : sql`DESC`;
  const orderSql =
    sortBy === "name"
      ? sql`ORDER BY c.name ${sortDirSql}, c.created_at DESC`
      : sql`ORDER BY c.created_at ${sortDirSql}, c.name ASC`;

  try {
    const totalRes = await sql<Array<{ total: number | string }>>`
      SELECT COUNT(*)::int AS total
      FROM customers c
      WHERE c.company_id = ${companyId}
        AND c.is_active = TRUE
        ${filterSqlForTab(sql, tab)}
        ${searchSql}
    `;

    const rowsRes = await sql<
      Array<{
        id: string;
        code: string | null;
        name: string | null;
        phone: string | null;
        email: string | null;
        customer_type: string | null;
        created_at: string;
      }>
    >`
      SELECT
        c.id,
        c.code,
        c.name,
        c.phone,
        c.email,
        c.customer_type,
        c.created_at
      FROM customers c
      WHERE c.company_id = ${companyId}
        AND c.is_active = TRUE
        ${filterSqlForTab(sql, tab)}
        ${searchSql}
      ${orderSql}
      LIMIT ${pageSize}
      OFFSET ${offset}
    `;

    const rows = (rowsRes as any).rows ?? rowsRes;
    const totalRow = ((totalRes as any).rows ?? totalRes)?.[0] ?? {};
    const total = Number(totalRow.total ?? 0);
    let counts: {
      chsc: number;
      "non-chsc": number;
      insurance: number;
      "battery-warranty": number;
    } | null = null;

    if (includeCounts) {
      const countsRes = await sql<
        Array<{
          chsc_count: number | string;
          non_chsc_count: number | string;
          insurance_count: number | string;
          battery_warranty_count: number | string;
        }>
      >`
        SELECT
          SUM(CASE WHEN UPPER(TRIM(COALESCE(c.customer_type, ''))) = 'CHSC' THEN 1 ELSE 0 END)::int AS chsc_count,
          SUM(CASE WHEN UPPER(TRIM(COALESCE(c.customer_type, ''))) <> 'CHSC' THEN 1 ELSE 0 END)::int AS non_chsc_count,
          SUM(CASE WHEN UPPER(TRIM(COALESCE(c.customer_type, ''))) IN ('INSURANCE', 'INSURANCE CUSTOMER', 'INSURANCE CUSTOMERS') THEN 1 ELSE 0 END)::int AS insurance_count,
          SUM(CASE WHEN UPPER(TRIM(COALESCE(c.customer_type, ''))) IN ('BATTERY WARRANTY', 'BATTERY WARRANTY CUSTOMER', 'BATTERY WARRANTY CUSTOMERS') THEN 1 ELSE 0 END)::int AS battery_warranty_count
        FROM customers c
        WHERE c.company_id = ${companyId}
          AND c.is_active = TRUE
      `;
      const countsRow = ((countsRes as any).rows ?? countsRes)?.[0] ?? {};
      counts = {
        chsc: Number(countsRow.chsc_count ?? 0),
        "non-chsc": Number(countsRow.non_chsc_count ?? 0),
        insurance: Number(countsRow.insurance_count ?? 0),
        "battery-warranty": Number(countsRow.battery_warranty_count ?? 0),
      };
    }

    return NextResponse.json({
      data: rows,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      ...(counts ? { counts } : {}),
    });
  } catch (error) {
    console.error("GET /api/company/[companyId]/call-center/customers-list error:", error);
    return NextResponse.json({ error: "Failed to load customers list" }, { status: 500 });
  }
}
