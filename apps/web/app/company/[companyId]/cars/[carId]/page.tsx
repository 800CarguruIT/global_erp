"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppLayout, Card } from "@repo/ui";

type Params = { params: { companyId: string; carId: string } | Promise<{ companyId: string; carId: string }> };

export default function CarDetailPage({ params }: Params) {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [carId, setCarId] = useState<string | null>(null);
  const [car, setCar] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState({
    leads: [] as any[],
    inspections: [] as any[],
    estimates: [] as any[],
    invoices: [] as any[],
  });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTab, setHistoryTab] = useState<"leads" | "inspections" | "estimates" | "invoices">("leads");
  const [statusModal, setStatusModal] = useState<"archive" | "unarchive" | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);

  useEffect(() => {
    Promise.resolve(params).then((p) => {
      setCompanyId(p?.companyId ?? null);
      setCarId(p?.carId ?? null);
    });
  }, [params]);

  useEffect(() => {
    if (!companyId || !carId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/cars/${carId}?companyId=${companyId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to load car"))))
      .then((data) => setCar(data))
      .catch((err: any) => setError(err?.message ?? "Failed to load car"))
      .finally(() => setLoading(false));
  }, [companyId, carId]);

  useEffect(() => {
    if (!companyId || !carId) return;
    setHistoryLoading(true);
    Promise.all([
      fetch(`/api/company/${companyId}/sales/leads`).then((r) => (r.ok ? r.json() : { data: [] })),
      fetch(`/api/company/${companyId}/workshop/inspections`).then((r) => (r.ok ? r.json() : { data: [] })),
      fetch(`/api/company/${companyId}/workshop/estimates`).then((r) => (r.ok ? r.json() : { data: [] })),
      fetch(`/api/company/${companyId}/workshop/invoices`).then((r) => (r.ok ? r.json() : { data: [] })),
    ])
      .then(([leads, inspections, estimates, invoices]) => {
        setHistory({
          leads: (leads.data ?? []).filter((l: any) => l.carId === carId || l.car_id === carId),
          inspections: (inspections.data ?? []).filter((i: any) => i.carId === carId || i.car_id === carId),
          estimates: (estimates.data ?? []).filter((e: any) => e.carId === carId || e.car_id === carId),
          invoices: (invoices.data ?? []).filter((inv: any) => inv.carId === carId || inv.car_id === carId),
        });
      })
      .catch(() => {
        setHistory({ leads: [], inspections: [], estimates: [], invoices: [] });
      })
      .finally(() => setHistoryLoading(false));
  }, [companyId, carId]);

  const labelClass = "text-xs font-semibold text-muted-foreground";
  const uniqueCustomers = useMemo(() => {
    const seen = new Set<string>();
    const list = Array.isArray(car?.customers) ? car.customers : [];
    return list.filter((entry: any) => {
      const id = entry?.customer?.id || entry?.customer_id;
      if (!id) return true;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [car?.customers]);

  const historyCounts = useMemo(
    () => ({
      leads: history.leads.length,
      inspections: history.inspections.length,
      estimates: history.estimates.length,
      invoices: history.invoices.length,
    }),
    [history]
  );

  async function confirmStatusChange() {
    if (!companyId || !carId || !statusModal) return;
    setStatusSaving(true);
    setError(null);
    try {
      if (statusModal === "archive") {
        const res = await fetch(`/api/cars/${carId}?companyId=${companyId}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to archive car");
        window.location.href = `/company/${companyId}/cars`;
        return;
      }
      const res = await fetch(`/api/cars/${carId}?companyId=${companyId}&scope=company`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "company", companyId, is_active: true }),
      });
      if (!res.ok) throw new Error("Failed to unarchive car");
      window.location.reload();
    } catch (err: any) {
      setError(err?.message ?? "Failed to update car status");
    } finally {
      setStatusSaving(false);
      setStatusModal(null);
    }
  }

  const statusLabel = car?.is_active === false ? "Inactive" : "Active";
  const makeModel = [car?.make, car?.model].filter(Boolean).join(" ") || "-";
  const plateNumber = car?.plate_number ?? "-";

  return (
    <AppLayout>
      <div className="space-y-5 py-4">
        <div className="rounded-2xl border border-border/30 bg-gradient-to-r from-background to-muted/20 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Car Profile</div>
              <h1 className="text-xl font-semibold sm:text-2xl">{plateNumber}</h1>
              <p className="text-sm text-muted-foreground">{makeModel}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 font-semibold ${
                    car?.is_active === false ? "bg-amber-500/15 text-amber-600" : "bg-emerald-500/15 text-emerald-600"
                  }`}
                >
                  {statusLabel}
                </span>
                <span className="inline-flex rounded-full bg-muted/40 px-2.5 py-1 text-muted-foreground">
                  Code: {car?.code ?? "-"}
                </span>
                <span className="inline-flex rounded-full bg-muted/40 px-2.5 py-1 text-muted-foreground">
                  VIN: {car?.vin ?? "-"}
                </span>
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
              <Link
                href={companyId ? `/company/${companyId}/cars` : "#"}
                className="inline-flex min-h-[40px] w-full items-center justify-center rounded-md border border-border/40 bg-background px-3 text-sm font-medium text-foreground transition hover:bg-muted/40 sm:w-auto"
              >
                Back to cars
              </Link>
              {companyId && carId && !loading && (
                <Link
                  href={`/company/${companyId}/cars/${carId}/edit`}
                  className="inline-flex min-h-[40px] w-full items-center justify-center rounded-md border border-primary/30 bg-primary/10 px-3 text-sm font-medium text-primary transition hover:bg-primary/15 sm:w-auto"
                >
                  Edit car
                </Link>
              )}
            </div>
          </div>
        </div>

        {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card className="space-y-4 rounded-2xl border border-border/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-lg font-semibold">Car</div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {loading && <span>Loading...</span>}
                  {!loading && car?.is_active !== false && companyId && carId && (
                    <button
                      type="button"
                      className="rounded-md border border-red-400/40 px-2.5 py-1 font-semibold text-red-400 transition hover:bg-red-500/10"
                      onClick={() => setStatusModal("archive")}
                    >
                      Archive
                    </button>
                  )}
                  {!loading && car?.is_active === false && companyId && carId && (
                    <button
                      type="button"
                      className="rounded-md border border-emerald-400/40 px-2.5 py-1 font-semibold text-emerald-400 transition hover:bg-emerald-500/10"
                      onClick={() => setStatusModal("unarchive")}
                    >
                      Unarchive
                    </button>
                  )}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Plate" value={car?.plate_number ?? "-"} />
                <Field label="VIN" value={car?.vin ?? "-"} />
                <Field label="Make / Model" value={[car?.make, car?.model].filter(Boolean).join(" ") || "-"} />
                <Field label="Year" value={car?.model_year ?? "-"} />
                <Field label="Tyre Front" value={car?.tyre_size_front ?? "-"} />
                <Field label="Tyre Rear" value={car?.tyre_size_back ?? "-"} />
                <Field label="Registration Expiry" value={car?.registration_expiry ?? "-"} />
                <Field label="Mileage" value={car?.mileage ?? "-"} />
                <Field label="Code" value={car?.code ?? "-"} />
              </div>
              <div className="rounded-lg bg-muted/20 p-3">
                <div className={labelClass}>Notes</div>
                <div className="text-sm">{car?.notes ?? "-"}</div>
              </div>
            </Card>

            <Card className="space-y-4 rounded-2xl border border-border/30 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-lg font-semibold">History</div>
                <div className="inline-flex w-full flex-wrap gap-1 rounded-lg bg-muted/30 p-1 text-xs sm:w-auto">
                  {(["leads", "inspections", "estimates", "invoices"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      className={`rounded-md px-3 py-1.5 font-medium transition ${
                        historyTab === tab
                          ? "border border-border/40 bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted/50"
                      }`}
                      onClick={() => setHistoryTab(tab)}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)} ({historyCounts[tab]})
                    </button>
                  ))}
                </div>
              </div>
              {historyLoading && <div className="rounded-lg bg-muted/20 px-3 py-2 text-sm text-muted-foreground">Loading history...</div>}
              {!historyLoading && (
                <div className="rounded-lg bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  Showing {historyCounts[historyTab]} {historyTab}
                </div>
              )}
              {historyTab === "leads" && (
                <HistorySection
                  title="Leads"
                  items={history.leads}
                  emptyLabel="No leads"
                  renderItem={(item) => {
                    const href = companyId ? `/company/${companyId}/leads/${item.id}` : null;
                    const customer = item.customerName ?? item.customer_name ?? "Customer";
                    const phone = item.customerPhone ?? item.customer_phone ?? "";
                    const division = item.leadType ?? item.lead_type ?? "";
                    const meta = [customer, phone, division && `Type: ${division}`].filter(Boolean).join(" | ");
                    return <HistoryRow key={item.id} href={href} title={item.leadStage || item.status || "Lead"} subtitle={meta} />;
                  }}
                />
              )}
              {historyTab === "inspections" && (
                <HistorySection
                  title="Inspections"
                  items={history.inspections}
                  emptyLabel="No inspections"
                  renderItem={(item) => (
                    <HistoryRow
                      key={item.id}
                      title={item.status || "Inspection"}
                      subtitle={`Car: ${item.carPlateNumber ?? item.car_id ?? item.carId ?? "-"}`}
                    />
                  )}
                />
              )}
              {historyTab === "estimates" && (
                <HistorySection
                  title="Estimates"
                  items={history.estimates}
                  emptyLabel="No estimates"
                  renderItem={(item) => (
                    <HistoryRow
                      key={item.id}
                      title={item.status || "Estimate"}
                      subtitle={`Car: ${item.carPlateNumber ?? item.car_id ?? item.carId ?? "-"}`}
                    />
                  )}
                />
              )}
              {historyTab === "invoices" && (
                <HistorySection
                  title="Invoices"
                  items={history.invoices}
                  emptyLabel="No invoices"
                  renderItem={(item) => (
                    <HistoryRow
                      key={item.id}
                      title={item.status || "Invoice"}
                      subtitle={`Car: ${item.carPlateNumber ?? item.car_id ?? item.carId ?? "-"}`}
                    />
                  )}
                />
              )}
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="space-y-3 rounded-2xl border border-border/30 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-lg font-semibold">Linked Customers</div>
                <span className="rounded-full bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground">{uniqueCustomers.length}</span>
              </div>
              {uniqueCustomers.length > 0 ? (
                <div className="space-y-2 text-sm">
                  {uniqueCustomers.map((c: any) => {
                    const customerId = c.customer?.id || c.customer_id;
                    const href = companyId && customerId ? `/company/${companyId}/customers/${customerId}` : null;
                    const body = (
                      <>
                        <div className="font-medium">{c.customer?.name ?? "Customer"}</div>
                        <div className="text-xs text-muted-foreground">{c.customer?.phone ?? "-"}</div>
                      </>
                    );
                    return href ? (
                      <Link key={customerId ?? Math.random()} href={href} className="block rounded-lg border border-border/40 bg-background px-3 py-2 hover:border-primary/50">
                        {body}
                      </Link>
                    ) : (
                      <div key={customerId ?? Math.random()} className="rounded-lg border border-border/40 bg-background px-3 py-2">
                        {body}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg bg-muted/20 px-3 py-2 text-sm text-muted-foreground">Not linked to any customer yet.</div>
              )}
              {companyId && (
                <Link href={`/company/${companyId}/customers`} className="inline-flex min-h-[36px] items-center justify-center rounded-md border border-border/40 px-3 text-xs font-semibold text-primary hover:bg-primary/5">
                  Link via customer profile
                </Link>
              )}
            </Card>
          </div>
        </div>

        {statusModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-md rounded-2xl border border-white/30 bg-slate-950 p-5 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9)]">
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full ${
                    statusModal === "archive" ? "bg-red-500/20 text-red-300" : "bg-emerald-500/20 text-emerald-300"
                  }`}
                >
                  {statusModal === "archive" ? "!" : "+"}
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-semibold text-slate-100">{statusModal === "archive" ? "Archive car?" : "Unarchive car?"}</div>
                  <p className="mt-1 text-sm text-slate-300">
                    {statusModal === "archive"
                      ? "This car will be archived and can be reactivated later."
                      : "This car will become active again and visible in active lists."}
                  </p>
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setStatusModal(null)}
                  className="rounded-md border border-slate-500 bg-slate-100 px-3.5 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmStatusChange}
                  disabled={statusSaving}
                  className={`rounded-md px-3.5 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-60 ${
                    statusModal === "archive" ? "bg-red-600 hover:bg-red-500" : "bg-emerald-600 hover:bg-emerald-500"
                  }`}
                >
                  {statusSaving ? "Updating..." : statusModal === "archive" ? "Archive" : "Unarchive"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-muted/20 p-3">
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function HistorySection({
  title,
  items,
  emptyLabel,
  renderItem,
}: {
  title: string;
  items: any[];
  emptyLabel: string;
  renderItem: (item: any) => React.ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <div className="text-sm font-semibold">{title}</div>
      {items.length === 0 && <div className="rounded-lg bg-muted/20 px-3 py-2 text-xs text-muted-foreground">{emptyLabel}</div>}
      {items.length > 0 && <div className="space-y-2">{items.map(renderItem)}</div>}
    </div>
  );
}

function HistoryRow({ title, subtitle, href }: { title: string; subtitle?: string; href?: string | null }) {
  const content = (
    <div className="rounded-lg border border-border/40 bg-background px-3 py-2.5 text-sm transition hover:border-primary/50 hover:bg-muted/10">
      <div className="font-medium truncate">{title}</div>
      {subtitle && <div className="mt-0.5 text-xs text-muted-foreground truncate">{subtitle}</div>}
    </div>
  );
  if (href) {
    return (
      <a href={href} className="block">
        {content}
      </a>
    );
  }
  return content;
}
