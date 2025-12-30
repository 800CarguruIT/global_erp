"use client";

import React from "react";
import { ModulePlaceholder, useI18n } from "@repo/ui";

export default function GlobalSettingsMonitoringPage() {
  const { t } = useI18n();
  return (
    <ModulePlaceholder
      title={t("settings.security.monitoring.title")}
      description={t("settings.security.monitoring.desc")}
    />
  );
}
