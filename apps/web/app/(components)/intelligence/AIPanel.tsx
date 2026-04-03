"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AIStatusBar } from "./AIStatusBar";
import { SignalCard } from "./SignalCard";
import type { EngineKey, EngineResult, Signal, SignalType } from "./types";

interface Props {
  companyId: string;
  branchId?: string;
  engines: EngineKey[];
  from?: Date;
  to?: Date;
  refreshIntervalMin?: number;
}

const TABS: { key: SignalType; label: string }[] = [
  { key: "diagnostic", label: "Diagnostic" },
  { key: "predictive", label: "Predictive" },
  { key: "prescriptive", label: "Prescriptive" },
];

export function AIPanel({ companyId, branchId, engines, from, to, refreshIntervalMin = 5 }: Props) {
  const [results, setResults] = useState<EngineResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<SignalType>("diagnostic");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userResolved, setUserResolved] = useState(false);

  // Resolve userId from session once
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          setUserId(json?.userId ?? null);
        }
      } catch { /* ignore */ }
      setUserResolved(true);
    })();
  }, []);

  const fetchSignals = useCallback(async () => {
    if (!userResolved) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("engines", engines.join(","));
      if (branchId) params.set("branchId", branchId);
      if (from) params.set("from", from.toISOString().slice(0, 10));
      if (to) params.set("to", to.toISOString().slice(0, 10));

      const headers: HeadersInit = {};
      if (userId) headers["x-user-id"] = userId;

      const res = await fetch(`/api/company/${companyId}/intelligence/signals?${params}`, { headers });
      if (!res.ok) return;
      const json = await res.json();
      if (Array.isArray(json.engines)) {
        setResults(json.engines);
        setLastUpdated(new Date());
      }
    } catch {
      // silent — graceful degradation
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId, engines, from, to, userId, userResolved]);

  useEffect(() => {
    fetchSignals();
    timerRef.current = setInterval(fetchSignals, refreshIntervalMin * 60 * 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchSignals, refreshIntervalMin]);

  const allSignals: Signal[] = results.flatMap((r) => r.signals ?? []);
  const filtered = allSignals.filter((s) => s.type === activeTab);
  const highCount = allSignals.filter((s) => s.urgency === "HIGH").length;

  // Don't render anything if no signals and not loading and already tried once
  if (!loading && lastUpdated && allSignals.length === 0) return null;

  return (
    <div className="space-y-4">
      <AIStatusBar
        engineKeys={engines}
        loading={loading}
        lastUpdated={lastUpdated}
        totalSignals={allSignals.length}
        highCount={highCount}
      />

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => {
          const count = allSignals.filter((s) => s.type === tab.key).length;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-purple-500 text-purple-400"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className="ml-1.5 rounded-full bg-purple-500/20 px-1.5 py-0.5 text-[10px] text-purple-400">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Signal cards */}
      {loading && allSignals.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-slate-900/40 p-4 h-32 animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((signal, i) => (
            <SignalCard key={`${signal.engine_key}-${i}`} signal={signal} />
          ))}
        </div>
      ) : lastUpdated ? (
        <div className="rounded-xl border border-border bg-slate-900/40 px-4 py-6 text-center text-sm text-slate-500">
          No {activeTab} signals detected for this period.
        </div>
      ) : null}
    </div>
  );
}
