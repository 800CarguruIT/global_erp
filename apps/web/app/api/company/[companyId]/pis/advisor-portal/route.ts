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
             l.lead_stage, l.service_type, l.customer_id,
             c.name as customer_name, c.phone as customer_phone, c.email as customer_email,
             c.wallet_amount as customer_wallet_amount,
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

    // Workflow data for car-in leads (inspection, estimate, job card, parts, invoice, QC, gatepass, pre-inspection form)
    const carInLeadIds = leads.filter((l: any) => l.lead_status === "car_in" || l.checkin_at).map((l: any) => String(l.id));
    let workflowByLead: Record<string, any> = {};
    if (carInLeadIds.length > 0) {
      const [inspRows, estRows, jcRows, invoiceRows, partsRows, qcRows, gpRows, formRows] = await Promise.all([
        sql`SELECT DISTINCT ON (i.lead_id) i.lead_id, i.id, i.status, i.created_at FROM inspections i WHERE i.company_id = ${companyId} AND i.lead_id::text = ANY(${sql.array(carInLeadIds)}) ORDER BY i.lead_id, i.created_at DESC`.catch(() => []),
        sql`SELECT DISTINCT ON (e.lead_id) e.lead_id, e.id, e.status, e.grand_total FROM estimates e WHERE e.company_id = ${companyId} AND e.lead_id::text = ANY(${sql.array(carInLeadIds)}) ORDER BY e.lead_id, e.created_at DESC`.catch(() => []),
        sql`SELECT DISTINCT ON (COALESCE(jc.lead_id, e.lead_id)) COALESCE(jc.lead_id, e.lead_id) as lead_id, jc.id, jc.status, jc.start_at, jc.complete_at, jc.final_inspection_at, jc.final_inspection_by, jc.final_inspection_car_wash, jc.final_inspection_test_drive, jc.final_inspection_cluster_warning, jc.final_inspection_tyre_check, jc.final_inspection_computer_reset, jc.final_inspection_protective_shields, jc.final_inspection_remarks, jc.final_inspection_car_out_video_id, insp.draft_payload as inspection_draft_payload FROM job_cards jc LEFT JOIN estimates e ON e.id = jc.estimate_id LEFT JOIN inspections insp ON insp.id = e.inspection_id WHERE (jc.lead_id::text = ANY(${sql.array(carInLeadIds)}) OR e.lead_id::text = ANY(${sql.array(carInLeadIds)})) ORDER BY COALESCE(jc.lead_id, e.lead_id), jc.created_at DESC`.catch(() => []),
        sql`SELECT DISTINCT ON (inv.lead_id) inv.lead_id, inv.id, inv.status, inv.grand_total, inv.invoice_number FROM invoices inv WHERE inv.company_id = ${companyId} AND inv.lead_id::text = ANY(${sql.array(carInLeadIds)}) ORDER BY inv.lead_id, inv.created_at DESC`.catch(() => []),
        sql`SELECT lead_id, sum(total_count)::int as ordered_count, sum(received_count)::int as received_count FROM (
          SELECT li.lead_id, count(*) as total_count, count(*) FILTER (WHERE LOWER(pq.status) IN ('received','completed')) as received_count
          FROM part_quotes pq JOIN line_items li ON li.id = pq.line_item_id
          WHERE li.company_id = ${companyId} AND li.lead_id::text = ANY(${sql.array(carInLeadIds)})
          GROUP BY li.lead_id
          UNION ALL
          SELECT e.lead_id, count(*) as total_count, count(*) FILTER (WHERE LOWER(pq.status) IN ('received','completed')) as received_count
          FROM part_quotes pq JOIN estimates e ON e.id = pq.estimate_id
          WHERE e.company_id = ${companyId} AND e.lead_id::text = ANY(${sql.array(carInLeadIds)})
          GROUP BY e.lead_id
        ) sub WHERE lead_id IS NOT NULL GROUP BY lead_id`.catch(() => []),
        sql`SELECT DISTINCT ON (qc.lead_id) qc.lead_id, qc.id, qc.status FROM quality_checks qc WHERE qc.company_id = ${companyId} AND qc.lead_id::text = ANY(${sql.array(carInLeadIds)}) ORDER BY qc.lead_id, qc.created_at DESC`.catch(() => []),
        sql`SELECT DISTINCT ON (g.lead_id) g.lead_id, g.id, g.status FROM gatepasses g WHERE g.company_id = ${companyId} AND g.lead_id::text = ANY(${sql.array(carInLeadIds)}) ORDER BY g.lead_id, g.created_at DESC`.catch(() => []),
        sql`SELECT DISTINCT ON (pf.lead_id) pf.lead_id, pf.status, pf.submitted_at FROM pre_inspection_form_requests pf WHERE pf.lead_id::text = ANY(${sql.array(carInLeadIds)}) ORDER BY pf.lead_id, pf.created_at DESC`.catch(() => []),
      ]);
      // Parts detail per lead
      const partsDetailRows = await sql`
        SELECT pq.id, pq.status, COALESCE(li.product_name, 'Part') as part_name,
               pq.oem, pq.oe, pq.aftm, pq.used, pq.vendor_part_number,
               pq.delivery_note_no, pq.delivery_note_status,
               v.name as vendor_name, li.lead_id, e.lead_id as est_lead_id
        FROM part_quotes pq
        LEFT JOIN line_items li ON li.id = pq.line_item_id
        LEFT JOIN estimates e ON e.id = pq.estimate_id
        LEFT JOIN vendors v ON v.id = pq.vendor_id
        WHERE pq.company_id = ${companyId}
          AND (li.lead_id::text = ANY(${sql.array(carInLeadIds)}) OR e.lead_id::text = ANY(${sql.array(carInLeadIds)}))
        ORDER BY pq.updated_at DESC
      `.catch(() => [] as any[]);
      const partsDetailByLead: Record<string, any[]> = {};
      for (const row of partsDetailRows) {
        const lid = String(row.lead_id ?? row.est_lead_id ?? "");
        if (!lid) continue;
        if (!partsDetailByLead[lid]) partsDetailByLead[lid] = [];
        const price = Number(row.oem ?? row.oe ?? row.aftm ?? row.used ?? 0);
        const type = row.oem ? "OEM" : row.oe ? "OE" : row.aftm ? "AFTM" : row.used ? "Used" : "—";
        partsDetailByLead[lid].push({ id: row.id, partName: row.part_name, status: row.status, vendorName: row.vendor_name, vendorPartNumber: row.vendor_part_number, price, type, deliveryNoteNo: row.delivery_note_no, deliveryNoteStatus: row.delivery_note_status });
      }
      for (const lid of carInLeadIds) {
        const insp = (inspRows as any[]).find((r: any) => String(r.lead_id) === lid);
        const est = (estRows as any[]).find((r: any) => String(r.lead_id) === lid);
        const jc = (jcRows as any[]).find((r: any) => String(r.lead_id) === lid);
        const inv = (invoiceRows as any[]).find((r: any) => String(r.lead_id) === lid);
        const parts = (partsRows as any[]).find((r: any) => String(r.lead_id) === lid);
        const qc = (qcRows as any[]).find((r: any) => String(r.lead_id) === lid);
        const gp = (gpRows as any[]).find((r: any) => String(r.lead_id) === lid);
        const form = (formRows as any[]).find((r: any) => String(r.lead_id) === lid);
        workflowByLead[lid] = {
          inspection: insp ? { id: insp.id, status: insp.status } : null,
          estimate: est ? { id: est.id, status: est.status, grandTotal: Number(est.grand_total ?? 0) } : null,
          jobCard: jc ? (() => {
            const draft = (jc.inspection_draft_payload ?? {}) as Record<string, any>;
            const finalPhotos = (draft?.jobCardFinalInspectionCarPhotos ?? {}) as Record<string, string>;
            const washMedia = (draft?.jobCardCarWashMedia ?? {}) as Record<string, string>;
            return {
              id: jc.id, status: jc.status, startAt: jc.start_at, completeAt: jc.complete_at,
              finalInspectionAt: jc.final_inspection_at, finalInspectionBy: jc.final_inspection_by,
              carWash: jc.final_inspection_car_wash,
              testDrive: jc.final_inspection_test_drive, clusterWarning: jc.final_inspection_cluster_warning,
              tyreCheck: jc.final_inspection_tyre_check, computerReset: jc.final_inspection_computer_reset,
              protectiveShields: jc.final_inspection_protective_shields,
              finalRemarks: jc.final_inspection_remarks, carOutVideoId: jc.final_inspection_car_out_video_id,
              finalPhotos: {
                front: finalPhotos.front ?? null, rear: finalPhotos.rear ?? null,
                right: finalPhotos.right ?? null, left: finalPhotos.left ?? null,
              },
              carWashMedia: {
                front: washMedia.front ?? null, rear: washMedia.rear ?? null,
                right: washMedia.right ?? null, left: washMedia.left ?? null,
                video: washMedia.video ?? null,
              },
              carWashNotes: String(draft?.jobCardCarWashNotes ?? ""),
            };
          })() : null,
          invoice: inv ? { id: inv.id, status: inv.status, grandTotal: Number(inv.grand_total ?? 0), invoiceNumber: inv.invoice_number } : null,
          parts: parts ? { orderedCount: Number(parts.ordered_count ?? 0), receivedCount: Number(parts.received_count ?? 0), items: partsDetailByLead[lid] ?? [] } : (partsDetailByLead[lid]?.length ? { orderedCount: 0, receivedCount: 0, items: partsDetailByLead[lid] } : null),
          qualityCheck: qc ? { id: qc.id, status: qc.status } : null,
          gatepass: gp ? { id: gp.id, status: gp.status } : null,
          preInspectionForm: form ? { status: form.status, submittedAt: form.submitted_at } : null,
        };
      }
    }

    // Revenue for this advisor
    const [revRow] = empId ? await sql<{ revenue: number; invoices: number }[]>`
      SELECT COALESCE(SUM(i.grand_total), 0)::numeric as revenue, COUNT(*)::int as invoices
      FROM invoices i JOIN leads l ON l.id = i.lead_id
      WHERE i.company_id = ${companyId} AND l.agent_employee_id = ${empId}
    ` : [{ revenue: 0, invoices: 0 }];

    // Car-out count and today's collection
    const carOutCount = leads.filter((l: any) => ["closed_won", "closed", "completed"].includes(l.lead_status)).length;
    const [todayCollectionRow] = empId ? await sql<{ total: number }[]>`
      SELECT COALESCE(SUM(i.grand_total), 0)::numeric as total
      FROM invoices i JOIN leads l ON l.id = i.lead_id
      WHERE i.company_id = ${companyId} AND l.agent_employee_id = ${empId}
        AND i.status = 'paid' AND i.paid_at >= CURRENT_DATE
    `.catch(() => [{ total: 0 }]) : [{ total: 0 }];

    // Pending offers from PIS lead queue for this advisor
    const pendingOffers = await sql<any[]>`
      SELECT q.id AS queue_id, q.lead_id, q.status AS queue_status,
             q.current_tier, q.offered_at, q.locked_until, q.pipeline_value,
             c.name AS customer_name, c.phone AS customer_phone,
             cr.plate_number AS car_plate_number, cr.model AS car_model, cr.make AS car_make,
             l.lead_type, l.service_type, l.lead_stage,
             b.name AS branch_name
      FROM pis_lead_queue q
      JOIN leads l ON l.id = q.lead_id
      LEFT JOIN customers c ON c.id = l.customer_id
      LEFT JOIN cars cr ON cr.id = l.car_id
      LEFT JOIN branches b ON b.id = l.branch_id
      WHERE q.company_id = ${companyId}
        AND q.offered_to_user_id = ${advisorUserId}
        AND q.status = 'offered'
      ORDER BY q.offered_at DESC
    `.catch(() => [] as any[]);

    return NextResponse.json({
      leads: leads.map((l: any) => ({
        id: l.id, customer_name: l.customer_name, customer_phone: l.customer_phone,
        lead_status: l.lead_status, lead_type: l.lead_type, source: l.source,
        created_at: l.created_at, checkinAt: l.checkin_at,
        carPlateNumber: l.car_plate_number, carModel: l.car_model ? `${l.car_make ?? ''} ${l.car_model}`.trim() : null,
        branchName: l.branch_name, serviceType: l.service_type, leadStage: l.lead_stage,
        customerId: l.customer_id ?? null,
        customerWalletAmount: Number(l.customer_wallet_amount ?? 0),
        workflow: workflowByLead[String(l.id)] ?? null,
      })),
      calls: calls.map((c: any) => ({
        id: c.id, direction: c.direction, from_number: c.from_number, to_number: c.to_number,
        status: c.status, duration_seconds: c.duration_seconds, created_at: c.created_at,
        customer_name: c.customer_name,
      })),
      pendingOffers: pendingOffers.map((o: any) => ({
        queueId: o.queue_id, leadId: o.lead_id, queueStatus: o.queue_status,
        tier: o.current_tier, offeredAt: o.offered_at, lockedUntil: o.locked_until,
        pipelineValue: Number(o.pipeline_value ?? 0),
        customerName: o.customer_name, customerPhone: o.customer_phone,
        carPlate: o.car_plate_number, carModel: o.car_model ? `${o.car_make ?? ''} ${o.car_model}`.trim() : null,
        leadType: o.lead_type, serviceType: o.service_type, leadStage: o.lead_stage,
        branchName: o.branch_name,
      })),
      kpis: {
        totalLeads, convertedLeads, carInLeads, totalCalls, answerRate,
        revenue: Number(revRow?.revenue ?? 0), invoiceCount: revRow?.invoices ?? 0,
        carOutCount, todayCollection: Number(todayCollectionRow?.total ?? 0),
      },
    });
  } catch (error: any) {
    console.error("PIS advisor-portal error:", error);
    return NextResponse.json({ error: "Failed to load advisor data" }, { status: 500 });
  }
}
