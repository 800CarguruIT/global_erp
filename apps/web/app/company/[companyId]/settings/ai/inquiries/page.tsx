"use client";

import { AppLayout, useTheme } from "@repo/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Params = { params: { companyId: string } | Promise<{ companyId: string }> };

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
  converted_division: string | null;
  converted_lead_status: string | null;
  converted_lead_stage: string | null;
  lead_outcome: string | null;
  outcome_reason: string | null;
  agent_name: string | null;
  verified_mobile: boolean;
  verified_location: boolean;
  verification_notes: string | null;
  customer_exists: boolean;
  matched_customer_id: string | null;
  matched_customer_name: string | null;
  matched_customer_phone: string | null;
  matched_customer_location: string | null;
  recording_url: string | null;
  recording_duration_seconds: number | null;
  verification_location_text: string | null;
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
  analysis_conversation_turns: { speaker: "agent" | "customer"; text: string }[] | null;
  analysis_error: string | null;
  analysis_attempted_at: string | null;
  call_direction: "inbound" | "outbound" | null;
  created_at: string;
  updated_at: string;
};

type GroupedRow = {
  from_number: string | null;
  call_count: number;
  today_count: number;
  last_call_at: string;
  converted_count: number;
  pending_count: number;
  agent_names: string | null;
  customer_name: string | null;
  customer_id: string | null;
};

function toLocalDatetimeInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function todayDefaultFrom(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return toLocalDatetimeInput(d);
}

function todayDefaultTo(): string {
  const d = new Date();
  d.setHours(23, 59, 0, 0);
  return toLocalDatetimeInput(d);
}

const RSA_DIVISIONS = [
  { value: "tyre", label: "Tyre" },
  { value: "battery", label: "Battery" },
  { value: "jump_start", label: "Jump Start" },
  { value: "fuel_delivery", label: "Fuel Delivery" },
  { value: "ac_gas", label: "AC Gas" },
  { value: "inspection", label: "Inspection" },
  { value: "warranty_claimed", label: "Warranty Claimed" },
];

const RECOVERY_DIVISIONS = [
  { value: "insurance_recovery", label: "Insurance Recovery" },
  { value: "customer_to_customer", label: "Customer To Customer" },
  { value: "internal_workshop_to_workshop", label: "Internal (Workshop to Workshop)" },
];

function isUsableRecordingUrl(url: string | null | undefined): boolean {
  const normalized = String(url ?? "").trim().toLowerCase();
  return normalized.length > 0 && normalized !== "unknown" && normalized !== "null" && normalized !== "undefined";
}

