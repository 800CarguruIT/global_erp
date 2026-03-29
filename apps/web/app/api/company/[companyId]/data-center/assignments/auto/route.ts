import { NextRequest, NextResponse } from "next/server";
import { CustomerDataCenter, getSql } from "@repo/ai-core/server";
import { resolveDataCenterAccess } from "@/lib/data-center/access";

type ParamsCtx = { params: Promise<{ companyId: string }> };
type Segment = "chsc" | "chsc_inactive" | "non_chsc" | "non_chsc_inactive" | "insurance";
type SqlRowsResult<T> = { rows: T[] };

function getCurrentUserId(req: NextRequest): string | null {
  return req.headers.get("x-user-id");
}

function normalizePercent(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function segmentWhereClause(sql: ReturnType<typeof getSql>, segment: Segment) {
  if (segment === "chsc") {
    return sql`AND UPPER(TRIM(COALESCE(c.customer_type, ''))) = 'CHSC' AND c.is_active = TRUE`;
  }
  if (segment === "chsc_inactive") {
    return sql`AND UPPER(TRIM(COALESCE(c.customer_type, ''))) = 'CHSC' AND c.is_active = FALSE`;
  }
  if (segment === "insurance") {
    return sql`AND UPPER(TRIM(COALESCE(c.customer_type, ''))) IN ('INSURANCE', 'INSURANCE CUSTOMER', 'INSURANCE CUSTOMERS')`;
  }
  if (segment === "non_chsc_inactive") {
    return sql`AND UPPER(TRIM(COALESCE(c.customer_type, ''))) NOT IN (
      'CHSC', 'INSURANCE', 'INSURANCE CUSTOMER', 'INSURANCE CUSTOMERS'
    ) AND c.is_active = FALSE`;
  }
  // non_chsc (active)
  return sql`AND UPPER(TRIM(COALESCE(c.customer_type, ''))) NOT IN (
    'CHSC', 'INSURANCE', 'INSURANCE CUSTOMER', 'INSURANCE CUSTOMERS'
  ) AND c.is_active = TRUE`;
}

function segmentLabel(segment: Segment): string {
  return segment;
}

const ALL_SEGMENTS: Segment[] = ["chsc", "chsc_inactive", "non_chsc", "non_chsc_inactive", "insurance"];

function splitCounts(totalCustomers: number, percentages: Record<Segment, number>): Record<Segment, number> {
  const totalPercent = ALL_SEGMENTS.reduce((sum, s) => sum + (percentages[s] ?? 0), 0);
  const safeDenominator = totalPercent > 0 ? totalPercent : ALL_SEGMENTS.length;
  const raw = ALL_SEGMENTS.map((s) => ({
    segment: s,
    value: ((percentages[s] ?? 0) > 0 ? (percentages[s] ?? 0) : totalPercent > 0 ? 0 : 1) * totalCustomers / safeDenominator,
  }));
  const base: Record<Segment, number> = { chsc: 0, chsc_inactive: 0, non_chsc: 0, non_chsc_inactive: 0, insurance: 0 };
  let used = 0;
  for (const row of raw) {
    const v = Math.floor(row.value);
    base[row.segment] = v;
    used += v;
  }
  let remaining = Math.max(0, totalCustomers - used);
  raw
    .map((r) => ({ segment: r.segment, fraction: r.value - Math.floor(r.value) }))
    .sort((a, b) => b.fraction - a.fraction)
    .forEach((row) => {
      if (remaining <= 0) return;
      base[row.segment] += 1;
      remaining -= 1;
    });
  return base;
}

export async function POST(req: NextRequest, ctx: ParamsCtx) {
  const userId = getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyId } = await ctx.params;
  let access: Awaited<ReturnType<typeof resolveDataCenterAccess>>;
  try {
    access = await resolveDataCenterAccess(userId, companyId);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (access.scope === "agent") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const agentUserId = String(body.agentUserId ?? "").trim();
    const totalCustomers = Math.max(1, Number(body.totalCustomers ?? 0) || 0);
    if (!agentUserId) return NextResponse.json({ error: "agentUserId is required" }, { status: 400 });
    if (!Number.isFinite(totalCustomers) || totalCustomers <= 0) {
      return NextResponse.json({ error: "totalCustomers must be greater than 0" }, { status: 400 });
    }

    const percentagesInput = (body.percentages ?? {}) as Record<string, unknown>;
    const percentages: Record<Segment, number> = {
      chsc: normalizePercent(percentagesInput.chsc),
      chsc_inactive: normalizePercent(percentagesInput.chsc_inactive),
      non_chsc: normalizePercent(percentagesInput.non_chsc),
      non_chsc_inactive: normalizePercent(percentagesInput.non_chsc_inactive),
      insurance: normalizePercent(percentagesInput.insurance),
    };
    const targets = splitCounts(totalCustomers, percentages);
    const sql = getSql();
    const normalizeSqlRows = <T,>(result: T[] | SqlRowsResult<T>): T[] =>
      Array.isArray(result) ? result : result.rows;
    const selectedRows: Array<{ customerId: string; segment: Segment }> = [];
    const selectedSet = new Set<string>();

    for (const segment of ALL_SEGMENTS) {
      const needed = targets[segment];
      if (needed <= 0) continue;
      const rowsRes = await sql<Array<{ customer_id: string }>>`
        SELECT c.id::text AS customer_id
        FROM customers c
        WHERE c.company_id = ${companyId}
          ${segmentWhereClause(sql, segment)}
          AND NOT EXISTS (
            SELECT 1
            FROM customer_assignments ca
            WHERE ca.company_id = ${companyId}
              AND ca.customer_id = c.id
              AND ca.status = 'active'
          )
        ORDER BY c.created_at DESC
        LIMIT ${needed}
      `;
      const rows = normalizeSqlRows(rowsRes);
      for (const row of rows) {
        const customerId = String(row.customer_id);
        if (selectedSet.has(customerId)) continue;
        selectedSet.add(customerId);
        selectedRows.push({ customerId, segment });
      }
    }

    const remaining = Math.max(0, totalCustomers - selectedRows.length);
    if (remaining > 0) {
      const fillRes = await sql<Array<{ customer_id: string; segment: Segment }>>`
        SELECT
          c.id::text AS customer_id,
          CASE
            WHEN UPPER(TRIM(COALESCE(c.customer_type, ''))) = 'CHSC' AND c.is_active = TRUE THEN 'chsc'
            WHEN UPPER(TRIM(COALESCE(c.customer_type, ''))) = 'CHSC' AND c.is_active = FALSE THEN 'chsc_inactive'
            WHEN UPPER(TRIM(COALESCE(c.customer_type, ''))) IN ('INSURANCE', 'INSURANCE CUSTOMER', 'INSURANCE CUSTOMERS') THEN 'insurance'
            WHEN c.is_active = FALSE THEN 'non_chsc_inactive'
            ELSE 'non_chsc'
          END::text AS segment
        FROM customers c
        WHERE c.company_id = ${companyId}
          AND NOT EXISTS (
            SELECT 1
            FROM customer_assignments ca
            WHERE ca.company_id = ${companyId}
              AND ca.customer_id = c.id
              AND ca.status = 'active'
          )
        ORDER BY c.created_at DESC
        LIMIT ${remaining * 3}
      `;
      const fillRows = normalizeSqlRows(fillRes);
      for (const row of fillRows) {
        if (selectedRows.length >= totalCustomers) break;
        const customerId = String(row.customer_id);
        if (selectedSet.has(customerId)) continue;
        selectedSet.add(customerId);
        const segment = (String(row.segment) as Segment) || "non_chsc";
        selectedRows.push({ customerId, segment });
      }
    }

    // Map sub-segments to DB-compatible segment values
    const dbSegment = (s: Segment): string => {
      if (s === "chsc_inactive") return "chsc";
      if (s === "non_chsc_inactive") return "non_chsc";
      return s;
    };

    const payload = selectedRows.map((row) => ({
      companyId,
      customerId: row.customerId,
      supervisorUserId: access.scope === "supervisor" ? access.supervisorUserId : null,
      agentUserId,
      segment: dbSegment(row.segment),
      status: "active" as const,
      assignedByUserId: userId,
      reason: "auto_assign",
      action: "bulk_assign" as const,
    }));

    if (payload.length === 0) {
      return NextResponse.json(
        { error: "No unassigned customers available for the selected distribution" },
        { status: 400 }
      );
    }

    const result = await CustomerDataCenter.bulkAssignCustomers(payload);
    const assignedBySegment: Record<Segment, number> = {
      chsc: 0,
      chsc_inactive: 0,
      non_chsc: 0,
      non_chsc_inactive: 0,
      insurance: 0,
    };
    for (const row of selectedRows) assignedBySegment[row.segment] += 1;

    return NextResponse.json({
      data: {
        requested: totalCustomers,
        assigned: result.updated,
        targetBySegment: targets,
        assignedBySegment,
        agentUserId,
      },
    });
  } catch (error) {
    console.error("POST /api/company/[companyId]/data-center/assignments/auto error:", error);
    return NextResponse.json({ error: "Failed to auto assign customers" }, { status: 500 });
  }
}
