"use client";

import React from "react";
import Link from "next/link";
import { AppLayout, Card, useI18n } from "@repo/ui";

const links = [
  { titleKey: "accounting.reports.pnl", href: "/global/accounting/reports/pnl" },
  { titleKey: "accounting.reports.cashflow", href: "/global/accounting/reports/cashflow" },
  { titleKey: "accounting.reports.trial", href: "/global/accounting/reports/trial-balance" },
  { titleKey: "accounting.reports.balance", href: "/global/accounting/reports/balance-sheet" },
] as const;

export default function AccountingReportsPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("accounting.reports.page.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("accounting.reports.page.subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {links.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="h-full cursor-pointer transition hover:border-primary/60">
              <div className="text-lg font-semibold">{t(item.titleKey)}</div>
              <div className="mt-1 text-xs text-muted-foreground">{t("accounting.reports.view")}</div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
