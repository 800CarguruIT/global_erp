"use client";

import { DialerIntegrationsScreen, useI18n } from "@repo/ui";

export default function GlobalSettingsDialerPage() {
  const { t } = useI18n();
  return (
    <div className="space-y-6 py-4">
      <h1 className="text-xl sm:text-2xl font-semibold">{t("settings.integrations.dialer.title")}</h1>
      <DialerIntegrationsScreen level="global" />
    </div>
  );
}
