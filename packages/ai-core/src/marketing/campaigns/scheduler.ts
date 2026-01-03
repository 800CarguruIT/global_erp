import { getSql } from "../../db";
import { getCompanyMarketingSettings } from "../settings/repository";
import { getCampaignBuilderGraph } from "./builderRepository";
import type { CampaignScheduleRow } from "./scheduleTypes";
import { upsertCampaignSchedule, updateCampaignScheduleJob } from "./scheduleRepository";

type DrawflowGraph = {
  drawflow?: {
    Home?: {
      data?: Record<string, any>;
    };
  };
};

type ScheduleCampaignInput = {
  companyId: string;
  campaignId: string;
  baseUrl?: string | null;
};

type ScheduleCampaignResult = {
  schedules: CampaignScheduleRow[];
  warnings: string[];
};

const EASYCRON_API_URL = process.env.EASYCRON_API_URL || "https://www.easycron.com/rest/add";
const SCHEDULED_STATUS = "scheduled";

function getNodes(graph: DrawflowGraph | null | undefined): Record<string, any> {
  const data = graph?.drawflow?.Home?.data;
  if (!data || typeof data !== "object") return {};
  return data;
}

function getNodeKey(node: any): string {
  return String(node?.data?.key ?? node?.name ?? "");
}

function getIncomingNodeId(node: any): string | null {
  const inputs = node?.inputs ?? {};
  for (const input of Object.values(inputs)) {
    const connection = (input as any)?.connections?.[0];
    if (!connection?.node) continue;
    return String(connection.node);
  }
  return null;
}

function durationMs(amount: number, unit: string): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const normalized = unit.toLowerCase();
  if (normalized === "minutes") return amount * 60 * 1000;
  if (normalized === "hours") return amount * 60 * 60 * 1000;
  if (normalized === "days") return amount * 24 * 60 * 60 * 1000;
  return 0;
}

function resolveLaunchRunAt(
  launchId: string,
  nodes: Record<string, any>,
  baseTime: Date
): Date | null {
  let currentId: string | null = launchId;
  let offsetMs = 0;
  const visited = new Set<string>();
  while (currentId) {
    const incomingId = getIncomingNodeId(nodes[currentId]);
    if (!incomingId || visited.has(incomingId)) break;
    visited.add(incomingId);
    const incoming = nodes[incomingId];
    const key = getNodeKey(incoming);
    if (key === "delay") {
      const settings = (incoming?.data?.settings as Record<string, any> | undefined) ?? {};
      const waitType = String(settings.waitType ?? "");
      if (waitType === "datetime") {
        const raw = String(settings.waitDateTime ?? "");
        if (raw) {
          const at = new Date(raw);
          if (!Number.isNaN(at.getTime())) return at;
        }
      }
      if (waitType === "duration") {
        const amount = Number(settings.waitAmount ?? 0);
        const unit = String(settings.waitUnit ?? "");
        offsetMs += durationMs(amount, unit);
      }
    }
    currentId = incomingId;
  }
  if (offsetMs > 0) {
    return new Date(baseTime.getTime() + offsetMs);
  }
  return new Date(baseTime.getTime());
}

function clampToFuture(value: Date): Date {
  const now = Date.now();
  if (value.getTime() <= now) {
    return new Date(now + 60 * 1000);
  }
  return value;
}

function resolveCronExpression(runAt: Date, timeZone?: string | null): { expression: string; timeZone: string } {
  const zone = timeZone && timeZone.trim() ? timeZone.trim() : "UTC";
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(runAt).reduce((acc: Record<string, string>, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});
    const minute = parts.minute ?? "00";
    const hour = parts.hour ?? "00";
    const day = parts.day ?? "01";
    const month = parts.month ?? "01";
    return { expression: `${minute} ${hour} ${day} ${month} *`, timeZone: zone };
  } catch {
    const utc = new Date(runAt.toISOString());
    const minute = String(utc.getUTCMinutes()).padStart(2, "0");
    const hour = String(utc.getUTCHours()).padStart(2, "0");
    const day = String(utc.getUTCDate()).padStart(2, "0");
    const month = String(utc.getUTCMonth() + 1).padStart(2, "0");
    return { expression: `${minute} ${hour} ${day} ${month} *`, timeZone: "UTC" };
  }
}

