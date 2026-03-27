import { getSql } from "../db";
import type {
  AgentPerformanceReport,
  AgentPerformanceRow,
  AssignmentListItem,
  AssignmentListResult,
  CustomerAssignmentRow,
  CustomerSegment,
  DataCenterKpiFilter,
  DataCenterKpis,
  ListAssignmentsFilter,
  UpsertCustomerAssignmentInput,
} from "./types";

function rowsFrom<T>(result: T[] | { rows: T[] }): T[] {
  return (result as any).rows ?? (result as any);
}

function coerceNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

const SEGMENT_FROM_CUSTOMER_TYPE_SQL = `
  CASE
    WHEN UPPER(TRIM(COALESCE(c.customer_type, ''))) = 'CHSC' THEN 'chsc'
    WHEN UPPER(TRIM(COALESCE(c.customer_type, ''))) IN ('INSURANCE', 'INSURANCE CUSTOMER', 'INSURANCE CUSTOMERS') THEN 'insurance'
    WHEN UPPER(TRIM(COALESCE(c.customer_type, ''))) IN ('BATTERY WARRANTY', 'BATTERY WARRANTY CUSTOMER', 'BATTERY WARRANTY CUSTOMERS') THEN 'warranty'
    WHEN COALESCE(NULLIF(TRIM(c.customer_type), ''), '') <> '' THEN 'non_chsc'
    ELSE 'unknown'
  END
`;

export async function upsertCustomerAssignment(
  input: UpsertCustomerAssignmentInput
): Promise<CustomerAssignmentRow> {
  const sql = getSql();
  const action = input.action ?? "update";
  const status = input.status ?? "active";

  return sql.begin(async (trx) => {
    const existingRes = await trx<CustomerAssignmentRow[]>`
      SELECT *
      FROM customer_assignments
      WHERE company_id = ${input.companyId}
        AND customer_id = ${input.customerId}
      LIMIT 1
    `;
    const existing = rowsFrom(existingRes)[0] ?? null;

    const fallbackSegRes = await trx<{ segment: CustomerSegment }[]>`
      SELECT ${trx.unsafe(SEGMENT_FROM_CUSTOMER_TYPE_SQL)}::text AS segment
      FROM customers c
      WHERE c.id = ${input.customerId}
        AND c.company_id = ${input.companyId}
      LIMIT 1
    `;
    const fallbackSegment = (rowsFrom(fallbackSegRes)[0]?.segment ?? "unknown") as CustomerSegment;
    const nextSegment = input.segment ?? existing?.segment ?? fallbackSegment;

    const upsertRes = await trx<CustomerAssignmentRow[]>`
      INSERT INTO customer_assignments (
        company_id,
        customer_id,
        supervisor_user_id,
        agent_user_id,
        segment,
        status,
        assigned_at,
        assigned_by_user_id,
        updated_at
      ) VALUES (
        ${input.companyId},
        ${input.customerId},
        ${input.supervisorUserId ?? null},
        ${input.agentUserId ?? null},
        ${nextSegment},
        ${status},
        NOW(),
        ${input.assignedByUserId ?? null},
        NOW()
      )
      ON CONFLICT (company_id, customer_id)
      DO UPDATE
      SET
        supervisor_user_id = EXCLUDED.supervisor_user_id,
        agent_user_id = EXCLUDED.agent_user_id,
        segment = EXCLUDED.segment,
        status = EXCLUDED.status,
        assigned_by_user_id = EXCLUDED.assigned_by_user_id,
        updated_at = NOW()
      RETURNING *
    `;

    const saved = rowsFrom(upsertRes)[0];
    if (!saved) throw new Error("Failed to upsert customer assignment");

    await trx`
      INSERT INTO customer_assignment_history (
        company_id,
        customer_id,
        assignment_id,
        old_supervisor_user_id,
        new_supervisor_user_id,
        old_agent_user_id,
        new_agent_user_id,
        old_segment,
        new_segment,
        action,
        reason,
        changed_by_user_id,
        changed_at
      ) VALUES (
        ${input.companyId},
        ${input.customerId},
        ${saved.id},
        ${existing?.supervisor_user_id ?? null},
        ${saved.supervisor_user_id ?? null},
        ${existing?.agent_user_id ?? null},
        ${saved.agent_user_id ?? null},
        ${existing?.segment ?? null},
        ${saved.segment},
        ${action},
        ${input.reason ?? null},
        ${input.assignedByUserId ?? null},
        NOW()
      )
    `;

    return saved;
  });
}

