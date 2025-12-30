"use client";

import React from "react";

type Props = {
  riskLevel?: "low" | "medium" | "high" | string | null;
  score?: number | null;
};

const styles: Record<string, string> = {
  low: "bg-emerald-500/20 text-emerald-200 border border-emerald-400/40",
  medium: "bg-amber-500/20 text-amber-200 border border-amber-400/40",
  high: "bg-red-500/20 text-red-200 border border-red-400/40",
  unknown: "bg-slate-500/20 text-slate-200 border border-slate-400/40",
};

export function UserRiskBadge({ riskLevel, score }: Props) {
  const level = (riskLevel ?? "unknown").toLowerCase();
  const cls = styles[level] ?? styles.unknown;
  const label =
    level === "unknown"
      ? "Unknown"
      : `${level.charAt(0).toUpperCase()}${level.slice(1)}` +
        (score != null ? ` (${Math.round(score)})` : "");
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}
