"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppLayout, useI18n, useTheme } from "@repo/ui";

type Params = { params: { companyId: string } | Promise<{ companyId: string }> };

type CallHistoryRow = {
  id: string;
  providerKey?: string;
  providerCallId?: string | null;
  direction: "inbound" | "outbound";
  from: string;
  to: string;
  status: string;
  startedAt: string | Date | null;
  durationSeconds: number | null;
  createdByUserId: string;
  agent: { name: string | null; email: string | null } | null;
  customer: { name: string | null; phone: string | null } | null;
  recording: { url: string; durationSeconds: number | null } | null;
  metadata?: Record<string, unknown>;
};

type InquiryRow = {
  id: string;
  provider_key: string;
  provider_call_id: string;
  from_number: string | null;
  to_number: string | null;
  inquiry_status: string;
  inquiry_summary: string | null;
  conversion_status: string;
  converted_to_lead_id: string | null;
  converted_lead_type: "rsa" | "recovery" | "workshop" | null;
  lead_outcome: string | null;
  outcome_reason: string | null;
  verified_mobile: boolean;
  verified_location: boolean;
  verification_notes: string | null;
  customer_exists: boolean;
  matched_customer_id: string | null;
  matched_customer_name: string | null;
  matched_customer_phone: string | null;
  recording_url: string | null;
  recording_duration_seconds: number | null;
  analysis_analyzed_at: string | null;
  analysis_auto_convert_eligible: boolean;
  analysis_confidence: number | null;
  analysis_lead_type: string | null;
  analysis_request_type: string | null;
  analysis_plate_number: string | null;
  analysis_location: string | null;
  analysis_caller_name: string | null;
  analysis_mobile_number: string | null;
  analysis_summary: string | null;
  analysis_transcript: string | null;
  analysis_error: string | null;
  analysis_attempted_at: string | null;
  created_at: string;
  updated_at: string;
};

const historyDirectionTabs: Array<{ key: "all" | "inbound" | "outbound"; label: string }> = [
  { key: "all", label: "call.history.tab.all" },
  { key: "inbound", label: "call.history.tab.inbound" },
  { key: "outbound", label: "call.history.tab.outbound" },
];

function isUsableRecordingUrl(url: string | null | undefined): boolean {
  const normalized = String(url ?? "").trim().toLowerCase();
  return normalized.length > 0 && normalized !== "unknown" && normalized !== "null" && normalized !== "undefined";
}

function formatDuration(totalSeconds: number | null | undefined) {
  if (!totalSeconds) return "—";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatConfidence(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `${(Math.max(0, Math.min(1, Number(value))) * 100).toFixed(0)}%`;
}

function statusColor(status: string) {
  const s = status.toLowerCase();
  if (s === "completed") return "text-emerald-400";
  if (s === "in_progress" || s === "in-progress") return "text-blue-400";
  if (s === "ringing") return "text-yellow-400";
  if (s === "failed" || s === "cancelled" || s === "canceled") return "text-red-400";
  return "text-muted-foreground";
}

export default function CallHistoryPage({ params }: Params) {
  const [companyId, setCompanyId] = useState<string>("");
  useEffect(() => {
    Promise.resolve(params).then((p: any) => setCompanyId(String(p?.companyId ?? "").trim()));
  }, [params]);
  return <AppLayout>{companyId ? <CallCenterTabs companyId={companyId} /> : null}</AppLayout>;
}

function CallCenterTabs({ companyId }: { companyId: string }) {
  const { theme } = useTheme();
  const panelClass = `${theme.card} ${theme.cardBorder} rounded-2xl border p-4`;
  const [view, setView] = useState<"history" | "inquiries">("history");

  return (
    <div className="min-h-screen space-y-4 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Call Center</h1>
        <p className="text-sm text-muted-foreground">Call history and AI lead inquiries.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setView("history")}
          className={`rounded-full border px-3 py-1 text-sm ${view === "history" ? "bg-primary text-primary-foreground border-primary" : `${theme.surfaceSubtle} ${theme.cardBorder}`}`}>
          Call History
        </button>
        <button type="button" onClick={() => setView("inquiries")}
          className={`rounded-full border px-3 py-1 text-sm ${view === "inquiries" ? "bg-primary text-primary-foreground border-primary" : `${theme.surfaceSubtle} ${theme.cardBorder}`}`}>
          AI Inquiries
        </button>
      </div>
      <div className={panelClass}>
        {view === "history" ? <CallHistoryPanel companyId={companyId} /> : <LeadInquiriesPanel companyId={companyId} />}
      </div>
    </div>
  );
}

