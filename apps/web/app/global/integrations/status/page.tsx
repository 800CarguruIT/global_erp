"use client";

import { AppLayout, ModulePlaceholder, useI18n } from "@repo/ui";

function GlobalIntegrationsStatusContent() {
  const { t } = useI18n();
  return (
    <ModulePlaceholder
      title={t("settings.integrations.status.title")}
      description={t("settings.integrations.status.desc")}
    />
  );
}

export default function GlobalIntegrationsStatusPage() {
  return (
    <AppLayout>
      <GlobalIntegrationsStatusContent />
    </AppLayout>
  );
}
