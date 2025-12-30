import { NextRequest, NextResponse } from "next/server";
import { getSql, UserRepository } from "@repo/ai-core";
import { getCurrentUserIdFromRequest } from "../../../../lib/auth/current-user";

type LeadStatus = "open" | "assigned" | "onboarding" | "inprocess" | "completed" | "closed" | "lost";
type LeadType = "sales" | "support" | "complaint";

function mapStatus(raw: string | null): LeadStatus {
  switch (raw) {
    case "open":
      return "open";
    case "assigned":
      return "assigned";
    case "onboarding":
      return "onboarding";
    case "inprocess":
    case "processing":
      return "inprocess";
    case "completed":
      return "completed";
    case "closed_won":
    case "closed":
      return "closed";
    case "lost":
      return "lost";
    default:
      return "open";
  }
}

function mapType(raw: string | null): LeadType {
  switch (raw) {
    case "support":
      return "support";
    case "complaint":
      return "complaint";
    case "recovery":
    case "workshop":
      return "support";
    case "rsa":
      return "complaint";
    default:
      return "sales";
  }
}

export async function GET(_req: NextRequest) {
  try {
    const sql = getSql();
    const rows = await sql/* sql */ `
      SELECT
        l.id,
        l.lead_type,
        l.lead_status,
        l.updated_at,
        l.created_at,
        l.lead_stage,
        l.company_name,
        l.contact_name,
        l.contact_phone
      FROM leads l
      WHERE (l.scope = 'global' OR l.company_id IS NULL)
      ORDER BY l.updated_at DESC NULLS LAST, l.created_at DESC
      LIMIT 200
    `;

    const data = rows.map((r: any) => ({
      id: r.id,
      title: r.lead_stage ?? r.company_name ?? r.contact_name ?? r.lead_type ?? "Lead",
      status: mapStatus(r.lead_status),
      type: mapType(r.lead_type),
      customerName: r.contact_name ?? r.company_name ?? "Unknown",
      customerPhone: r.contact_phone ?? "-",
      lastUpdated: r.updated_at ?? r.created_at ?? new Date().toISOString(),
    }));

    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/global/leads error", err);
    return NextResponse.json({ data: [] }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserIdFromRequest(req);
    const user = userId ? await UserRepository.getUserById(userId) : null;
    const actor = user?.full_name || user?.email || "Creator";

    const body = await req.json().catch(() => ({}));

    const leadType: LeadType = (body.leadType as LeadType) || "sales";
    const incomingStatus: LeadStatus | undefined = body.leadStatus;
    const status: LeadStatus = mapStatus(incomingStatus || "open");

    const sql = getSql();
    const leadId = crypto.randomUUID();

    const [inserted] = await sql/* sql */ `
      INSERT INTO leads (
        id,
        scope,
        company_id,
        lead_type,
        lead_status,
        lead_stage,
        source,
        company_name,
        country,
        city,
        state_region,
        postal_code,
        address,
        contact_title,
        contact_name,
        contact_email,
        contact_phone_code,
        contact_phone,
        agent_remark,
        customer_remark,
        created_by_user_id,
        lead_owner_user_id
      ) VALUES (
        ${leadId},
        'global',
        NULL,
        ${leadType},
        ${status},
        ${body.companyName || body.contactName || "Lead"},
        ${body.source || "call_center"},
        ${body.companyName || null},
        ${body.country || null},
        ${body.city || null},
        ${body.state || null},
        ${body.postal || null},
        ${body.address || null},
        ${body.contactTitle || null},
        ${body.contactName || null},
        ${body.email || null},
        ${body.phoneCode || null},
        ${body.phone || null},
        ${body.agentRemarks || null},
        ${body.customerRemarks || null},
        ${userId || null},
        ${userId || null}
      )
      RETURNING *
    `;

    // Timeline and remark events
    const timelineAt = inserted.created_at ?? new Date().toISOString();
    await sql/* sql */ `
      INSERT INTO lead_events (lead_id, company_id, scope, actor_user_id, event_type, event_payload)
      VALUES
        (${leadId}, NULL, 'global', ${userId || null}, 'timeline', ${{
          author: actor,
          summary: `Lead created (${leadType})`,
        }}::jsonb),
        (${leadId}, NULL, 'global', ${userId || null}, 'timeline', ${{
          author: actor,
          summary: `Auto-assigned to ${actor}`,
        }}::jsonb)
    `;

    if (body.agentRemarks) {
      await sql/* sql */ `
        INSERT INTO lead_events (lead_id, company_id, scope, actor_user_id, event_type, event_payload)
        VALUES (${leadId}, NULL, 'global', ${userId || null}, 'remark', ${{
          author: actor,
          role: "agent",
          message: body.agentRemarks,
        }}::jsonb)
      `;
    }

    if (body.customerRemarks) {
      await sql/* sql */ `
        INSERT INTO lead_events (lead_id, company_id, scope, actor_user_id, event_type, event_payload)
        VALUES (${leadId}, NULL, 'global', ${userId || null}, 'remark', ${{
          author: body.contactName || "Customer",
          role: "customer",
          message: body.customerRemarks,
        }}::jsonb)
      `;
    }

    const lead = {
      id: inserted.id,
      title: inserted.lead_stage ?? inserted.company_name ?? inserted.contact_name ?? "Lead",
      status: mapStatus(inserted.lead_status),
      type: mapType(inserted.lead_type),
      customerName: inserted.contact_name ?? inserted.company_name ?? "Unknown",
      customerPhone: inserted.contact_phone ?? "-",
      lastUpdated: inserted.updated_at ?? inserted.created_at ?? timelineAt,
      meta: body,
      assignedTo: actor,
    };

    const timeline = [
      { at: timelineAt, summary: `Lead created (${leadType})`, author: actor },
      { at: timelineAt, summary: `Auto-assigned to ${actor}`, author: actor },
    ];

    const remarks = [];
    if (body.agentRemarks) {
      remarks.push({
        at: timelineAt,
        author: actor,
        role: "agent" as const,
        message: body.agentRemarks,
      });
    }
    if (body.customerRemarks) {
      remarks.push({
        at: timelineAt,
        author: body.contactName || "Customer",
        role: "customer" as const,
        message: body.customerRemarks,
      });
    }

    return NextResponse.json({ lead, timeline, remarks }, { status: 201 });
  } catch (err) {
    console.error("POST /api/global/leads error", err);
    return NextResponse.json({ error: "Failed to create lead" }, { status: 400 });
  }
}