function formatDuration(totalSeconds: number | null | undefined) {
  if (!totalSeconds || totalSeconds <= 0) return "-";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatConfidence(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `${(Math.max(0, Math.min(1, Number(value))) * 100).toFixed(0)}%`;
}

function isInquiryActionLocked(row: InquiryRow): boolean {
  if (!row.converted_to_lead_id) return false;
  const status = String(row.converted_lead_status ?? "").trim().toLowerCase();
  const stage = String(row.converted_lead_stage ?? "").trim().toLowerCase();
  if (["closed", "closed_won", "lost", "done", "completed"].includes(status)) return true;
  if (stage === "closed") return true;
  return false;
}

type KpiData = { total: number; today: number; converted: number; pending: number; appointment: number; walkin: number; lost: number };

export default function CompanyAiInquiriesPage({ params }: Params) {
  const { theme } = useTheme();
  const [companyId, setCompanyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [items, setItems] = useState<InquiryRow[]>([]);
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_LIMIT = 25;

  // Filters
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(todayDefaultFrom);
  const [dateTo, setDateTo] = useState(todayDefaultTo);
  const [filterToNumber, setFilterToNumber] = useState("");
  const [filterConversion, setFilterConversion] = useState("");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Grouped main view
  const [groupedItems, setGroupedItems] = useState<GroupedRow[]>([]);

  // Calls drill-down modal
  const [callsModalGroup, setCallsModalGroup] = useState<GroupedRow | null>(null);
  const [callsModalItems, setCallsModalItems] = useState<InquiryRow[]>([]);
  const [callsModalLoading, setCallsModalLoading] = useState(false);
  const callsModalGroupRef = useRef<GroupedRow | null>(null);

  const [actionById, setActionById] = useState<Record<string, string>>({});
  const [leadTypeById, setLeadTypeById] = useState<Record<string, "rsa" | "recovery" | "workshop">>({});
  const [divisionById, setDivisionById] = useState<Record<string, string>>({});
  const [verifyModalRow, setVerifyModalRow] = useState<InquiryRow | null>(null);
  const [verifyLocationInput, setVerifyLocationInput] = useState("");
  const [verifyMobileChecked, setVerifyMobileChecked] = useState(true);
  const [verifyLocationChecked, setVerifyLocationChecked] = useState(true);
  const [transcriptModalRow, setTranscriptModalRow] = useState<InquiryRow | null>(null);
  const [analysisModalRow, setAnalysisModalRow] = useState<InquiryRow | null>(null);

  // Auto-analyze control
  const [autoAnalyzeInterval, setAutoAnalyzeInterval] = useState<number>(0); // 0 = off
  const [autoAnalyzeRunning, setAutoAnalyzeRunning] = useState(false);
  const [autoAnalyzeLogs, setAutoAnalyzeLogs] = useState<{
    ts: string; processed: number; succeeded: number; skipped: number; failed: number;
    logs: { id: string; ok: boolean; skipped?: boolean; error?: string; ms: number }[];
  }[]>([]);
  const autoAnalyzeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runBatchAnalyzeRef = useRef<(cid: string) => Promise<void>>(async () => {});
  const autoAnalyzeRunningRef = useRef(false);

  useEffect(() => {
    Promise.resolve(params).then((p: any) => {
      setCompanyId(String(p?.companyId ?? "").trim());
    });
  }, [params]);

  const loadInquiries = useCallback(async (
    targetCompanyId: string,
    targetPage: number,
    filters: { search: string; dateFrom: string; dateTo: string; toNumber: string; conversion: string }
  ) => {
    setLoading(true);
    setError(null);
    setWarning(null);
    try {
      const qs = new URLSearchParams({ page: String(targetPage), limit: String(PAGE_LIMIT), grouped: "true", _: String(Date.now()) });
      if (filters.search)     qs.set("search",           filters.search);
      if (filters.dateFrom)   qs.set("dateFrom",         filters.dateFrom);
      if (filters.dateTo)     qs.set("dateTo",           filters.dateTo);
      if (filters.toNumber)   qs.set("toNumber",         filters.toNumber);
      if (filters.conversion) qs.set("conversionStatus", filters.conversion);

      const res = await fetch(`/api/company/${targetCompanyId}/ai/inquiries?${qs}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(json?.error ?? "Failed to load AI inquiries"));

      const newGrouped: GroupedRow[] = Array.isArray(json?.inquiries) ? json.inquiries : [];
      setGroupedItems(newGrouped);
      setKpis(json?.kpis ?? null);
      setTotalPages(typeof json?.totalPages === "number" ? Math.max(1, json.totalPages) : 1);
      setTotalCount(typeof json?.totalCount === "number" ? json.totalCount : 0);
      setWarning(json?.warning ? String(json.warning) : null);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load AI inquiries");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const currentFilters = useMemo(() => ({ search, dateFrom, dateTo, toNumber: filterToNumber, conversion: filterConversion }), [search, dateFrom, dateTo, filterToNumber, filterConversion]);

  useEffect(() => {
    if (!companyId) return;
    void loadInquiries(companyId, page, currentFilters);
  }, [companyId, page, currentFilters, loadInquiries]);

  const loadCallsForGroup = useCallback(async (
    fromNumber: string | null,
    _filters: Record<string, unknown>,
    cid: string,
  ) => {
    setCallsModalLoading(true);
    try {
      // Show ALL calls for this number — no date filter, no conversion filter
      const qs = new URLSearchParams({ limit: "200", _: String(Date.now()) });
      if (fromNumber) qs.set("fromNumber", fromNumber);
      const res = await fetch(`/api/company/${cid}/ai/inquiries?${qs}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      const newItems: InquiryRow[] = Array.isArray(json?.inquiries) ? json.inquiries : [];
      setCallsModalItems(newItems);
      setTranscriptModalRow((prev) => prev ? (newItems.find((r) => r.id === prev.id) ?? prev) : null);
      setAnalysisModalRow((prev) => prev ? (newItems.find((r) => r.id === prev.id) ?? prev) : null);
    } catch { /* ignore */ } finally {
      setCallsModalLoading(false);
    }
  }, []);

  const runBatchAnalyze = useCallback(async (cid: string) => {
    if (!cid || autoAnalyzeRunningRef.current) return;
    autoAnalyzeRunningRef.current = true;
    setAutoAnalyzeRunning(true);
    try {
      const res = await fetch(`/api/company/${cid}/ai/inquiries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "batch_analyze", limit: 10 }),
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      setAutoAnalyzeLogs(prev => [
        { ts: new Date().toLocaleTimeString(), processed: json.processed ?? 0, succeeded: json.succeeded ?? 0, skipped: json.skipped ?? 0, failed: json.failed ?? 0, logs: json.logs ?? [] },
        ...prev.slice(0, 19),
      ]);
      if ((json.processed ?? 0) > 0) {
        void loadInquiries(cid, page, currentFilters);
      }
    } catch (e: any) {
      setAutoAnalyzeLogs(prev => [
        { ts: new Date().toLocaleTimeString(), processed: 0, succeeded: 0, skipped: 0, failed: 1, logs: [{ id: "—", ok: false, error: e?.message ?? "Network error", ms: 0 }] },
        ...prev.slice(0, 19),
      ]);
    } finally {
      autoAnalyzeRunningRef.current = false;
      setAutoAnalyzeRunning(false);
    }
  }, [loadInquiries, page, currentFilters]);

  // Keep ref in sync so the interval callback always uses the latest version
  runBatchAnalyzeRef.current = runBatchAnalyze;

  // Start/stop auto-analyze interval — only depends on interval value and companyId,
  // uses the ref so the timer is never reset by unrelated re-renders
  useEffect(() => {
    if (autoAnalyzeIntervalRef.current) {
      clearInterval(autoAnalyzeIntervalRef.current);
      autoAnalyzeIntervalRef.current = null;
    }
    if (autoAnalyzeInterval > 0 && companyId) {
      const cid = companyId;
      autoAnalyzeIntervalRef.current = setInterval(() => {
        void runBatchAnalyzeRef.current(cid);
      }, autoAnalyzeInterval * 1000);
    }
    return () => {
      if (autoAnalyzeIntervalRef.current) clearInterval(autoAnalyzeIntervalRef.current);
    };
  }, [autoAnalyzeInterval, companyId]);

  function setRowBusy(id: string, value: string | null) {
    setActionById((prev) => {
      const next = { ...prev };
      if (value) next[id] = value;
      else delete next[id];
      return next;
    });
  }

  async function runInquiryAction(
    inquiryId: string,
    payload: Record<string, unknown>,
    fallbackError: string
  ) {
    const res = await fetch(`/api/company/${companyId}/ai/inquiries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inquiryId, ...payload }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.ok === false) {
      throw new Error(String(json?.error ?? fallbackError));
    }
    await loadInquiries(companyId, page, currentFilters);
    const openGroup = callsModalGroupRef.current;
    if (openGroup) {
      await loadCallsForGroup(openGroup.from_number, {}, companyId);
    }
  }

  function openVerifyModal(row: InquiryRow) {
    const prefillLocation =
      String(row.verification_location_text ?? "").trim() ||
      String(row.analysis_location ?? "").trim() ||
      String(row.matched_customer_location ?? "").trim() ||
      "";
    setVerifyModalRow(row);
    setVerifyLocationInput(prefillLocation);
    setVerifyMobileChecked(true);
    setVerifyLocationChecked(prefillLocation.length >= 3);
  }

  function closeVerifyModal() {
    setVerifyModalRow(null);
    setVerifyLocationInput("");
    setVerifyMobileChecked(true);
    setVerifyLocationChecked(true);
  }

  function openTranscriptModal(row: InquiryRow) {
    setTranscriptModalRow(row);
  }

  function closeTranscriptModal() {
    setTranscriptModalRow(null);
  }

  function openAnalysisModal(row: InquiryRow) {
    setAnalysisModalRow(row);
  }

  function closeAnalysisModal() {
    setAnalysisModalRow(null);
  }

  function openCallsModal(group: GroupedRow) {
    callsModalGroupRef.current = group;
    setCallsModalGroup(group);
    setCallsModalItems([]);
    void loadCallsForGroup(group.from_number, {}, companyId);
  }

  function closeCallsModal() {
    callsModalGroupRef.current = null;
    setCallsModalGroup(null);
    setCallsModalItems([]);
  }

  async function verifyInquiry(row: InquiryRow, locationText: string, verifiedMobile: boolean, verifiedLocation: boolean) {
    setRowBusy(row.id, "verify");
    setError(null);
    try {
      const normalizedLocation = String(locationText ?? "").trim();
      const locationVerified = verifiedLocation && normalizedLocation.length >= 3;
      await runInquiryAction(
        row.id,
        {
          action: "verify",
          verifiedMobile,
          verifiedLocation: locationVerified,
          verificationLocation: normalizedLocation,
          verificationNotes: normalizedLocation
            ? `Verified manually by agent. Location: ${normalizedLocation}`
            : "Verified manually by agent",
        },
        "Failed to verify inquiry"
      );
      closeVerifyModal();
    } catch (err: any) {
      setError(err?.message ?? "Failed to verify inquiry");
    } finally {
      setRowBusy(row.id, null);
    }
  }

  async function convertToLead(row: InquiryRow) {
    setRowBusy(row.id, "convert");
    setError(null);
    try {
      await runInquiryAction(
        row.id,
        { action: "convert_to_lead" },
        "Failed to convert inquiry to lead"
      );
    } catch (err: any) {
      setError(err?.message ?? "Failed to convert inquiry to lead");
    } finally {
      setRowBusy(row.id, null);
    }
  }

  async function setLeadType(row: InquiryRow) {
    const selected = leadTypeById[row.id] ?? row.converted_lead_type ?? "rsa";
    const selectedDivision = divisionById[row.id] ?? row.converted_division ?? "";
    setRowBusy(row.id, "set_type");
    setError(null);
    try {
      await runInquiryAction(
        row.id,
        { action: "set_lead_type", leadType: selected, division: selectedDivision || null },
        "Failed to set lead type"
      );
    } catch (err: any) {
      setError(err?.message ?? "Failed to set lead type");
    } finally {
      setRowBusy(row.id, null);
    }
  }

  async function analyzeRecording(row: InquiryRow) {
    setRowBusy(row.id, "analyze");
    setError(null);
    try {
      await runInquiryAction(
        row.id,
        { action: "analyze_recording" },
        "Failed to analyze recording"
      );
    } catch (err: any) {
      setError(err?.message ?? "Failed to analyze recording");
    } finally {
      setRowBusy(row.id, null);
    }
  }

  const containerClass = useMemo(
    () => `min-h-screen ${theme.appBg} ${theme.appText} p-6 space-y-4 transition-colors`,
    [theme.appBg, theme.appText]
  );
  const panelClass = `${theme.cardBg} ${theme.cardBorder} rounded-2xl border p-4`;

  const kpiCards = useMemo(() => {
    if (!kpis) return [];
    const rate = kpis.total > 0 ? ((kpis.converted / kpis.total) * 100).toFixed(1) : "0.0";
    return [
      { label: "Total",       value: kpis.total,       border: "border-sky-500/50",    bg: "bg-sky-500/10",    num: "text-sky-200"    },
      { label: "Today",       value: kpis.today,       border: "border-indigo-500/50", bg: "bg-indigo-500/10", num: "text-indigo-200" },
      { label: "Converted",   value: kpis.converted,   border: "border-emerald-500/50",bg: "bg-emerald-500/10",num: "text-emerald-300"},
      { label: "Conv. Rate",  value: `${rate}%`,       border: "border-teal-500/50",   bg: "bg-teal-500/10",   num: "text-teal-300"  },
      { label: "Pending",     value: kpis.pending,     border: "border-amber-500/50",  bg: "bg-amber-500/10",  num: "text-amber-300" },
      { label: "Appointment", value: kpis.appointment, border: "border-violet-500/50", bg: "bg-violet-500/10", num: "text-violet-300"},
      { label: "Walk-in",     value: kpis.walkin,      border: "border-cyan-500/50",   bg: "bg-cyan-500/10",   num: "text-cyan-300"  },
      { label: "Lost",        value: kpis.lost,        border: "border-rose-500/50",   bg: "bg-rose-500/10",   num: "text-rose-300"  },
    ];
  }, [kpis]);

  return (
    <AppLayout>
      <div className={containerClass}>
        {/* Page title */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">AI Inquiries</h1>
            <p className="text-sm text-muted-foreground">Inquiry records created by AI workflow automation.</p>
          </div>
          <button type="button"
            onClick={() => companyId ? void loadInquiries(companyId, page, currentFilters) : undefined}
            className={`rounded-xl px-3 py-1.5 text-sm border ${theme.surfaceSubtle} ${theme.cardBorder}`}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {/* KPI cards — own row */}
        {kpiCards.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
            {kpiCards.map((kpi) => (
              <div key={kpi.label} className={`rounded-2xl border ${kpi.border} ${kpi.bg} px-4 py-3`}>
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">{kpi.label}</div>
                <div className={`text-3xl font-bold leading-none ${kpi.num}`}>{kpi.value}</div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Filter card */}
        <div className={`${panelClass}`}>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filters</div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1 min-w-[180px]">
              <label className="text-[10px] text-muted-foreground">Search</label>
              <input
                type="text"
                placeholder="Number, call ID..."
                value={searchInput}
                onChange={(e) => {
                  const v = e.target.value;
                  setSearchInput(v);
                  if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                  searchDebounceRef.current = setTimeout(() => { setSearch(v); setPage(1); }, 400);
                }}
                className={`rounded-lg border px-3 py-1.5 text-xs ${theme.surfaceSubtle} ${theme.cardBorder} outline-none`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground">From</label>
              <input type="datetime-local" value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className={`rounded-lg border px-3 py-1.5 text-xs ${theme.surfaceSubtle} ${theme.cardBorder} outline-none`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground">To</label>
              <input type="datetime-local" value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className={`rounded-lg border px-3 py-1.5 text-xs ${theme.surfaceSubtle} ${theme.cardBorder} outline-none`}
              />
            </div>
            <div className="flex flex-col gap-1 min-w-[120px]">
              <label className="text-[10px] text-muted-foreground">Agent ext.</label>
              <input type="text" placeholder="e.g. 6301"
                value={filterToNumber}
                onChange={(e) => { setFilterToNumber(e.target.value.trim()); setPage(1); }}
                className={`rounded-lg border px-3 py-1.5 text-xs ${theme.surfaceSubtle} ${theme.cardBorder} outline-none`}
              />
            </div>
            <div className="flex flex-col gap-1 min-w-[140px]">
              <label className="text-[10px] text-muted-foreground">Conversion</label>
              <select value={filterConversion}
                onChange={(e) => { setFilterConversion(e.target.value); setPage(1); }}
                className={`rounded-lg border px-3 py-1.5 text-xs ${theme.surfaceSubtle} ${theme.cardBorder} outline-none`}
              >
                <option value="">All statuses</option>
                <option value="converted">Converted</option>
                <option value="not_converted">Not converted</option>
              </select>
            </div>
            <button type="button"
              onClick={() => { setSearchInput(""); setSearch(""); setDateFrom(todayDefaultFrom()); setDateTo(todayDefaultTo()); setFilterToNumber(""); setFilterConversion(""); setPage(1); }}
              className="self-end rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white/60 hover:text-white"
            >
              Reset to today
            </button>
          </div>
        </div>

        {/* Auto-Analyze control */}
        <div className={`${panelClass}`}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Auto Analyze</div>
            <select
              value={autoAnalyzeInterval}
              onChange={(e) => setAutoAnalyzeInterval(Number(e.target.value))}
              className={`rounded-lg border px-2 py-1 text-xs ${theme.surfaceSubtle} ${theme.cardBorder} outline-none`}
            >
              <option value={0}>Off</option>
              <option value={60}>Every 1 min</option>
              <option value={120}>Every 2 min</option>
              <option value={300}>Every 5 min</option>
              <option value={600}>Every 10 min</option>
              <option value={1800}>Every 30 min</option>
            </select>
            {autoAnalyzeInterval > 0 && (
              <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Running every {autoAnalyzeInterval < 120 ? `${autoAnalyzeInterval}s` : `${autoAnalyzeInterval / 60}m`}
              </span>
            )}
            <button
              type="button"
              disabled={autoAnalyzeRunning || !companyId}
              onClick={() => void runBatchAnalyze(companyId)}
              className="rounded-lg border px-3 py-1 text-xs border-sky-500/50 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20 disabled:opacity-50"
            >
              {autoAnalyzeRunning ? "Running..." : "Run Now"}
            </button>
            {autoAnalyzeLogs.length > 0 && (
              <span className="text-[11px] text-muted-foreground ml-auto">
                Last run: {autoAnalyzeLogs[0].ts} — {autoAnalyzeLogs[0].processed} processed, {autoAnalyzeLogs[0].succeeded} ok, {autoAnalyzeLogs[0].failed} failed
              </span>
            )}
          </div>

          {/* Log panel */}
          {autoAnalyzeLogs.length > 0 && (
            <div className="mt-3 rounded-lg border border-white/10 bg-black/30 font-mono text-[11px] text-muted-foreground overflow-auto max-h-48">
              {autoAnalyzeLogs.map((run, i) => (
                <div key={i} className="px-3 py-1.5 border-b border-white/5 last:border-0">
                  <span className="text-white/40 mr-2">[{run.ts}]</span>
                  <span className={run.failed > 0 ? "text-red-400" : run.processed === 0 ? "text-white/40" : "text-emerald-400"}>
                    {run.processed === 0 ? "Nothing pending" : `${run.processed} processed · ${run.succeeded} ok · ${run.skipped} skipped · ${run.failed} failed`}
                  </span>
                  {run.logs.filter(l => !l.ok && !l.skipped).map((l, j) => (
                    <div key={j} className="mt-0.5 pl-4 text-red-400">✗ {l.id.slice(0, 8)}… — {l.error}</div>
                  ))}
                  {run.logs.filter(l => l.skipped).map((l, j) => (
                    <div key={j} className="mt-0.5 pl-4 text-amber-400/70">⏭ {l.id.slice(0, 8)}… — {l.error ?? "no recording yet"}</div>
                  ))}
                  {run.logs.filter(l => l.ok).map((l, j) => (
                    <div key={j} className="mt-0.5 pl-4 text-emerald-400/70">✓ {l.id.slice(0, 8)}… ({l.ms}ms)</div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Table card */}
        <div className={`${panelClass} space-y-3`}>
          {warning ? <div className="text-xs text-amber-300">{warning}</div> : null}
          {error ? <div className="text-xs text-red-300">{error}</div> : null}

          {!loading && !error && groupedItems.length === 0 ? (
            <div className="text-sm text-muted-foreground">No inquiries found.</div>
          ) : null}

          {groupedItems.length > 0 ? (
            <div className="overflow-x-auto space-y-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left">
                    <th className="py-2 pr-3">Mobile / Customer</th>
                    <th className="py-2 pr-3 text-center">Calls</th>
                    <th className="py-2 pr-3 text-center">Converted</th>
                    <th className="py-2 pr-3 text-center">Pending</th>
                    <th className="py-2 pr-3">Last Call</th>
                    <th className="py-2 pr-3">Agent(s)</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedItems.map((row) => (
                    <tr key={row.from_number ?? "__unknown__"} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="py-2.5 pr-3">
                        <div className="space-y-0.5">
                          <div className="font-mono text-sm">{row.from_number ?? <span className="italic text-muted-foreground">Unknown</span>}</div>
                          {row.customer_name ? (
                            <div className="text-xs text-sky-300 font-medium">{row.customer_name}</div>
                          ) : (
                            <div className="text-xs text-amber-400/80">New customer</div>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 text-center">
                        <button
                          type="button"
                          onClick={() => openCallsModal(row)}
                          className="rounded-full border border-sky-400/50 bg-sky-500/15 px-3 py-0.5 text-sm font-bold text-sky-200 hover:bg-sky-500/25 transition-colors"
                          title={`${row.call_count} total calls`}
                        >
                          {row.today_count}
                        </button>
                      </td>
                      <td className="py-2.5 pr-3 text-center">
                        {row.converted_count > 0 ? (
                          <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] text-emerald-300 font-semibold">
                            {row.converted_count}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">0</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-center">
                        {row.pending_count > 0 ? (
                          <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-2.5 py-0.5 text-[11px] text-amber-300 font-semibold">
                            {row.pending_count}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">0</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-muted-foreground">{new Date(row.last_call_at).toLocaleString()}</td>
                      <td className="py-2.5 pr-3 text-xs text-muted-foreground">{row.agent_names ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 ? (
                <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3">
                  <div className="text-xs text-muted-foreground">
                    Page {page} of {totalPages} · {totalCount} caller{totalCount !== 1 ? "s" : ""}
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setPage(1)} disabled={page <= 1}
                      className={`rounded border px-2 py-1 text-xs disabled:opacity-30 ${theme.surfaceSubtle} ${theme.cardBorder}`}>«</button>
                    <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                      className={`rounded border px-2 py-1 text-xs disabled:opacity-30 ${theme.surfaceSubtle} ${theme.cardBorder}`}>‹ Prev</button>
                    {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                      const mid = Math.min(Math.max(page, 4), totalPages - 3);
                      const start = Math.max(1, mid - 3);
                      return start + i;
                    }).filter((p) => p >= 1 && p <= totalPages).map((p) => (
                      <button key={p} type="button" onClick={() => setPage(p)}
                        className={`rounded border px-2.5 py-1 text-xs ${p === page ? "border-sky-400/60 bg-sky-500/20 text-sky-200" : `${theme.surfaceSubtle} ${theme.cardBorder}`}`}
                      >{p}</button>
                    ))}
                    <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                      className={`rounded border px-2 py-1 text-xs disabled:opacity-30 ${theme.surfaceSubtle} ${theme.cardBorder}`}>Next ›</button>
                    <button type="button" onClick={() => setPage(totalPages)} disabled={page >= totalPages}
                      className={`rounded border px-2 py-1 text-xs disabled:opacity-30 ${theme.surfaceSubtle} ${theme.cardBorder}`}>»</button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Calls drill-down modal */}
        {callsModalGroup ? (
          <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-[2px]" onClick={closeCallsModal} />
            <div
              className={`relative z-[9999] flex w-full max-w-6xl flex-col rounded-2xl border shadow-2xl ${theme.cardBorder}`}
              style={{ background: "rgba(2, 8, 23, 0.98)", maxHeight: "90vh" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4 shrink-0">
                <div>
                  <div>
                    <h3 className="text-base font-semibold">
                      {callsModalGroup.from_number ?? "Unknown"}
                      {callsModalGroup.customer_name ? (
                        <span className="ml-2 text-sky-300 font-normal">— {callsModalGroup.customer_name}</span>
                      ) : (
                        <span className="ml-2 text-amber-400/80 font-normal text-sm">New customer</span>
                      )}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {callsModalLoading ? "Loading..." : (
                        <>
                          {(() => {
                            const startOfToday = new Date(); startOfToday.setHours(0,0,0,0);
                            const todayCount = callsModalItems.filter(r => new Date(r.created_at) >= startOfToday).length;
                            const convertedCount = callsModalItems.filter(r => r.conversion_status === "converted").length;
                            return `Today: ${todayCount} · All time: ${callsModalItems.length} · ${convertedCount} converted · ${callsModalItems.length - convertedCount} pending`;
                          })()}
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <button type="button" onClick={closeCallsModal}
                  className="rounded border px-2.5 py-1 text-xs text-muted-foreground hover:text-white border-white/20 bg-white/5"
                >✕</button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-auto px-5 py-4">
                {callsModalLoading ? (
                  <div className="text-sm text-muted-foreground py-6 text-center">Loading calls...</div>
                ) : callsModalItems.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-6 text-center">No calls found.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-left">
                          <th className="py-2 pr-3">Created</th>
                          <th className="py-2 pr-3">To (Agent)</th>
                          <th className="py-2 pr-3">Status</th>
                          <th className="py-2 pr-3">Verification</th>
                          <th className="py-2 pr-3">Conversion</th>
                          <th className="py-2 pr-3">Lead Type</th>
                          <th className="py-2 pr-3">Recording</th>
                          <th className="py-2 pr-3">AI Analysis</th>
                          <th className="py-2 pr-3">Outcome</th>
                          <th className="py-2 pr-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {callsModalItems.map((row) => {
                          const rowLocked = isInquiryActionLocked(row);
                          return (
                            <tr key={row.id} className="border-b border-white/5">
                              <td className="py-2 pr-3 text-xs">
                                <div>{new Date(row.created_at).toLocaleString()}</div>
                                {row.call_direction === "outbound" ? (
                                  <span className="inline-flex items-center gap-0.5 rounded-full border border-violet-400/40 bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-300 mt-0.5">
                                    ↑ Outbound
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 rounded-full border border-sky-400/40 bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-300 mt-0.5">
                                    ↓ Inbound
                                  </span>
                                )}
                              </td>
                              <td className="py-2 pr-3">
                                <div className="text-xs space-y-0.5">
                                  <div className="font-medium">{row.agent_name ?? row.to_number ?? "-"}</div>
                                  {row.agent_name && row.to_number ? <div className="text-muted-foreground">{row.to_number}</div> : null}
                                </div>
                              </td>
                              <td className="py-2 pr-3 text-xs">{row.inquiry_status}</td>
                              <td className="py-2 pr-3">
                                <div className="text-xs">Mobile: {row.verified_mobile ? "yes" : "no"}</div>
                                <div className="text-xs">Location: {row.verified_location ? "yes" : "no"}</div>
                                {row.verification_location_text ? <div className="text-xs text-muted-foreground truncate max-w-[160px]">{row.verification_location_text}</div> : null}
                              </td>
                              <td className="py-2 pr-3">
                                {row.converted_to_lead_id ? (
                                  <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-200">Converted</span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">{row.conversion_status}</span>
                                )}
                              </td>
                              <td className="py-2 pr-3">
                                {row.converted_to_lead_id ? (
                                  <div className="space-y-1">
                                    <select
                                      value={leadTypeById[row.id] ?? row.converted_lead_type ?? "rsa"}
                                      onChange={(e) => setLeadTypeById((prev) => ({ ...prev, [row.id]: e.target.value as "rsa" | "recovery" | "workshop" }))}
                                      className={`rounded border px-2 py-1 text-xs ${theme.surfaceSubtle} ${theme.cardBorder}`}
                                      disabled={Boolean(actionById[row.id]) || rowLocked}
                                    >
                                      <option value="rsa">RSA</option>
                                      <option value="recovery">Recovery</option>
                                      <option value="workshop">Service Center (Walkin)</option>
                                    </select>
                                    {(() => {
                                      const lt = leadTypeById[row.id] ?? row.converted_lead_type ?? "rsa";
                                      const opts = lt === "rsa" ? RSA_DIVISIONS : lt === "recovery" ? RECOVERY_DIVISIONS : [];
                                      if (!opts.length) return null;
                                      return (
                                        <select value={divisionById[row.id] ?? row.converted_division ?? ""}
                                          onChange={(e) => setDivisionById((prev) => ({ ...prev, [row.id]: e.target.value }))}
                                          className={`rounded border px-2 py-1 text-xs ${theme.surfaceSubtle} ${theme.cardBorder}`}
                                          disabled={Boolean(actionById[row.id]) || rowLocked}
                                        >
                                          <option value="">Select division</option>
                                          {opts.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                        </select>
                                      );
                                    })()}
                                  </div>
                                ) : <span className="text-xs text-muted-foreground">-</span>}
                              </td>
                              <td className="py-2 pr-3">
                                {isUsableRecordingUrl(row.recording_url) ? (
                                  <div className="min-w-[200px] space-y-1">
                                    <audio controls preload="none"
                                      src={`/api/company/${companyId}/call-center/history/recording-proxy?recordingUrl=${encodeURIComponent(String(row.recording_url ?? ""))}`}
                                      className="h-8 w-full"
                                    />
                                    <div className="text-xs text-muted-foreground">Duration: {formatDuration(row.recording_duration_seconds)}</div>
                                  </div>
                                ) : "-"}
                              </td>
                              <td className="py-2 pr-3">
                                {row.analysis_analyzed_at ? (
                                  <button type="button" onClick={() => openAnalysisModal(row)} className="flex flex-wrap items-center gap-1.5 text-left">
                                    <span className="rounded-full border border-sky-400/40 bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-200">AI analyzed</span>
                                    <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-200">{formatConfidence(row.analysis_confidence)}</span>
                                    <span className={`rounded-full border px-2 py-0.5 text-[11px] ${row.analysis_auto_convert_eligible ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200" : "border-amber-400/40 bg-amber-500/10 text-amber-200"}`}>
                                      {row.analysis_auto_convert_eligible ? "Eligible" : "Not eligible"}
                                    </span>
                                  </button>
                                ) : row.analysis_error ? (
                                  <button type="button" onClick={() => openAnalysisModal(row)} className="rounded-full border border-rose-400/30 bg-rose-500/5 px-2 py-0.5 text-[11px] text-rose-300">Failed — view</button>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Not analyzed</span>
                                )}
                              </td>
                              <td className="py-2 pr-3 text-xs">{row.lead_outcome ?? "-"}</td>
                              <td className="py-2 pr-3">
                                <div className="flex flex-wrap gap-2">
                                  <button type="button" onClick={() => openVerifyModal(row)}
                                    disabled={Boolean(actionById[row.id]) || rowLocked || (row.verified_mobile && row.verified_location)}
                                    className={`rounded border px-2 py-1 text-xs disabled:opacity-50 ${theme.surfaceSubtle} ${theme.cardBorder}`}
                                  >
                                    {actionById[row.id] === "verify" ? "Verifying..." : row.verified_mobile && row.verified_location ? "Verified" : "Verify"}
                                  </button>
                                  <button type="button" onClick={() => void analyzeRecording(row)}
                                    disabled={Boolean(actionById[row.id]) || rowLocked || !isUsableRecordingUrl(row.recording_url)}
                                    className={`rounded border px-2 py-1 text-xs disabled:opacity-50 ${theme.surfaceSubtle} ${theme.cardBorder}`}
                                  >
                                    {actionById[row.id] === "analyze" ? "Analyzing..." : "Analyze (AI)"}
                                  </button>
                                  <button type="button" onClick={() => void convertToLead(row)}
                                    disabled={Boolean(actionById[row.id]) || rowLocked || Boolean(row.converted_to_lead_id)}
                                    className={`rounded border px-2 py-1 text-xs disabled:opacity-50 ${theme.surfaceSubtle} ${theme.cardBorder}`}
                                  >
                                    {actionById[row.id] === "convert" ? "Converting..." : row.converted_to_lead_id ? "Converted" : "Convert to Lead"}
                                  </button>
                                  {row.converted_to_lead_id ? (
                                    <button type="button" onClick={() => void setLeadType(row)}
                                      disabled={Boolean(actionById[row.id]) || rowLocked || (((leadTypeById[row.id] ?? row.converted_lead_type ?? "rsa") === "rsa" || (leadTypeById[row.id] ?? row.converted_lead_type ?? "rsa") === "recovery") && !(divisionById[row.id] ?? row.converted_division))}
                                      className={`rounded border px-2 py-1 text-xs disabled:opacity-50 ${theme.surfaceSubtle} ${theme.cardBorder}`}
                                    >
                                      {actionById[row.id] === "set_type" ? "Saving..." : "Set Type"}
                                    </button>
                                  ) : null}
                                  {rowLocked ? <span className="text-[11px] text-muted-foreground">Lead closed</span> : null}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {verifyModalRow ? (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/75 backdrop-blur-[2px]" onClick={closeVerifyModal} />
            <div
              className={`relative z-[10000] w-full max-w-xl rounded-2xl border p-4 shadow-2xl ${theme.cardBorder}`}
              style={{ background: "rgba(2, 8, 23, 0.98)" }}
            >
              <div className="mb-3">
                <h3 className="text-lg font-semibold">Verify Inquiry Location</h3>
                <p className="text-xs text-muted-foreground">
                  {verifyModalRow.matched_customer_location
                    ? "Customer location found. Confirm or update before verifying."
                    : "No location found. Add location before verifying."}
                </p>
              </div>

              <div className="space-y-3">
                <div className="text-xs text-muted-foreground">
                  Call ID: {verifyModalRow.provider_call_id} | From: {verifyModalRow.from_number ?? "-"}
                </div>

                <label className="block text-xs">
                  <span className="mb-1 block text-muted-foreground">Location</span>
                  <input
                    value={verifyLocationInput}
                    onChange={(e) => setVerifyLocationInput(e.target.value)}
                    placeholder="Enter caller location"
                    className={`w-full rounded-md border px-3 py-2 text-sm ${theme.surfaceSubtle} ${theme.cardBorder}`}
                  />
                </label>

                <div className="flex flex-wrap gap-4 text-xs">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={verifyMobileChecked}
                      onChange={(e) => setVerifyMobileChecked(e.target.checked)}
                    />
                    <span>Mobile verified</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={verifyLocationChecked}
                      onChange={(e) => setVerifyLocationChecked(e.target.checked)}
                    />
                    <span>Location verified</span>
                  </label>
                </div>

                {verifyLocationChecked && verifyLocationInput.trim().length < 3 ? (
                  <div className="text-xs text-amber-300">Please enter a valid location (min 3 chars).</div>
                ) : null}
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeVerifyModal}
                  className={`rounded border px-3 py-1.5 text-sm ${theme.surfaceSubtle} ${theme.cardBorder}`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void verifyInquiry(
                      verifyModalRow,
                      verifyLocationInput,
                      verifyMobileChecked,
                      verifyLocationChecked
                    )
                  }
                  disabled={Boolean(actionById[verifyModalRow.id]) || (verifyLocationChecked && verifyLocationInput.trim().length < 3)}
                  className={`rounded border px-3 py-1.5 text-sm disabled:opacity-50 ${theme.surfaceSubtle} ${theme.cardBorder}`}
                >
                  {actionById[verifyModalRow.id] === "verify" ? "Verifying..." : "Save Verification"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {analysisModalRow ? (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/75 backdrop-blur-[2px]" onClick={closeAnalysisModal} />
            <div
              className={`relative z-[10000] w-full max-w-lg rounded-2xl border shadow-2xl ${theme.cardBorder}`}
              style={{ background: "rgba(2, 8, 23, 0.98)" }}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
                <div>
                  <h3 className="text-base font-semibold">AI Analysis</h3>
                  <p className="text-xs text-muted-foreground">
                    Call {analysisModalRow.provider_call_id} · From {analysisModalRow.from_number ?? "-"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeAnalysisModal}
                  className="mt-0.5 rounded border px-2.5 py-1 text-xs text-muted-foreground hover:text-white border-white/20 bg-white/5"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 px-5 py-4">
                {/* Badges */}
                {analysisModalRow.analysis_analyzed_at ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-sky-400/40 bg-sky-500/10 px-2.5 py-0.5 text-[11px] text-sky-200">
                        AI analyzed
                      </span>
                      <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] text-emerald-200">
                        Confidence {formatConfidence(analysisModalRow.analysis_confidence)}
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] ${
                          analysisModalRow.analysis_auto_convert_eligible
                            ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                            : "border-amber-400/40 bg-amber-500/10 text-amber-200"
                        }`}
                      >
                        Eligible {analysisModalRow.analysis_auto_convert_eligible ? "yes" : "no"}
                      </span>
                    </div>

                    <div className="text-[11px] text-muted-foreground">
                      Analyzed: {new Date(analysisModalRow.analysis_analyzed_at).toLocaleString()}
                    </div>

                    {/* Details grid */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      {[
                        ["Lead type", analysisModalRow.analysis_lead_type],
                        ["Request", analysisModalRow.analysis_request_type],
                        ["Plate", analysisModalRow.analysis_plate_number],
                        ["Caller", analysisModalRow.analysis_caller_name],
                        ["Mobile", analysisModalRow.analysis_mobile_number],
                        ["Location", analysisModalRow.analysis_location],
                      ].map(([label, value]) => (
                        <div key={label} className="contents">
                          <div className="text-muted-foreground">{label}</div>
                          <div>{value ?? "-"}</div>
                        </div>
                      ))}
                    </div>

                    {/* Summary */}
                    {analysisModalRow.analysis_summary ? (
                      <div className={`rounded-lg border ${theme.cardBorder} bg-black/20 p-3`}>
                        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Summary
                        </div>
                        <p className="text-sm leading-relaxed">{analysisModalRow.analysis_summary}</p>
                      </div>
                    ) : null}

                    {/* Transcript button */}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          closeAnalysisModal();
                          openTranscriptModal(analysisModalRow);
                        }}
                        disabled={!String(analysisModalRow.analysis_transcript ?? "").trim()}
                        className={`rounded border px-3 py-1.5 text-xs disabled:opacity-50 ${theme.surfaceSubtle} ${theme.cardBorder}`}
                      >
                        View Transcript
                      </button>
                      <span className="text-xs text-muted-foreground">
                        {String(analysisModalRow.analysis_transcript ?? "").trim()
                          ? `${String(analysisModalRow.analysis_transcript ?? "").trim().length} chars`
                          : "No transcript"}
                      </span>
                    </div>
                  </>
                ) : analysisModalRow.analysis_error ? (
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-rose-300">Analysis failed</div>
                    <div className="text-xs text-muted-foreground">
                      {analysisModalRow.analysis_attempted_at
                        ? new Date(analysisModalRow.analysis_attempted_at).toLocaleString()
                        : "-"}
                    </div>
                    <div className="mt-2 rounded-lg border border-rose-400/30 bg-rose-500/5 p-3 text-xs text-red-300 break-words">
                      {analysisModalRow.analysis_error}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {transcriptModalRow ? (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/75 backdrop-blur-[2px]" onClick={closeTranscriptModal} />
            <div
              className={`relative z-[10000] flex w-full max-w-2xl flex-col rounded-2xl border shadow-2xl ${theme.cardBorder}`}
              style={{ background: "rgba(2, 8, 23, 0.98)", maxHeight: "85vh" }}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4 shrink-0">
                <div>
                  <h3 className="text-base font-semibold">AI Transcript</h3>
                  <p className="text-xs text-muted-foreground">
                    Call {transcriptModalRow.provider_call_id} ·{" "}
                    {transcriptModalRow.analysis_analyzed_at
                      ? `Analyzed ${new Date(transcriptModalRow.analysis_analyzed_at).toLocaleString()}`
                      : "Not analyzed"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeTranscriptModal}
                  className="mt-0.5 rounded border px-2.5 py-1 text-xs text-muted-foreground hover:text-white border-white/20 bg-white/5"
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                {Array.isArray(transcriptModalRow.analysis_conversation_turns) && transcriptModalRow.analysis_conversation_turns.length > 0 ? (
                  <div className="space-y-3">
                    {transcriptModalRow.analysis_conversation_turns.map((turn, i) => {
                      const isAgent = turn.speaker === "agent";
                      return (
                        <div key={i} className={`flex gap-3 ${isAgent ? "flex-row" : "flex-row-reverse"}`}>
                          {/* Avatar */}
                          <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${isAgent ? "bg-blue-600/60 text-blue-100" : "bg-emerald-600/60 text-emerald-100"}`}>
                            {isAgent ? "AG" : "CX"}
                          </div>
                          {/* Bubble */}
                          <div className={`max-w-[75%] space-y-0.5`}>
                            <div className={`text-[10px] font-semibold ${isAgent ? "text-blue-300 text-left" : "text-emerald-300 text-right"}`}>
                              {isAgent ? "Agent" : "Customer"}
                            </div>
                            <div className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${isAgent ? "rounded-tl-sm bg-blue-900/40 text-blue-50" : "rounded-tr-sm bg-emerald-900/40 text-emerald-50"}`}>
                              {turn.text}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-xs text-amber-300/80">
                      Conversation view not available — re-analyze this call to enable it.
                    </div>
                    <div className={`rounded-lg border ${theme.cardBorder} bg-black/20 p-3`}>
                      <pre className="whitespace-pre-wrap break-words text-xs leading-5">
                        {String(transcriptModalRow.analysis_transcript ?? "").trim() || "No transcript available."}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}
