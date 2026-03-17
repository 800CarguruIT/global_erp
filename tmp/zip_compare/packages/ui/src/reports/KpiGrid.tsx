"use client";

import React from "react";

export interface KpiItem {
  label: string;
  value: number | string;
  subtitle?: string;
}

export interface KpiGridProps {
  items: KpiItem[];
}

export function KpiGrid({ items }: KpiGridProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="text-xs text-muted-foreground">{item.label}</div>
          <div className="text-2xl font-semibold">{item.value}</div>
          {item.subtitle ? (
            <div className="text-[11px] text-muted-foreground">{item.subtitle}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
