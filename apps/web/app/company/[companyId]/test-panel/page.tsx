"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { AppLayout } from "@repo/ui";
import { toast } from "sonner";

/* ── Types ── */
type Objective = {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
};

type StepResult = {
  step: number;
  name: string;
  status: "pass" | "warn" | "fail" | "pending";
  message: string;
  objectives: Objective[];
  data?: Record<string, unknown>;
};

type LeadOption = {
  id: string;
  lead_type: string;
  lead_status: string;
  lead_stage: string;
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  plate_number: string | null;
  make: string | null;
  model: string | null;
};

type Summary = { total: number; pass: number; warn: number; fail: number; pending: number };

type LeadInfo = {
  id: string;
  type: string;
  status: string;
  stage: string;
  customerName: string | null;
  customerPhone: string | null;
  car: string;
  createdAt: string;
  closedAt: string | null;
};

/* ── Status Helpers ── */
const STATUS_CONFIG = {
  pass:    { icon: "\u2713", label: "Pass",    bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400", glow: "shadow-emerald-500/10" },
  warn:    { icon: "\u26A0", label: "Warning", bg: "bg-amber-500/10",   border: "border-amber-500/20",   text: "text-amber-400",   glow: "shadow-amber-500/10" },
  fail:    { icon: "\u2717", label: "Fail",    bg: "bg-red-500/10",     border: "border-red-500/20",     text: "text-red-400",     glow: "shadow-red-500/10" },
  pending: { icon: "\u2022", label: "Pending", bg: "bg-zinc-800/50",    border: "border-zinc-700/50",    text: "text-zinc-500",    glow: "" },
};

function StatusBadge({ status }: { status: keyof typeof STATUS_CONFIG }) {
  const c = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${c.bg} ${c.border} ${c.text}`}>
      <span className="text-sm">{c.icon}</span> {c.label}
    </span>
  );
}

/* ── Components ── */
function SummaryCards({ summary }: { summary: Summary }) {
  const cards = [
    { label: "Pass",    value: summary.pass,    color: "text-emerald-400", bg: "from-emerald-950/40 to-emerald-950/20" },
    { label: "Warning", value: summary.warn,    color: "text-amber-400",   bg: "from-amber-950/40 to-amber-950/20" },
    { label: "Fail",    value: summary.fail,    color: "text-red-400",     bg: "from-red-950/40 to-red-950/20" },
    { label: "Pending", value: summary.pending, color: "text-zinc-400",    bg: "from-zinc-900/40 to-zinc-950/20" },
  ];
  return (
    <div className="grid grid-cols-4 gap-3">
      {cards.map(c => (
        <div key={c.label} className={`rounded-xl border border-border bg-gradient-to-br ${c.bg} p-4 text-center`}>
          <div className={`text-3xl font-bold tabular-nums ${c.color}`}>{c.value}</div>
          <div className="text-[11px] uppercase tracking-wider text-zinc-500 mt-1">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

function ProgressBar({ summary }: { summary: Summary }) {
  const total = summary.total || 1;
  const pPass = (summary.pass / total) * 100;
  const pWarn = (summary.warn / total) * 100;
  const pFail = (summary.fail / total) * 100;
  return (
    <div className="w-full h-3 rounded-full bg-zinc-800 overflow-hidden flex">
      {pPass > 0 && <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${pPass}%` }} />}
      {pWarn > 0 && <div className="h-full bg-amber-500 transition-all duration-700" style={{ width: `${pWarn}%` }} />}
      {pFail > 0 && <div className="h-full bg-red-500 transition-all duration-700" style={{ width: `${pFail}%` }} />}
    </div>
  );
}

