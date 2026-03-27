"use client";

import { ENGINE_LABELS, type EngineKey } from "./types";

interface Props {
  engineKeys: EngineKey[];
  loading: boolean;
  lastUpdated: Date | null;
  totalSignals: number;
  highCount: number;
}

function relativeTime(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

export function AIStatusBar({ engineKeys, loading, lastUpdated, totalSignals, highCount }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-purple-500/20 bg-purple-500/5 px-4 py-2.5">
      {/* Label */}
      <div className="flex items-center gap-1.5">
        <span className="text-purple-400 text-sm">✦</span>
        <span className="text-xs font-semibold text-purple-400 uppercase tracking-wide">
          AI Intelligence
        </span>
      </div>

      {/* Engine pills */}
      <div className="flex flex-wrap gap-1.5">
        {engineKeys.map((key) => (
          <span
            key={key}
            className="rounded-full px-2 py-0.5 text-[10px] bg-purple-500/10 border border-purple-400/20 text-purple-300"
          >
            {key.toUpperCase()} {ENGINE_LABELS[key]}
          </span>
        ))}
      </div>

      {/* Status */}
      <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
        {loading ? (
          <span className="text-purple-400 animate-pulse">Analysing…</span>
        ) : lastUpdated ? (
          <>
            {highCount > 0 && (
              <span className="text-red-400 font-medium">{highCount} HIGH</span>
            )}
            <span>{totalSignals} signals</span>
            <span>Updated {relativeTime(lastUpdated)}</span>
          </>
        ) : (
          <span>Not yet run</span>
        )}
      </div>
    </div>
  );
}
