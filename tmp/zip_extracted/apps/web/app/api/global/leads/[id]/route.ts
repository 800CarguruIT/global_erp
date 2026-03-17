import { NextRequest, NextResponse } from "next/server";
import { getSql, UserRepository } from "@repo/ai-core";
import { getCurrentUserIdFromRequest } from "../../../../../lib/auth/current-user";

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
    case "closed":
    case "closed_won":
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

export async function GET(req: NextRequest, { params }: { params: { id?: string } }) {
  try {
    let currentUser: any = null;
    try {
      const currentUserId = await getCurrentUserIdFromRequest(req);
      currentUser = currentUserId ? await UserRepository.getUserById(currentUserId) : null;
    } catch {
      // Non-blocking: allow anonymous access for global lead view
      currentUser = null;
    }

    const sql = getSql();
    const leadId = params?.id || req.nextUrl.pathname.split("/").pop() || null;
    if (!leadId) {
      return NextResponse.json({ error: "Lead id missing" }, { status: 400 });
    }

    const [lead] = await sql/* sql */ `
      SELECT
        l.*
      FROM leads l
      WHERE l.id = ${leadId}
      LIMIT 1
    `;

    if (!lead) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let events: any[] = [];
    try {
      events = await sql/* sql */ `
        SELECT id, event_type, event_payload, created_at
        FROM lead_events
        WHERE lead_id = ${leadId}
        ORDER BY created_at ASC
      `;
    } catch (err) {
      console.error("Failed to load lead events", err);
      events = [];
    }

    const timeline = events.map((e: any) => ({
      at: e.created_at,
      summary: e.event_payload?.summary ?? e.event_type,
      author: e.event_payload?.author ?? "System",
    }));

    const remarks = events
      .filter((e: any) => e.event_type === "remark")
      .map((e: any) => ({
        at: e.created_at,
        author: e.event_payload?.author ?? "System",
        role: (e.event_payload?.role ?? "agent") as const,
        message: e.event_payload?.message ?? e.event_payload ?? "Remark",
      }));

    let phoneText = "-";
    const phoneVal = lead.contact_phone;
    if (typeof phoneVal === "string" && phoneVal.trim() && phoneVal.trim() !== "[object Object]") {
      phoneText = phoneVal.trim();
    } else if (phoneVal && typeof phoneVal === "object") {
      const dial = (phoneVal as any).dialCode || (phoneVal as any).countryCode || "";
      const num = (phoneVal as any).nationalNumber || (phoneVal as any).number || "";
      if (num) {
        phoneText = [dial, num].filter(Boolean).join(" ").trim();
      }
    } else if (lead.contact_phone_code) {
      phoneText = `${lead.contact_phone_code} ${lead.contact_phone ?? ""}`.trim();
    }

    const assigned =
      lead.lead_owner_user_id ||
      currentUser?.full_name ||
      currentUser?.email ||
      "Unassigned";

    return NextResponse.json({
      lead: {
        id: lead.id,
        title: lead.lead_stage ?? lead.company_name ?? lead.contact_name ?? lead.lead_type ?? "Lead",
        status: mapStatus(lead.lead_status),
        type: mapType(lead.lead_type),
        customerName: lead.contact_name ?? "Unknown",
        customerPhone: phoneText,
        companyName: lead.company_name ?? null,
        tradeLicense: null,
        assignedTo: assigned,
      },
      timeline,
      remarks,
    });
  } catch (err: any) {
    console.error("GET /api/global/leads/[id] error", err);
    return NextResponse.json(
      { error: "Failed to load lead", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id?: string } }) {
  const leadId = params?.id || req.nextUrl.pathname.split("/").pop() || null;
  if (!leadId) {
    return NextResponse.json({ error: "Lead id missing" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const sql = getSql();

  let actorId: string | null = null;
  let actorName: string | null = null;
  try {
    const uid = await getCurrentUserIdFromRequest(req);
    actorId = uid ?? null;
    const user = uid ? await UserRepository.getUserById(uid) : null;
    actorName = user?.full_name || user?.email || null;
  } catch {
    // ignore auth failures for public/global flows
  }

  const tasks: Promise<any>[] = [];

  if (body.status) {
    const status = mapStatus(body.status);
    tasks.push(
      sql/* sql */ `
        UPDATE leads
        SET lead_status = ${status}
        WHERE id = ${leadId}
      `
    );
    tasks.push(
      sql/* sql */ `
        INSERT INTO lead_events (lead_id, company_id, scope, actor_user_id, event_type, event_payload)
        VALUES (
          ${leadId},
          NULL,
          'global',
          ${actorId},
          'timeline',
          ${{
            author: actorName || "System",
            summary: `Status changed to ${status}`,
          }}::jsonb
        )
      `
    );
  }

  if (body.remark) {
    const role = body.role === "customer" ? "customer" : "agent";
    const author = body.author || actorName || "System";
    tasks.push(
      sql/* sql */ `
        INSERT INTO lead_events (lead_id, company_id, scope, actor_user_id, event_type, event_payload)
        VALUES (
          ${leadId},
          NULL,
          'global',
          ${actorId},
          'remark',
          ${{
            author,
            role,
            message: body.remark,
          }}::jsonb
        )
      `
    );
  }

  await Promise.all(tasks);

  return NextResponse.json({ ok: true });
}