function StepCard({ result, isExpanded, onToggle }: { result: StepResult; isExpanded: boolean; onToggle: () => void }) {
  const c = STATUS_CONFIG[result.status];
  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} transition-all duration-300 ${c.glow ? `shadow-lg ${c.glow}` : ""}`}>
      <button onClick={onToggle} className="w-full text-left px-5 py-4 flex items-center gap-4">
        {/* Step Number */}
        <div className={`flex-shrink-0 w-10 h-10 rounded-full border-2 ${c.border} flex items-center justify-center`}>
          <span className={`text-lg font-bold ${c.text}`}>
            {result.status === "pass" ? "\u2713" : result.step}
          </span>
        </div>
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white text-sm">{result.name}</span>
            <StatusBadge status={result.status} />
          </div>
          <p className="text-xs text-zinc-400 mt-0.5 truncate">{result.message}</p>
        </div>
        {/* Expand Arrow */}
        <svg className={`w-4 h-4 text-zinc-500 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded Objectives */}
      {isExpanded && (
        <div className="px-5 pb-4 border-t border-border pt-3">
          <div className="space-y-2">
            {result.objectives.map(obj => {
              const oc = STATUS_CONFIG[obj.status];
              return (
                <div key={obj.id} className="flex items-start gap-3 py-1.5">
                  <span className={`mt-0.5 text-sm ${oc.text} flex-shrink-0 w-5 text-center`}>
                    {obj.status === "pass" ? "\u2713" : obj.status === "fail" ? "\u2717" : "\u26A0"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-mono text-zinc-600">{obj.id}</span>
                      <span className={`text-xs ${obj.status === "fail" ? "text-red-300" : "text-zinc-300"}`}>{obj.label}</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-0.5">{obj.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function LeadSelector({ leads, onSelect, loading }: { leads: LeadOption[]; onSelect: (id: string) => void; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="text-center py-4">
        <h2 className="text-lg font-bold text-white">Select a Lead to Test</h2>
        <p className="text-sm text-zinc-400 mt-1">Choose a lead to validate its complete workflow from creation to delivery</p>
      </div>
      {leads.length === 0 && (
        <div className="text-center py-10 text-zinc-500 text-sm">No leads found. Create a lead first to start testing.</div>
      )}
      <div className="space-y-2">
        {leads.map(lead => (
          <button
            key={lead.id}
            onClick={() => onSelect(lead.id)}
            className="w-full text-left rounded-xl border border-zinc-800/60 bg-gradient-to-r from-zinc-900/80 to-zinc-950/80 hover:border-blue-500/30 hover:from-blue-950/20 hover:to-zinc-950/80 transition-all p-4 group"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors">
                    {lead.customer_name || "Unknown Customer"}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                    {lead.lead_type}
                  </span>
                  <StatusBadge status={
                    lead.lead_status === "closed_won" || lead.lead_status === "closed" ? "pass" :
                    lead.lead_status === "processing" ? "warn" :
                    lead.lead_status === "lost" ? "fail" : "pending"
                  } />
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[11px] text-zinc-500">{lead.customer_phone || "No phone"}</span>
                  <span className="text-[11px] text-zinc-600">|</span>
                  <span className="text-[11px] text-zinc-500">{[lead.plate_number, lead.make, lead.model].filter(Boolean).join(" ") || "No car"}</span>
                  <span className="text-[11px] text-zinc-600">|</span>
                  <span className="text-[11px] text-zinc-500">{new Date(lead.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <svg className="w-5 h-5 text-zinc-600 group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function TestPanelPage() {
  const { companyId } = useParams();
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [results, setResults] = useState<StepResult[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [leadInfo, setLeadInfo] = useState<LeadInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [autoRefresh, setAutoRefresh] = useState(false);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/company/${companyId}/test-panel`);
      if (!res.ok) throw new Error("Failed to load leads");
      const data = await res.json();
      setLeads(data.leads || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const runTest = useCallback(async (leadId: string) => {
    setTesting(true);
    try {
      const res = await fetch(`/api/company/${companyId}/test-panel?leadId=${leadId}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Test failed");
      }
      const data = await res.json();
      setResults(data.steps);
      setSummary(data.summary);
      setLeadInfo(data.lead);

      // auto-expand steps with issues
      const issueSteps = new Set<number>(
        data.steps.filter((s: StepResult) => s.status === "fail" || s.status === "warn").map((s: StepResult) => s.step)
      );
      setExpandedSteps(issueSteps);

      if (data.summary.fail > 0) {
        toast.error(`${data.summary.fail} step(s) failed`);
      } else if (data.summary.warn > 0) {
        toast.warning(`${data.summary.warn} step(s) have warnings`);
      } else if (data.summary.pending > 0) {
        toast(`${data.summary.pass}/11 steps passed, ${data.summary.pending} pending`);
      } else {
        toast.success("All 11 steps passed!");
      }
    } catch (err: any) {
      toast.error(err.message || "Test failed");
    } finally {
      setTesting(false);
    }
  }, [companyId]);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  // Auto-refresh every 10s when enabled
  useEffect(() => {
    if (!autoRefresh || !selectedLeadId) return;
    const interval = setInterval(() => runTest(selectedLeadId), 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedLeadId, runTest]);

  const toggleStep = (step: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      next.has(step) ? next.delete(step) : next.add(step);
      return next;
    });
  };

  const handleSelectLead = (leadId: string) => {
    setSelectedLeadId(leadId);
    runTest(leadId);
  };

  const handleBack = () => {
    setSelectedLeadId(null);
    setResults(null);
    setSummary(null);
    setLeadInfo(null);
    setAutoRefresh(false);
    loadLeads();
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-sm">AI</span>
              Test Panel
            </h1>
            <p className="text-xs text-zinc-500 mt-1">Workflow validation: Lead Creation to Car Out / Delivery</p>
          </div>
          {selectedLeadId && (
            <div className="flex items-center gap-2">
              {/* Auto Refresh Toggle */}
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                  autoRefresh
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:text-white"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`} />
                Auto-Refresh {autoRefresh ? "ON" : "OFF"}
              </button>
              {/* Refresh */}
              <button
                onClick={() => runTest(selectedLeadId)}
                disabled={testing}
                className="flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-500/20 transition-all disabled:opacity-50"
              >
                <svg className={`w-3.5 h-3.5 ${testing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {testing ? "Testing..." : "Re-test"}
              </button>
              {/* Back */}
              <button
                onClick={handleBack}
                className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-all"
              >
                Back
              </button>
            </div>
          )}
        </div>

        {/* Lead Selection or Results */}
        {!selectedLeadId ? (
          <div className="rounded-xl border border-zinc-800/60 bg-gradient-to-br from-slate-900/80 to-black/90 p-6">
            <LeadSelector leads={leads} onSelect={handleSelectLead} loading={loading} />
          </div>
        ) : (
          <>
            {/* Lead Info Bar */}
            {leadInfo && (
              <div className="rounded-xl border border-zinc-800/60 bg-gradient-to-br from-slate-900/80 to-black/90 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="text-sm font-bold text-white">{leadInfo.customerName || "Unknown Customer"}</div>
                      <div className="text-[11px] text-zinc-400">{leadInfo.customerPhone || "No phone"} | {leadInfo.car || "No car"}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <div className="text-right">
                      <span className="text-zinc-500">Type: </span>
                      <span className="text-zinc-300 font-medium">{leadInfo.type}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-zinc-500">Status: </span>
                      <span className="text-zinc-300 font-medium">{leadInfo.status}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-zinc-500">Stage: </span>
                      <span className="text-zinc-300 font-medium">{leadInfo.stage}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Summary Cards */}
            {summary && (
              <div className="space-y-3">
                <ProgressBar summary={summary} />
                <SummaryCards summary={summary} />
              </div>
            )}

            {/* Step Results */}
            {testing && !results && (
              <div className="flex items-center justify-center py-20">
                <div className="text-center space-y-3">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-400 mx-auto" />
                  <div className="text-sm text-zinc-400">Analyzing workflow...</div>
                </div>
              </div>
            )}
            {results && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-zinc-300">Workflow Steps</h2>
                  <div className="flex gap-2">
                    <button onClick={() => setExpandedSteps(new Set(results.map(r => r.step)))} className="text-[11px] text-zinc-500 hover:text-white">
                      Expand All
                    </button>
                    <span className="text-zinc-700">|</span>
                    <button onClick={() => setExpandedSteps(new Set())} className="text-[11px] text-zinc-500 hover:text-white">
                      Collapse All
                    </button>
                  </div>
                </div>
                {results.map(result => (
                  <StepCard
                    key={result.step}
                    result={result}
                    isExpanded={expandedSteps.has(result.step)}
                    onToggle={() => toggleStep(result.step)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
