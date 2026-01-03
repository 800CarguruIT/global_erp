import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core";

type Params = { params: Promise<{ companyId: string; campaignId: string }> };

export const runtime = "nodejs";

const SCHEDULED_STATUSES = new Set(["scheduled", "marketing.status.scheduled"]);

function isScheduledStatus(value: string) {
  return SCHEDULED_STATUSES.has(value);
}

function getBaseUrl(req: NextRequest) {
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const proto = forwardedProto ? forwardedProto.split(",")[0].trim() : "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (!host) return null;
  return `${proto}://${host}`;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { companyId: rawCompanyId, campaignId: rawCampaignId } = await params;
  const companyId = String(rawCompanyId || "").trim();
  const campaignId = String(rawCampaignId || "").trim();
  if (!companyId || !campaignId) {
    return NextResponse.json({ error: "companyId and campaignId are required" }, { status: 400 });
  }

  const payload = await req.json().catch(() => ({}));
  const status = String(payload?.status ?? "").trim();
  const name = String(payload?.name ?? "").trim();
  const startsAtRaw = String(payload?.startsAt ?? "").trim();
  const startsAt = startsAtRaw ? new Date(startsAtRaw) : null;
  const startsAtValue =
    startsAt && !Number.isNaN(startsAt.getTime()) ? startsAt : null;
  if (!status && !name) {
    return NextResponse.json({ error: "status or name is required" }, { status: 400 });
  }
  const scheduledRequested = isScheduledStatus(status);

  try {
    const sql = getSql();
    let previousStatus = "";
    if (status) {
      const existing = await sql<{ status: string }[]>`
        SELECT status
        FROM campaigns
        WHERE id = ${campaignId} AND scope = 'company' AND company_id = ${companyId}
        LIMIT 1
      `;
      previousStatus = String(existing?.[0]?.status ?? "");
    }

    const rows = await sql<{
      id: string;
      name: string;
      status: string;
      starts_at: string | null;
      created_at: string;
    }[]>`
      UPDATE campaigns
      SET name = COALESCE(${name || null}, name),
          status = COALESCE(${status || null}, status),
          starts_at = COALESCE(
            ${startsAtValue},
            CASE WHEN ${scheduledRequested} AND starts_at IS NULL THEN NOW() ELSE starts_at END
          ),
          updated_at = NOW()
      WHERE id = ${campaignId} AND scope = 'company' AND company_id = ${companyId}
      RETURNING id, name, status, starts_at, created_at
    `;
    const row = rows[0];
    if (!row) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    let scheduleWarnings: string[] | null = null;
    if (status && isScheduledStatus(status) && !isScheduledStatus(previousStatus)) {
      try {
        const { CampaignScheduler } = await import("@repo/ai-core");
        const baseUrl =
          getBaseUrl(req) ||
          process.env.APP_BASE_URL ||
          process.env.NEXT_PUBLIC_APP_URL ||
          process.env.PUBLIC_BASE_URL ||
          null;
        const result = await CampaignScheduler.scheduleCampaignFromGraph({
          companyId,
          campaignId,
          baseUrl,
        });
        scheduleWarnings = result.warnings ?? null;
        if (scheduleWarnings?.length) {
          console.warn("Campaign scheduling warnings:", scheduleWarnings);
        }
      } catch (error) {
        console.error("Failed to schedule campaign.", error);
        scheduleWarnings = ["Failed to schedule campaign."];
      }
    }

    return NextResponse.json({
      item: {
        id: row.id,
        name: row.name,
        status: row.status,
        startsAt: row.starts_at,
        createdAt: row.created_at,
      },
      scheduleWarnings,
    });
  } catch (error) {
    console.error("PATCH /api/company/[companyId]/marketing/campaigns/[campaignId] error:", error);
    return NextResponse.json({ error: "Failed to update campaign" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { companyId: rawCompanyId, campaignId: rawCampaignId } = await params;
  const companyId = String(rawCompanyId || "").trim();
  const campaignId = String(rawCampaignId || "").trim();
  if (!companyId || !campaignId) {
    return NextResponse.json({ error: "companyId and campaignId are required" }, { status: 400 });
  }

  try {
    const sql = getSql();
    const rows = await sql<{ id: string }[]>`
      DELETE FROM campaigns
      WHERE id = ${campaignId} AND scope = 'company' AND company_id = ${companyId}
      RETURNING id
    `;
    const row = rows[0];
    if (!row) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/company/[companyId]/marketing/campaigns/[campaignId] error:", error);
    return NextResponse.json({ error: "Failed to delete campaign" }, { status: 500 });
  }
}
