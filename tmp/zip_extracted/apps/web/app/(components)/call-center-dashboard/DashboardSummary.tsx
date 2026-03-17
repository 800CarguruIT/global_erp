"use client";

import React from "react";
import { formatHms, formatMmSs } from "./helpers";

type SummaryProps = {
  totalCalls: number;
  completedCalls: number;
  failedCalls: number;
  totalDurationSeconds: number;
  averageDurationSeconds: number | null;
};

const cardClass =
  "rounded-lg border border-slate-800 bg-slate-900/80 p-4 shadow-sm flex flex-col gap-1 text-gray-100";

export function DashboardSummary(props: SummaryProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      <div className={cardClass}>
        <span className="text-xs uppercase text-gray-400">Total Calls</span>
        <span className="text-2xl font-semibold">{props.totalCalls}</span>
      </div>
      <div className={cardClass}>
        <span className="text-xs uppercase text-gray-400">Completed</span>
        <span className="text-2xl font-semibold text-green-400">{props.completedCalls}</span>
      </div>
      <div className={cardClass}>
        <span className="text-xs uppercase text-gray-400">Failed</span>
        <span className="text-2xl font-semibold text-red-400">{props.failedCalls}</span>
      </div>
      <div className={cardClass}>
        <span className="text-xs uppercase text-gray-400">Total Duration</span>
        <span className="text-xl font-semibold">{formatHms(props.totalDurationSeconds)}</span>
      </div>
      <div className={cardClass}>
        <span className="text-xs uppercase text-gray-400">Avg Duration</span>
        <span className="text-xl font-semibold">{formatMmSs(props.averageDurationSeconds)}</span>
      </div>
    </div>
  );
}
