"use client";

import React from "react";
import type { LeadStatus, LeadType } from "@repo/ai-core/crm/leads/types";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function LeadTypeBadge({ type }: { type: LeadType }) {
  const label = type === "rsa" ? "RSA" : type === "recovery" ? "Recovery" : "Workshop";
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs bg-muted/40 border-border/60">
      {label}
    </span>
  );
}

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const labelMap: Record<LeadStatus, string> = {
    open: "Open",
    accepted: "Accepted",
    car_in: "Car In",
    closed: "Closed",
    lost: "Lost",
    processing: "Processing",
    closed_won: "Closed / Won",
  };
  const colorMap: Record<LeadStatus, string> = {
    open: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200",
    accepted: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
    car_in: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200",
    closed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
    lost: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200",
    processing: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
    closed_won: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        colorMap[status]
      )}
    >
      {labelMap[status]}
    </span>
  );
}

export function LeadHealthBadge({ score }: { score: number | null }) {
  if (score == null) {
    return <span className="text-xs text-muted-foreground">Unknown</span>;
  }
  let label = "Healthy";
  let cls = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
  if (score < 40) {
    label = "At Risk";
    cls = "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200";
  } else if (score < 70) {
    label = "Attention";
    cls = "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200";
  }
  return (
    <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", cls)}>
      {label} ({score})
    </span>
  );
}
