"use client";

import React from "react";
import Link from "next/link";
import { AppLayout, Card, useI18n } from "@repo/ui";

const cards = [
  {
    titleKey: "marketing.card.omni.title",
    descKey: "marketing.card.omni.desc",
    actions: [
      { labelKey: "marketing.card.omni.view", href: "/global/marketing/campaigns" },
      { labelKey: "marketing.card.omni.create", href: "/global/marketing/campaigns/builder" },
    ],
  },
  {
    titleKey: "marketing.card.ad.title",
    descKey: "marketing.card.ad.desc",
    actions: [
      { labelKey: "marketing.card.ad.manage", href: "/global/marketing/ads" },
      { labelKey: "marketing.card.ad.channels", href: "/global/settings/integrations/channels" },
    ],
  },
  {
    titleKey: "marketing.card.sms.title",
    descKey: "marketing.card.sms.desc",
    actions: [
      { labelKey: "marketing.card.sms.manage", href: "/global/marketing/sms" },
      { labelKey: "marketing.card.sms.create", href: "/global/marketing/sms#form" },
    ],
  },
  {
    titleKey: "marketing.card.email.title",
    descKey: "marketing.card.email.desc",
    actions: [
      { labelKey: "marketing.card.email.manage", href: "/global/marketing/email" },
      { labelKey: "marketing.card.email.create", href: "/global/marketing/email#form" },
    ],
  },
  {
    titleKey: "marketing.card.social.title",
    descKey: "marketing.card.social.desc",
    actions: [
      { labelKey: "marketing.card.social.manage", href: "/global/marketing/posts" },
      { labelKey: "marketing.card.social.create", href: "/global/marketing/posts#form" },
    ],
  },
  {
    titleKey: "marketing.card.dialer.title",
    descKey: "marketing.card.dialer.desc",
    actions: [
      { labelKey: "marketing.card.dialer.settings", href: "/global/settings/integrations/dialer" },
      { labelKey: "marketing.card.dialer.callcenter", href: "/global/call-center" },
    ],
  },
] as const;

export default function GlobalMarketingPage() {
  return (
    <AppLayout>
      <MarketingContent />
    </AppLayout>
  );
}

function MarketingContent() {
  const { t } = useI18n();

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("marketing.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("marketing.subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.titleKey}>
            <div className="space-y-3">
              <div className="text-lg font-semibold">{t(card.titleKey)}</div>
              <div className="text-sm text-muted-foreground">{t(card.descKey)}</div>
              <div className="flex flex-wrap gap-2 text-xs">
                {card.actions.map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="rounded-full border px-3 py-1 hover:border-primary"
                  >
                    {t(action.labelKey)}
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
