import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core";

type ParamsCtx = { params: Promise<{ companyId: string }> };
type TabKey = "chsc" | "non-chsc" | "insurance";
type InsuranceExpiryStatus = "all" | "active" | "expire-soon" | "expired";

function normalizeTab(value: string | null): TabKey {
  if (value === "non-chsc" || value === "insurance") return value;
  return "chsc";
}

function normalizeInsuranceExpiryStatus(value: string | null): InsuranceExpiryStatus {
  if (value === "active" || value === "expire-soon" || value === "expired") return value;
  return "all";
}

function filterSqlForTab(sql: ReturnType<typeof getSql>, tab: TabKey) {
  if (tab === "chsc") {
    return sql`AND UPPER(TRIM(COALESCE(c.customer_type, ''))) = 'CHSC'`;
  }
  if (tab === "non-chsc") {
    return sql`AND UPPER(TRIM(COALESCE(c.customer_type, ''))) <> 'CHSC'
      AND UPPER(TRIM(COALESCE(c.customer_type, ''))) NOT IN (
        'BATTERY WARRANTY',
        'BATTERY WARRANTY CUSTOMER',
        'BATTERY WARRANTY CUSTOMERS',
        'WARRANTY',
        'WARRANTY CUSTOMER',
        'WARRANTY CUSTOMERS'
      )`;
  }
  if (tab === "insurance") {
    return sql`AND UPPER(TRIM(COALESCE(c.customer_type, ''))) IN ('INSURANCE', 'INSURANCE CUSTOMER', 'INSURANCE CUSTOMERS')`;
  }
  return sql``;
}

