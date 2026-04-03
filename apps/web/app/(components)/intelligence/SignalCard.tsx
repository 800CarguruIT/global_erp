"use client";

import type { Signal } from "./types";

interface Props {
  signal: Signal;
}

const URGENCY_STYLES: Record<Signal["urgency"], string> = {
  HIGH: "bg-red-500/10 text-red-400 border border-red-500/20",
  MED: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
  LOW: "bg-green-500/10 text-green-400 border border-green-500/20",
};

const TYPE_STYLES: Record<Signal["type"], string> = {
  diagnostic: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  predictive: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
  prescriptive: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
};

export function SignalCard({ signal }: Props) {
  const confidencePct = Math.round(signal.confidence * 100);

  return (
    <div className="rounded-xl border border-border bg-slate-900/80 p-4 space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${URGENCY_STYLES[signal.urgency]}`}>
          {signal.urgency}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TYPE_STYLES[signal.type]}`}>
          {signal.type}
        </span>
        <span className="ml-auto text-xs text-slate-500">{confidencePct}% confidence</span>
      </div>

      {/* Metric + Observation */}
      <div>
        <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-0.5">
          {signal.metric}
        </div>
        <div className="text-sm font-medium text-slate-100">{signal.observation}</div>
      </div>

      {/* Diagnosis */}
      {signal.diagnosis && (
        <div className="text-sm text-slate-400">{signal.diagnosis}</div>
      )}

      {/* Action */}
      {signal.action && (
        <div className="rounded-lg bg-purple-500/10 border border-purple-400/20 p-3">
          <div className="text-[10px] uppercase tracking-widest text-purple-400 mb-1">Action</div>
          <div className="text-sm text-purple-200">{signal.action}</div>
        </div>
      )}

      {/* Footer */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1 border-t border-border">
        {signal.owner_role && (
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-400">
            {signal.owner_role}
          </span>
        )}
        <span>Respond within {signal.respond_by_hours}h</span>
        {signal.expected_outcome && (
          <span className="text-slate-600 truncate max-w-[200px]" title={signal.expected_outcome}>
            → {signal.expected_outcome}
          </span>
        )}
      </div>
    </div>
  );
}
