"use client";

import { AppLayout, useTheme } from "@repo/ui";
import { useEffect, useMemo, useState } from "react";

type Props = { params: { companyId: string } | Promise<{ companyId: string }> };
type SegmentFilter = "all" | "chsc" | "non_chsc" | "insurance" | "warranty";

type Kpis = {
  totalCustomers: number;
  assignedCustomers: number;
  contactedCustomers: number;
  totalCalls: number;
  answeredCalls: number;
  failedCalls: number;
  answeredRate: number;
  avgCallDurationSeconds: number | null;
};
type AgentReportRow = {
  agentUserId: string;
  agentName: string | null;
  totalCalls: number;
  answeredCalls: number;
  failedCalls: number;
  totalDurationSeconds: number;
  assignedCustomers: number;
  totalLeads: number;
  totalCollection: number;
  answerRate: number;
};

type AgentTableRow = {
  name: string;
  totalAssigned: number;
  totalCalls: number;
  totalAnswered: number;
  totalFailed: number;
  callsDurationSeconds: number;
  totalLeads: number;
  totalCollection: number;
  answerRate: number;
  performanceScore: number;
  performanceLabel: "Excellent" | "Good" | "Average" | "Needs Improvement";
};
type UserOption = {
  id: string;
  name: string;
  email?: string;
  isAgent?: boolean;
};
type AutoAssignPercentages = {
  chsc: number;
  non_chsc: number;
  insurance: number;
  warranty: number;
};
type AutoAssignResult = {
  requested: number;
  assigned: number;
  targetBySegment: AutoAssignPercentages;
  assignedBySegment: AutoAssignPercentages;
  agentUserId: string;
};

function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "-";
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

const SEGMENT_OPTIONS: Array<{ value: SegmentFilter; label: string }> = [
  { value: "all", label: "All Segments" },
  { value: "chsc", label: "CHSC" },
  { value: "non_chsc", label: "Non CHSC" },
  { value: "insurance", label: "Insurance" },
  { value: "warranty", label: "Warranty" },
];

