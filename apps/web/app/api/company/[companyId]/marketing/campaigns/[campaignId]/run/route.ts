import { NextRequest, NextResponse } from "next/server";
import { getSql, CampaignSchedules } from "@repo/ai-core";

type Params = { params: Promise<{ companyId: string; campaignId: string }> };

function normalizeId(value?: string | null) {
  const id = value?.toString?.().trim?.();
  if (!id || id === "undefined" || id === "null") return null;
  return id;
}

async function handleRun(req: NextRequest, { params }: Params) {
  const { companyId: rawCompanyId, campaignId: rawCampaignId } = await params;
  const companyId = normalizeId(rawCompanyId);
  const campaignId = normalizeId(rawCampaignId);
  if (!companyId || !campaignId) {
    return NextResponse.json({ error: "companyId and campaignId are required" }, { status: 400 });
  }

  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const scheduleId = normalizeId(req.nextUrl.searchParams.get("scheduleId")) ?? normalizeId(body?.scheduleId);
  const nodeId = normalizeId(req.nextUrl.searchParams.get("nodeId")) ?? normalizeId(body?.nodeId);
  if (!scheduleId && !nodeId) {
    return NextResponse.json({ error: "scheduleId or nodeId is required" }, { status: 400 });
  }

  const schedule = scheduleId
    ? await CampaignSchedules.getCampaignScheduleById(scheduleId)
    : await CampaignSchedules.getLatestCampaignScheduleByNode(companyId, campaignId, nodeId as string);

  if (!schedule) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  }

  const updated = await CampaignSchedules.markCampaignScheduleRun(schedule.id, "completed");

  if (updated?.nodeKey === "launch") {
    const sql = getSql();
    const current = await sql<{ status: string }[]>`
      SELECT status
      FROM campaigns
      WHERE id = ${campaignId} AND scope = 'company' AND company_id = ${companyId}
      LIMIT 1
    `;
    const currentStatus = String(current?.[0]?.status ?? "");
    const liveStatus = currentStatus.startsWith("marketing.status.") ? "marketing.status.live" : "live";
    const rows = await sql<{ status: string }[]>`
      UPDATE campaigns
      SET status = ${liveStatus},
          updated_at = NOW()
      WHERE id = ${campaignId} AND scope = 'company' AND company_id = ${companyId}
      RETURNING status
    `;
    const row = rows[0];
    return NextResponse.json({ schedule: updated, campaignStatus: row?.status ?? null }, { status: 200 });
  }

  return NextResponse.json({ schedule: updated }, { status: 200 });
}

export async function GET(req: NextRequest, ctx: Params) {
  return handleRun(req, ctx);
}

export async function POST(req: NextRequest, ctx: Params) {
  return handleRun(req, ctx);
}
