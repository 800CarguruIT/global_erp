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
  created_at: string;
  updated_at: string;
};

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

export default function CompanyAiInquiriesPage({ params }: Params) {
  const { theme } = useTheme();
  const [companyId, setCompanyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [items, setItems] = useState<InquiryRow[]>([]);
  const [actionById, setActionById] = useState<Record<string, string>>({});
  const [leadTypeById, setLeadTypeById] = useState<Record<string, "rsa" | "recovery" | "workshop">>({});

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
      const res = await fetch(`/api/company/${targetCompanyId}/ai/inquiries`, { cache: "no-store" });
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

  async function verifyInquiry(row: InquiryRow) {
    setRowBusy(row.id, "verify");
    setError(null);
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
    setRowBusy(row.id, "set_type");
    setError(null);
    try {
      await runInquiryAction(
        row.id,
        { action: "set_lead_type", leadType: selected },
        "Failed to set lead type"
      );
    } catch (err: any) {
      setError(err?.message ?? "Failed to set lead type");
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
                    <th className="py-2 pr-3">Recording</th>
                    <th className="py-2 pr-3">Outcome</th>
                    <th className="py-2 pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
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
                      <td className="py-2 pr-3">{row.lead_outcome ?? "-"}</td>
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void verifyInquiry(row)}
                            disabled={Boolean(actionById[row.id]) || (row.verified_mobile && row.verified_location)}
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
                            onClick={() => void convertToLead(row)}
                            disabled={Boolean(actionById[row.id]) || Boolean(row.converted_to_lead_id)}
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
      </div>
    </AppLayout>
  );
}
