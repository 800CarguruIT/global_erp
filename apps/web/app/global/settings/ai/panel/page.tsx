"use client";

import React from "react";
import { AiControlPanel, AiTranslate, useI18n } from "@repo/ui";

export default function GlobalAiPanelPage() {
  const { t } = useI18n();
  return (
    <div className="space-y-6 py-4">
      <div className="space-y-2">
        <h1 className="text-xl sm:text-2xl font-semibold">{t("settings.ai.title")}</h1>
        <p className="text-sm sm:text-base opacity-80">{t("settings.ai.subtitle")}</p>
      </div>
      <AiControlPanel />
      <AiTranslate />
    </div>
  );
}
