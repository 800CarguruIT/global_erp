import { getSql } from "../../db";

export type CampaignEventKey =
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "read"
  | "replied"
  | "bounced"
  | "unsubscribed"
  | "failed";

export type CampaignEventCounts = Record<CampaignEventKey, number>;

export type CampaignPerformance = {
  campaign: {
    id: string;
    name: string;
    status: string;
    scope: string;
    startsAt: string | null;
    endsAt: string | null;
    createdAt: string;
  };
  schedule: {
    counts: Record<string, number>;
    totalRuns: number;
    lastRunAt: string | null;
    nextRunAt: string | null;
  };
  totals: CampaignEventCounts;
  channels: Record<"email" | "whatsapp" | "sms" | "push", CampaignEventCounts>;
  recentEvents: Array<{
    channel: "email" | "whatsapp" | "sms" | "push";
    eventType: string;
    recipient: string | null;
    occurredAt: string;
  }>;
};

const EVENT_KEYS: CampaignEventKey[] = [
  "sent",
  "delivered",
  "opened",
  "clicked",
  "read",
  "replied",
  "bounced",
  "unsubscribed",
  "failed",
];

function emptyCounts(): CampaignEventCounts {
  return {
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    read: 0,
    replied: 0,
    bounced: 0,
    unsubscribed: 0,
    failed: 0,
  };
}

function coerceNumber(value: unknown): number {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

export async function getCampaignPerformance(
  companyId: string,
  campaignId: string
): Promise<CampaignPerformance | null> {
  const sql = getSql();

  const campaignRows = await sql<{
    id: string;
    name: string;
    status: string;
    scope: string;
    starts_at: string | null;
    ends_at: string | null;
    created_at: string;
  }[]>`
    SELECT id, name, status, scope, starts_at, ends_at, created_at
    FROM campaigns
    WHERE id = ${campaignId} AND scope = 'company' AND company_id = ${companyId}
    LIMIT 1
  `;
  const campaign = campaignRows[0];
  if (!campaign) return null;

  const scheduleRows = await sql<{ status: string | null; count: number }[]>`
    SELECT status, COUNT(*)::int as count
    FROM marketing_campaign_schedules
    WHERE company_id IS NOT DISTINCT FROM ${companyId}
      AND campaign_id = ${campaignId}
    GROUP BY status
  `;
  const scheduleCounts: Record<string, number> = {};
  for (const row of scheduleRows) {
    const key = String(row.status ?? "unknown");
    scheduleCounts[key] = coerceNumber(row.count);
  }
  const totalRuns = Object.values(scheduleCounts).reduce((sum, value) => sum + value, 0);

  const lastRunRows = await sql<{ last_run_at: string | null }[]>`
    SELECT MAX(last_run_at) as last_run_at
    FROM marketing_campaign_schedules
    WHERE company_id IS NOT DISTINCT FROM ${companyId}
      AND campaign_id = ${campaignId}
  `;
  const nextRunRows = await sql<{ next_run_at: string | null }[]>`
    SELECT MIN(run_at) as next_run_at
    FROM marketing_campaign_schedules
    WHERE company_id IS NOT DISTINCT FROM ${companyId}
      AND campaign_id = ${campaignId}
      AND run_at >= NOW()
      AND status IN ('pending', 'scheduled')
  `;

  let eventRows: Array<{
    channel: "email" | "whatsapp" | "sms" | "push";
    event_type: string;
    count: number;
  }> = [];
  let recentEvents: Array<{
    channel: "email" | "whatsapp" | "sms" | "push";
    event_type: string;
    recipient: string | null;
    occurred_at: string;
  }> = [];

  try {
    eventRows = await sql<{
      channel: "email" | "whatsapp" | "sms" | "push";
      event_type: string;
      count: number;
    }[]>`
      SELECT 'email' as channel, event_type, COUNT(*)::int as count
      FROM marketing_email_events
      WHERE company_id IS NOT DISTINCT FROM ${companyId}
        AND campaign_id = ${campaignId}
      GROUP BY event_type
      UNION ALL
      SELECT 'whatsapp' as channel, event_type, COUNT(*)::int as count
      FROM marketing_whatsapp_events
      WHERE company_id IS NOT DISTINCT FROM ${companyId}
        AND campaign_id = ${campaignId}
      GROUP BY event_type
      UNION ALL
      SELECT 'sms' as channel, event_type, COUNT(*)::int as count
      FROM marketing_sms_events
      WHERE company_id IS NOT DISTINCT FROM ${companyId}
        AND campaign_id = ${campaignId}
      GROUP BY event_type
      UNION ALL
      SELECT 'push' as channel, event_type, COUNT(*)::int as count
      FROM marketing_push_events
      WHERE company_id IS NOT DISTINCT FROM ${companyId}
        AND campaign_id = ${campaignId}
      GROUP BY event_type
    `;

    recentEvents = await sql<{
      channel: "email" | "whatsapp" | "sms" | "push";
      event_type: string;
      recipient: string | null;
      occurred_at: string;
    }[]>`
      SELECT channel, event_type, recipient, occurred_at
      FROM (
        SELECT 'email' as channel, event_type, recipient, occurred_at
        FROM marketing_email_events
        WHERE company_id IS NOT DISTINCT FROM ${companyId}
          AND campaign_id = ${campaignId}
        UNION ALL
        SELECT 'whatsapp' as channel, event_type, recipient, occurred_at
        FROM marketing_whatsapp_events
        WHERE company_id IS NOT DISTINCT FROM ${companyId}
          AND campaign_id = ${campaignId}
        UNION ALL
        SELECT 'sms' as channel, event_type, recipient, occurred_at
        FROM marketing_sms_events
        WHERE company_id IS NOT DISTINCT FROM ${companyId}
          AND campaign_id = ${campaignId}
        UNION ALL
        SELECT 'push' as channel, event_type, recipient, occurred_at
        FROM marketing_push_events
        WHERE company_id IS NOT DISTINCT FROM ${companyId}
          AND campaign_id = ${campaignId}
      ) events
      ORDER BY occurred_at DESC
      LIMIT 30
    `;
  } catch {
    eventRows = [];
    recentEvents = [];
  }

  const channels = {
    email: emptyCounts(),
    whatsapp: emptyCounts(),
    sms: emptyCounts(),
    push: emptyCounts(),
  };

  for (const row of eventRows) {
    const channel = row.channel;
    const key = String(row.event_type ?? "").toLowerCase();
    if (!EVENT_KEYS.includes(key as CampaignEventKey)) continue;
    channels[channel][key as CampaignEventKey] += coerceNumber(row.count);
  }

  const totals = emptyCounts();
  for (const counts of Object.values(channels)) {
    for (const key of EVENT_KEYS) {
      totals[key] += counts[key];
    }
  }

  return {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      scope: campaign.scope,
      startsAt: campaign.starts_at,
      endsAt: campaign.ends_at,
      createdAt: campaign.created_at,
    },
    schedule: {
      counts: scheduleCounts,
      totalRuns,
      lastRunAt: lastRunRows[0]?.last_run_at ?? null,
      nextRunAt: nextRunRows[0]?.next_run_at ?? null,
    },
    totals,
    channels,
    recentEvents: recentEvents.map((event) => ({
      channel: event.channel,
      eventType: event.event_type,
      recipient: event.recipient ?? null,
      occurredAt: event.occurred_at,
    })),
  };
}
