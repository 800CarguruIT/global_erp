"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { AIPanel } from "../../../../(components)/intelligence/AIPanel";

interface CallRecord {
  id: string;
  direction: string;
  from_number: string;
  to_number: string;
  status: string;
  duration_seconds: number | null;
  created_at: string;
  agent_name: string | null;
  agent_email: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  recording_url: string | null;
}

function formatDuration(s: number | null) {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function statusColor(s: string) {
  if (s === "completed") return "text-emerald-400";
  if (s === "in_progress") return "text-blue-400";
  if (s === "ringing") return "text-yellow-400";
  if (s === "failed" || s === "cancelled") return "text-red-400";
  return "text-slate-400";
}

export default function PisCallsPage() {
  const { companyId } = useParams();
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState("all");
  const [showAi, setShowAi] = useState(false);

  const loadCalls = useCallback(async () => {
    try {
      const url = `/api/company/${companyId}/pis/calls${direction !== "all" ? `?direction=${direction}` : ""}`;
      const r = await fetch(url, { cache: "no-store" });
      const data = await r.json();
      const arr = Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : [];
      setCalls(arr);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [companyId, direction]);

  useEffect(() => { setLoading(true); loadCalls(); }, [loadCalls]);

  const total = calls.length;
  const inbound = calls.filter(c => c.direction === "inbound").length;
  const outbound = calls.filter(c => c.direction === "outbound").length;
  const completed = calls.filter(c => c.status === "completed").length;
  const missed = calls.filter(c => c.status === "failed" || c.status === "cancelled").length;
  const avgDuration = completed > 0 ? Math.round(calls.filter(c => c.status === "completed" && c.duration_seconds).reduce((sum, c) => sum + (c.duration_seconds ?? 0), 0) / completed) : 0;
  const answerRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Service Center — Calls History</h2>
          <p className="text-xs text-slate-500">All call activity across service center agents</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowAi(!showAi)} className={`rounded-lg px-3 py-1.5 text-[10px] font-semibold ${showAi ? "bg-purple-500/20 text-purple-400" : "bg-slate-800 text-slate-400 hover:text-foreground"}`}>
            {showAi ? "Hide AI" : "AI Signals"}
          </button>
          <button onClick={loadCalls} className="rounded-lg bg-slate-800 px-3 py-1.5 text-[10px] font-semibold text-slate-400 hover:text-foreground">
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { l: "Total Calls", v: total, c: "text-foreground" },
          { l: "Inbound", v: inbound, c: "text-cyan-400" },
          { l: "Outbound", v: outbound, c: "text-blue-400" },
          { l: "Completed", v: completed, c: "text-emerald-400" },
          { l: "Missed", v: missed, c: "text-red-400" },
          { l: "Avg Duration", v: formatDuration(avgDuration), c: "text-amber-400" },
          { l: "Answer Rate", v: `${answerRate}%`, c: answerRate >= 80 ? "text-emerald-400" : "text-red-400" },
        ].map(k => (
          <div key={k.l} className="rounded-xl border border-border bg-gradient-to-br from-slate-900/80 to-black/90 p-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">{k.l}</div>
            <div className={`text-lg font-bold ${k.c}`}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Direction Filter */}
      <div className="flex gap-2">
        {["all", "inbound", "outbound"].map(d => (
          <button key={d} onClick={() => setDirection(d)}
            className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase ${direction === d ? "bg-amber-500/20 text-amber-400" : "bg-slate-800 text-slate-400 hover:text-foreground"}`}>
            {d}
          </button>
        ))}
      </div>

      <div className={`${showAi ? "grid grid-cols-1 lg:grid-cols-3 gap-6" : ""}`}>
        {/* Calls Table */}
        <div className={`${showAi ? "lg:col-span-2" : ""} rounded-xl border border-border bg-gradient-to-br from-slate-900/80 to-black/90 overflow-hidden`}>
          {loading ? <div className="text-slate-400 p-4">Loading calls...</div> : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left">
                  {["Time", "Direction", "Agent", "From", "To", "Customer", "Status", "Duration"].map(h => (
                    <th key={h} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {calls.slice(0, 100).map(c => (
                  <tr key={c.id} className="border-b border-border/40 hover:bg-muted/40">
                    <td className="px-3 py-2 text-slate-500">{timeAgo(c.created_at)}</td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${c.direction === "inbound" ? "bg-cyan-500/20 text-cyan-400" : "bg-blue-500/20 text-blue-400"}`}>
                        {c.direction === "inbound" ? "IN" : "OUT"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-foreground">{c.agent_name ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-300 font-mono">{c.from_number}</td>
                    <td className="px-3 py-2 text-slate-300 font-mono">{c.to_number}</td>
                    <td className="px-3 py-2 text-slate-300">{c.customer_name ?? "—"}</td>
                    <td className={`px-3 py-2 font-medium ${statusColor(c.status)}`}>{c.status}</td>
                    <td className="px-3 py-2 text-slate-300">{formatDuration(c.duration_seconds)}</td>
                  </tr>
                ))}
                {calls.length === 0 && (
                  <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-500">No calls found</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* AI Panel */}
        {showAi && companyId && (
          <div className="lg:col-span-1">
            <AIPanel companyId={companyId as string} engines={["e2", "e7"]} />
          </div>
        )}
      </div>
    </div>
  );
}