// ─── Notes cell ──────────────────────────────────────────────────────────────

function NotesCell({ companyId, row }: { companyId: string; row: CallHistoryRow }) {
  const { theme } = useTheme();
  const initial = String(row.metadata?.notes ?? "");
  const [text, setText] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dirty = text !== initial;

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/company/${companyId}/call-center/history/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callSessionId: row.id, notes: text }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to save");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setErr(e?.message ?? "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-w-[180px] flex-col gap-1">
      <textarea
        rows={2}
        value={text}
        onChange={(e) => { setText(e.target.value); setSaved(false); }}
        placeholder="Add note…"
        className={`w-full resize-none rounded border px-2 py-1 text-xs ${theme.surfaceSubtle} ${theme.cardBorder} focus:outline-none focus:ring-1 focus:ring-primary`}
      />
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !dirty}
          className={`rounded border px-2 py-0.5 text-xs font-medium transition disabled:opacity-40 ${
            saved ? "border-emerald-500 text-emerald-400" : "bg-primary text-primary-foreground border-primary"
          }`}
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
        </button>
        {dirty && !saving && (
          <button type="button" onClick={() => { setText(initial); setSaved(false); }}
            className="text-xs text-muted-foreground hover:text-foreground">
            Cancel
          </button>
        )}
      </div>
      {err && <p className="text-xs text-red-400">{err}</p>}
    </div>
  );
}

// ─── KPI bar ─────────────────────────────────────────────────────────────────

