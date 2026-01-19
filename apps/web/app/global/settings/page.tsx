"use client";

import React from "react";
import Link from "next/link";
import { Card, useI18n } from "@repo/ui";

export default function GlobalSettingsHome() {
  const { t } = useI18n();
  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("settings.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("settings.subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SettingsCard
          title={t("settings.cards.ai.title")}
          description={t("settings.cards.ai.desc")}
          href="/global/settings/ai/panel"
        />
        <SettingsCard
          title={t("settings.cards.integrations.title")}
          description={t("settings.cards.integrations.desc")}
          href="/global/settings/integrations"
        />
        <SettingsCard
          title={t("settings.cards.orgProfile.title")}
          description={t("settings.cards.orgProfile.desc")}
          href="/global/settings/org-profile"
        />
        <SettingsCard
          title={t("settings.cards.roles.title")}
          description={t("settings.cards.roles.desc")}
          href="/global/settings/security/roles"
        />
        <SettingsCard
          title={t("settings.cards.profile.title")}
          description={t("settings.cards.profile.desc")}
          href="/profile"
        />
      </div>
    </div>
  );
}

function SettingsCard({ title, description, href }: { title: string; description: string; href: string }) {
  const { t } = useI18n();
  return (
    <Link href={href}>
      <Card className="h-full cursor-pointer transition hover:border-primary/60">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-lg font-semibold">{title}</div>
            <div className="text-sm text-muted-foreground">{description}</div>
          </div>
          <span className="text-xs text-primary">{t("settings.cards.open")}</span>
        </div>
      </Card>
    </Link>
  );
}
