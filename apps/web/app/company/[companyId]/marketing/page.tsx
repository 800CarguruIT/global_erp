"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AppLayout, Card } from "@repo/ui";

const cards = [
  {
    title: "Omni Campaigns",
    desc: "Plan, run, and track omni-channel campaigns for this company.",
    actions: [
      { label: "View campaigns", path: "/marketing/campaigns" },
      { label: "New campaign", path: "/marketing/campaigns/builder" },
    ],
  },
  {
    title: "Ads",
    desc: "Manage ad channels and budgets.",
    actions: [
      { label: "Manage ads", path: "/marketing/ads" },
      { label: "Channel settings", path: "/settings/integrations/channels" },
    ],
  },
  {
    title: "SMS",
    desc: "Create and send SMS broadcasts.",
    actions: [
      { label: "Manage SMS", path: "/marketing/sms" },
      { label: "New SMS", path: "/marketing/sms#form" },
    ],
  },
  {
    title: "Email",
    desc: "Design, schedule, and track email campaigns.",
    actions: [
      { label: "Manage email", path: "/marketing/email" },
      { label: "New email", path: "/marketing/email#form" },
    ],
  },
  {
    title: "Templates",
    desc: "Manage WhatsApp and email templates for approved messaging.",
    actions: [
      { label: "Manage templates", path: "/marketing/templates" },
      { label: "WhatsApp templates", path: "/marketing/templates?tab=whatsapp" },
      { label: "Email templates", path: "/marketing/templates?tab=email" },
    ],
  },
  {
    title: "Social",
    desc: "Plan and publish social posts.",
    actions: [
      { label: "Manage posts", path: "/marketing/posts" },
      { label: "New post", path: "/marketing/posts#form" },
    ],
  },
  {
    title: "Dialer",
    desc: "Configure dialer for outbound/IVR flows.",
    actions: [
      { label: "Dialer settings", path: "/settings/integrations/dialer" },
      { label: "Call center", path: "/call-center" },
    ],
  },
] as const;

export default function CompanyMarketingPage({
  params,
}: {
  params: { companyId: string } | Promise<{ companyId: string }>;
}) {
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve(params).then((p) => setCompanyId(p?.companyId ?? null));
  }, [params]);

  return (
    <AppLayout>
      <MarketingContent companyId={companyId} />
    </AppLayout>
  );
}

function MarketingContent({ companyId }: { companyId: string | null }) {
  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-semibold">Marketing</h1>
        <p className="text-sm text-muted-foreground">
          Company-level marketing campaigns, channels, and content for this workspace.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.title}>
            <div className="space-y-3">
              <div className="text-lg font-semibold">{card.title}</div>
              <div className="text-sm text-muted-foreground">{card.desc}</div>
              <div className="flex flex-wrap gap-2 text-xs">
                {card.actions.map((action) => (
                  <Link
                    key={action.path}
                    href={companyId ? `/company/${companyId}${action.path}` : "#"}
                    className="rounded-full border px-3 py-1 hover:border-primary"
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