export async function GET(req: NextRequest, ctx: ParamsCtx) {
  const { companyId } = await ctx.params;
  const url = new URL(req.url);
  const tab = normalizeTab(url.searchParams.get("tab"));
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.max(10, Math.min(100, Number(url.searchParams.get("pageSize") ?? 25) || 25));
  const searchRaw = (url.searchParams.get("search") ?? "").trim();
  const search = searchRaw ? `%${searchRaw}%` : null;
  const expiryStatus = normalizeInsuranceExpiryStatus(url.searchParams.get("expiryStatus"));
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
  const insuranceOrderSql =
    sortBy === "name"
      ? sql`ORDER BY i.insured_name ${sortDirSql}, i.id DESC`
      : sql`ORDER BY i.date_created ${sortDirSql}, i.id DESC`;

  try {
    const insuranceTableCheck = await sql<Array<{ exists: boolean }>>`
      SELECT (to_regclass('public.insurance_data') IS NOT NULL) AS exists
    `;
    const insuranceTableExists = Boolean((((insuranceTableCheck as any).rows ?? insuranceTableCheck)?.[0] ?? {}).exists);

    const insuranceSearchSql = search
      ? sql`AND (
        i.policy_no ILIKE ${search}
        OR i.insured_name ILIKE ${search}
        OR i.phone ILIKE ${search}
        OR i.car_vin ILIKE ${search}
      )`
      : sql``;
    const insurancePolicyExpiryDateSql = sql`(
      CASE
        WHEN NULLIF(TRIM(SPLIT_PART(i.policy_expiry, ' ', 1)), '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        THEN TO_DATE(
          REPLACE(
            REPLACE(NULLIF(TRIM(SPLIT_PART(i.policy_expiry, ' ', 1)), ''), '-00-', '-01-'),
            '-00',
            '-01'
          ),
          'YYYY-MM-DD'
        )
        ELSE NULL
      END
    )`;
    const insuranceExpiryStatusSql =
      expiryStatus === "expired"
        ? sql`AND ${insurancePolicyExpiryDateSql} IS NOT NULL AND ${insurancePolicyExpiryDateSql} < CURRENT_DATE`
        : expiryStatus === "expire-soon"
          ? sql`AND ${insurancePolicyExpiryDateSql} BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '45 days')::date`
          : expiryStatus === "active"
            ? sql`AND ${insurancePolicyExpiryDateSql} > (CURRENT_DATE + INTERVAL '45 days')::date`
            : sql``;

    let totalRes: any;
    let rowsRes: any;
    if (tab === "insurance") {
      if (!insuranceTableExists) {
        totalRes = [{ total: 0 }];
        rowsRes = [];
      } else {
        totalRes = await sql<Array<{ total: number | string }>>`
          SELECT COUNT(*)::int AS total
          FROM public.insurance_data i
          WHERE i.company_id = ${companyId}::uuid
            ${insuranceSearchSql}
            ${insuranceExpiryStatusSql}
        `;

        rowsRes = await sql<
          Array<{
            id: string;
            code: string | null;
            name: string | null;
            phone: string | null;
            email: string | null;
            customer_type: string | null;
            policy_expiry: string | null;
            created_at: string;
            source: "insurance_data";
          }>
        >`
          SELECT
            i.id::text AS id,
            NULLIF(i.policy_no, '') AS code,
            NULLIF(i.insured_name, '') AS name,
            NULLIF(i.phone, '') AS phone,
            NULL::text AS email,
            'INSURANCE'::text AS customer_type,
            NULLIF(i.policy_expiry, '') AS policy_expiry,
            COALESCE(NULLIF(i.date_created, ''), '') AS created_at,
            'insurance_data'::text AS source
          FROM public.insurance_data i
          WHERE i.company_id = ${companyId}::uuid
            ${insuranceSearchSql}
            ${insuranceExpiryStatusSql}
          ${insuranceOrderSql}
          LIMIT ${pageSize}
          OFFSET ${offset}
        `;
      }
    } else {
      totalRes = await sql<Array<{ total: number | string }>>`
        SELECT COUNT(*)::int AS total
        FROM customers c
        WHERE c.company_id = ${companyId}
          AND c.is_active = TRUE
          ${filterSqlForTab(sql, tab)}
          ${searchSql}
      `;

      rowsRes = await sql<
        Array<{
          id: string;
          code: string | null;
          name: string | null;
          phone: string | null;
          email: string | null;
          customer_type: string | null;
          created_at: string;
          source: "customers";
        }>
      >`
        SELECT
          c.id,
          c.code,
          c.name,
          c.phone,
          c.email,
          c.customer_type,
          NULL::text AS policy_expiry,
          c.created_at,
          'customers'::text AS source
        FROM customers c
        WHERE c.company_id = ${companyId}
          AND c.is_active = TRUE
          ${filterSqlForTab(sql, tab)}
          ${searchSql}
        ${orderSql}
        LIMIT ${pageSize}
        OFFSET ${offset}
      `;
    }

    const rows = (rowsRes as any).rows ?? rowsRes;
    const totalRow = ((totalRes as any).rows ?? totalRes)?.[0] ?? {};
    const total = Number(totalRow.total ?? 0);
    let counts: {
      chsc: number;
      "non-chsc": number;
      insurance: number;
    } | null = null;

    if (includeCounts) {
      const countsRes = await sql<
        Array<{
          chsc_count: number | string;
          non_chsc_count: number | string;
        }>
      >`
        SELECT
          SUM(CASE WHEN UPPER(TRIM(COALESCE(c.customer_type, ''))) = 'CHSC' THEN 1 ELSE 0 END)::int AS chsc_count,
          SUM(CASE
            WHEN UPPER(TRIM(COALESCE(c.customer_type, ''))) <> 'CHSC'
              AND UPPER(TRIM(COALESCE(c.customer_type, ''))) NOT IN (
                'BATTERY WARRANTY',
                'BATTERY WARRANTY CUSTOMER',
                'BATTERY WARRANTY CUSTOMERS',
                'WARRANTY',
                'WARRANTY CUSTOMER',
                'WARRANTY CUSTOMERS'
              )
            THEN 1 ELSE 0 END
          )::int AS non_chsc_count
        FROM customers c
        WHERE c.company_id = ${companyId}
          AND c.is_active = TRUE
      `;
      let insuranceCount = 0;
      if (insuranceTableExists) {
        const insuranceCountRes = await sql<Array<{ insurance_count: number | string }>>`
          SELECT COUNT(*)::int AS insurance_count
          FROM public.insurance_data
          WHERE company_id = ${companyId}::uuid
        `;
        const insuranceCountRow = ((insuranceCountRes as any).rows ?? insuranceCountRes)?.[0] ?? {};
        insuranceCount = Number(insuranceCountRow.insurance_count ?? 0);
      }
      const countsRow = ((countsRes as any).rows ?? countsRes)?.[0] ?? {};
      counts = {
        chsc: Number(countsRow.chsc_count ?? 0),
        "non-chsc": Number(countsRow.non_chsc_count ?? 0),
        insurance: insuranceCount,
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
