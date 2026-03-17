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
        <button
          type="button"
          onClick={() => setView("history")}
          className={`rounded-full border px-3 py-1 text-sm ${view === "history" ? "bg-primary text-primary-foreground border-primary" : `${theme.surfaceSubtle} ${theme.cardBorder}`}`}
        >
          Call History
        </button>
        <button
          type="button"
          onClick={() => setView("inquiries")}
          className={`rounded-full border px-3 py-1 text-sm ${view === "inquiries" ? "bg-primary text-primary-foreground border-primary" : `${theme.surfaceSubtle} ${theme.cardBorder}`}`}
        >
          AI Inquiries
        </button>
      </div>

      <div className={panelClass}>
        {view === "history" ? <CallHistoryPanel companyId={companyId} /> : <LeadInquiriesPanel companyId={companyId} />}
      </div>
    </div>
  );
}

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

  const fetchData = useCallback(
    async (opts?: { background?: boolean }) => {
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
        const list: CallHistoryRow[] = (data?.data ?? []).map((item: any) => ({
          ...item,
          startedAt: item.startedAt ?? null,
        }));
        setRows(list);
      } catch (err: any) {
        setError(err?.message ?? t("call.history.error"));
      } finally {
        setLoading(false);
        if (background) setRefreshing(false);
      }
    },
    [companyId, direction, t]
  );

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

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
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error ?? "Recording not found yet");
      }
      await fetchData({ background: true });
    } catch (err: any) {
      setError(err?.message ?? "Failed to resolve recording");
    } finally {
      setResolvingById((prev) => ({ ...prev, [row.id]: false }));
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">{t("call.history.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("call.history.subtitle")}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => void fetchData({ background: true })}
          disabled={loading || refreshing}
          className={`rounded-full border px-3 py-1 text-sm font-medium transition disabled:opacity-60 ${cardBorder} ${cardBg}`}
        >
          {refreshing ? "Refreshing..." : "Refresh Log"}
        </button>
        {historyDirectionTabs.map((tab) => {
          const isActive = direction === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setDirection(tab.key)}
              className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
                isActive ? "bg-primary text-primary-foreground border-primary" : `${cardBorder} ${cardBg}`
              }`}
            >
              {t(tab.label)}
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("call.history.loading")}</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("call.history.empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b">
                <th className="px-3 py-2 text-left">{t("call.history.table.customer")}</th>
                <th className="px-3 py-2 text-left">{t("call.history.table.direction")}</th>
                <th className="px-3 py-2 text-left">{t("call.history.table.from")}</th>
                <th className="px-3 py-2 text-left">{t("call.history.table.to")}</th>
                <th className="px-3 py-2 text-left">{t("call.history.table.status")}</th>
                <th className="px-3 py-2 text-left">{t("call.history.table.started")}</th>
                <th className="px-3 py-2 text-left">{t("call.history.table.remarks")}</th>
                <th className="px-3 py-2 text-left">{t("call.history.table.recording")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => {
                const started = row.startedAt ? new Date(row.startedAt) : null;
                const agentLabel = row.agent?.name ?? row.agent?.email ?? row.createdByUserId ?? "—";
                const customerLabel = row.customer?.name ?? row.customer?.phone ?? "—";
                const recordingProxyUrl = isUsableRecordingUrl(row.recording?.url)
                  ? `/api/company/${companyId}/call-center/history/recording-proxy?recordingUrl=${encodeURIComponent(
                      String(row.recording?.url ?? "")
                    )}`
                  : "";
                return (
                  <tr key={row.id} className="align-top">
                    <td className="px-3 py-2">
                      <div className="font-medium">{customerLabel}</div>
                      {row.customer?.phone && <div className="text-xs text-muted-foreground">{row.customer.phone}</div>}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded-full border px-2 py-1 text-xs capitalize">{row.direction}</span>
                    </td>
                    <td className="px-3 py-2">{row.from}</td>
                    <td className="px-3 py-2">{row.to}</td>
                    <td className="px-3 py-2 capitalize">{row.status}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {started ? started.toLocaleString() : "—"}
                      <div className="text-xs text-muted-foreground">{formatDuration(row.durationSeconds)}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-sm">{agentLabel}</div>
                      {row.agent?.email && <div className="text-xs text-muted-foreground">{row.agent.email}</div>}
                    </td>
                    <td className="px-3 py-2">
                      {isUsableRecordingUrl(row.recording?.url) ? (
                        <div className="flex min-w-[220px] flex-col gap-2">
                          <audio controls preload="none" src={recordingProxyUrl} className="h-8 w-full" />
                          <Link href={recordingProxyUrl} className="text-primary hover:underline" target="_blank">
                            {t("call.history.table.recording.link")}
                          </Link>
                        </div>
                      ) : (
                        <div className="flex min-w-[220px] items-center gap-2">
                          <span className="text-xs text-muted-foreground">—</span>
                          <button
                            type="button"
                            onClick={() => void resolveRecordingNow(row)}
                            disabled={Boolean(resolvingById[row.id]) || !String(row.providerCallId ?? "").trim()}
                            className={`rounded-full border px-2 py-1 text-xs transition disabled:opacity-60 ${cardBorder} ${cardBg}`}
                          >
                            {resolvingById[row.id] ? "Resolving..." : "Resolve Recording Now"}
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
    setError(null);
    const res = await fetch(`/api/company/${companyId}/ai/inquiries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inquiryId, ...payload }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.ok === false) {
      throw new Error(String(json?.error ?? fallbackError));
    }
    await loadInquiries(true);
  }

  async function loadInquiries(background = false) {
    if (background) setRefreshing(true);
    setLoading(true);
    setError(null);
    setWarning(null);
    try {
      const res = await fetch(`/api/company/${companyId}/ai/inquiries?_=${Date.now()}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(json?.error ?? "Failed to load lead inquiries"));
      setItems(Array.isArray(json?.inquiries) ? json.inquiries : []);
      setWarning(json?.warning ? String(json.warning) : null);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load lead inquiries");
      setItems([]);
    } finally {
      setLoading(false);
      if (background) setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadInquiries();
  }, [companyId]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((row) => String(row.conversion_status ?? "").toLowerCase() === filter);
  }, [filter, items]);

  const kpis = useMemo(() => {
    let converted = 0;
    let pending = 0;
    for (const row of items) {
      if (row.conversion_status === "converted") converted += 1;
      else pending += 1;
    }
    return { total: items.length, converted, pending };
  }, [items]);

  async function verifyInquiry(row: InquiryRow) {
    setRowBusy(row.id, "verify");
    try {
      await runInquiryAction(
        row.id,
        {
          action: "verify",
          verifiedMobile: true,
          verifiedLocation: true,
          verificationNotes: "Verified manually by agent",
        },
        "Failed to verify inquiry"
      );
    } catch (err: any) {
      setError(err?.message ?? "Failed to verify inquiry");
    } finally {
      setRowBusy(row.id, null);
    }
  }

  async function convertToLead(row: InquiryRow) {
    setRowBusy(row.id, "convert");
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
    setRowBusy(row.id, "set_type");
    try {
      await runInquiryAction(
        row.id,
        { action: "set_lead_type", leadType: selected },
        "Failed to update lead type"
      );
    } catch (err: any) {
      setError(err?.message ?? "Failed to update lead type");
    } finally {
      setRowBusy(row.id, null);
    }
  }

  async function analyzeRecording(row: InquiryRow) {
    setRowBusy(row.id, "analyze");
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

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Lead Inquiries</h2>
        <p className="text-sm text-muted-foreground">Incoming call inquiries and lead conversion status.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">{loading ? "Loading..." : `${filtered.length} record(s)`}</div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-full border px-3 py-1 text-xs ${
              filter === "all" ? "bg-primary text-primary-foreground border-primary" : `${theme.surfaceSubtle} ${theme.cardBorder}`
            }`}
          >
            All ({kpis.total})
          </button>
          <button
            type="button"
            onClick={() => setFilter("not_converted")}
            className={`rounded-full border px-3 py-1 text-xs ${
              filter === "not_converted" ? "bg-primary text-primary-foreground border-primary" : `${theme.surfaceSubtle} ${theme.cardBorder}`
            }`}
          >
            Not Converted ({kpis.pending})
          </button>
          <button
            type="button"
            onClick={() => setFilter("converted")}
            className={`rounded-full border px-3 py-1 text-xs ${
              filter === "converted" ? "bg-primary text-primary-foreground border-primary" : `${theme.surfaceSubtle} ${theme.cardBorder}`
            }`}
          >
            Converted ({kpis.converted})
          </button>
          <button
            type="button"
            onClick={() => void loadInquiries(true)}
            className={`rounded-xl border px-3 py-1.5 text-sm ${theme.surfaceSubtle} ${theme.cardBorder}`}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {warning ? <div className="text-xs text-amber-300">{warning}</div> : null}
      {error ? <div className="text-xs text-red-300">{error}</div> : null}

      {!loading && !error && filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground">No lead inquiries yet.</div>
      ) : null}

      {filtered.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left">
                <th className="py-2 pr-3">Created</th>
                <th className="py-2 pr-3">Call ID</th>
                <th className="py-2 pr-3">From</th>
                <th className="py-2 pr-3">Customer</th>
                <th className="py-2 pr-3">To</th>
                <th className="py-2 pr-3">Inquiry</th>
                <th className="py-2 pr-3">Summary</th>
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
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-white/5">
                  <td className="whitespace-nowrap py-2 pr-3">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="py-2 pr-3">{row.provider_call_id}</td>
                  <td className="py-2 pr-3">{row.from_number ?? "-"}</td>
                  <td className="py-2 pr-3">
                    {row.customer_exists ? (
                      <div className="text-xs">
                        <div>{row.matched_customer_name ?? "Existing customer"}</div>
                        <div className="text-muted-foreground">{row.matched_customer_phone ?? row.from_number ?? "-"}</div>
                      </div>
                    ) : (
                      <span className="text-xs text-amber-300">New customer</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">{row.to_number ?? "-"}</td>
                  <td className="py-2 pr-3">{row.inquiry_status ?? "-"}</td>
                  <td className="py-2 pr-3">{row.inquiry_summary ?? "-"}</td>
                  <td className="py-2 pr-3">
                    <div className="text-xs">
                      Mobile: {row.verified_mobile ? "yes" : "no"}
                    </div>
                    <div className="text-xs">
                      Location: {row.verified_location ? "yes" : "no"}
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    {row.conversion_status}
                    {row.converted_to_lead_id ? ` (${row.converted_to_lead_id})` : ""}
                  </td>
                  <td className="py-2 pr-3">
                    {row.converted_to_lead_id ? (
                      <select
                        value={leadTypeById[row.id] ?? row.converted_lead_type ?? "rsa"}
                        onChange={(e) =>
                          setLeadTypeById((prev) => ({
                            ...prev,
                            [row.id]: e.target.value as "rsa" | "recovery" | "workshop",
                          }))
                        }
                        className={`rounded border px-2 py-1 text-xs ${theme.surfaceSubtle} ${theme.cardBorder}`}
                        disabled={Boolean(actionById[row.id])}
                      >
                        <option value="rsa">RSA</option>
                        <option value="recovery">Recovery</option>
                        <option value="workshop">Service Center (Walkin)</option>
                      </select>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    {isUsableRecordingUrl(row.recording_url) ? (
                      <div className="min-w-[220px] space-y-1">
                        <audio
                          controls
                          preload="none"
                          src={`/api/company/${companyId}/call-center/history/recording-proxy?recordingUrl=${encodeURIComponent(
                            String(row.recording_url ?? "")
                          )}`}
                          className="h-8 w-full"
                        />
                        <div className="text-xs text-muted-foreground">
                          Duration: {formatDuration(row.recording_duration_seconds)}
                        </div>
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    {row.analysis_analyzed_at ? (
                      <div className="min-w-[260px] text-xs">
                        <div>Analyzed: {new Date(row.analysis_analyzed_at).toLocaleString()}</div>
                        <div>Confidence: {formatConfidence(row.analysis_confidence)}</div>
                        <div>Eligible: {row.analysis_auto_convert_eligible ? "yes" : "no"}</div>
                        <div>Lead type: {row.analysis_lead_type ?? "-"}</div>
                        <div>Request: {row.analysis_request_type ?? "-"}</div>
                        <div>Plate: {row.analysis_plate_number ?? "-"}</div>
                        <div>Location: {row.analysis_location ?? "-"}</div>
                        <div>Caller: {row.analysis_caller_name ?? "-"}</div>
                        <div>Mobile: {row.analysis_mobile_number ?? "-"}</div>
                        <div className="truncate">Summary: {row.analysis_summary ?? "-"}</div>
                        <div className="truncate text-muted-foreground">Transcript: {row.analysis_transcript ?? "-"}</div>
                      </div>
                    ) : row.analysis_error ? (
                      <div className="min-w-[260px] text-xs">
                        <div className="text-amber-300">Last attempt failed</div>
                        <div className="text-muted-foreground">
                          {row.analysis_attempted_at ? new Date(row.analysis_attempted_at).toLocaleString() : "-"}
                        </div>
                        <div className="break-words text-red-300">{row.analysis_error}</div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not analyzed</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">{row.lead_outcome ?? "-"}</td>
                  <td className="py-2 pr-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void verifyInquiry(row)}
                        disabled={Boolean(actionById[row.id]) || (row.verified_mobile && row.verified_location)}
                        className={`rounded border px-2 py-1 text-xs disabled:opacity-50 ${theme.surfaceSubtle} ${theme.cardBorder}`}
                      >
                        {actionById[row.id] === "verify" ? "Verifying..." : row.verified_mobile && row.verified_location ? "Verified" : "Verify"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void analyzeRecording(row)}
                        disabled={Boolean(actionById[row.id]) || !isUsableRecordingUrl(row.recording_url)}
                        className={`rounded border px-2 py-1 text-xs disabled:opacity-50 ${theme.surfaceSubtle} ${theme.cardBorder}`}
                      >
                        {actionById[row.id] === "analyze" ? "Analyzing..." : "Analyze (AI)"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void convertToLead(row)}
                        disabled={Boolean(actionById[row.id]) || Boolean(row.converted_to_lead_id)}
                        className={`rounded border px-2 py-1 text-xs disabled:opacity-50 ${theme.surfaceSubtle} ${theme.cardBorder}`}
                      >
                        {actionById[row.id] === "convert" ? "Converting..." : row.converted_to_lead_id ? "Converted" : "Convert to Lead"}
                      </button>
                      {row.converted_to_lead_id ? (
                        <button
                          type="button"
                          onClick={() => void setLeadType(row)}
                          disabled={Boolean(actionById[row.id])}
                          className={`rounded border px-2 py-1 text-xs disabled:opacity-50 ${theme.surfaceSubtle} ${theme.cardBorder}`}
                        >
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
