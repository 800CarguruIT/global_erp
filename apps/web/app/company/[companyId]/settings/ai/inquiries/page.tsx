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
  lead_outcome: string | null;
  outcome_reason: string | null;
  created_at: string;
  updated_at: string;
};

export default function CompanyAiInquiriesPage({ params }: Params) {
  const { theme } = useTheme();
  const [companyId, setCompanyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [items, setItems] = useState<InquiryRow[]>([]);

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
                    <th className="py-2 pr-3">To</th>
                    <th className="py-2 pr-3">Inquiry</th>
                    <th className="py-2 pr-3">Conversion</th>
                    <th className="py-2 pr-3">Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className="border-b border-white/5">
                      <td className="py-2 pr-3">{new Date(row.created_at).toLocaleString()}</td>
                      <td className="py-2 pr-3">{row.provider_call_id}</td>
                      <td className="py-2 pr-3">{row.from_number ?? "-"}</td>
                      <td className="py-2 pr-3">{row.to_number ?? "-"}</td>
                      <td className="py-2 pr-3">{row.inquiry_status}</td>
                      <td className="py-2 pr-3">
                        {row.conversion_status}
                        {row.converted_to_lead_id ? ` (${row.converted_to_lead_id})` : ""}
                      </td>
                      <td className="py-2 pr-3">{row.lead_outcome ?? "-"}</td>
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