function KpiBar({ rows }: { rows: CallHistoryRow[] }) {
  const { theme } = useTheme();
  const kpis = useMemo(() => {
    const total = rows.length;
    const inbound = rows.filter((r) => r.direction === "inbound").length;
    const outbound = rows.filter((r) => r.direction === "outbound").length;
    const completed = rows.filter((r) => r.status.toLowerCase() === "completed").length;
    const missed = rows.filter((r) => ["cancelled", "canceled", "failed", "no_answer"].includes(r.status.toLowerCase())).length;
    const durRows = rows.filter((r) => r.durationSeconds && r.durationSeconds > 0);
    const avgDur = durRows.length ? Math.round(durRows.reduce((s, r) => s + (r.durationSeconds ?? 0), 0) / durRows.length) : null;
    const answeredRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, inbound, outbound, completed, missed, avgDur, answeredRate };
  }, [rows]);

  const tiles = [
    { label: "Total Calls", value: kpis.total, color: "text-foreground" },
    { label: "Inbound", value: kpis.inbound, color: "text-blue-400" },
    { label: "Outbound", value: kpis.outbound, color: "text-purple-400" },
    { label: "Completed", value: kpis.completed, color: "text-emerald-400" },
    { label: "Missed / Failed", value: kpis.missed, color: "text-red-400" },
    { label: "Avg Duration", value: kpis.avgDur !== null ? formatDuration(kpis.avgDur) : "—", color: "text-amber-400" },
    { label: "Answer Rate", value: `${kpis.answeredRate}%`, color: kpis.answeredRate >= 80 ? "text-emerald-400" : kpis.answeredRate >= 50 ? "text-amber-400" : "text-red-400" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {tiles.map((t) => (
        <div key={t.label} className={`rounded-xl border p-3 ${theme.card} ${theme.cardBorder}`}>
          <p className="text-xs text-muted-foreground">{t.label}</p>
          <p className={`mt-1 text-xl font-semibold ${t.color}`}>{t.value}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Call History Panel ───────────────────────────────────────────────────────

function CallHistoryPanel({ companyId }: { companyId: string }) {
  const { t } = useI18n();
  const { theme } = useTheme();
  const { cardBg, cardBorder } = theme;
  const [direction, setDirection] = useState<"all" | "inbound" | "outbound">("all");
  const [rows, setRows] = useState<CallHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resolvingById, setResolvingById] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (opts?: { background?: boolean }) => {
    const background = Boolean(opts?.background);
    if (background) setRefreshing(true);
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (direction !== "all") qs.set("direction", direction);
      const res = await fetch(`/api/company/${companyId}/call-center/history?${qs.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(t("call.history.error"));
      const data = await res.json();
      const list: CallHistoryRow[] = (data?.data ?? []).map((item: any) => ({ ...item, startedAt: item.startedAt ?? null }));
      setRows(list);
    } catch (err: any) {
      setError(err?.message ?? t("call.history.error"));
    } finally {
      setLoading(false);
      if (background) setRefreshing(false);
    }
  }, [companyId, direction, t]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  async function resolveRecordingNow(row: CallHistoryRow) {
    const providerCallId = String(row.providerCallId ?? "").trim();
    if (!providerCallId) return;
    setResolvingById((prev) => ({ ...prev, [row.id]: true }));
    try {
      const res = await fetch(`/api/company/${companyId}/call-center/history/resolve-recording`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerCallId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) throw new Error(json?.error ?? "Recording not found yet");
      await fetchData({ background: true });
    } catch (err: any) {
      setError(err?.message ?? "Failed to resolve recording");
    } finally {
      setResolvingById((prev) => ({ ...prev, [row.id]: false }));
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{t("call.history.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("call.history.subtitle")}</p>
        </div>
        <button onClick={() => void fetchData({ background: true })} disabled={loading || refreshing}
          className={`rounded-full border px-3 py-1 text-sm font-medium transition disabled:opacity-60 ${cardBorder} ${cardBg}`}>
          {refreshing ? "Refreshing…" : "Refresh Log"}
        </button>
      </div>

      {/* KPIs */}
      {!loading && rows.length > 0 && <KpiBar rows={rows} />}

      {/* Direction filter */}
      <div className="flex flex-wrap gap-2">
        {historyDirectionTabs.map((tab) => {
          const isActive = direction === tab.key;
          return (
            <button key={tab.key} onClick={() => setDirection(tab.key)}
              className={`rounded-full border px-3 py-1 text-sm font-medium transition ${isActive ? "bg-primary text-primary-foreground border-primary" : `${cardBorder} ${cardBg}`}`}>
              {t(tab.label)}
            </button>
          );
        })}
        {!loading && <span className="ml-2 self-center text-xs text-muted-foreground">{rows.length} record{rows.length !== 1 ? "s" : ""}</span>}
      </div>

      {/* Body */}
      {loading ? (
        <p className="text-sm text-muted-foreground">{t("call.history.loading")}</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("call.history.empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-muted-foreground" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Direction</th>
                <th className="px-4 py-3 text-left">From</th>
                <th className="px-4 py-3 text-left">To</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Started</th>
                <th className="px-4 py-3 text-left">Agent</th>
                <th className="px-4 py-3 text-left">Notes</th>
                <th className="px-4 py-3 text-left">Recording</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const started = row.startedAt ? new Date(row.startedAt) : null;
                const isOutbound = row.direction === "outbound";
                const agentLabel = row.agent?.name ?? row.agent?.email ?? "—";
                const externalPhone = isOutbound ? row.to : row.from;
                const hasPhone = Boolean(externalPhone) && externalPhone!.toLowerCase() !== "unknown";
                const customerLabel = row.customer?.name ?? row.customer?.phone ?? (hasPhone ? null : "—");
                const recordingProxyUrl = isUsableRecordingUrl(row.recording?.url)
                  ? `/api/company/${companyId}/call-center/history/recording-proxy?recordingUrl=${encodeURIComponent(String(row.recording?.url ?? ""))}`
                  : "";

                return (
                  <tr key={row.id} className={`align-top transition-colors hover:bg-white/[0.03] ${idx !== rows.length - 1 ? "border-b" : ""}`}
                    style={{ borderColor: "rgba(255,255,255,0.06)" }}>

                    {/* Customer */}
                    <td className="px-4 py-3">
                      {customerLabel === null ? (
                        <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">
                          New Customer
                        </span>
                      ) : (
                        <div className="font-medium">{customerLabel}</div>
                      )}
                      {row.customer?.phone && <div className="text-xs text-muted-foreground">{row.customer.phone}</div>}
                    </td>

                    {/* Direction */}
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${
                        isOutbound
                          ? "border-purple-500/40 text-purple-400 bg-purple-500/10"
                          : "border-blue-500/40 text-blue-400 bg-blue-500/10"
                      }`}>
                        {row.direction}
                      </span>
                    </td>

                    {/* From */}
                    <td className="px-4 py-3 font-mono text-xs">{row.from}</td>

                    {/* To */}
                    <td className="px-4 py-3 font-mono text-xs">{row.to}</td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium capitalize ${statusColor(row.status)}`}>
                        {row.status.replace(/_/g, " ")}
                      </span>
                    </td>

                    {/* Started */}
                    <td className="px-4 py-3 whitespace-nowrap text-xs">
                      {started ? (
                        <>
                          <div>{started.toLocaleDateString()}</div>
                          <div className="text-muted-foreground">{started.toLocaleTimeString()}</div>
                        </>
                      ) : "—"}
                      {row.durationSeconds ? (
                        <div className="mt-0.5 text-muted-foreground">{formatDuration(row.durationSeconds)}</div>
                      ) : null}
                    </td>

                    {/* Agent */}
                    <td className="px-4 py-3">
                      <div className="text-xs font-medium">{agentLabel}</div>
                      {row.agent?.email && row.agent.email !== agentLabel && (
                        <div className="text-xs text-muted-foreground">{row.agent.email}</div>
                      )}
                    </td>

                    {/* Notes */}
                    <td className="px-4 py-3">
                      <NotesCell companyId={companyId} row={row} />
                    </td>

                    {/* Recording */}
                    <td className="px-4 py-3">
                      {isUsableRecordingUrl(row.recording?.url) ? (
                        <div className="flex min-w-[200px] flex-col gap-1.5">
                          <audio controls preload="none" src={recordingProxyUrl} className="h-8 w-full" />
                          <Link href={recordingProxyUrl} className="text-xs text-primary hover:underline" target="_blank">
                            {t("call.history.table.recording.link")}
                          </Link>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">—</span>
                          <button type="button" onClick={() => void resolveRecordingNow(row)}
                            disabled={Boolean(resolvingById[row.id]) || !String(row.providerCallId ?? "").trim()}
                            className={`rounded-full border px-2 py-0.5 text-xs transition disabled:opacity-60 ${cardBorder} ${cardBg}`}>
                            {resolvingById[row.id] ? "Resolving…" : "Resolve Recording"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Lead Inquiries Panel (unchanged) ────────────────────────────────────────

function LeadInquiriesPanel({ companyId }: { companyId: string }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [items, setItems] = useState<InquiryRow[]>([]);
  const [filter, setFilter] = useState<"all" | "not_converted" | "converted">("not_converted");
  const [actionById, setActionById] = useState<Record<string, string>>({});
  const [leadTypeById, setLeadTypeById] = useState<Record<string, "rsa" | "recovery" | "workshop">>({});
  const { theme } = useTheme();

  function setRowBusy(id: string, value: string | null) {
    setActionById((prev) => { const next = { ...prev }; if (value) next[id] = value; else delete next[id]; return next; });
  }

  async function runInquiryAction(inquiryId: string, payload: Record<string, unknown>, fallbackError: string) {
    setError(null);
    const res = await fetch(`/api/company/${companyId}/ai/inquiries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inquiryId, ...payload }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.ok === false) throw new Error(String(json?.error ?? fallbackError));
    await loadInquiries(true);
  }

  async function loadInquiries(background = false) {
    if (background) setRefreshing(true);
    setLoading(true); setError(null); setWarning(null);
    try {
      const res = await fetch(`/api/company/${companyId}/ai/inquiries?_=${Date.now()}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(json?.error ?? "Failed to load lead inquiries"));
      setItems(Array.isArray(json?.inquiries) ? json.inquiries : []);
      setWarning(json?.warning ? String(json.warning) : null);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load lead inquiries"); setItems([]);
    } finally {
      setLoading(false); if (background) setRefreshing(false);
    }
  }

  useEffect(() => { void loadInquiries(); }, [companyId]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((row) => String(row.conversion_status ?? "").toLowerCase() === filter);
  }, [filter, items]);

  const kpis = useMemo(() => {
    let converted = 0, pending = 0;
    for (const row of items) { if (row.conversion_status === "converted") converted++; else pending++; }
    return { total: items.length, converted, pending };
  }, [items]);

  async function verifyInquiry(row: InquiryRow) {
    setRowBusy(row.id, "verify");
    try { await runInquiryAction(row.id, { action: "verify", verifiedMobile: true, verifiedLocation: true, verificationNotes: "Verified manually by agent" }, "Failed to verify inquiry"); }
    catch (err: any) { setError(err?.message ?? "Failed to verify inquiry"); }
    finally { setRowBusy(row.id, null); }
  }

  async function convertToLead(row: InquiryRow) {
    setRowBusy(row.id, "convert");
    try { await runInquiryAction(row.id, { action: "convert_to_lead" }, "Failed to convert inquiry to lead"); }
    catch (err: any) { setError(err?.message ?? "Failed to convert inquiry to lead"); }
    finally { setRowBusy(row.id, null); }
  }

  async function setLeadType(row: InquiryRow) {
    const selected = leadTypeById[row.id] ?? row.converted_lead_type ?? "rsa";
    setRowBusy(row.id, "set_type");
    try { await runInquiryAction(row.id, { action: "set_lead_type", leadType: selected }, "Failed to update lead type"); }
    catch (err: any) { setError(err?.message ?? "Failed to update lead type"); }
    finally { setRowBusy(row.id, null); }
  }

  async function analyzeRecording(row: InquiryRow) {
    setRowBusy(row.id, "analyze");
    try { await runInquiryAction(row.id, { action: "analyze_recording" }, "Failed to analyze recording"); }
    catch (err: any) { setError(err?.message ?? "Failed to analyze recording"); }
    finally { setRowBusy(row.id, null); }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Lead Inquiries</h2>
        <p className="text-sm text-muted-foreground">Incoming call inquiries and lead conversion status.</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">{loading ? "Loading..." : `${filtered.length} record(s)`}</div>
        <div className="flex flex-wrap gap-2">
          {(["all", "not_converted", "converted"] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1 text-xs ${filter === f ? "bg-primary text-primary-foreground border-primary" : `${theme.surfaceSubtle} ${theme.cardBorder}`}`}>
              {f === "all" ? `All (${kpis.total})` : f === "not_converted" ? `Not Converted (${kpis.pending})` : `Converted (${kpis.converted})`}
            </button>
          ))}
          <button type="button" onClick={() => void loadInquiries(true)}
            className={`rounded-xl border px-3 py-1.5 text-sm ${theme.surfaceSubtle} ${theme.cardBorder}`}>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>
      {warning ? <div className="text-xs text-amber-300">{warning}</div> : null}
      {error ? <div className="text-xs text-red-300">{error}</div> : null}
      {!loading && !error && filtered.length === 0 ? <div className="text-sm text-muted-foreground">No lead inquiries yet.</div> : null}
      {filtered.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left">
                {["Created","Call ID","From","Customer","To","Inquiry","Summary","Verification","Conversion","Lead Type","Recording","AI Analysis","Outcome","Actions"].map((h) => (
                  <th key={h} className="py-2 pr-3 text-xs font-medium uppercase text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-white/5">
                  <td className="whitespace-nowrap py-2 pr-3 text-xs">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="py-2 pr-3 text-xs">{row.provider_call_id}</td>
                  <td className="py-2 pr-3 text-xs">{row.from_number ?? "-"}</td>
                  <td className="py-2 pr-3">
                    {row.customer_exists ? (
                      <div className="text-xs"><div>{row.matched_customer_name ?? "Existing"}</div><div className="text-muted-foreground">{row.matched_customer_phone ?? row.from_number ?? "-"}</div></div>
                    ) : <span className="text-xs text-amber-300">New customer</span>}
                  </td>
                  <td className="py-2 pr-3 text-xs">{row.to_number ?? "-"}</td>
                  <td className="py-2 pr-3 text-xs">{row.inquiry_status ?? "-"}</td>
                  <td className="py-2 pr-3 text-xs">{row.inquiry_summary ?? "-"}</td>
                  <td className="py-2 pr-3 text-xs">
                    <div>Mobile: {row.verified_mobile ? "yes" : "no"}</div>
                    <div>Location: {row.verified_location ? "yes" : "no"}</div>
                  </td>
                  <td className="py-2 pr-3 text-xs">{row.conversion_status}{row.converted_to_lead_id ? ` (${row.converted_to_lead_id})` : ""}</td>
                  <td className="py-2 pr-3">
                    {row.converted_to_lead_id ? (
                      <select value={leadTypeById[row.id] ?? row.converted_lead_type ?? "rsa"}
                        onChange={(e) => setLeadTypeById((prev) => ({ ...prev, [row.id]: e.target.value as any }))}
                        className={`rounded border px-2 py-1 text-xs ${theme.surfaceSubtle} ${theme.cardBorder}`}
                        disabled={Boolean(actionById[row.id])}>
                        <option value="rsa">RSA</option>
                        <option value="recovery">Recovery</option>
                        <option value="workshop">Service Center</option>
                      </select>
                    ) : "-"}
                  </td>
                  <td className="py-2 pr-3">
                    {isUsableRecordingUrl(row.recording_url) ? (
                      <div className="min-w-[200px] space-y-1">
                        <audio controls preload="none" src={`/api/company/${companyId}/call-center/history/recording-proxy?recordingUrl=${encodeURIComponent(String(row.recording_url ?? ""))}`} className="h-8 w-full" />
                        <div className="text-xs text-muted-foreground">Duration: {formatDuration(row.recording_duration_seconds)}</div>
                      </div>
                    ) : "-"}
                  </td>
                  <td className="py-2 pr-3">
                    {row.analysis_analyzed_at ? (
                      <div className="min-w-[240px] text-xs space-y-0.5">
                        <div>Analyzed: {new Date(row.analysis_analyzed_at).toLocaleString()}</div>
                        <div>Confidence: {formatConfidence(row.analysis_confidence)}</div>
                        <div>Lead type: {row.analysis_lead_type ?? "-"}</div>
                        <div>Plate: {row.analysis_plate_number ?? "-"}</div>
                        <div className="truncate">Summary: {row.analysis_summary ?? "-"}</div>
                      </div>
                    ) : row.analysis_error ? (
                      <div className="min-w-[200px] text-xs"><div className="text-amber-300">Last attempt failed</div><div className="break-words text-red-300">{row.analysis_error}</div></div>
                    ) : <span className="text-xs text-muted-foreground">Not analyzed</span>}
                  </td>
                  <td className="py-2 pr-3 text-xs">{row.lead_outcome ?? "-"}</td>
                  <td className="py-2 pr-3">
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" onClick={() => void verifyInquiry(row)} disabled={Boolean(actionById[row.id]) || (row.verified_mobile && row.verified_location)}
                        className={`rounded border px-2 py-1 text-xs disabled:opacity-50 ${theme.surfaceSubtle} ${theme.cardBorder}`}>
                        {actionById[row.id] === "verify" ? "Verifying..." : row.verified_mobile && row.verified_location ? "Verified" : "Verify"}
                      </button>
                      <button type="button" onClick={() => void analyzeRecording(row)} disabled={Boolean(actionById[row.id]) || !isUsableRecordingUrl(row.recording_url)}
                        className={`rounded border px-2 py-1 text-xs disabled:opacity-50 ${theme.surfaceSubtle} ${theme.cardBorder}`}>
                        {actionById[row.id] === "analyze" ? "Analyzing..." : "Analyze (AI)"}
                      </button>
                      <button type="button" onClick={() => void convertToLead(row)} disabled={Boolean(actionById[row.id]) || Boolean(row.converted_to_lead_id)}
                        className={`rounded border px-2 py-1 text-xs disabled:opacity-50 ${theme.surfaceSubtle} ${theme.cardBorder}`}>
                        {actionById[row.id] === "convert" ? "Converting..." : row.converted_to_lead_id ? "Converted" : "Convert to Lead"}
                      </button>
                      {row.converted_to_lead_id ? (
                        <button type="button" onClick={() => void setLeadType(row)} disabled={Boolean(actionById[row.id])}
                          className={`rounded border px-2 py-1 text-xs disabled:opacity-50 ${theme.surfaceSubtle} ${theme.cardBorder}`}>
                          {actionById[row.id] === "set_type" ? "Saving..." : "Set Type"}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
