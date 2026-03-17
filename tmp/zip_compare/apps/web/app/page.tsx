"use client";

import { AppLayout, AiTranslate, Card, useI18n } from "@repo/ui";

function WelcomeCard() {
  const { t } = useI18n();
  return (
    <Card title={t("welcome.title")}>
      <p className="text-sm opacity-80">{t("welcome.body")}</p>
    </Card>
  );
}

export default function Page() {
  return (
    <AppLayout>
      <div className="space-y-6 py-4">
        <WelcomeCard />
        <AiTranslate />
      </div>
    </AppLayout>
  );
}
