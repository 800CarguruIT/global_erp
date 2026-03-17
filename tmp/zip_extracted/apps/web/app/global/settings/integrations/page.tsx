"use client";

import Link from "next/link";
import { Card, useI18n } from "@repo/ui";

const cards = [
  {
    titleKey: "settings.cards.integrations.channels",
    descKey: "settings.cards.integrations.channels.desc",
    href: "/global/settings/integrations/channels",
  },
  {
    titleKey: "settings.cards.integrations.dialer",
    descKey: "settings.cards.integrations.dialer.desc",
    href: "/global/settings/integrations/dialer",
  },
  {
    titleKey: "settings.cards.integrations.status",
    descKey: "settings.cards.integrations.status.desc",
    href: "/global/settings/integrations/status",
  },
];

export default function GlobalSettingsIntegrationsPage() {
  const { t } = useI18n();
  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("settings.integrations.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("settings.integrations.subtitle")}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.href} href={card.href}>
            <Card className="h-full cursor-pointer transition hover:border-primary/60">
              <div className="text-lg font-semibold">{t(card.titleKey)}</div>
              <div className="mt-1 text-sm text-muted-foreground">{t(card.descKey)}</div>
              <div className="mt-3 text-xs text-primary">{t("settings.cards.open")}</div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
