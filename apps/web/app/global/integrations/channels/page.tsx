"use client";

import { AppLayout, ChannelIntegrationsScreen, useI18n } from "@repo/ui";

function GlobalIntegrationsChannelsContent() {
  const { t } = useI18n();
  return (
    <div className="space-y-6 py-4">
      <h1 className="text-xl sm:text-2xl font-semibold">
        {t("settings.integrations.channels.title")}
      </h1>
      <ChannelIntegrationsScreen scope="global" />
    </div>
  );
}

export default function GlobalIntegrationsChannelsPage() {
  return (
    <AppLayout>
      <GlobalIntegrationsChannelsContent />
    </AppLayout>
  );
}
