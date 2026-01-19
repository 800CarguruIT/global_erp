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

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Car Details</h1>
            <p className="text-sm text-muted-foreground">Standalone car; link to customers later.</p>
          </div>
          <Link href={companyId ? `/company/${companyId}/cars` : "#"} className="text-sm text-primary hover:underline">
            Back to cars
          </Link>
        </div>

        {error && <div className="text-sm text-destructive">{error}</div>}

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold">Car</div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {loading && <span>Loading...</span>}
                  {!loading && companyId && carId && (
                    <Link href={`/company/${companyId}/cars/${carId}/edit`} className="text-primary hover:underline">
                      Edit car
                    </Link>
                  )}
                  {!loading && car?.is_active !== false && companyId && carId && (
                    <button
                      type="button"
                      className="text-destructive underline"
                      onClick={async () => {
                        if (!confirm("Archive this car? It can be reactivated later.")) return;
                        await fetch(`/api/cars/${carId}?companyId=${companyId}`, { method: "DELETE" });
                        window.location.href = `/company/${companyId}/cars`;
                      }}
                    >
                      Archive
                    </button>
                  )}
                  {!loading && car?.is_active === false && companyId && carId && (
                    <button
                      type="button"
                      className="text-primary underline"
                      onClick={async () => {
                        await fetch(`/api/cars/${carId}?companyId=${companyId}&scope=company`, {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ is_active: true }),
                        });
                        window.location.reload();
                      }}
                    >
                      Unarchive
                    </button>
                  )}
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Plate" value={car?.plate_number ?? "—"} />
                <Field label="VIN" value={car?.vin ?? "—"} />
                <Field label="Make / Model" value={[car?.make, car?.model].filter(Boolean).join(" ") || "—"} />
                <Field label="Year" value={car?.model_year ?? "—"} />
                <Field label="Tyre Front" value={car?.tyre_size_front ?? "—"} />
                <Field label="Tyre Rear" value={car?.tyre_size_back ?? "—"} />
                <Field label="Registration Expiry" value={car?.registration_expiry ?? "—"} />
                <Field label="Mileage" value={car?.mileage ?? "—"} />
                <Field label="Code" value={car?.code ?? "—"} />
              </div>
              <div>
                <div className={labelClass}>Notes</div>
                <div className="text-sm">{car?.notes ?? "—"}</div>
              </div>
            </Card>
            <Card className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold">History</div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {(["leads", "inspections", "estimates", "invoices"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      className={`rounded-md border px-3 py-1 ${historyTab === tab ? "border-primary text-primary" : "hover:border-primary"}`}
                      onClick={() => setHistoryTab(tab)}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              {historyLoading && <div className="text-sm text-muted-foreground">Loading history...</div>}
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
                    const meta = [customer, phone, division && `Type: ${division}`].filter(Boolean).join(" • ");
                    return (
                      <HistoryRow
                        key={item.id}
                        href={href}
                        title={item.leadStage || item.status || "Lead"}
                        subtitle={meta}
                      />
                    );
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
            <Card className="space-y-3">
              <div className="text-lg font-semibold">Linked Customers</div>
              {uniqueCustomers.length > 0 ? (
                <div className="space-y-2 text-sm">
                  {uniqueCustomers.map((c: any) => {
                    const customerId = c.customer?.id || c.customer_id;
                    const href = companyId && customerId ? `/company/${companyId}/customers/${customerId}` : null;
                    const body = (
                      <>
                        <div className="font-medium">{c.customer?.name ?? "Customer"}</div>
                        <div className="text-xs text-muted-foreground">{c.customer?.phone ?? "—"}</div>
                      </>
                    );
                    return href ? (
                      <Link key={customerId ?? Math.random()} href={href} className="block rounded-md border px-3 py-2">
                        {body}
                      </Link>
                    ) : (
                      <div key={customerId ?? Math.random()} className="rounded-md border px-3 py-2">
                        {body}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Not linked to any customer yet.</div>
              )}
              {companyId && (
                <Link href={`/company/${companyId}/customers`} className="text-xs text-primary hover:underline">
                  Link via customer profile
                </Link>
              )}
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="text-sm">{value}</div>
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
    <div className="space-y-2">
      <div className="text-sm font-semibold">{title}</div>
      {items.length === 0 && <div className="text-xs text-muted-foreground">{emptyLabel}</div>}
      {items.length > 0 && <div className="space-y-2">{items.map(renderItem)}</div>}
    </div>
  );
}

function HistoryRow({ title, subtitle, href }: { title: string; subtitle?: string; href?: string | null }) {
  const content = (
    <div className="rounded-md border px-3 py-2 text-sm hover:border-primary">
      <div className="font-medium truncate">{title}</div>
      {subtitle && <div className="text-xs text-muted-foreground truncate">{subtitle}</div>}
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
