"use client";

import { ModulePlaceholder, useI18n } from "@repo/ui";

export default function GlobalIntegrationStatusPage() {
  const { t } = useI18n();
  return (
    <ModulePlaceholder
      title={t("settings.integrations.status.title")}
      description={t("settings.integrations.status.desc")}
    />
  );
}
