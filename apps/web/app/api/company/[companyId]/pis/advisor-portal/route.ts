import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core";
import { getCurrentUserIdFromRequest } from "../../../../../../lib/auth/current-user";

type ParamsCtx = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, ctx: ParamsCtx) {
  const { companyId } = await ctx.params;
  const userId = await getCurrentUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const advisorUserId = url.searchParams.get("advisorUserId");
  if (!advisorUserId) return NextResponse.json({ error: "advisorUserId required" }, { status: 400 });

  const sql = getSql();

  try {
    // Get the employee_id for this user
    const [userRow] = await sql<{ employee_id: string | null }[]>`
      SELECT employee_id FROM users WHERE id = ${advisorUserId}
    `;
    const empId = userRow?.employee_id;

    // Leads for this advisor (via agent_employee_id)
    const leads = empId ? await sql<any[]>`
      SELECT l.id, l.lead_status, l.lead_type, l.source, l.created_at, l.checkin_at,
             l.lead_stage, l.service_type,
             c.name as customer_name, c.phone as customer_phone, c.email as customer_email,
             cr.plate_number as car_plate_number, cr.model as car_model, cr.make as car_make,
             b.name as branch_name
      FROM leads l
      LEFT JOIN customers c ON c.id = l.customer_id
      LEFT JOIN cars cr ON cr.id = l.car_id
      LEFT JOIN branches b ON b.id = l.branch_id
      WHERE l.company_id = ${companyId} AND l.agent_employee_id = ${empId}
      ORDER BY l.created_at DESC
      LIMIT 200
    ` : [];

    // Calls for this advisor (via created_by_user_id)
    const calls = await sql<any[]>`
      SELECT cs.id, cs.direction, cs.from_number, cs.to_number, cs.status,
             cs.duration_seconds, cs.created_at,
             c.name as customer_name
      FROM call_sessions cs
      LEFT JOIN customers c ON c.id = cs.to_entity_id
      WHERE cs.company_id = ${companyId} AND cs.created_by_user_id = ${advisorUserId}
      ORDER BY cs.created_at DESC
      LIMIT 100
    `;

    // KPIs
    const totalLeads = leads.length;
    const convertedLeads = leads.filter((l: any) => ['closed_won', 'completed', 'car_in'].includes(l.lead_status)).length;
    const carInLeads = leads.filter((l: any) => l.checkin_at || l.lead_status === 'car_in').length;
    const totalCalls = calls.length;
    const completedCalls = calls.filter((c: any) => c.status === 'completed').length;
    const answerRate = totalCalls > 0 ? Math.round((completedCalls / totalCalls) * 100) : 0;

    // Revenue for this advisor
    const [revRow] = empId ? await sql<{ revenue: number; invoices: number }[]>`
      SELECT COALESCE(SUM(i.grand_total), 0)::numeric as revenue, COUNT(*)::int as invoices
      FROM invoices i JOIN leads l ON l.id = i.lead_id
      WHERE i.company_id = ${companyId} AND l.agent_employee_id = ${empId}
    ` : [{ revenue: 0, invoices: 0 }];

    return NextResponse.json({
      leads: leads.map((l: any) => ({
        id: l.id, customer_name: l.customer_name, customer_phone: l.customer_phone,
        lead_status: l.lead_status, lead_type: l.lead_type, source: l.source,
        created_at: l.created_at, checkinAt: l.checkin_at,
        carPlateNumber: l.car_plate_number, carModel: l.car_model ? `${l.car_make ?? ''} ${l.car_model}`.trim() : null,
        branchName: l.branch_name, serviceType: l.service_type, leadStage: l.lead_stage,
      })),
      calls: calls.map((c: any) => ({
        id: c.id, direction: c.direction, from_number: c.from_number, to_number: c.to_number,
        status: c.status, duration_seconds: c.duration_seconds, created_at: c.created_at,
        customer_name: c.customer_name,
      })),
      kpis: {
        totalLeads, convertedLeads, carInLeads, totalCalls, answerRate,
        revenue: Number(revRow?.revenue ?? 0), invoiceCount: revRow?.invoices ?? 0,
      },
    });
  } catch (error: any) {
    console.error("PIS advisor-portal error:", error);
    return NextResponse.json({ error: "Failed to load advisor data" }, { status: 500 });
  }
}
