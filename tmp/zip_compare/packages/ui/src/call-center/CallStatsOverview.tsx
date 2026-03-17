"use client";

import React from "react";
import { Card } from "../components/Card";
import { useI18n } from "../i18n";

export type CallStatsOverviewProps = {
  totalCallsToday: number;
  answeredToday: number;
  missedToday: number;
  outboundToday: number;
};

export function CallStatsOverview({ totalCallsToday, answeredToday, missedToday, outboundToday }: CallStatsOverviewProps) {
  const { t } = useI18n();

  const items = [
    { label: t("call.stats.totalToday"), value: totalCallsToday },
    { label: t("call.stats.answered"), value: answeredToday },
    { label: t("call.stats.missed"), value: missedToday },
    { label: t("call.stats.outbound"), value: outboundToday },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</div>
          <div className="text-2xl font-semibold mt-1">{item.value}</div>
        </Card>
      ))}
    </div>
  );
}