export default function CompanyDataCenterPage({ params }: Props) {
  const { theme } = useTheme();
  const [companyId, setCompanyId] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [from, setFrom] = useState(toDateInput(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)));
  const [to, setTo] = useState(toDateInput(new Date()));
  const [segment, setSegment] = useState<SegmentFilter>("all");
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [agentReport, setAgentReport] = useState<AgentReportRow[]>([]);
  const [agents, setAgents] = useState<UserOption[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [totalToAssign, setTotalToAssign] = useState<number>(100);
  const [percentages, setPercentages] = useState<AutoAssignPercentages>({
    chsc: 25,
    non_chsc: 25,
    insurance: 25,
    warranty: 25,
  });
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignResult, setAssignResult] = useState<AutoAssignResult | null>(null);
  const agentRows = useMemo<AgentTableRow[]>(() => {
    const reportMap = new Map(agentReport.map((r) => [r.agentUserId, r]));
    const base = agents.length > 0 ? agents : agentReport.map((r) => ({ id: r.agentUserId, name: r.agentName ?? r.agentUserId }));
    return base.map((agent) => {
      const r = reportMap.get(agent.id);
      const totalLeads = r?.totalLeads ?? 0;
      const answeredCalls = r?.answeredCalls ?? 0;
      const answerRate = r?.answerRate ?? 0;
      // Performance based on answered calls vs total leads
      const score = Math.round(answerRate * 100);
      let label: AgentTableRow["performanceLabel"] = "Needs Improvement";
      if (score >= 85) label = "Excellent";
      else if (score >= 70) label = "Good";
      else if (score >= 50) label = "Average";
      return {
        name: agent.name,
        totalAssigned: r?.assignedCustomers ?? 0,
        totalCalls: r?.totalCalls ?? 0,
        totalAnswered: answeredCalls,
        totalFailed: r?.failedCalls ?? 0,
        callsDurationSeconds: r?.totalDurationSeconds ?? 0,
        totalLeads,
        totalCollection: r?.totalCollection ?? 0,
        answerRate,
        performanceScore: score,
        performanceLabel: label,
      };
    });
  }, [agents, agentReport]);

  useEffect(() => {
    Promise.resolve(params).then((p) => setCompanyId(String((p as { companyId?: string })?.companyId ?? "").trim()));
  }, [params]);

  useEffect(() => {
    let cancelled = false;
    async function loadCurrentUser() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setUserId((json?.userId as string | null) ?? null);
      } catch {
        if (!cancelled) setUserId(null);
      }
    }
    void loadCurrentUser();
    return () => {
      cancelled = true;
    };
  }, []);

  const queryString = useMemo(() => {
    const qs = new URLSearchParams();
    qs.set("from", from);
    qs.set("to", to);
    if (segment !== "all") qs.set("segment", segment);
    return qs.toString();
  }, [from, to, segment]);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;

    async function loadKpis() {
      setLoading(true);
      setError(null);
      try {
        const headers: HeadersInit = {};
        if (userId) headers["x-user-id"] = userId;
        const res = await fetch(`/api/company/${companyId}/data-center/kpis?${queryString}`, {
          cache: "no-store",
          headers,
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          const apiError = String(payload?.error ?? "Failed to load KPIs");
          if (res.status === 401) throw new Error("Unauthorized. Please sign in again.");
          throw new Error(apiError);
        }
        const json = await res.json();
        if (!cancelled) setKpis((json?.data as Kpis) ?? null);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to load KPIs";
        if (!cancelled) setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadKpis();
    return () => {
      cancelled = true;
    };
  }, [companyId, queryString, refreshKey, userId]);

  useEffect(() => {
    if (!companyId || !userId) return;
    let cancelled = false;
    async function loadAgentReport() {
      try {
        const headers: HeadersInit = { "x-user-id": userId };
        const res = await fetch(`/api/company/${companyId}/data-center/reports/agents?${queryString}`, {
          cache: "no-store",
          headers,
        });
        if (!res.ok) return;
        const json = await res.json();
        const rows = (json?.data?.rows as AgentReportRow[] | undefined) ?? [];
        if (!cancelled) setAgentReport(rows);
      } catch {
        if (!cancelled) setAgentReport([]);
      }
    }
    void loadAgentReport();
    return () => { cancelled = true; };
  }, [companyId, queryString, refreshKey, userId]);

  useEffect(() => {
    if (!companyId || !userId) return;
    let cancelled = false;
    async function loadAgents() {
      try {
        const res = await fetch(`/api/company/${companyId}/data-center/users`, {
          cache: "no-store",
          headers: { "x-user-id": userId },
        });
        if (!res.ok) return;
        const json = await res.json();
        const list = (json?.data?.agents as UserOption[] | undefined) ?? [];
        if (!cancelled) {
          setAgents(list);
          setSelectedAgentId((current) => current || String(list[0]?.id ?? ""));
        }
      } catch {
        if (!cancelled) setAgents([]);
      }
    }
    void loadAgents();
    return () => {
      cancelled = true;
    };
  }, [companyId, userId]);

  const percentageTotal = useMemo(
    () => percentages.chsc + percentages.non_chsc + percentages.insurance + percentages.warranty,
    [percentages]
  );

  async function handleAutoAssign() {
    if (!companyId) return;
    if (!selectedAgentId) {
      setAssignError("Please select an agent.");
      return;
    }
    if (!Number.isFinite(totalToAssign) || totalToAssign <= 0) {
      setAssignError("No. of customers must be greater than 0.");
      return;
    }
    if (percentageTotal <= 0) {
      setAssignError("Segment percentages must be greater than 0.");
      return;
    }

    setAssigning(true);
    setAssignError(null);
    setAssignResult(null);
    try {
      const headers: HeadersInit = { "content-type": "application/json" };
      if (userId) headers["x-user-id"] = userId;
      const res = await fetch(`/api/company/${companyId}/data-center/assignments/auto`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          agentUserId: selectedAgentId,
          totalCustomers: totalToAssign,
          percentages,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(String(payload?.error ?? "Failed to auto assign customers"));
      }
      const json = await res.json();
      setAssignResult((json?.data as AutoAssignResult) ?? null);
      setRefreshKey((v) => v + 1);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to auto assign customers";
      setAssignError(message);
    } finally {
      setAssigning(false);
    }
  }

  async function exportReport(format: "excel" | "pdf") {
    if (!companyId) return;
    setExporting(format);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set("from", from);
      qs.set("to", to);
      if (segment !== "all") qs.set("segment", segment);
      qs.set("format", format);

      const headers: HeadersInit = {};
      if (userId) headers["x-user-id"] = userId;
      const res = await fetch(`/api/company/${companyId}/data-center/reports/export?${qs.toString()}`, {
        method: "GET",
        cache: "no-store",
        headers,
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(String(payload?.error ?? `Failed to export ${format.toUpperCase()}`));
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get("content-disposition") ?? "";
      const fileNameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
      const fallbackName = `data-center-agents-${from}-to-${to}.${format === "excel" ? "xls" : "pdf"}`;
      const fileName = fileNameMatch?.[1] ?? fallbackName;

      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : `Failed to export ${format.toUpperCase()}`;
      setError(message);
    } finally {
      setExporting(null);
    }
  }

  if (!companyId) {
    return (
      <AppLayout>
        <div className="p-4 text-sm text-destructive">Company ID is required.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1600px] space-y-5 py-4 px-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl">Customer Data Center</h1>
            <p className="text-sm text-muted-foreground">KPIs</p>
          </div>
        </div>

        <div className={`rounded-2xl border p-4 ${theme.card} ${theme.cardBorder}`}>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-md border border-slate-700/60 bg-slate-900/70 px-3 py-2 text-xs text-slate-100"
            />
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-md border border-slate-700/60 bg-slate-900/70 px-3 py-2 text-xs text-slate-100"
            />
            <select
              value={segment}
              onChange={(e) => setSegment(e.target.value as SegmentFilter)}
              className="rounded-md border border-slate-700/60 bg-slate-900/70 px-3 py-2 text-xs text-slate-100"
            >
              {SEGMENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => setRefreshKey((v) => v + 1)} className="rounded-md bg-primary px-3 py-2 text-xs text-primary-foreground">
              Refresh
            </button>
          </div>
        </div>

        {error ? <div className="text-sm text-destructive">{error}</div> : null}
        {loading ? <div className="text-sm text-muted-foreground">Loading KPIs...</div> : null}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-violet-700/60 bg-violet-950/25 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-violet-300">Total Customer</div>
            <div className="mt-1 text-4xl font-semibold text-violet-300">{(kpis?.totalCustomers ?? 0).toLocaleString()}</div>
          </div>
          <div className="rounded-xl border border-slate-700/70 bg-slate-950/60 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">Assigned Customers</div>
            <div className="mt-1 text-4xl font-semibold text-white">{(kpis?.assignedCustomers ?? 0).toLocaleString()}</div>
          </div>
          <div className="rounded-xl border border-cyan-700/60 bg-cyan-950/30 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-cyan-300">Contacted Customers</div>
            <div className="mt-1 text-4xl font-semibold text-cyan-400">{(kpis?.contactedCustomers ?? 0).toLocaleString()}</div>
          </div>
          <div className="rounded-xl border border-emerald-700/60 bg-emerald-950/30 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-300">Answered Rate</div>
            <div className="mt-1 text-4xl font-semibold text-emerald-400">{((kpis?.answeredRate ?? 0) * 100).toFixed(1)}%</div>
          </div>
          <div className="rounded-xl border border-slate-700/70 bg-slate-950/60 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">Total Calls</div>
            <div className="mt-1 text-4xl font-semibold text-white">{(kpis?.totalCalls ?? 0).toLocaleString()}</div>
          </div>
          <div className="rounded-xl border border-emerald-700/60 bg-emerald-950/30 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-300">Answered Calls</div>
            <div className="mt-1 text-4xl font-semibold text-emerald-400">{(kpis?.answeredCalls ?? 0).toLocaleString()}</div>
          </div>
          <div className="rounded-xl border border-rose-700/60 bg-rose-950/25 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-rose-300">Failed Calls</div>
            <div className="mt-1 text-4xl font-semibold text-rose-400">{(kpis?.failedCalls ?? 0).toLocaleString()}</div>
          </div>
          <div className="rounded-xl border border-indigo-700/60 bg-indigo-950/25 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-indigo-300">Avg Call Duration</div>
            <div className="mt-1 text-4xl font-semibold text-indigo-300">{formatDuration(kpis?.avgCallDurationSeconds)}</div>
          </div>
        </div>

        <div className={`rounded-2xl border p-4 ${theme.card} ${theme.cardBorder}`}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Auto Assign Customers</h2>
            <button
              type="button"
              onClick={() => setPercentages({ chsc: 25, non_chsc: 25, insurance: 25, warranty: 25 })}
              className="rounded-md border border-slate-600/60 bg-slate-900/40 px-3 py-1.5 text-xs text-slate-200"
            >
              Set Equal (25%)
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-300">Agent</label>
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="w-full rounded-md border border-slate-700/60 bg-slate-900/70 px-3 py-2 text-xs text-slate-100"
              >
                {agents.length === 0 ? <option value="">No agents found</option> : null}
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-300">No. of Customers</label>
              <input
                type="number"
                min={1}
                value={totalToAssign}
                onChange={(e) => setTotalToAssign(Math.max(1, Number(e.target.value) || 0))}
                className="w-full rounded-md border border-slate-700/60 bg-slate-900/70 px-3 py-2 text-xs text-slate-100"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => void handleAutoAssign()}
                disabled={assigning || agents.length === 0}
                className="w-full rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60"
              >
                {assigning ? "Assigning..." : "Assign Customers"}
              </button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <div className="space-y-1">
              <label className="text-xs text-slate-300">CHSC %</label>
              <input
                type="number"
                min={0}
                value={percentages.chsc}
                onChange={(e) => setPercentages((v) => ({ ...v, chsc: Math.max(0, Number(e.target.value) || 0) }))}
                className="w-full rounded-md border border-slate-700/60 bg-slate-900/70 px-3 py-2 text-xs text-slate-100"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-300">Non CHSC %</label>
              <input
                type="number"
                min={0}
                value={percentages.non_chsc}
                onChange={(e) => setPercentages((v) => ({ ...v, non_chsc: Math.max(0, Number(e.target.value) || 0) }))}
                className="w-full rounded-md border border-slate-700/60 bg-slate-900/70 px-3 py-2 text-xs text-slate-100"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-300">Insurance %</label>
              <input
                type="number"
                min={0}
                value={percentages.insurance}
                onChange={(e) => setPercentages((v) => ({ ...v, insurance: Math.max(0, Number(e.target.value) || 0) }))}
                className="w-full rounded-md border border-slate-700/60 bg-slate-900/70 px-3 py-2 text-xs text-slate-100"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-300">Warranty %</label>
              <input
                type="number"
                min={0}
                value={percentages.warranty}
                onChange={(e) => setPercentages((v) => ({ ...v, warranty: Math.max(0, Number(e.target.value) || 0) }))}
                className="w-full rounded-md border border-slate-700/60 bg-slate-900/70 px-3 py-2 text-xs text-slate-100"
              />
            </div>
          </div>

          <div className="mt-2 text-xs text-muted-foreground">
            Distribution total:{" "}
            <span className={percentageTotal === 100 ? "text-emerald-300" : "text-amber-300"}>
              {percentageTotal}%
            </span>
            {" "}({percentageTotal === 100 ? "balanced" : "normalized automatically on submit"})
          </div>

          {assignError ? <div className="mt-2 text-sm text-destructive">{assignError}</div> : null}
          {assignResult ? (
            <div className="mt-3 rounded-lg border border-emerald-700/50 bg-emerald-950/25 p-3 text-xs text-emerald-200">
              Assigned {assignResult.assigned} of {assignResult.requested} requested.
              {" "}CHSC {assignResult.assignedBySegment.chsc}, Non CHSC {assignResult.assignedBySegment.non_chsc},
              {" "}Insurance {assignResult.assignedBySegment.insurance}, Warranty {assignResult.assignedBySegment.warranty}.
            </div>
          ) : null}
        </div>

        <div className={`rounded-2xl border p-4 ${theme.card} ${theme.cardBorder}`}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">All Agents</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void exportReport("excel")}
                disabled={exporting !== null}
                className="rounded-md border border-cyan-700/60 bg-cyan-950/30 px-3 py-1.5 text-xs font-medium text-cyan-200 disabled:opacity-60"
              >
                {exporting === "excel" ? "Exporting..." : "Export Excel"}
              </button>
              <button
                type="button"
                onClick={() => void exportReport("pdf")}
                disabled={exporting !== null}
                className="rounded-md border border-rose-700/60 bg-rose-950/30 px-3 py-1.5 text-xs font-medium text-rose-200 disabled:opacity-60"
              >
                {exporting === "pdf" ? "Exporting..." : "Export PDF"}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-700/60 bg-slate-950/30">
            <table className="min-w-[1200px] w-full text-sm">
              <thead className="bg-slate-950">
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-300">
                  <th className="px-3 py-2">Agent Name</th>
                  <th className="px-3 py-2">Total Assigned</th>
                  <th className="px-3 py-2">Total Leads</th>
                  <th className="px-3 py-2">Total Collection</th>
                  <th className="px-3 py-2">Total Calls</th>
                  <th className="px-3 py-2">Total Answered</th>
                  <th className="px-3 py-2">Total Failed</th>
                  <th className="px-3 py-2">Answer Rate</th>
                  <th className="px-3 py-2">Calls Duration</th>
                  <th className="px-3 py-2">Performance</th>
                </tr>
              </thead>
              <tbody>
                {agentRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-6 text-center text-xs text-muted-foreground">No agent data for selected period.</td>
                  </tr>
                ) : null}
                {agentRows.map((row, idx) => (
                  <tr key={row.name + idx} className={idx % 2 ? "bg-slate-900/20" : "bg-transparent"}>
                    <td className="px-3 py-2 border-t border-slate-700/40 text-slate-100">{row.name}</td>
                    <td className="px-3 py-2 border-t border-slate-700/40 text-slate-200">{row.totalAssigned.toLocaleString()}</td>
                    <td className="px-3 py-2 border-t border-slate-700/40 text-violet-300">{row.totalLeads.toLocaleString()}</td>
                    <td className="px-3 py-2 border-t border-slate-700/40 text-emerald-300">{row.totalCollection.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2 border-t border-slate-700/40 text-slate-200">{row.totalCalls.toLocaleString()}</td>
                    <td className="px-3 py-2 border-t border-slate-700/40 text-emerald-300">{row.totalAnswered.toLocaleString()}</td>
                    <td className="px-3 py-2 border-t border-slate-700/40 text-rose-300">{row.totalFailed.toLocaleString()}</td>
                    <td className="px-3 py-2 border-t border-slate-700/40 text-cyan-300">{(row.answerRate * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2 border-t border-slate-700/40 text-indigo-300">{formatDuration(row.callsDurationSeconds)}</td>
                    <td className="px-3 py-2 border-t border-slate-700/40">
                      <span
                        className={`font-semibold ${
                          row.performanceLabel === "Excellent"
                            ? "text-emerald-300"
                            : row.performanceLabel === "Good"
                              ? "text-cyan-300"
                              : row.performanceLabel === "Average"
                                ? "text-amber-300"
                                : "text-rose-300"
                        }`}
                      >
                        {row.performanceScore}%
                      </span>
                      <span
                        className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          row.performanceLabel === "Excellent"
                            ? "border border-emerald-700/60 bg-emerald-950/40 text-emerald-300"
                            : row.performanceLabel === "Good"
                              ? "border border-cyan-700/60 bg-cyan-950/40 text-cyan-300"
                              : row.performanceLabel === "Average"
                                ? "border border-amber-700/60 bg-amber-950/40 text-amber-300"
                                : "border border-rose-700/60 bg-rose-950/40 text-rose-300"
                        }`}
                      >
                        {row.performanceLabel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
