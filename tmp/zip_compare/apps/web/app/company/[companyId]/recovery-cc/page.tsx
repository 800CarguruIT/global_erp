"use client";

import { AppLayout } from "@repo/ui";
import { useCallback, useEffect, useMemo, useState } from "react";

type Params = { params: { companyId: string } | Promise<{ companyId: string }> };
type TabKey = "pre_pickup" | "work_progress" | "happiness_check";

type Row = {
  id: string;
  leadId: string;
  relatedLeadId: string | null;
  appointmentAt: string | null;
  recoveryDriver: string;
  customerDetails: string;
  carDetails: string;
  type: string | null;
  status: string | null;
  stage: string | null;
  pickupLocation: string | null;
  dropoffLocation: string | null;
  formSubmitted: boolean;
  formStatus: "pending" | "submitted" | null;
  formToken: string | null;
  formUrl: string | null;
  callRemarks: string | null;
  bucket: TabKey;
};

export default function RecoveryCcPage({ params }: Params) {
  const [companyId, setCompanyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Record<TabKey, number>>({
    pre_pickup: 0,
    work_progress: 0,
    happiness_check: 0,
  });
  const [tab, setTab] = useState<TabKey>("pre_pickup");
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  useEffect(() => {
    Promise.resolve(params).then((p: any) => {
      setCompanyId(String(p?.companyId ?? "").trim());
    });
  }, [params]);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/company/${companyId}/recovery-requests/cc`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(json?.error ?? "Failed to load Recovery CC"));
      setRows(Array.isArray(json?.data) ? json.data : []);
      setCounts({
        pre_pickup: Number(json?.counts?.pre_pickup ?? 0),
        work_progress: Number(json?.counts?.work_progress ?? 0),
        happiness_check: Number(json?.counts?.happiness_check ?? 0),
      });
    } catch (err: any) {
      setError(err?.message ?? "Failed to load Recovery CC");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleRows = useMemo(() => rows.filter((r) => r.bucket === tab), [rows, tab]);

  async function copyFormUrl(row: Row) {
    try {
      let url = row.formUrl;
      if (!url) {
        const res = await fetch(
          `/api/company/${companyId}/recovery-requests/${row.id}/form-link`,
          { cache: "no-store" }
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(String(json?.error ?? "No form URL"));
        url = String(json?.data?.formUrl ?? "");
      }
      if (!url) throw new Error("No form URL");
      const absolute = url.startsWith("http")
        ? url
        : `${window.location.origin}${url}`;
      await navigator.clipboard.writeText(absolute);
      alert("Form URL copied.");
      await load();
    } catch {
      alert("Failed to copy form URL.");
    }
  }

  async function shareForm(row: Row) {
    if (!row.id) return;
    setBusy((prev) => ({ ...prev, [row.id]: true }));
    try {
      const res = await fetch(
        `/api/company/${companyId}/recovery-requests/${row.id}/form-link`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "direct", force: true }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(String(json?.error ?? "Failed to share form"));
        return;
      }
      if (json?.data?.sent) {
        alert("Form shared successfully.");
      } else {
        alert(`Not sent: ${String(json?.data?.skippedReason ?? "already submitted or already sent")}`);
      }
      await load();
    } catch {
      alert("Failed to share form.");
    } finally {
      setBusy((prev) => ({ ...prev, [row.id]: false }));
    }
  }

  return (
    <AppLayout>
      <div className="space-y-4 p-6">
        <div>
          <h1 className="text-2xl font-semibold">Recovery Call Center</h1>
          <p className="text-sm text-muted-foreground">Pre-pickup follow up, work progress, and happiness checks.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTab("pre_pickup")}
            className={`rounded-xl border px-4 py-2 text-sm ${tab === "pre_pickup" ? "border-primary bg-primary/10" : "border-white/20"}`}
          >
            Pre Pickup ({counts.pre_pickup})
          </button>
          <button
            type="button"
            onClick={() => setTab("work_progress")}
            className={`rounded-xl border px-4 py-2 text-sm ${tab === "work_progress" ? "border-primary bg-primary/10" : "border-white/20"}`}
          >
            Work Progress ({counts.work_progress})
          </button>
          <button
            type="button"
            onClick={() => setTab("happiness_check")}
            className={`rounded-xl border px-4 py-2 text-sm ${tab === "happiness_check" ? "border-primary bg-primary/10" : "border-white/20"}`}
          >
            Happiness Check ({counts.happiness_check})
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="ml-auto rounded-xl border border-white/20 px-4 py-2 text-sm"
          >
            Refresh
          </button>
        </div>

        {loading ? <div className="text-sm text-muted-foreground">Loading...</div> : null}
        {error ? <div className="text-sm text-red-300">{error}</div> : null}

        {!loading && !error ? (
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left">
                <tr>
                  <th className="px-3 py-2">Lead ID</th>
                  <th className="px-3 py-2">Related Lead ID</th>
                  <th className="px-3 py-2">Appointment Time</th>
                  <th className="px-3 py-2">Recovery Driver</th>
                  <th className="px-3 py-2">Customer Details</th>
                  <th className="px-3 py-2">Car Details</th>
                  <th className="px-3 py-2">Recovery Stage</th>
                  <th className="px-3 py-2">Form Submitted</th>
                  <th className="px-3 py-2">Call Remarks</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-4 text-center text-muted-foreground">
                      No records.
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row) => (
                    <tr key={row.id} className="border-t border-white/10">
                      <td className="px-3 py-2">
                        {row.leadId ? (
                          <a
                            href={`/company/${companyId}/leads/${row.leadId}`}
                            className="font-mono text-xs text-primary hover:underline"
                          >
                            {row.leadId.slice(0, 8)}
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {row.relatedLeadId ? (
                          <a
                            href={`/company/${companyId}/leads/${row.relatedLeadId}`}
                            className="font-mono text-xs text-primary hover:underline"
                          >
                            {row.relatedLeadId.slice(0, 8)}
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-3 py-2">{row.appointmentAt ? new Date(row.appointmentAt).toLocaleString() : "-"}</td>
                      <td className="px-3 py-2">{row.recoveryDriver}</td>
                      <td className="px-3 py-2">{row.customerDetails}</td>
                      <td className="px-3 py-2">{row.carDetails}</td>
                      <td className="px-3 py-2">{[row.status, row.stage].filter(Boolean).join(" / ") || "-"}</td>
                      <td className="px-3 py-2">{row.formSubmitted ? "Yes" : "No"}</td>
                      <td className="px-3 py-2">{row.callRemarks || "-"}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          <a
                            href={`/company/${companyId}/recovery-requests/${row.id}`}
                            className="rounded-md border border-white/20 px-2 py-1 text-xs"
                          >
                            Open
                          </a>
                          <button
                            type="button"
                            className="rounded-md border border-white/20 px-2 py-1 text-xs"
                            onClick={() => void copyFormUrl(row)}
                          >
                            Copy Form URL
                          </button>
                          {row.formSubmitted && row.formUrl ? (
                            <a
                              href={row.formUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-md border border-emerald-300/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-100"
                            >
                              View Submitted Form
                            </a>
                          ) : null}
                          <button
                            type="button"
                            className="rounded-md border border-white/20 px-2 py-1 text-xs"
                            onClick={() => void shareForm(row)}
                            disabled={busy[row.id]}
                          >
                            {busy[row.id] ? "Sharing..." : "Share Form"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}
