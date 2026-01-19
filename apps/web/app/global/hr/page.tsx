"use client";

import React from "react";
import Link from "next/link";
import { AppLayout, Card, useI18n } from "@repo/ui";

export default function GlobalHrPage() {
  return (
    <AppLayout>
      <HrContent />
    </AppLayout>
  );
}

function HrContent() {
  const { t } = useI18n();

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("hr.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("hr.subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <HrCard
          title={t("hr.card.employees.title")}
          description={t("hr.card.employees.desc")}
          href="/global/hr/employees"
          cta={t("hr.card.employees.cta")}
        />
        <HrCard
          title={t("hr.card.globalUsers.title")}
          description={t("hr.card.globalUsers.desc")}
          href="/global/settings/security/users"
          cta={t("hr.card.globalUsers.cta")}
        />
        <HrCard
          title={t("hr.card.companyUsers.title")}
          description={t("hr.card.companyUsers.desc")}
          href="/global/hr/company-users"
          cta={t("hr.card.companyUsers.cta")}
        />
      </div>
    </div>
  );
}

function HrCard({
  title,
  description,
  href,
  cta,
}: {
  title: string;
  description: string;
  href: string;
  cta: string;
}) {
  return (
    <Card className="h-full space-y-2 transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="text-lg font-semibold">{title}</div>
      <div className="text-sm text-muted-foreground">{description}</div>
      <Link
        href={href}
        className="inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold hover:border-primary"
      >
        {cta}
      </Link>
    </Card>
  );
}
