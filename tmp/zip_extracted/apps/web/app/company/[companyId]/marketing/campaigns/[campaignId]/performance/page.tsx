import { AppLayout, Card, KpiGrid } from "@repo/ui";

type PageProps = { params: { companyId: string; campaignId: string } };

type ChannelKey = "email" | "whatsapp" | "sms" | "push";

const CHANNEL_LABELS: Record<ChannelKey, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  sms: "SMS",
  push: "Push",
};

function formatRate(numerator: number, denominator: number) {
  if (!denominator) return "n/a";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function formatDate(value: string | null) {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "n/a";
  return date.toLocaleString();
}

function titleCase(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function CampaignPerformancePage({ params }: PageProps) {
  const { companyId, campaignId } = params;

  const campaign = {
    id: campaignId,
    name: "Winter Re-Engagement",
    status: "live",
    scope: "company",
    startsAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString(),
    endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 8).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
    companyId,
  };

  const channels = {
    email: {
      sent: 24500,
      delivered: 23820,
      opened: 14210,
      clicked: 4860,
      read: 0,
      replied: 420,
      bounced: 680,
      unsubscribed: 210,
      failed: 35,
    },
    whatsapp: {
      sent: 8600,
      delivered: 8520,
      opened: 0,
      clicked: 920,
      read: 6120,
      replied: 540,
      bounced: 40,
      unsubscribed: 85,
      failed: 18,
    },
    sms: {
      sent: 12400,
      delivered: 11880,
      opened: 0,
      clicked: 1330,
      read: 0,
      replied: 190,
      bounced: 320,
      unsubscribed: 110,
      failed: 55,
    },
    push: {
      sent: 9200,
      delivered: 9100,
      opened: 0,
      clicked: 1840,
      read: 0,
      replied: 0,
      bounced: 0,
      unsubscribed: 65,
      failed: 24,
    },
  };

  const totals = {
    sent: 54700,
    delivered: 53320,
    opened: 14210,
    clicked: 8950,
    read: 6120,
    replied: 1150,
    bounced: 1040,
    unsubscribed: 470,
    failed: 132,
  };

  const schedule = {
    counts: {
      pending: 6,
      scheduled: 10,
      running: 1,
      completed: 28,
      failed: 2,
      cancelled: 0,
    },
    totalRuns: 47,
    lastRunAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    nextRunAt: new Date(Date.now() + 1000 * 60 * 90).toISOString(),
  };

  const recentEvents = [
    {
      channel: "email" as const,
      eventType: "opened",
      recipient: "aliya.hassan@example.com",
      occurredAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    },
    {
      channel: "whatsapp" as const,
      eventType: "read",
      recipient: "+971555012341",
      occurredAt: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
    },
    {
      channel: "sms" as const,
      eventType: "clicked",
      recipient: "+971555013982",
      occurredAt: new Date(Date.now() - 1000 * 60 * 22).toISOString(),
    },
    {
      channel: "push" as const,
      eventType: "clicked",
      recipient: "device:IOS-9F2A",
      occurredAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    },
    {
      channel: "email" as const,
      eventType: "unsubscribed",
      recipient: "omar.saleh@example.com",
      occurredAt: new Date(Date.now() - 1000 * 60 * 53).toISOString(),
    },
    {
      channel: "whatsapp" as const,
      eventType: "replied",
      recipient: "+971555018120",
      occurredAt: new Date(Date.now() - 1000 * 60 * 80).toISOString(),
    },
    {
      channel: "sms" as const,
      eventType: "delivered",
      recipient: "+971555011292",
      occurredAt: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
    },
    {
      channel: "email" as const,
      eventType: "clicked",
      recipient: "sara.naseer@example.com",
      occurredAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    },
  ];

  const kpis = [
    { label: "Sent", value: totals.sent },
    { label: "Delivered", value: totals.delivered, subtitle: `Rate ${formatRate(totals.delivered, totals.sent)}` },
    { label: "Opened", value: totals.opened, subtitle: `Rate ${formatRate(totals.opened, totals.delivered)}` },
    { label: "Clicked", value: totals.clicked, subtitle: `Rate ${formatRate(totals.clicked, totals.delivered)}` },
    { label: "Read", value: totals.read, subtitle: `Rate ${formatRate(totals.read, totals.delivered)}` },
    { label: "Replied", value: totals.replied, subtitle: `Rate ${formatRate(totals.replied, totals.delivered)}` },
    { label: "Bounced", value: totals.bounced, subtitle: `Rate ${formatRate(totals.bounced, totals.sent)}` },
    { label: "Unsubscribed", value: totals.unsubscribed, subtitle: `Rate ${formatRate(totals.unsubscribed, totals.delivered)}` },
    { label: "Failed", value: totals.failed },
  ];

  const scheduleItems = [
    { label: "Scheduled runs", value: schedule.counts.scheduled ?? 0 },
    { label: "Pending runs", value: schedule.counts.pending ?? 0 },
    { label: "Running", value: schedule.counts.running ?? 0 },
    { label: "Completed runs", value: schedule.counts.completed ?? 0 },
    { label: "Failed runs", value: schedule.counts.failed ?? 0 },
    { label: "Cancelled runs", value: schedule.counts.cancelled ?? 0 },
  ];

  const channelRows: Array<{ key: ChannelKey; label: string }> = [
    { key: "email", label: CHANNEL_LABELS.email },
    { key: "whatsapp", label: CHANNEL_LABELS.whatsapp },
    { key: "sms", label: CHANNEL_LABELS.sms },
    { key: "push", label: CHANNEL_LABELS.push },
  ];

  const deliveredTotal = channelRows.reduce((sum, row) => sum + channels[row.key].delivered, 0);
  const openRate = formatRate(totals.opened, totals.delivered);
  const clickRate = formatRate(totals.clicked, totals.delivered);

  return (
    <AppLayout>
      <div className="space-y-6 py-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold">Campaign performance</h1>
          <p className="text-sm text-muted-foreground">
            {campaign.name} · {campaign.scope} · {campaign.status}
          </p>
        </div>

        <KpiGrid items={kpis} />

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="space-y-3">
            <div className="text-sm font-semibold">Engagement summary</div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Open rate</span>
                <span className="font-medium text-foreground">{openRate}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-white/10">
                <div className="h-2 rounded-full bg-emerald-400/80" style={{ width: openRate === "n/a" ? "0%" : openRate }} />
              </div>
              <div className="flex items-center justify-between">
                <span>Click rate</span>
                <span className="font-medium text-foreground">{clickRate}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-white/10">
                <div className="h-2 rounded-full bg-sky-400/80" style={{ width: clickRate === "n/a" ? "0%" : clickRate }} />
              </div>
            </div>
          </Card>

          <Card className="space-y-3">
            <div className="text-sm font-semibold">Channel delivered share</div>
            <div className="space-y-3">
              {channelRows.map((row) => {
                const delivered = channels[row.key].delivered;
                const percent = deliveredTotal ? Math.round((delivered / deliveredTotal) * 100) : 0;
                return (
                  <div key={row.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{row.label}</span>
                      <span>{percent}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-white/10">
                      <div
                        className="h-2 rounded-full bg-indigo-400/80"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {deliveredTotal === 0 && (
                <div className="text-xs text-muted-foreground">No deliveries yet for this campaign.</div>
              )}
            </div>
          </Card>

          <Card className="space-y-3">
            <div className="text-sm font-semibold">Schedule summary</div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>Total runs: {schedule.totalRuns}</li>
              <li>Last run: {formatDate(schedule.lastRunAt)}</li>
              <li>Next run: {formatDate(schedule.nextRunAt)}</li>
              <li>Starts at: {formatDate(campaign.startsAt)}</li>
              <li>Ends at: {formatDate(campaign.endsAt)}</li>
            </ul>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="space-y-3 lg:col-span-2">
            <div className="text-sm font-semibold">Channel performance</div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2">Channel</th>
                    <th className="px-3 py-2">Sent</th>
                    <th className="px-3 py-2">Delivered</th>
                    <th className="px-3 py-2">Opened</th>
                    <th className="px-3 py-2">Clicked</th>
                    <th className="px-3 py-2">Read</th>
                    <th className="px-3 py-2">Replied</th>
                    <th className="px-3 py-2">Bounced</th>
                    <th className="px-3 py-2">Unsubscribed</th>
                    <th className="px-3 py-2">Failed</th>
                  </tr>
                </thead>
                <tbody>
                  {channelRows.map((row) => {
                    const counts = channels[row.key];
                    return (
                      <tr key={row.key} className="border-b border-white/5">
                        <td className="px-3 py-2 font-medium">{row.label}</td>
                        <td className="px-3 py-2 text-muted-foreground">{counts.sent}</td>
                        <td className="px-3 py-2 text-muted-foreground">{counts.delivered}</td>
                        <td className="px-3 py-2 text-muted-foreground">{counts.opened}</td>
                        <td className="px-3 py-2 text-muted-foreground">{counts.clicked}</td>
                        <td className="px-3 py-2 text-muted-foreground">{counts.read}</td>
                        <td className="px-3 py-2 text-muted-foreground">{counts.replied}</td>
                        <td className="px-3 py-2 text-muted-foreground">{counts.bounced}</td>
                        <td className="px-3 py-2 text-muted-foreground">{counts.unsubscribed}</td>
                        <td className="px-3 py-2 text-muted-foreground">{counts.failed}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="space-y-3">
            <div className="text-sm font-semibold">Recent activity</div>
            <div className="space-y-2 text-sm">
              {recentEvents.length === 0 && (
                <div className="text-xs text-muted-foreground">No activity recorded yet.</div>
              )}
              {recentEvents.map((event, index) => (
                <div key={`${event.channel}-${event.occurredAt}-${index}`} className="rounded-md border border-white/5 p-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{CHANNEL_LABELS[event.channel]}</span>
                    <span>{formatDate(event.occurredAt)}</span>
                  </div>
                  <div className="mt-1 text-sm font-medium text-foreground">
                    {titleCase(event.eventType)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {event.recipient ? `Recipient: ${event.recipient}` : "Recipient: n/a"}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="pt-2">
          <KpiGrid items={scheduleItems} />
        </div>
      </div>
    </AppLayout>
  );
}
