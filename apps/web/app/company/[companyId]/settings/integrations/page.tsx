"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AppLayout, Card } from "@repo/ui";

type Params = { params: { companyId: string } | Promise<{ companyId: string }> };

export default function CompanySettingsIntegrationsPage({ params }: Params) {
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve(params).then((p) => setCompanyId(p?.companyId ?? null));
  }, [params]);

  const cards =
    companyId == null
      ? []
      : [
          {
            titleKey: "settings.cards.integrations.channels",
            descKey: "settings.cards.integrations.channels.desc",
            href: `/company/${companyId}/settings/integrations/channels`,
          },
          {
            titleKey: "settings.cards.integrations.dialer",
            descKey: "settings.cards.integrations.dialer.desc",
            href: `/company/${companyId}/settings/integrations/dialer`,
          },
        ];

  return (
    <AppLayout>
      <div className="space-y-6 py-4">
        <div>
          <h1 className="text-2xl font-semibold">Integrations</h1>
          <p className="text-sm text-muted-foreground">Manage company channel and dialer integrations.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <Link key={card.href} href={card.href}>
              <Card className="h-full cursor-pointer transition hover:border-primary/60">
                <div className="text-lg font-semibold">
                  {card.titleKey === "settings.cards.integrations.channels" ? "Channels" : "Dialer"}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {card.descKey === "settings.cards.integrations.channels.desc"
                    ? "Manage outbound channels (email/SMS/ads)."
                    : "Configure dialer integrations for calls/IVR."}
                </div>
                <div className="mt-3 text-xs text-primary">Open</div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
