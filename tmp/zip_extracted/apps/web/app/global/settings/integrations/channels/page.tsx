"use client";

import { ChannelIntegrationsScreen, useI18n } from "@repo/ui";

export default function GlobalSettingsChannelsPage() {
  const { t } = useI18n();
  return (
    <div className="space-y-6 py-4">
      <h1 className="text-xl sm:text-2xl font-semibold">{t("settings.integrations.channels.title")}</h1>
      <ChannelIntegrationsScreen scope="global" />
    </div>
  );
}