export async function listAssignments(filter: ListAssignmentsFilter): Promise<AssignmentListResult> {
  const sql = getSql();
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.max(10, Math.min(200, filter.pageSize ?? 25));
  const offset = (page - 1) * pageSize;

  const searchLike = filter.search?.trim() ? `%${filter.search.trim()}%` : null;
  const searchClause = searchLike
    ? sql`AND (
      c.code ILIKE ${searchLike}
      OR c.name ILIKE ${searchLike}
      OR c.phone ILIKE ${searchLike}
      OR c.email ILIKE ${searchLike}
    )`
    : sql``;

  const segmentClause = filter.segment ? sql`AND ca.segment = ${filter.segment}` : sql``;
  const supervisorClause = filter.supervisorUserId
    ? sql`AND ca.supervisor_user_id = ${filter.supervisorUserId}`
    : sql``;
  const agentClause = filter.agentUserId ? sql`AND ca.agent_user_id = ${filter.agentUserId}` : sql``;
  const statusClause =
    filter.status && filter.status !== "all" ? sql`AND ca.status = ${filter.status}` : sql``;

  const totalRes = await sql<{ total: number | string }[]>`
    SELECT COUNT(*)::int AS total
    FROM customer_assignments ca
    INNER JOIN customers c ON c.id = ca.customer_id
    WHERE ca.company_id = ${filter.companyId}
      AND c.company_id = ${filter.companyId}
      ${segmentClause}
      ${supervisorClause}
      ${agentClause}
      ${statusClause}
      ${searchClause}
  `;

  const rowsRes = await sql<AssignmentListItem[]>`
    SELECT
      ca.*,
      c.code AS customer_code,
      c.name AS customer_name,
      c.phone AS customer_phone,
      c.email AS customer_email,
      c.customer_type
    FROM customer_assignments ca
    INNER JOIN customers c ON c.id = ca.customer_id
    WHERE ca.company_id = ${filter.companyId}
      AND c.company_id = ${filter.companyId}
      ${segmentClause}
      ${supervisorClause}
      ${agentClause}
      ${statusClause}
      ${searchClause}
    ORDER BY ca.updated_at DESC
    LIMIT ${pageSize}
    OFFSET ${offset}
  `;

  const total = coerceNumber(rowsFrom(totalRes)[0]?.total);
  return {
    data: rowsFrom(rowsRes),
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

function assignmentFilterClauses(sql: ReturnType<typeof getSql>, filter: DataCenterKpiFilter) {
  const segmentClause = filter.segment ? sql`AND ca.segment = ${filter.segment}` : sql``;
  const supervisorClause = filter.supervisorUserId
    ? sql`AND ca.supervisor_user_id = ${filter.supervisorUserId}`
    : sql``;
  const agentClause = filter.agentUserId ? sql`AND ca.agent_user_id = ${filter.agentUserId}` : sql``;
  return { segmentClause, supervisorClause, agentClause };
}

export async function getDataCenterKpis(filter: DataCenterKpiFilter): Promise<DataCenterKpis> {
  const sql = getSql();
  const { segmentClause, supervisorClause, agentClause } = assignmentFilterClauses(sql, filter);

  const baseCustomersRes = await sql<{ total: number | string }[]>`
    SELECT COUNT(*)::int AS total
    FROM customers c
    WHERE c.company_id = ${filter.companyId}
      AND c.is_active = TRUE
  `;
  const baseCustomers = coerceNumber(rowsFrom(baseCustomersRes)[0]?.total);

  const warrantyCustomersRes = await sql<{ total: number | string }[]>`
    SELECT COUNT(*)::int AS total
    FROM customers c
    WHERE c.company_id = ${filter.companyId}
      AND c.is_active = TRUE
      AND UPPER(TRIM(COALESCE(c.customer_type, ''))) IN (
        'BATTERY WARRANTY',
        'BATTERY WARRANTY CUSTOMER',
        'BATTERY WARRANTY CUSTOMERS',
        'WARRANTY',
        'WARRANTY CUSTOMER',
        'WARRANTY CUSTOMERS'
      )
  `;
  const warrantyCustomers = coerceNumber(rowsFrom(warrantyCustomersRes)[0]?.total);

  const insuranceTableCheck = await sql<{ exists: boolean }[]>`
    SELECT (to_regclass('public.insurance_data') IS NOT NULL) AS exists
  `;
  const insuranceTableExists = Boolean(rowsFrom(insuranceTableCheck)[0]?.exists);
  let insuranceDataCustomers = 0;
  if (insuranceTableExists) {
    const insuranceRes = await sql<{ total: number | string }[]>`
      SELECT COUNT(*)::int AS total
      FROM public.insurance_data i
      WHERE i.company_id = ${filter.companyId}
    `;
    insuranceDataCustomers = coerceNumber(rowsFrom(insuranceRes)[0]?.total);
  }

  const totalCustomers = baseCustomers + insuranceDataCustomers + warrantyCustomers;

  const scopeRes = await sql<{
    total_customers: number | string;
    active_customers: number | string;
    archived_customers: number | string;
  }[]>`
    SELECT
      COUNT(*)::int AS total_customers,
      COUNT(*) FILTER (WHERE ca.status = 'active')::int AS active_customers,
      COUNT(*) FILTER (WHERE ca.status <> 'active')::int AS archived_customers
    FROM customer_assignments ca
    WHERE ca.company_id = ${filter.companyId}
      ${segmentClause}
      ${supervisorClause}
      ${agentClause}
  `;
  const scopeRow = rowsFrom(scopeRes)[0] ?? {
    total_customers: 0,
    active_customers: 0,
    archived_customers: 0,
  };
  const activeCustomers = coerceNumber(scopeRow.active_customers);
  const archivedCustomers = coerceNumber(scopeRow.archived_customers);

  const assignedRes = await sql<{ total: number | string }[]>`
    SELECT COUNT(*)::int AS total
    FROM customer_assignments ca
    WHERE ca.company_id = ${filter.companyId}
      AND ca.status = 'active'
      ${segmentClause}
      ${supervisorClause}
      ${agentClause}
  `;
  const assignedCustomers = coerceNumber(rowsFrom(assignedRes)[0]?.total);

  const callAgentClause = filter.agentUserId
    ? sql`AND cs.created_by_user_id = ${filter.agentUserId}`
    : sql``;

  const callsRes = await sql<
    {
      contacted_customers: number | string;
      total_calls: number | string;
      answered_calls: number | string;
      failed_calls: number | string;
      avg_call_duration_seconds: number | string | null;
    }[]
  >`
    WITH scoped_assignments AS (
      SELECT ca.customer_id
      FROM customer_assignments ca
      WHERE ca.company_id = ${filter.companyId}
        AND ca.status = 'active'
        ${segmentClause}
        ${supervisorClause}
        ${agentClause}
    ), scoped_calls AS (
      SELECT cs.*
      FROM call_sessions cs
      INNER JOIN scoped_assignments sa
        ON cs.to_entity_type = 'customer'
       AND cs.to_entity_id = sa.customer_id
      WHERE cs.scope = 'company'
        AND cs.company_id = ${filter.companyId}
        AND cs.created_at BETWEEN ${filter.from} AND ${filter.to}
        ${callAgentClause}
    )
    SELECT
      COUNT(DISTINCT to_entity_id)::int AS contacted_customers,
      COUNT(*)::int AS total_calls,
      COUNT(*) FILTER (WHERE status = 'completed')::int AS answered_calls,
      COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_calls,
      AVG(duration_seconds) FILTER (WHERE status = 'completed' AND duration_seconds IS NOT NULL) AS avg_call_duration_seconds
    FROM scoped_calls
  `;

  const callRow = rowsFrom(callsRes)[0] ?? {
    contacted_customers: 0,
    total_calls: 0,
    answered_calls: 0,
    failed_calls: 0,
    avg_call_duration_seconds: null,
  };

  const contactedCustomers = coerceNumber(callRow.contacted_customers);
  const totalCalls = coerceNumber(callRow.total_calls);
  const answeredCalls = coerceNumber(callRow.answered_calls);
  const failedCalls = coerceNumber(callRow.failed_calls);
  const avgCallDurationSeconds =
    callRow.avg_call_duration_seconds == null
      ? null
      : Number(callRow.avg_call_duration_seconds);

  const pendingCustomers = Math.max(0, assignedCustomers - contactedCustomers);
  const answeredRate = totalCalls > 0 ? answeredCalls / totalCalls : 0;

  return {
    totalCustomers,
    activeCustomers,
    archivedCustomers,
    assignedCustomers,
    contactedCustomers,
    pendingCustomers,
    totalCalls,
    answeredCalls,
    failedCalls,
    answeredRate,
    avgCallDurationSeconds,
  };
}

export async function getAgentsPerformanceReport(
  filter: DataCenterKpiFilter
): Promise<AgentPerformanceReport> {
  const sql = getSql();
  const { segmentClause, supervisorClause, agentClause } = assignmentFilterClauses(sql, filter);

  const rowsRes = await sql<
    {
      agent_user_id: string;
      agent_name: string | null;
      total_calls: number | string;
      answered_calls: number | string;
      failed_calls: number | string;
      total_duration_seconds: number | string;
      avg_duration_seconds: number | string | null;
      assigned_customers: number | string;
      contacted_customers: number | string;
      total_leads: number | string;
      total_collection: number | string;
    }[]
  >`
    WITH scoped_assignments AS (
      SELECT ca.customer_id, ca.agent_user_id
      FROM customer_assignments ca
      WHERE ca.company_id = ${filter.companyId}
        AND ca.status = 'active'
        ${segmentClause}
        ${supervisorClause}
        ${agentClause}
        AND ca.agent_user_id IS NOT NULL
    ), call_metrics AS (
      SELECT
        sa.agent_user_id,
        COUNT(*)::int AS total_calls,
        COUNT(*) FILTER (WHERE cs.status = 'completed')::int AS answered_calls,
        COUNT(*) FILTER (WHERE cs.status = 'failed')::int AS failed_calls,
        COALESCE(SUM(cs.duration_seconds), 0)::int AS total_duration_seconds,
        AVG(cs.duration_seconds) FILTER (WHERE cs.status = 'completed' AND cs.duration_seconds IS NOT NULL) AS avg_duration_seconds,
        COUNT(DISTINCT cs.to_entity_id)::int AS contacted_customers
      FROM call_sessions cs
      INNER JOIN scoped_assignments sa
        ON cs.to_entity_type = 'customer'
       AND cs.to_entity_id = sa.customer_id
       AND cs.created_by_user_id = sa.agent_user_id
      WHERE cs.scope = 'company'
        AND cs.company_id = ${filter.companyId}
        AND cs.created_at BETWEEN ${filter.from} AND ${filter.to}
      GROUP BY sa.agent_user_id
    ), assigned_metrics AS (
      SELECT
        sa.agent_user_id,
        COUNT(DISTINCT sa.customer_id)::int AS assigned_customers
      FROM scoped_assignments sa
      GROUP BY sa.agent_user_id
    ), lead_metrics AS (
      SELECT
        COALESCE(l.assigned_user_id, u_emp.id) AS agent_user_id,
        COUNT(DISTINCT l.id)::int AS total_leads,
        COALESCE(SUM(inv.grand_total) FILTER (WHERE inv.status <> 'cancelled'), 0)::numeric AS total_collection
      FROM leads l
      LEFT JOIN users u_emp ON u_emp.employee_id = l.agent_employee_id
      LEFT JOIN invoices inv ON inv.lead_id = l.id
      WHERE l.company_id = ${filter.companyId}
        AND COALESCE(l.assigned_user_id, u_emp.id) IS NOT NULL
      GROUP BY COALESCE(l.assigned_user_id, u_emp.id)
    )
    SELECT
      am.agent_user_id,
      COALESCE(NULLIF(TRIM(u.full_name), ''), u.email) AS agent_name,
      COALESCE(cm.total_calls, 0)::int AS total_calls,
      COALESCE(cm.answered_calls, 0)::int AS answered_calls,
      COALESCE(cm.failed_calls, 0)::int AS failed_calls,
      COALESCE(cm.total_duration_seconds, 0)::int AS total_duration_seconds,
      cm.avg_duration_seconds,
      am.assigned_customers,
      COALESCE(cm.contacted_customers, 0)::int AS contacted_customers,
      COALESCE(lm.total_leads, 0)::int AS total_leads,
      COALESCE(lm.total_collection, 0)::numeric AS total_collection
    FROM assigned_metrics am
    LEFT JOIN call_metrics cm ON cm.agent_user_id = am.agent_user_id
    LEFT JOIN lead_metrics lm ON lm.agent_user_id = am.agent_user_id
    LEFT JOIN users u ON u.id = am.agent_user_id
    ORDER BY total_calls DESC, am.assigned_customers DESC
  `;

  const rows: AgentPerformanceRow[] = rowsFrom(rowsRes).map((row) => {
    const totalCalls = coerceNumber(row.total_calls);
    const answeredCalls = coerceNumber(row.answered_calls);
    const totalLeads = coerceNumber(row.total_leads);
    const answerRate = totalLeads > 0 ? answeredCalls / totalLeads : (totalCalls > 0 ? answeredCalls / totalCalls : 0);
    return {
      agentUserId: row.agent_user_id,
      agentName: row.agent_name,
      totalCalls,
      answeredCalls,
      failedCalls: coerceNumber(row.failed_calls),
      totalDurationSeconds: coerceNumber(row.total_duration_seconds),
      avgDurationSeconds: row.avg_duration_seconds == null ? null : Number(row.avg_duration_seconds),
      assignedCustomers: coerceNumber(row.assigned_customers),
      contactedCustomers: coerceNumber(row.contacted_customers),
      totalLeads,
      totalCollection: coerceNumber(row.total_collection),
      answerRate,
    };
  });

  return {
    from: filter.from.toISOString(),
    to: filter.to.toISOString(),
    rows,
  };
}
