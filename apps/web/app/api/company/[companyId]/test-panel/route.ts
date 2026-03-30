import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";
import { getCurrentUserIdFromRequest } from "../../../../../lib/auth/current-user";

type Ctx = { params: Promise<{ companyId: string }> };

type StepResult = {
  step: number;
  name: string;
  status: "pass" | "warn" | "fail" | "pending";
  message: string;
  objectives: {
    id: string;
    label: string;
    status: "pass" | "warn" | "fail";
    detail: string;
  }[];
  data?: Record<string, unknown>;
};

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
  const userId = await getCurrentUserIdFromRequest(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyId } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get("leadId");

  if (!leadId) {
    // Return recent leads for selection
    const sql = getSql();
    const leads = await sql`
      SELECT l.id, l.lead_type, l.lead_status, l.lead_stage,
             l.created_at, l.closed_at,
             c.name AS customer_name, c.phone AS customer_phone,
             ca.plate_number, ca.make, ca.model
      FROM leads l
      LEFT JOIN customers c ON c.id = l.customer_id
      LEFT JOIN cars ca ON ca.id = l.car_id
      WHERE l.company_id = ${companyId}
      ORDER BY l.created_at DESC
      LIMIT 20
    `;
    return NextResponse.json({ mode: "select", leads });
  }

  const sql = getSql();
  const steps: StepResult[] = [];

  // ─── Step 1: Lead Creation ───
  const [lead] = await sql`
    SELECT l.*, c.name AS customer_name, c.phone AS customer_phone,
           c.email AS customer_email, c.code AS customer_code,
           ca.plate_number, ca.make, ca.model, ca.model_year, ca.vin
    FROM leads l
    LEFT JOIN customers c ON c.id = l.customer_id
    LEFT JOIN cars ca ON ca.id = l.car_id
    WHERE l.id = ${leadId} AND l.company_id = ${companyId}
  `;
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const leadEvents = await sql`
    SELECT event_type, created_at FROM lead_events
    WHERE lead_id = ${leadId} ORDER BY created_at ASC
  `;

  const carLink = lead.customer_id && lead.car_id
    ? await sql`SELECT id FROM customer_car_links WHERE customer_id = ${lead.customer_id} AND car_id = ${lead.car_id} LIMIT 1`
    : [];

  // ── Booking data ──
  const bookings = await sql`
    SELECT id, booking_kind, scheduled_at, status, priority,
           pickup_location, dropoff_location, notes
    FROM lead_bookings
    WHERE lead_id = ${leadId} AND company_id = ${companyId}
    ORDER BY created_at DESC
  `;
  const activeBooking = bookings.find((b: any) => b.status === "active");
  const hasBookingEvent = leadEvents.some((e: any) => e.event_type === "lead_booking_saved");

  // ── Pre-inspection form ──
  const preInspForms = await sql`
    SELECT id, status, token, submitted_at, appointment_type
    FROM pre_inspection_form_requests
    WHERE lead_id = ${leadId}
    ORDER BY created_at DESC LIMIT 1
  `.catch(() => [] as any[]);

  // ── Recovery request ──
  const recoveryReqs = await sql`
    SELECT id, status FROM recovery_requests
    WHERE lead_id = ${leadId} LIMIT 1
  `.catch(() => [] as any[]);

  // ── Queue data ──
  const queueEntries = await sql`
    SELECT q.id, q.status, q.current_tier, q.cascade_count,
           q.offered_to_user_id, q.offered_at, q.accepted_at,
           q.locked_until, q.pipeline_value, q.released_at,
           u.full_name AS offered_to_name
    FROM pis_lead_queue q
    LEFT JOIN users u ON u.id = q.offered_to_user_id
    WHERE q.lead_id = ${leadId} AND q.company_id = ${companyId}
    ORDER BY q.created_at DESC LIMIT 1
  `.catch(() => [] as any[]);
  const queueEntry = queueEntries[0];

  const queueHistory = queueEntry ? await sql`
    SELECT action, tier_at_action, advisor_user_id, penalty_points, created_at
    FROM pis_lead_queue_history
    WHERE queue_id = ${queueEntry.id}
    ORDER BY created_at ASC
  `.catch(() => [] as any[]) : [];

  // ── Step 1A: Lead & Customer Data ──
  const s1aObjectives = [
    { id: "1.1", label: "Lead exists with type 'workshop'", status: lead.lead_type === "workshop" ? "pass" as const : "warn" as const, detail: `Type: ${lead.lead_type}` },
    { id: "1.2", label: "Customer linked (name + phone)", status: lead.customer_name && lead.customer_phone ? "pass" as const : lead.customer_name || lead.customer_phone ? "warn" as const : "fail" as const, detail: `${lead.customer_name || "No name"} | ${lead.customer_phone || "No phone"}` },
    { id: "1.3", label: "Car linked (plate, make, model, year)", status: lead.plate_number && lead.make && lead.model ? "pass" as const : lead.plate_number ? "warn" as const : "fail" as const, detail: `${lead.plate_number || "No plate"} ${lead.make || ""} ${lead.model || ""} ${lead.model_year || ""}`.trim() },
    { id: "1.4", label: "Customer-car link established", status: carLink.length > 0 ? "pass" as const : "warn" as const, detail: carLink.length > 0 ? "Linked" : "No link found" },
    { id: "1.5", label: "Lead status is valid", status: ["open", "processing", "accepted", "car_in", "closed_won", "closed", "assigned", "onboarding", "inprocess", "completed"].includes(lead.lead_status) ? "pass" as const : "warn" as const, detail: `Status: ${lead.lead_status}` },
    { id: "1.6", label: "Lead stage is set", status: lead.lead_stage ? "pass" as const : "warn" as const, detail: `Stage: ${lead.lead_stage || "Not set"}` },
    { id: "1.7", label: "Lead events audit trail exists", status: leadEvents.length > 0 ? "pass" as const : "fail" as const, detail: `${leadEvents.length} event(s)` },
    { id: "1.8", label: "Branch assigned", status: lead.branch_id ? "pass" as const : "warn" as const, detail: lead.branch_id ? "Assigned" : "No branch" },
  ];

  // ── Step 1B: Booking ──
  const isRecoveryBooking = activeBooking?.booking_kind === "workshop_recovery" || activeBooking?.booking_kind === "recovery";
  const s1bObjectives = [
    { id: "1.11", label: "Booking record exists", status: bookings.length > 0 ? "pass" as const : "warn" as const, detail: bookings.length > 0 ? `${bookings.length} booking(s)` : "No booking created" },
    { id: "1.12", label: "Booking kind matches lead type", status: activeBooking ? "pass" as const : "warn" as const, detail: activeBooking ? `Kind: ${activeBooking.booking_kind}` : "No active booking" },
    { id: "1.13", label: "Scheduled date/time is set", status: activeBooking?.scheduled_at ? "pass" as const : activeBooking ? "fail" as const : "warn" as const, detail: activeBooking?.scheduled_at ? `At: ${activeBooking.scheduled_at}` : "Not scheduled" },
    { id: "1.14", label: "Booking status is 'active'", status: activeBooking?.status === "active" ? "pass" as const : bookings.length > 0 ? "warn" as const : "warn" as const, detail: activeBooking ? `Status: ${activeBooking.status}` : "N/A" },
    { id: "1.15", label: "Booking priority is set", status: activeBooking?.priority ? "pass" as const : activeBooking ? "warn" as const : "warn" as const, detail: activeBooking ? `Priority: ${activeBooking.priority}` : "N/A" },
    { id: "1.16", label: "Pickup/dropoff locations (if recovery)", status: !isRecoveryBooking ? "pass" as const : (activeBooking?.pickup_location && activeBooking?.dropoff_location) ? "pass" as const : activeBooking?.pickup_location ? "warn" as const : "fail" as const, detail: isRecoveryBooking ? `Pickup: ${activeBooking?.pickup_location || "Missing"} | Dropoff: ${activeBooking?.dropoff_location || "Missing"}` : "Not recovery type" },
    { id: "1.17", label: "Workshop visit mode set on lead", status: lead.workshop_visit_mode ? "pass" as const : lead.lead_type === "workshop" ? "warn" as const : "pass" as const, detail: lead.workshop_visit_mode ? `Mode: ${lead.workshop_visit_mode}` : "Not set" },
    { id: "1.18", label: "Booking event logged", status: hasBookingEvent ? "pass" as const : bookings.length > 0 ? "warn" as const : "warn" as const, detail: hasBookingEvent ? "Event recorded" : "No booking event" },
    { id: "1.19", label: "Pre-inspection form created", status: preInspForms.length > 0 ? "pass" as const : "warn" as const, detail: preInspForms.length > 0 ? `Form: ${preInspForms[0].status}` : "No form" },
    { id: "1.20", label: "Recovery request (if applicable)", status: !isRecoveryBooking ? "pass" as const : recoveryReqs.length > 0 ? "pass" as const : "fail" as const, detail: isRecoveryBooking ? (recoveryReqs.length > 0 ? `Request: ${recoveryReqs[0].status}` : "Missing") : "Not applicable" },
  ];

  // ── Step 1C: Pre-Inspection Form ──
  const preInspForm = preInspForms[0];
  const s1cObjectives = [
    { id: "1.23", label: "Pre-inspection form created", status: preInspForms.length > 0 ? "pass" as const : bookings.length > 0 ? "warn" as const : "warn" as const, detail: preInspForm ? `Token: ${preInspForm.token ? "yes" : "no"} | Status: ${preInspForm.status}` : "No form created" },
    { id: "1.24", label: "Form status", status: preInspForm?.status === "submitted" ? "pass" as const : preInspForm ? "warn" as const : "warn" as const, detail: preInspForm ? `Status: ${preInspForm.status}` : "N/A" },
    { id: "1.25", label: "Form submitted by customer", status: preInspForm?.status === "submitted" ? "pass" as const : preInspForm ? "warn" as const : "warn" as const, detail: preInspForm?.submitted_at ? `Submitted: ${preInspForm.submitted_at}` : "Not yet submitted" },
  ];

  // ── Step 1D: Check-In Queue ──
  const hasCheckedIn = lead.lead_status === "car_in" || lead.lead_stage === "checkin" || Boolean(lead.checkin_at) || ["closed_won", "closed", "completed"].includes(lead.lead_status);
  const s1dObjectives = [
    { id: "1.35", label: "Car checked in", status: hasCheckedIn ? "pass" as const : preInspForm?.status === "submitted" ? "warn" as const : "warn" as const, detail: hasCheckedIn ? `Status: ${lead.lead_status} | Stage: ${lead.lead_stage}` : "Not checked in yet" },
    { id: "1.36", label: "Check-in timestamp set", status: lead.checkin_at ? "pass" as const : hasCheckedIn ? "warn" as const : "warn" as const, detail: lead.checkin_at ? `At: ${lead.checkin_at}` : "N/A" },
    { id: "1.37", label: "Lead moved to Inspection Queue", status: hasCheckedIn ? "pass" as const : "warn" as const, detail: hasCheckedIn ? "In inspection queue" : "Still in check-in queue" },
  ];

  const allS1 = [...s1aObjectives, ...s1bObjectives, ...s1cObjectives, ...s1dObjectives];
  steps.push({
    step: 1, name: "Lead Creation",
    status: allS1.some(o => o.status === "fail") ? "fail" : allS1.some(o => o.status === "warn") ? "warn" : "pass",
    message: `Lead ${lead.lead_type} | ${lead.lead_status} | Booking: ${activeBooking ? activeBooking.booking_kind : "none"} | Form: ${preInspForm?.status || "none"} | Check-in: ${hasCheckedIn ? "done" : "pending"}`,
    objectives: allS1,
    data: {
      leadId: lead.id, leadType: lead.lead_type, leadStatus: lead.lead_status, leadStage: lead.lead_stage,
      bookingId: activeBooking?.id, bookingKind: activeBooking?.booking_kind, bookingStatus: activeBooking?.status,
      formStatus: preInspForm?.status, checkedIn: hasCheckedIn,
    },
  });

  // ─── Step 2: Advisor Assign (Auto via PIS after car check-in) ───
  const s2Objectives = hasCheckedIn ? [
    { id: "2.1", label: "Auto-assign triggered on car check-in", status: queueEntry ? "pass" as const : "fail" as const, detail: queueEntry ? `Queue ID: ${queueEntry.id}` : "No PIS queue entry -- auto-assign may have failed" },
    { id: "2.2", label: "PIS queue status", status: queueEntry ? (["accepted", "completed", "locked"].includes(queueEntry.status) ? "pass" as const : ["offered", "pending"].includes(queueEntry.status) ? "warn" as const : "fail" as const) : "fail" as const, detail: queueEntry ? `Status: ${queueEntry.status}` : "N/A" },
    { id: "2.3", label: "Offered to best-scored advisor", status: queueEntry?.offered_to_user_id ? "pass" as const : queueEntry ? "warn" as const : "fail" as const, detail: queueEntry?.offered_to_name ? `Advisor: ${queueEntry.offered_to_name}` : "Not offered" },
    { id: "2.4", label: "Acceptance timeout set", status: queueEntry?.locked_until ? "pass" as const : queueEntry?.offered_to_user_id ? "warn" as const : "fail" as const, detail: queueEntry?.locked_until ? `Until: ${queueEntry.locked_until}` : "N/A" },
    { id: "2.5", label: "Advisor accepted", status: queueEntry?.accepted_at ? "pass" as const : queueEntry ? "warn" as const : "fail" as const, detail: queueEntry?.accepted_at ? `Accepted: ${queueEntry.accepted_at}` : "Awaiting acceptance" },
    { id: "2.6", label: "Advisor set on lead", status: lead.agent_employee_id ? "pass" as const : queueEntry?.accepted_at ? "warn" as const : "warn" as const, detail: lead.agent_employee_id ? `Employee: ${lead.agent_employee_id}` : "Not yet assigned" },
    { id: "2.7", label: "Assignment timestamp recorded", status: lead.assigned_at ? "pass" as const : lead.agent_employee_id ? "warn" as const : "warn" as const, detail: lead.assigned_at ? `At: ${lead.assigned_at}` : "N/A" },
    { id: "2.8", label: "Queue history logged", status: queueHistory.length > 0 ? "pass" as const : queueEntry ? "warn" as const : "fail" as const, detail: `${queueHistory.length} action(s)` },
  ] : [
    { id: "2.1", label: "Auto-assign (triggers after car check-in)", status: "pass" as const, detail: "Not applicable yet -- car not checked in" },
  ];
  steps.push({
    step: 2, name: "Advisor Assign",
    status: !hasCheckedIn ? "pending" : s2Objectives.some(o => o.status === "fail") ? "fail" : s2Objectives.some(o => o.status === "warn") ? "warn" : "pass",
    message: !hasCheckedIn ? "Waiting for car check-in" : lead.agent_employee_id ? `Assigned: ${queueEntry?.offered_to_name || lead.agent_employee_id}` : queueEntry ? `Queue: ${queueEntry.status}` : "Auto-assign not triggered",
    objectives: s2Objectives,
  });

  // ─── Step 3: Inspection ───
  const inspections = await sql`
    SELECT i.*, (SELECT count(*) FROM line_items li WHERE li.inspection_id = i.id) AS item_count,
           (SELECT count(*) FROM inspection_media im WHERE im.inspection_id = i.id) AS media_count
    FROM inspections i WHERE i.lead_id = ${leadId}
    ORDER BY i.created_at DESC LIMIT 1
  `;
  const insp = inspections[0];
  const s3Objectives = [
    { id: "3.1", label: "Inspection exists for this lead", status: insp ? "pass" as const : "fail" as const, detail: insp ? `ID: ${insp.id}` : "No inspection found" },
    { id: "3.2", label: "Inspector/Advisor assigned", status: (insp?.inspector_employee_id || insp?.advisor_employee_id || lead.agent_employee_id) ? "pass" as const : insp ? "warn" as const : "fail" as const, detail: insp?.inspector_employee_id ? `Inspector: ${insp.inspector_employee_id}` : insp?.advisor_employee_id ? `Advisor: ${insp.advisor_employee_id}` : lead.agent_employee_id ? `Lead advisor: ${lead.agent_employee_id}` : "Not assigned" },
    { id: "3.3", label: "Line items added", status: insp && Number(insp.item_count) > 0 ? "pass" as const : insp ? "fail" as const : "fail" as const, detail: insp ? `${insp.item_count} item(s)` : "N/A" },
    { id: "3.4", label: "Media uploaded", status: insp && Number(insp.media_count) > 0 ? "pass" as const : "pass" as const, detail: insp ? `${insp.media_count} file(s) (optional)` : "N/A" },
    { id: "3.5", label: "Inspection completed", status: insp?.status === "completed" ? "pass" as const : insp ? "warn" as const : "fail" as const, detail: insp ? `Status: ${insp.status}` : "N/A" },
  ];
  steps.push({
    step: 3, name: "Inspection",
    status: !insp ? "pending" : s3Objectives.some(o => o.status === "fail") ? "fail" : s3Objectives.some(o => o.status === "warn") ? "warn" : "pass",
    message: !insp ? "No inspection created yet" : `${insp.status} | ${insp.item_count} items | ${insp.media_count} media`,
    objectives: s3Objectives,
    data: insp ? { inspectionId: insp.id, status: insp.status } : undefined,
  });

  // ─── Step 4: Estimate ───
  const estimates = await sql`
    SELECT e.*, (SELECT count(*) FROM estimate_items ei WHERE ei.estimate_id = e.id) AS item_count
    FROM estimates e WHERE e.lead_id = ${leadId}
    ORDER BY e.created_at DESC LIMIT 1
  `;
  const est = estimates[0];
  const s4Objectives = [
    { id: "4.1", label: "Estimate exists for this lead", status: est ? "pass" as const : "fail" as const, detail: est ? `ID: ${est.id}` : "No estimate found" },
    { id: "4.2", label: "Estimate items populated", status: est && Number(est.item_count) > 0 ? "pass" as const : est && insp && Number(insp.item_count) > 0 ? "pass" as const : est ? "warn" as const : "fail" as const, detail: est ? (Number(est.item_count) > 0 ? `${est.item_count} estimate item(s)` : Number(insp?.item_count ?? 0) > 0 ? `${insp.item_count} inspection item(s) (set pricing in estimate)` : "No items -- add in estimate page") : "N/A" },
    { id: "4.3", label: "Totals calculated", status: est && (est.grand_total || est.total) ? "pass" as const : est ? "warn" as const : "fail" as const, detail: est ? `Total: ${est.grand_total || est.total || "Not set"}` : "N/A" },
    { id: "4.4", label: "Estimate linked to inspection", status: est?.inspection_id ? "pass" as const : est ? "warn" as const : "fail" as const, detail: est?.inspection_id ? "Linked" : "Not linked" },
  ];
  steps.push({
    step: 4, name: "Estimate",
    status: !est ? "pending" : s4Objectives.some(o => o.status === "fail") ? "fail" : s4Objectives.some(o => o.status === "warn") ? "warn" : "pass",
    message: !est ? "No estimate created yet" : `${est.status} | ${est.item_count} items | Total: ${est.grand_total || est.total || "N/A"}`,
    objectives: s4Objectives,
    data: est ? { estimateId: est.id, status: est.status } : undefined,
  });

  // ─── Step 5: Estimate Approval ───
  const estMeta = est?.meta as Record<string, any> | null;
  const approval = estMeta?.customerEstimateApproval;
  const s5Objectives = [
    { id: "5.1", label: "Approval link generated", status: approval?.token ? "pass" as const : est ? "fail" as const : "fail" as const, detail: approval?.token ? "Token exists" : "No token" },
    { id: "5.2", label: "Approval shared with customer", status: approval?.sharedAt ? "pass" as const : approval ? "warn" as const : "fail" as const, detail: approval?.sharedAt ? `Shared: ${approval.sharedAt}` : "Not shared" },
    { id: "5.3", label: "Customer approved estimate", status: approval?.status === "approved" ? "pass" as const : est?.status === "approved" ? "pass" as const : approval ? "warn" as const : "fail" as const, detail: approval?.status || est?.status || "N/A" },
    { id: "5.4", label: "Customer signature captured", status: approval?.signatureDataUrl ? "pass" as const : approval?.status === "approved" ? "warn" as const : "fail" as const, detail: approval?.signatureDataUrl ? "Signed" : "No signature" },
    { id: "5.5", label: "Terms accepted", status: approval?.termsAccepted ? "pass" as const : approval?.status === "approved" ? "warn" as const : "fail" as const, detail: approval?.termsAccepted ? "Accepted" : "Not accepted" },
  ];
  steps.push({
    step: 5, name: "Estimate Approval",
    status: !est ? "pending" : (approval?.status === "approved" || est?.status === "approved") ? "pass" : approval ? "warn" : "pending",
    message: !est ? "Waiting for estimate" : approval?.status === "approved" || est?.status === "approved" ? "Customer approved" : approval ? "Awaiting customer approval" : "Approval link not generated",
    objectives: s5Objectives,
  });

  // ─── Step 6: Parts Approval ───
  const partQuotes = est ? await sql`
    SELECT pq.status, count(*) AS cnt
    FROM part_quotes pq
    WHERE pq.company_id = ${companyId}
      AND (
        pq.estimate_id = ${est.id}
        OR pq.line_item_id IN (SELECT li.id FROM line_items li WHERE li.inspection_id = ${insp?.id ?? null})
        OR pq.line_item_id IN (SELECT li.id FROM line_items li WHERE li.lead_id = ${leadId})
      )
    GROUP BY pq.status
  `.catch(() => [] as any[]) : [];
  const totalParts = partQuotes.reduce((s: number, r: any) => s + Number(r.cnt), 0);
  const approvedParts = partQuotes.find((r: any) => r.status === "approved" || r.status === "Approved");
  const quotedParts = partQuotes.find((r: any) => r.status === "quoted" || r.status === "Quoted");
  const orderedParts = partQuotes.find((r: any) => r.status?.toLowerCase() === "ordered");
  const receivedParts = partQuotes.find((r: any) => ["received", "completed"].includes(r.status?.toLowerCase()));
  const statusSummary = partQuotes.map((r: any) => `${r.status}: ${r.cnt}`).join(", ");
  const s6Objectives = [
    { id: "6.1", label: "Part quotes exist", status: totalParts > 0 ? "pass" as const : est ? "fail" as const : "fail" as const, detail: totalParts > 0 ? `${totalParts} quote(s) (${statusSummary})` : "0 quote(s)" },
    { id: "6.2", label: "Vendors provided quotes", status: quotedParts || approvedParts || orderedParts || receivedParts ? "pass" as const : totalParts > 0 ? "warn" as const : "fail" as const, detail: statusSummary || "None" },
    { id: "6.3", label: "Parts approved/ordered", status: approvedParts || orderedParts || receivedParts ? "pass" as const : totalParts > 0 ? "warn" as const : "fail" as const, detail: approvedParts ? `${approvedParts.cnt} approved` : orderedParts ? `${orderedParts.cnt} ordered` : receivedParts ? `${receivedParts.cnt} received` : "None approved" },
  ];
  steps.push({
    step: 6, name: "Parts Approval",
    status: !est ? "pending" : totalParts === 0 ? "pending" : (approvedParts || orderedParts || receivedParts) ? "pass" : "warn",
    message: totalParts === 0 ? "No part quotes yet" : `${totalParts} quotes | ${statusSummary}`,
    objectives: s6Objectives,
  });

  // ─── Step 7: Procurement ───
  let pos: any[] = [];
  if (leadId) {
    try {
      // Search by notes containing lead ID or estimate ID
      const leadPattern = `%${leadId}%`;
      const estPattern = est ? `%${est.id}%` : "%NOMATCH%";
      pos = await sql`
        SELECT po.id, po.status, po.po_number,
               (SELECT count(*) FROM purchase_order_items poi WHERE poi.purchase_order_id = po.id) AS item_count,
               (SELECT count(*) FROM purchase_order_items poi WHERE poi.purchase_order_id = po.id AND poi.status = 'received') AS received_count
        FROM purchase_orders po
        WHERE po.company_id = ${companyId}
          AND (po.notes LIKE ${leadPattern} OR po.notes LIKE ${estPattern})
        ORDER BY po.created_at DESC
        LIMIT 1
      `;
      // Fallback: search by PO items linked to line items for this lead
      if (!pos.length) {
        pos = await sql`
          SELECT DISTINCT po.id, po.status, po.po_number,
                 (SELECT count(*) FROM purchase_order_items poi WHERE poi.purchase_order_id = po.id) AS item_count,
                 (SELECT count(*) FROM purchase_order_items poi WHERE poi.purchase_order_id = po.id AND poi.status = 'received') AS received_count
          FROM purchase_orders po
          JOIN purchase_order_items poi2 ON poi2.purchase_order_id = po.id
          WHERE po.company_id = ${companyId}
            AND poi2.estimate_item_id IN (SELECT id FROM line_items WHERE lead_id = ${leadId})
          ORDER BY po.created_at DESC
          LIMIT 1
        `;
      }
    } catch (e) {
      console.error("[TestPanel] PO query error:", e);
      pos = [];
    }
  }
  const po = pos[0];
  const s7Objectives = [
    { id: "7.1", label: "Purchase order created", status: po ? "pass" as const : est ? "fail" as const : "fail" as const, detail: po ? `PO: ${po.po_number || po.id}` : "No PO" },
    { id: "7.2", label: "PO issued to vendor", status: po && po.status !== "draft" ? "pass" as const : po ? "warn" as const : "fail" as const, detail: po ? `Status: ${po.status}` : "N/A" },
    { id: "7.3", label: "PO items match estimate", status: po && Number(po.item_count) > 0 ? "pass" as const : po ? "fail" as const : "fail" as const, detail: po ? `${po.item_count} item(s)` : "N/A" },
    { id: "7.4", label: "Goods received (GRN)", status: po && Number(po.received_count) > 0 ? (Number(po.received_count) === Number(po.item_count) ? "pass" as const : "warn" as const) : po ? "fail" as const : "fail" as const, detail: po ? `${po.received_count}/${po.item_count} received` : "N/A" },
  ];
  steps.push({
    step: 7, name: "Procurement",
    status: !po ? "pending" : po.status === "received" ? "pass" : po.status === "partially_received" ? "warn" : po.status === "issued" ? "warn" : "pending",
    message: !po ? "No purchase order yet" : `PO ${po.po_number || ""} | ${po.status} | ${po.received_count}/${po.item_count} received`,
    objectives: s7Objectives,
  });

  // ─── Step 8: Job Card ───
  const jobCards = est ? await sql`
    SELECT jc.*
    FROM job_cards jc WHERE jc.estimate_id = ${est.id}
    ORDER BY jc.created_at DESC LIMIT 1
  ` : [];
  const jc = jobCards[0];
  const s8Objectives = [
    { id: "8.1", label: "Job card created", status: jc ? "pass" as const : est ? "fail" as const : "fail" as const, detail: jc ? `ID: ${jc.id}` : "No job card" },
    { id: "8.2", label: "Collect car completed", status: jc?.collect_car_at ? "pass" as const : jc ? "warn" as const : "fail" as const, detail: jc?.collect_car_at ? `At: ${jc.collect_car_at}` : "Not done" },
    { id: "8.3", label: "Pre-work check completed", status: jc?.pre_work_checked_at ? "pass" as const : jc ? "warn" as const : "fail" as const, detail: jc?.pre_work_checked_at ? "Done" : "Not done" },
    { id: "8.4", label: "Job card started", status: jc?.start_at ? "pass" as const : jc ? "warn" as const : "fail" as const, detail: jc?.start_at ? `Started: ${jc.start_at}` : "Not started" },
    { id: "8.6", label: "Job card completed", status: jc?.status === "Completed" ? "pass" as const : jc?.start_at ? "warn" as const : "fail" as const, detail: jc ? `Status: ${jc.status}` : "N/A" },
    { id: "8.7", label: "Final inspection done", status: jc?.final_inspection_at ? "pass" as const : jc?.status === "Completed" ? "warn" as const : "fail" as const, detail: jc?.final_inspection_at ? "Done" : "Not done" },
  ];
  steps.push({
    step: 8, name: "Job Card",
    status: !jc ? "pending" : jc.status === "Completed" && jc.final_inspection_at ? "pass" : jc.start_at ? "warn" : "pending",
    message: !jc ? "No job card yet" : `${jc.status} | ${jc.start_at ? "Started" : "Not started"} | ${jc.final_inspection_at ? "Inspected" : "Not inspected"}`,
    objectives: s8Objectives,
    data: jc ? { jobCardId: jc.id, status: jc.status } : undefined,
  });

  // ─── Step 9: Quality Check (via Job Card Final Inspection) ───
  const finalInspDone = Boolean(jc?.final_inspection_at);
  const s9Objectives = [
    { id: "9.1", label: "Final inspection completed", status: finalInspDone ? "pass" as const : jc?.status === "Completed" ? "warn" as const : "fail" as const, detail: finalInspDone ? `Inspected at: ${jc.final_inspection_at}` : "Not done" },
    { id: "9.2", label: "Test drive done", status: finalInspDone ? "pass" as const : "warn" as const, detail: finalInspDone ? "Completed" : "Pending" },
    { id: "9.3", label: "Parts verified", status: finalInspDone ? "pass" as const : "warn" as const, detail: finalInspDone ? "All parts verified" : "Pending verification" },
    { id: "9.4", label: "Car wash completed", status: jc?.final_inspection_car_wash ? "pass" as const : finalInspDone ? "warn" as const : "fail" as const, detail: jc?.final_inspection_car_wash ? "Done" : "Not done" },
  ];
  steps.push({
    step: 9, name: "Quality Check",
    status: !jc ? "pending" : finalInspDone ? "pass" : jc?.status === "Completed" ? "warn" : "pending",
    message: !jc ? "No job card yet" : finalInspDone ? "Final inspection completed" : "Pending final inspection",
    objectives: s9Objectives,
  });

  // ─── Step 10: Car Wash ───
  const s10Objectives = [
    { id: "10.1", label: "Car wash completed on job card", status: jc?.final_inspection_car_wash ? "pass" as const : jc?.final_inspection_at ? "warn" as const : "fail" as const, detail: jc?.final_inspection_car_wash ? "Done" : "Not done" },
    { id: "10.2", label: "Car wash media uploaded", status: jc?.car_wash_media || (jc?.final_inspection_car_wash) ? "pass" as const : jc ? "warn" as const : "fail" as const, detail: jc?.final_inspection_car_wash ? "Media present" : "No media" },
  ];
  steps.push({
    step: 10, name: "Car Wash",
    status: !jc ? "pending" : jc.final_inspection_car_wash ? "pass" : jc.final_inspection_at ? "warn" : "pending",
    message: !jc ? "Waiting for job card" : jc.final_inspection_car_wash ? "Car wash completed" : "Car wash not done yet",
    objectives: s10Objectives,
  });

  // ─── Step 11: Car Out / Delivery ───
  const invoices = est ? await sql`
    SELECT inv.id, inv.status, inv.grand_total FROM invoices inv
    WHERE inv.estimate_id = ${est.id}
    ORDER BY inv.created_at DESC LIMIT 1
  ` : [];
  const inv = invoices[0];
  const gatepasses = inv ? await sql`
    SELECT g.* FROM gatepasses g WHERE g.invoice_id = ${inv.id}
    ORDER BY g.created_at DESC LIMIT 1
  ` : [];
  const gp = gatepasses[0];
  const s11Objectives = [
    { id: "11.1", label: "Invoice created", status: inv ? "pass" as const : est ? "fail" as const : "fail" as const, detail: inv ? `Status: ${inv.status} | Total: ${inv.grand_total}` : "No invoice" },
    { id: "11.2", label: "Invoice paid", status: inv?.status === "paid" ? "pass" as const : inv ? "warn" as const : "fail" as const, detail: inv ? `Status: ${inv.status}` : "N/A" },
    { id: "11.3", label: "Gatepass created", status: gp ? "pass" as const : inv ? "fail" as const : "fail" as const, detail: gp ? `ID: ${gp.id}` : "No gatepass" },
    { id: "11.4", label: "Supervisor approved", status: gp?.supervisor_approved_at ? "pass" as const : gp ? "warn" as const : "fail" as const, detail: gp?.supervisor_approved_at ? "Approved" : "Not approved" },
    { id: "11.5", label: "Customer signed", status: gp?.customer_signed ? "pass" as const : gp ? "warn" as const : "fail" as const, detail: gp?.customer_signed ? "Signed" : "Not signed" },
    { id: "11.6", label: "Final video uploaded", status: gp?.final_video_ref ? "pass" as const : gp ? "warn" as const : "fail" as const, detail: gp?.final_video_ref ? "Uploaded" : "Not uploaded" },
    { id: "11.7", label: "Car released", status: gp?.status === "released" ? "pass" as const : gp ? "warn" as const : "fail" as const, detail: gp ? `Status: ${gp.status}` : "N/A" },
    { id: "11.8", label: "Lead closed", status: ["closed", "closed_won"].includes(lead.lead_status) ? "pass" as const : gp?.status === "released" ? "warn" as const : "fail" as const, detail: `Lead: ${lead.lead_status}` },
  ];
  steps.push({
    step: 11, name: "Car Out / Delivery",
    status: gp?.status === "released" ? "pass" : gp ? "warn" : !inv ? "pending" : "pending",
    message: !inv ? "No invoice yet" : !gp ? "No gatepass yet" : gp.status === "released" ? "Car delivered!" : `Gatepass: ${gp.status}`,
    objectives: s11Objectives,
  });

  // ─── Overall Summary ───
  const passCount = steps.filter(s => s.status === "pass").length;
  const warnCount = steps.filter(s => s.status === "warn").length;
  const failCount = steps.filter(s => s.status === "fail").length;
  const pendingCount = steps.filter(s => s.status === "pending").length;

  return NextResponse.json({
    mode: "results",
    lead: {
      id: lead.id,
      type: lead.lead_type,
      status: lead.lead_status,
      stage: lead.lead_stage,
      customerName: lead.customer_name,
      customerPhone: lead.customer_phone,
      car: `${lead.plate_number || ""} ${lead.make || ""} ${lead.model || ""}`.trim(),
      createdAt: lead.created_at,
      closedAt: lead.closed_at,
    },
    summary: { total: 11, pass: passCount, warn: warnCount, fail: failCount, pending: pendingCount },
    steps,
  });
  } catch (err: any) {
    console.error("[TestPanel] Error:", err);
    return NextResponse.json({ error: err?.message ?? "Test panel failed" }, { status: 500 });
  }
}
