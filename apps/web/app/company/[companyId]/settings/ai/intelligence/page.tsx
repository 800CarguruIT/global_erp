"use client";

import React, { useEffect, useState } from "react";
import { AppLayout } from "@repo/ui";

type Params = { params: { companyId: string } | Promise<{ companyId: string }> };

type EngineKey = "e1" | "e2" | "e3" | "e4" | "e5" | "e6" | "e7";

const ENGINE_META: Record<EngineKey, { label: string; description: string }> = {
  e1: { label: "Funnel Intelligence", description: "Lead stage drop-off, bottlenecks, and SLA breaches" },
  e2: { label: "Agent Performance", description: "Individual KPI decline, coaching triggers, peer comparison" },
  e3: { label: "Revenue Forecasting", description: "24h/72h revenue projections and gap detection" },
  e4: { label: "Churn & Retention", description: "Customer risk scoring and retention playbooks" },
  e5: { label: "Anomaly Detection", description: "Z-score outliers across calls, leads, and revenue" },
  e6: { label: "Collections Intelligence", description: "Invoice payment probability and priority call lists" },
  e7: { label: "Coaching Intelligence", description: "Agent-specific coaching plans with expected improvements" },
};

interface EngineConfig {
  engine_key: EngineKey;
  enabled: boolean;
  refresh_interval_min: number;
  thresholds: Record<string, unknown>;
  prompt_override: string | null;
  has_prompt_override?: boolean;
}

interface LogEntry {
  id: string;
  engine_key: string;
  triggered_at: string;
  signals_count: number;
  high_urgency: number;
  latency_ms: number | null;
  error: string | null;
}