async function getCampaignStartTime(companyId: string, campaignId: string): Promise<Date> {
  const sql = getSql();
  const rows = await sql<{ starts_at: string | null }[]>`
    SELECT starts_at
    FROM campaigns
    WHERE id = ${campaignId} AND scope = 'company' AND company_id = ${companyId}
    LIMIT 1
  `;
  const raw = rows?.[0]?.starts_at;
  if (!raw) return new Date();
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
}

async function createEasyCronJob(input: {
  apiKey: string;
  url: string;
  runAt: Date;
  timeZone?: string | null;
  jobName: string;
}): Promise<{ jobId: string | null; payload: Record<string, unknown> }> {
  const { expression, timeZone } = resolveCronExpression(input.runAt, input.timeZone);
  const params = new URLSearchParams({
    token: input.apiKey,
    url: input.url,
    cron_expression: expression,
    timezone: timeZone,
    cron_type: "once",
    cron_job_name: input.jobName,
  });
  const res = await fetch(`${EASYCRON_API_URL}?${params.toString()}`, { method: "GET" });
  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const error = String((payload as any)?.error ?? "EasyCron request failed");
    throw new Error(error);
  }
  const jobId = String((payload as any)?.jobid ?? (payload as any)?.job_id ?? "");
  return { jobId: jobId || null, payload };
}

export async function scheduleCampaignFromGraph(
  input: ScheduleCampaignInput
): Promise<ScheduleCampaignResult> {
  const warnings: string[] = [];
  const { companyId, campaignId, baseUrl } = input;
  const graphRow = await getCampaignBuilderGraph("company", companyId, campaignId);
  if (!graphRow?.graph) {
    warnings.push("Campaign graph not found.");
    return { schedules: [], warnings };
  }

  const settings = await getCompanyMarketingSettings(companyId);
  if (settings && settings.scheduleLaunch === false) {
    warnings.push("Launch scheduling is disabled in marketing settings.");
    return { schedules: [], warnings };
  }

  const baseTime = await getCampaignStartTime(companyId, campaignId);
  const nodes = getNodes(graphRow.graph as DrawflowGraph);
  const launchNodes = Object.entries(nodes).filter(([, node]) => getNodeKey(node) === "launch");
  if (!launchNodes.length) {
    warnings.push("No launch nodes found in campaign graph.");
    return { schedules: [], warnings };
  }

  const schedules: CampaignScheduleRow[] = [];
  for (const [nodeId, node] of launchNodes) {
    const runAtRaw = resolveLaunchRunAt(String(nodeId), nodes, baseTime);
    if (!runAtRaw) continue;
    const runAt = clampToFuture(runAtRaw);
    const schedule = await upsertCampaignSchedule({
      companyId,
      campaignId,
      nodeId: String(nodeId),
      nodeKey: getNodeKey(node) || "launch",
      runAt,
      status: settings?.easycronApiKey ? SCHEDULED_STATUS : "pending",
    });

    if (settings?.easycronApiKey && baseUrl) {
      try {
        const jobName = `campaign-${campaignId}-node-${nodeId}`;
        const runUrl = new URL(
          `/api/company/${companyId}/marketing/campaigns/${campaignId}/run`,
          baseUrl
        );
        runUrl.searchParams.set("scheduleId", schedule.id);
        runUrl.searchParams.set("nodeId", String(nodeId));
        const job = await createEasyCronJob({
          apiKey: settings.easycronApiKey,
          url: runUrl.toString(),
          runAt,
          timeZone: settings.easycronTimezone,
          jobName,
        });
        const updated = await updateCampaignScheduleJob(schedule.id, {
          easycronJobId: job.jobId,
          easycronPayload: job.payload,
          status: SCHEDULED_STATUS,
          error: null,
        });
        schedules.push(updated ?? schedule);
      } catch (error: any) {
        const updated = await updateCampaignScheduleJob(schedule.id, {
          status: "failed",
          error: String(error?.message ?? "Failed to create EasyCron job"),
        });
        schedules.push(updated ?? schedule);
      }
    } else {
      schedules.push(schedule);
    }
  }

  if (!settings?.easycronApiKey) {
    warnings.push("EasyCron API key is not configured.");
  }
  if (!baseUrl) {
    warnings.push("Base URL not provided; EasyCron jobs were not created.");
  }

  return { schedules, warnings };
}
