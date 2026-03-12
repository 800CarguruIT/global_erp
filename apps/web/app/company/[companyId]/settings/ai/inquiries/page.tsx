"use client";

import { AppLayout, useTheme } from "@repo/ui";
import { useEffect, useMemo, useState } from "react";

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
  analysis_error: string | null;
  analysis_attempted_at: string | null;
  created_at: string;
  updated_at: string;
};

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

export default function CompanyAiInquiriesPage({ params }: Params) {
  const { theme } = useTheme();
  const [companyId, setCompanyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [items, setItems] = useState<InquiryRow[]>([]);
  const [actionById, setActionById] = useState<Record<string, string>>({});
  const [leadTypeById, setLeadTypeById] = useState<Record<string, "rsa" | "recovery" | "workshop">>({});
  const [divisionById, setDivisionById] = useState<Record<string, string>>({});
  const [verifyModalRow, setVerifyModalRow] = useState<InquiryRow | null>(null);
  const [verifyLocationInput, setVerifyLocationInput] = useState("");
  const [verifyMobileChecked, setVerifyMobileChecked] = useState(true);
  const [verifyLocationChecked, setVerifyLocationChecked] = useState(true);
  const [transcriptModalRow, setTranscriptModalRow] = useState<InquiryRow | null>(null);

  useEffect(() => {
    Promise.resolve(params).then((p: any) => {
      setCompanyId(String(p?.companyId ?? "").trim());
    });
  }, [params]);

  async function loadInquiries(targetCompanyId: string) {
    setLoading(true);
    setError(null);
    setWarning(null);
    try {
      const res = await fetch(`/api/company/${targetCompanyId}/ai/inquiries?_=${Date.now()}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(json?.error ?? "Failed to load AI inquiries"));
      }
      setItems(Array.isArray(json?.inquiries) ? json.inquiries : []);
      setWarning(json?.warning ? String(json.warning) : null);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load AI inquiries");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!companyId) return;
    void loadInquiries(companyId);
  }, [companyId]);

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
    await loadInquiries(companyId);
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
    () =>
      `min-h-screen ${theme.appBg} ${theme.appText} p-6 space-y-4 transition-colors`,
    [theme.appBg, theme.appText]
  );
  const panelClass = `${theme.card} ${theme.cardBorder} rounded-2xl border p-4`;
  const kpis = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    let today = 0;
    let converted = 0;
    let pending = 0;
    let appointment = 0;
    let walkin = 0;
    let lost = 0;

    for (const row of items) {
      const createdMs = new Date(row.created_at).getTime();
      if (Number.isFinite(createdMs) && createdMs >= todayStart) today += 1;
      if (row.conversion_status === "converted") converted += 1;
      if (row.conversion_status !== "converted") pending += 1;
      if (row.lead_outcome === "appointment") appointment += 1;
      if (row.lead_outcome === "walkin_service_request") walkin += 1;
      if (row.lead_outcome === "lost_lead") lost += 1;
    }
    const conversionRate = items.length > 0 ? (converted / items.length) * 100 : 0;

    return [
      { label: "Total", value: items.length },
      { label: "Today", value: today },
      { label: "Converted", value: converted },
      { label: "Conversion Rate", value: `${conversionRate.toFixed(1)}%` },
      { label: "Pending", value: pending },
      { label: "Appointment", value: appointment },
      { label: "Walk-in", value: walkin },
      { label: "Lost", value: lost },
    ];
  }, [items]);

  return (
    <AppLayout>
      <div className={containerClass}>
        <div>
          <h1 className="text-2xl font-semibold">AI Inquiries</h1>
          <p className="text-sm text-muted-foreground">Inquiry records created by AI workflow automation.</p>
        </div>

        <div className={`${panelClass} space-y-3`}>
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              {loading ? "Loading..." : `${items.length} record(s)`}
            </div>
            <button
              type="button"
              onClick={() => (companyId ? void loadInquiries(companyId) : undefined)}
              className={`rounded-xl px-3 py-1.5 text-sm border ${theme.surfaceSubtle} ${theme.cardBorder}`}
            >
              Refresh
            </button>
          </div>

          {warning ? <div className="text-xs text-amber-300">{warning}</div> : null}
          {error ? <div className="text-xs text-red-300">{error}</div> : null}

          {!error ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
              {kpis.map((kpi) => (
                <div
                  key={kpi.label}
                  className={`rounded-xl border ${theme.cardBorder} ${theme.surfaceSubtle} px-3 py-2`}
                >
                  <div className="text-xs text-muted-foreground">{kpi.label}</div>
                  <div className="text-lg font-semibold">{kpi.value}</div>
                </div>
              ))}
            </div>
          ) : null}

          {!loading && !error && items.length === 0 ? (
            <div className="text-sm text-muted-foreground">No inquiries yet.</div>
          ) : null}

          {items.length > 0 ? (
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
                    <th className="py-2 pr-3">Verification</th>
                    <th className="py-2 pr-3">Conversion</th>
                    <th className="py-2 pr-3">Lead Type</th>
                    <th className="py-2 pr-3">Division</th>
                    <th className="py-2 pr-3">Recording</th>
                    <th className="py-2 pr-3">AI Analysis</th>
                    <th className="py-2 pr-3">Outcome</th>
                    <th className="py-2 pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => {
                    const rowLocked = isInquiryActionLocked(row);
                    return (
                    <tr key={row.id} className="border-b border-white/5">
                      <td className="py-2 pr-3">{new Date(row.created_at).toLocaleString()}</td>
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
                      <td className="py-2 pr-3">{row.inquiry_status}</td>
                      <td className="py-2 pr-3">
                        <div className="text-xs">Mobile: {row.verified_mobile ? "yes" : "no"}</div>
                        <div className="text-xs">Location: {row.verified_location ? "yes" : "no"}</div>
                        {row.verification_location_text ? (
                          <div className="text-xs text-muted-foreground truncate max-w-[220px]">
                            {row.verification_location_text}
                          </div>
                        ) : null}
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
                            disabled={Boolean(actionById[row.id]) || rowLocked}
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
                        {row.converted_to_lead_id ? (
                          (() => {
                            const leadType = leadTypeById[row.id] ?? row.converted_lead_type ?? "rsa";
                            const options =
                              leadType === "rsa"
                                ? RSA_DIVISIONS
                                : leadType === "recovery"
                                  ? RECOVERY_DIVISIONS
                                  : [];
                            if (!options.length) return <span>-</span>;
                            return (
                              <select
                                value={divisionById[row.id] ?? row.converted_division ?? ""}
                                onChange={(e) =>
                                  setDivisionById((prev) => ({
                                    ...prev,
                                    [row.id]: e.target.value,
                                  }))
                                }
                                className={`rounded border px-2 py-1 text-xs ${theme.surfaceSubtle} ${theme.cardBorder}`}
                                disabled={Boolean(actionById[row.id]) || rowLocked}
                              >
                                <option value="">Select division</option>
                                {options.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            );
                          })()
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
                          <div className={`min-w-[320px] rounded-lg border ${theme.cardBorder} ${theme.surfaceSubtle} p-2 text-xs`}>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-sky-400/40 bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-200">
                                AI analyzed
                              </span>
                              <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-200">
                                Confidence {formatConfidence(row.analysis_confidence)}
                              </span>
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[11px] ${
                                  row.analysis_auto_convert_eligible
                                    ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                                    : "border-amber-400/40 bg-amber-500/10 text-amber-200"
                                }`}
                              >
                                Eligible {row.analysis_auto_convert_eligible ? "yes" : "no"}
                              </span>
                            </div>
                            <div className="mt-2 text-[11px] text-muted-foreground">
                              Analyzed: {new Date(row.analysis_analyzed_at).toLocaleString()}
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                              <div className="text-muted-foreground">Lead type</div>
                              <div className="truncate">{row.analysis_lead_type ?? "-"}</div>
                              <div className="text-muted-foreground">Request</div>
                              <div className="truncate">{row.analysis_request_type ?? "-"}</div>
                              <div className="text-muted-foreground">Plate</div>
                              <div className="truncate">{row.analysis_plate_number ?? "-"}</div>
                              <div className="text-muted-foreground">Caller</div>
                              <div className="truncate">{row.analysis_caller_name ?? "-"}</div>
                              <div className="text-muted-foreground">Mobile</div>
                              <div className="truncate">{row.analysis_mobile_number ?? "-"}</div>
                              <div className="text-muted-foreground">Location</div>
                              <div className="truncate">{row.analysis_location ?? "-"}</div>
                            </div>
                            <div className={`mt-2 rounded-md border ${theme.cardBorder} bg-black/10 p-2`}>
                              <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Summary</div>
                              <div className="max-h-16 overflow-hidden text-[11px] leading-4">
                                {row.analysis_summary ?? "-"}
                              </div>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openTranscriptModal(row)}
                                disabled={!String(row.analysis_transcript ?? "").trim()}
                                className={`rounded border px-2 py-1 text-[11px] disabled:opacity-50 ${theme.surfaceSubtle} ${theme.cardBorder}`}
                              >
                                View Transcript
                              </button>
                              <span className="text-[11px] text-muted-foreground">
                                {String(row.analysis_transcript ?? "").trim()
                                  ? `${String(row.analysis_transcript ?? "").trim().length} chars`
                                  : "No transcript"}
                              </span>
                            </div>
                          </div>
                        ) : row.analysis_error ? (
                          <div className={`min-w-[320px] rounded-lg border border-rose-400/30 bg-rose-500/5 p-2 text-xs`}>
                            <div className="text-rose-300">Last attempt failed</div>
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
                            onClick={() => openVerifyModal(row)}
                            disabled={Boolean(actionById[row.id]) || rowLocked || (row.verified_mobile && row.verified_location)}
                            className={`rounded border px-2 py-1 text-xs disabled:opacity-50 ${theme.surfaceSubtle} ${theme.cardBorder}`}
                          >
                            {actionById[row.id] === "verify"
                              ? "Verifying..."
                              : row.verified_mobile && row.verified_location
                                ? "Verified"
                                : "Verify"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void analyzeRecording(row)}
                            disabled={Boolean(actionById[row.id]) || rowLocked || !isUsableRecordingUrl(row.recording_url)}
                            className={`rounded border px-2 py-1 text-xs disabled:opacity-50 ${theme.surfaceSubtle} ${theme.cardBorder}`}
                          >
                            {actionById[row.id] === "analyze" ? "Analyzing..." : "Analyze (AI)"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void convertToLead(row)}
                            disabled={Boolean(actionById[row.id]) || rowLocked || Boolean(row.converted_to_lead_id)}
                            className={`rounded border px-2 py-1 text-xs disabled:opacity-50 ${theme.surfaceSubtle} ${theme.cardBorder}`}
                          >
                            {actionById[row.id] === "convert"
                              ? "Converting..."
                              : row.converted_to_lead_id
                                ? "Converted"
                                : "Convert to Lead"}
                          </button>
                          {row.converted_to_lead_id ? (
                            <button
                              type="button"
                              onClick={() => void setLeadType(row)}
                              disabled={
                                Boolean(actionById[row.id]) ||
                                rowLocked ||
                                (((leadTypeById[row.id] ?? row.converted_lead_type ?? "rsa") === "rsa" ||
                                  (leadTypeById[row.id] ?? row.converted_lead_type ?? "rsa") === "recovery") &&
                                  !(divisionById[row.id] ?? row.converted_division))
                              }
                              className={`rounded border px-2 py-1 text-xs disabled:opacity-50 ${theme.surfaceSubtle} ${theme.cardBorder}`}
                            >
                              {actionById[row.id] === "set_type" ? "Saving..." : "Set Type"}
                            </button>
                          ) : null}
                          {rowLocked ? (
                            <span className="text-[11px] text-muted-foreground">Lead closed: actions disabled</span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

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

        {transcriptModalRow ? (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/75 backdrop-blur-[2px]" onClick={closeTranscriptModal} />
            <div
              className={`relative z-[10000] w-full max-w-3xl rounded-2xl border p-4 shadow-2xl ${theme.cardBorder}`}
              style={{ background: "rgba(2, 8, 23, 0.98)" }}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">AI Transcript</h3>
                  <p className="text-xs text-muted-foreground">
                    Call ID: {transcriptModalRow.provider_call_id} |{" "}
                    {transcriptModalRow.analysis_analyzed_at
                      ? `Analyzed ${new Date(transcriptModalRow.analysis_analyzed_at).toLocaleString()}`
                      : "Not analyzed"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeTranscriptModal}
                  className={`rounded border px-3 py-1.5 text-sm ${theme.surfaceSubtle} ${theme.cardBorder}`}
                >
                  Close
                </button>
              </div>

              <div className={`max-h-[65vh] overflow-auto rounded-lg border ${theme.cardBorder} bg-black/20 p-3`}>
                <pre className="whitespace-pre-wrap break-words text-xs leading-5">
                  {String(transcriptModalRow.analysis_transcript ?? "").trim() || "No transcript available."}
                </pre>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}
