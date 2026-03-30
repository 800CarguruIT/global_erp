import { NextRequest, NextResponse } from "next/server";
import { CustomerDataCenter, getSql } from "@repo/ai-core/server";
import { resolveDataCenterAccess } from "@/lib/data-center/access";

type ParamsCtx = { params: Promise<{ companyId: string }> };
type BaseSegment = "chsc" | "chsc_inactive" | "non_chsc" | "non_chsc_inactive";
type SegmentKey = BaseSegment | string; // string for insurance:CompanyName keys
type SqlRowsResult<T> = { rows: T[] };

function getCurrentUserId(req: NextRequest): string | null {
  return req.headers.get("x-user-id");
}

function normalizePercent(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

const BASE_SEGMENTS: BaseSegment[] = ["chsc", "chsc_inactive", "non_chsc", "non_chsc_inactive"];

function splitCounts(totalCustomers: number, percentages: Record<string, number>): Record<string, number> {
  const keys = Object.keys(percentages);
  const totalPercent = keys.reduce((sum, k) => sum + (percentages[k] ?? 0), 0);
  const safeDenominator = totalPercent > 0 ? totalPercent : keys.length;
  const raw = keys.map((k) => ({
    key: k,
    value: ((percentages[k] ?? 0) > 0 ? (percentages[k] ?? 0) : totalPercent > 0 ? 0 : 1) * totalCustomers / safeDenominator,
  }));
  const base: Record<string, number> = {};
  for (const k of keys) base[k] = 0;
  let used = 0;
  for (const row of raw) {
    const v = Math.floor(row.value);
    base[row.key] = v;
    used += v;
  }
  let remaining = Math.max(0, totalCustomers - used);
  raw
    .map((r) => ({ key: r.key, fraction: r.value - Math.floor(r.value) }))
    .sort((a, b) => b.fraction - a.fraction)
    .forEach((row) => {
      if (remaining <= 0) return;
      base[row.key] += 1;
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

    // Build percentages map: base segments + insurance:CompanyName keys
    const percentages: Record<string, number> = {};
    for (const seg of BASE_SEGMENTS) {
      percentages[seg] = normalizePercent(percentagesInput[seg]);
    }

    // Collect insurance company percentages (keys starting with "insurance:")
    const insuranceCompanies: string[] = [];
    for (const key of Object.keys(percentagesInput)) {
      if (key.startsWith("insurance:")) {
        const companyName = key.slice("insurance:".length);
        if (companyName) {
          percentages[key] = normalizePercent(percentagesInput[key]);
          insuranceCompanies.push(companyName);
        }
      }
    }

    // Backward compat: if no insurance:X keys but plain "insurance" key exists, treat as single bucket
    if (insuranceCompanies.length === 0 && percentagesInput.insurance !== undefined) {
      percentages["insurance"] = normalizePercent(percentagesInput.insurance);
    }

    const allKeys = Object.keys(percentages);
    const targets = splitCounts(totalCustomers, percentages);
    const sql = getSql();
    const normalizeSqlRows = <T,>(result: T[] | SqlRowsResult<T>): T[] =>
      Array.isArray(result) ? result : result.rows;
    const selectedRows: Array<{ customerId: string; segmentKey: string }> = [];
    const selectedSet = new Set<string>();

    for (const key of allKeys) {
      const needed = targets[key];
      if (needed <= 0) continue;

      let whereClause;
      if (key === "chsc") {
        whereClause = sql`AND UPPER(TRIM(COALESCE(c.customer_type, ''))) = 'CHSC' AND c.is_active = TRUE`;
      } else if (key === "chsc_inactive") {
        whereClause = sql`AND UPPER(TRIM(COALESCE(c.customer_type, ''))) = 'CHSC' AND c.is_active = FALSE`;
      } else if (key === "non_chsc") {
        whereClause = sql`AND UPPER(TRIM(COALESCE(c.customer_type, ''))) NOT IN (
          'CHSC', 'INSURANCE', 'INSURANCE CUSTOMER', 'INSURANCE CUSTOMERS'
        ) AND c.is_active = TRUE`;
      } else if (key === "non_chsc_inactive") {
        whereClause = sql`AND UPPER(TRIM(COALESCE(c.customer_type, ''))) NOT IN (
          'CHSC', 'INSURANCE', 'INSURANCE CUSTOMER', 'INSURANCE CUSTOMERS'
        ) AND c.is_active = FALSE`;
      } else if (key.startsWith("insurance:")) {
        const insName = key.slice("insurance:".length);
        whereClause = sql`AND UPPER(TRIM(COALESCE(c.customer_type, ''))) IN ('INSURANCE', 'INSURANCE CUSTOMER', 'INSURANCE CUSTOMERS')
          AND UPPER(TRIM(COALESCE(c.insurance_name, ''))) = UPPER(TRIM(${insName}))`;
      } else {
        // fallback: plain "insurance" (all insurance customers)
        whereClause = sql`AND UPPER(TRIM(COALESCE(c.customer_type, ''))) IN ('INSURANCE', 'INSURANCE CUSTOMER', 'INSURANCE CUSTOMERS')`;
      }

      const rowsRes = await sql<Array<{ customer_id: string }>>`
        SELECT c.id::text AS customer_id
        FROM customers c
        WHERE c.company_id = ${companyId}
          ${whereClause}
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
        selectedRows.push({ customerId, segmentKey: key });
      }
    }

    // Fill remaining from overflow pool
    const remaining = Math.max(0, totalCustomers - selectedRows.length);
    if (remaining > 0) {
      const fillRes = await sql<Array<{ customer_id: string; segment: string }>>`
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
        const segment = String(row.segment) || "non_chsc";
        selectedRows.push({ customerId, segmentKey: segment });
      }
    }

    // Map segment keys to DB-compatible segment values
    const dbSegment = (key: string): string => {
      if (key === "chsc_inactive") return "chsc";
      if (key === "non_chsc_inactive") return "non_chsc";
      if (key.startsWith("insurance:") || key === "insurance") return "insurance";
      return key;
    };

    const payload = selectedRows.map((row) => ({
      companyId,
      customerId: row.customerId,
      supervisorUserId: access.scope === "supervisor" ? access.supervisorUserId : null,
      agentUserId,
      segment: dbSegment(row.segmentKey),
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
    const assignedBySegment: Record<string, number> = {};
    for (const key of allKeys) assignedBySegment[key] = 0;
    for (const row of selectedRows) {
      assignedBySegment[row.segmentKey] = (assignedBySegment[row.segmentKey] ?? 0) + 1;
    }

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
