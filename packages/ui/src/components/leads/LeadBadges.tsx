"use client";

import React from "react";
import type { LeadStatus, LeadType } from "@repo/ai-core/crm/leads/types";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function LeadTypeBadge({ type }: { type: LeadType }) {
  const config: Record<string, { label: string; cls: string }> = {
    rsa: { label: "RSA", cls: "border-sky-500/30 bg-sky-500/10 text-sky-400" },
    recovery: { label: "Recovery", cls: "border-orange-500/30 bg-orange-500/10 text-orange-400" },
    workshop: { label: "Workshop", cls: "border-violet-500/30 bg-violet-500/10 text-violet-400" },
  };
  const { label, cls } = config[type] ?? { label: type, cls: "border-border bg-muted/40 text-muted-foreground" };
  return (
    <span className={cx("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold", cls)}>
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
    open: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    accepted: "border-sky-500/30 bg-sky-500/10 text-sky-400",
    car_in: "border-indigo-500/30 bg-indigo-500/10 text-indigo-400",
    closed: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
    lost: "border-red-500/30 bg-red-500/10 text-red-400",
    processing: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    closed_won: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  };
  const dotColor: Record<LeadStatus, string> = {
    open: "bg-emerald-500",
    accepted: "bg-sky-500",
    car_in: "bg-indigo-500",
    closed: "bg-zinc-500",
    lost: "bg-red-500",
    processing: "bg-amber-500",
    closed_won: "bg-emerald-500",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold",
        colorMap[status]
      )}
    >
      <span className={cx("h-1.5 w-1.5 rounded-full", dotColor[status])} />
      {labelMap[status]}
    </span>
  );
}

export function LeadHealthBadge({ score }: { score: number | null }) {
  if (score == null) {
    return <span className="text-xs text-muted-foreground">Unknown</span>;
  }
  let label = "Healthy";
  let cls = "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
  if (score < 40) {
    label = "At Risk";
    cls = "border-red-500/30 bg-red-500/10 text-red-400";
  } else if (score < 70) {
    label = "Attention";
    cls = "border-amber-500/30 bg-amber-500/10 text-amber-400";
  }
  return (
    <span className={cx("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold", cls)}>
      {label} ({score})
    </span>
  );
}