export default function IntelligenceSettingsPage({ params }: Params) {
  const resolvedParams = params instanceof Promise ? null : params;
  const [companyId, setCompanyId] = useState<string>("");
  const [configs, setConfigs] = useState<EngineConfig[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<EngineKey | null>(null);
  const [expandedPrompt, setExpandedPrompt] = useState<EngineKey | null>(null);
  const [localConfigs, setLocalConfigs] = useState<Record<EngineKey, Partial<EngineConfig>>>({} as any);
  const [saveStatus, setSaveStatus] = useState<Record<EngineKey, "idle" | "saved" | "error">>({} as any);

  useEffect(() => {
    async function init() {
      let cid = "";
      if (params instanceof Promise) {
        const p = await params;
        cid = p.companyId;
      } else {
        cid = params.companyId;
      }
      setCompanyId(cid);
      await loadConfig(cid);
    }
    init();
  }, []);

  async function loadConfig(cid: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/company/${cid}/intelligence/config`);
      if (!res.ok) return;
      const data = await res.json();
      setConfigs(data.engines ?? []);
      setLogs(data.recent_logs ?? []);
      const local: Record<string, Partial<EngineConfig>> = {};
      for (const e of data.engines ?? []) {
        local[e.engine_key] = {
          enabled: e.enabled,
          refresh_interval_min: e.refresh_interval_min,
          thresholds: e.thresholds,
          prompt_override: e.prompt_override ?? "",
        };
      }
      setLocalConfigs(local as any);
    } finally {
      setLoading(false);
    }
  }

  function updateLocal(engineKey: EngineKey, patch: Partial<EngineConfig>) {
    setLocalConfigs((prev) => ({
      ...prev,
      [engineKey]: { ...(prev[engineKey] ?? {}), ...patch },
    }));
  }

  async function saveEngine(engineKey: EngineKey) {
    if (!companyId) return;
    setSaving(engineKey);
    try {
      const local = localConfigs[engineKey] ?? {};
      let thresholds = local.thresholds ?? {};
      if (typeof local.thresholds === "string") {
        try { thresholds = JSON.parse(local.thresholds as unknown as string); } catch { thresholds = {}; }
      }
      const res = await fetch(`/api/company/${companyId}/intelligence/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          engine_key: engineKey,
          enabled: local.enabled,
          refresh_interval_min: local.refresh_interval_min,
          thresholds,
          prompt_override: local.prompt_override || null,
        }),
      });
      setSaveStatus((prev) => ({ ...prev, [engineKey]: res.ok ? "saved" : "error" }));
      setTimeout(() => setSaveStatus((prev) => ({ ...prev, [engineKey]: "idle" })), 2000);
    } catch {
      setSaveStatus((prev) => ({ ...prev, [engineKey]: "error" }));
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="py-8 text-center text-slate-400 text-sm">Loading AI Intelligence configuration…</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6 py-6 px-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-100">AI Intelligence Engines</h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure the 7 AI engines that overlay your dashboards with diagnostic, predictive, and prescriptive insights.
          </p>
        </div>

        {/* Engine list */}
        <div className="space-y-4">
          {(Object.keys(ENGINE_META) as EngineKey[]).map((key) => {
            const meta = ENGINE_META[key];
            const local = localConfigs[key] ?? {};
            const status = saveStatus[key] ?? "idle";

            return (
              <div key={key} className="rounded-xl border border-white/10 bg-slate-900/80 p-5 space-y-4">
                {/* Header row */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-purple-500/10 border border-purple-400/20 px-2.5 py-1 text-xs font-semibold text-purple-400 uppercase">
                      {key.toUpperCase()}
                    </span>
                    <div>
                      <div className="font-medium text-slate-100">{meta.label}</div>
                      <div className="text-xs text-slate-500">{meta.description}</div>
                    </div>
                  </div>

                  {/* Enable toggle */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={local.enabled ?? true}
                      onChange={(e) => updateLocal(key, { enabled: e.target.checked })}
                      className="w-4 h-4 accent-purple-500"
                    />
                    <span className="text-sm text-slate-300">Enabled</span>
                  </label>
                </div>

                {/* Settings row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="space-y-1">
                    <span className="text-xs text-slate-400">Refresh interval (minutes)</span>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={local.refresh_interval_min ?? 5}
                      onChange={(e) => updateLocal(key, { refresh_interval_min: parseInt(e.target.value) || 5 })}
                      className="w-full rounded-md bg-slate-800 border border-white/10 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </label>
                </div>

                {/* Prompt override toggle */}
                <div>
                  <button
                    onClick={() => setExpandedPrompt(expandedPrompt === key ? null : key)}
                    className="text-xs text-purple-400 hover:text-purple-300 underline underline-offset-2"
                  >
                    {expandedPrompt === key ? "Hide prompt override ↑" : "Edit prompt override ↓"}
                  </button>

                  {expandedPrompt === key && (
                    <div className="mt-2 space-y-1">
                      <div className="text-xs text-slate-400">
                        Custom system prompt (leave empty to use built-in default)
                      </div>
                      <textarea
                        rows={6}
                        value={local.prompt_override ?? ""}
                        onChange={(e) => updateLocal(key, { prompt_override: e.target.value })}
                        placeholder="Leave empty to use built-in prompt for this engine…"
                        className="w-full rounded-md bg-slate-800 border border-white/10 px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-purple-500 placeholder:text-slate-600"
                      />
                    </div>
                  )}
                </div>

                {/* Save button */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => saveEngine(key)}
                    disabled={saving === key}
                    className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                  >
                    {saving === key ? "Saving…" : "Save"}
                  </button>
                  {status === "saved" && <span className="text-xs text-green-400">Saved</span>}
                  {status === "error" && <span className="text-xs text-red-400">Error saving</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent signal logs */}
        {logs.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-slate-900/80 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Recent Signal Runs</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs text-slate-400">
                <thead>
                  <tr className="border-b border-white/10 text-left">
                    <th className="pb-2 pr-4 font-medium">Engine</th>
                    <th className="pb-2 pr-4 font-medium">Triggered</th>
                    <th className="pb-2 pr-4 font-medium">Signals</th>
                    <th className="pb-2 pr-4 font-medium">HIGH</th>
                    <th className="pb-2 pr-4 font-medium">Latency</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-white/5">
                      <td className="py-1.5 pr-4">
                        <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-purple-300 text-[10px]">
                          {log.engine_key.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-1.5 pr-4">{new Date(log.triggered_at).toLocaleString()}</td>
                      <td className="py-1.5 pr-4">{log.signals_count}</td>
                      <td className="py-1.5 pr-4">
                        {log.high_urgency > 0 ? (
                          <span className="text-red-400">{log.high_urgency}</span>
                        ) : (
                          "0"
                        )}
                      </td>
                      <td className="py-1.5 pr-4">{log.latency_ms != null ? `${log.latency_ms}ms` : "—"}</td>
                      <td className="py-1.5">
                        {log.error ? (
                          <span className="text-red-400">Error</span>
                        ) : (
                          <span className="text-green-400">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
