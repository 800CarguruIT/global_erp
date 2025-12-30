"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppLayout, Card } from "@repo/ui";
import { CarMakeModelSelect } from "@repo/ui/components/common/CarMakeModelSelect";
import { PlateInput, PlateValue } from "@repo/ui/components/common/PlateInput";
import { FileUploader } from "@repo/ui";

type Params = {
  params:
    | { companyId: string; customerId: string }
    | Promise<{ companyId: string; customerId: string }>;
};

type CustomerCarLink = {
  car: any;
  link: any;
};

type HistoryItem = { id: string; carId?: string | null; customerId?: string | null; [key: string]: any };

const EMPTY_CAR_FORM = {
  carMake: "",
  carModel: "",
  carYear: "",
  plateCountry: "AE",
  plateLocationMode: undefined as PlateValue["locationMode"],
  plateState: "",
  plateCity: "",
  plateCode: "",
  plateNumber: "",
  vinNumber: "",
  vinPhotoFileId: "",
  tyreSizeFront: "",
  tyreSizeBack: "",
  registrationExpiry: "",
  registrationCardFileId: "",
  mileage: "",
  relationType: "owner" as "owner" | "driver" | "other",
};

export default function CustomerDetailPage({ params }: Params) {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [linkedCars, setLinkedCars] = useState<CustomerCarLink[]>([]);
  const [historicalCars, setHistoricalCars] = useState<CustomerCarLink[]>([]);
  const [selectedCarId, setSelectedCarId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState({
    leads: [] as HistoryItem[],
    inspections: [] as HistoryItem[],
    estimates: [] as HistoryItem[],
    invoices: [] as HistoryItem[],
  });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [addCarOpen, setAddCarOpen] = useState(false);
  const [newCar, setNewCar] = useState(EMPTY_CAR_FORM);
  const [savingCar, setSavingCar] = useState(false);
  const [existingCars, setExistingCars] = useState<any[]>([]);
  const [existingCarSearch, setExistingCarSearch] = useState("");
  const [existingCarId, setExistingCarId] = useState<string>("");
  const [existingCarLoading, setExistingCarLoading] = useState(false);
  const [historyTab, setHistoryTab] = useState<"leads" | "inspections" | "estimates" | "invoices">("leads");

  useEffect(() => {
    Promise.resolve(params).then((p) => {
      setCompanyId(p?.companyId ?? null);
      setCustomerId(p?.customerId ?? null);
    });
  }, [params]);

  useEffect(() => {
    if (!companyId || !customerId) return;
    loadCustomer(companyId, customerId);
  }, [companyId, customerId]);

  useEffect(() => {
    if (!companyId) return;
    loadHistory(companyId);
  }, [companyId]);

  useEffect(() => {
    if (!addCarOpen || !companyId) return;
    const controller = new AbortController();
    const load = async () => {
      setExistingCarLoading(true);
      try {
        const term = existingCarSearch.trim();
        const searchParam = term ? `&search=${encodeURIComponent(term)}` : "";
        const res = await fetch(`/api/cars?companyId=${companyId}&scope=company&activeOnly=true${searchParam}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("failed");
        const data = await res.json().catch(() => ({}));
        const list: any[] = data?.data ?? data ?? [];
        setExistingCars(list);
        if (!existingCarId && list.length === 1) {
          setExistingCarId(list[0].id);
        }
      } catch {
        setExistingCars([]);
      } finally {
        setExistingCarLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [addCarOpen, companyId, existingCarSearch]);

  useEffect(() => {
    if (existingCars.length && !existingCarId) {
      setExistingCarId(existingCars[0].id);
    } else if (existingCarId && !existingCars.find((c) => c.id === existingCarId) && existingCars.length) {
      setExistingCarId(existingCars[0].id);
    }
  }, [existingCars, existingCarId]);

  async function loadCustomer(cId: string, custId: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${custId}?companyId=${cId}`);
      if (!res.ok) throw new Error("Failed to load customer");
      const data = await res.json();
      setCustomer(data);
      const cars: CustomerCarLink[] = data?.cars ?? [];
      const active = cars.filter((c) => c?.link?.is_active !== false && c?.car?.is_active !== false);
      const inactive = cars.filter((c) => c?.link?.is_active === false || c?.car?.is_active === false);
      setLinkedCars(active);
      setHistoricalCars(inactive);
      setSelectedCarId((active[0]?.car?.id as string | undefined) ?? null);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load customer");
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory(cId: string) {
    setHistoryLoading(true);
    try {
      const [leadsRes, inspectionsRes, estimatesRes, invoicesRes] = await Promise.all([
        fetch(`/api/company/${cId}/sales/leads`),
        fetch(`/api/company/${cId}/workshop/inspections`),
        fetch(`/api/company/${cId}/workshop/estimates`),
        fetch(`/api/company/${cId}/workshop/invoices`),
      ]);
      const [leads, inspections, estimates, invoices] = await Promise.all([
        leadsRes.ok ? leadsRes.json().then((d) => d.data ?? d ?? []) : [],
        inspectionsRes.ok ? inspectionsRes.json().then((d) => d.data ?? d ?? []) : [],
        estimatesRes.ok ? estimatesRes.json().then((d) => d.data ?? d ?? []) : [],
        invoicesRes.ok ? invoicesRes.json().then((d) => d.data ?? d ?? []) : [],
      ]);
      setHistory({
        leads: Array.isArray(leads) ? leads : [],
        inspections: Array.isArray(inspections) ? inspections : [],
        estimates: Array.isArray(estimates) ? estimates : [],
        invoices: Array.isArray(invoices) ? invoices : [],
      });
    } catch {
      // ignore best-effort
    } finally {
      setHistoryLoading(false);
    }
  }

  const filteredHistory = useMemo(() => {
    const filterBy = selectedCarId;
    const custId = customerId;
    function filterList(list: HistoryItem[]) {
      return list.filter((item) => {
        const matchesCustomer = custId ? item.customerId === custId || item.customer_id === custId : true;
        const matchesCar = filterBy ? item.carId === filterBy || item.car_id === filterBy : true;
        return matchesCustomer && matchesCar;
      });
    }
    return {
      leads: filterList(history.leads),
      inspections: filterList(history.inspections),
      estimates: filterList(history.estimates),
      invoices: filterList(history.invoices),
    };
  }, [history, selectedCarId, customerId]);

  async function handleUnlink(linkId: string, carEntry: CustomerCarLink) {
    if (!companyId || !customerId) return;
    const confirmMsg = "Remove this car from the customer?";
    if (!window.confirm(confirmMsg)) return;
    try {
      await fetch(`/api/customers/${customerId}/cars?companyId=${companyId}&linkId=${linkId}`, {
        method: "DELETE",
      });
      setLinkedCars((prev) => prev.filter((c) => c.link?.id !== linkId));
      setHistoricalCars((prev) => [...prev, carEntry]);
      if (selectedCarId === carEntry.car?.id) {
        setSelectedCarId(null);
      }
    } catch (err: any) {
      alert(err?.message ?? "Failed to unlink car");
    }
  }

  async function handleAddCar(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId || !customerId) return;
    setSavingCar(true);
    try {
      const plate = `${newCar.plateCode ?? ""} ${newCar.plateNumber ?? ""}`.trim() || null;
      const payload = {
        relationType: newCar.relationType,
        priority: linkedCars.length + 1,
        isPrimary: linkedCars.length === 0,
        newCar: {
          plateCode: newCar.plateCode || null,
          plateCountry: newCar.plateCountry || null,
          plateState: newCar.plateState || null,
          plateCity: newCar.plateCity || null,
          plateLocationMode: newCar.plateLocationMode || null,
          plateNumber: plate,
          vin: newCar.vinNumber || null,
          make: newCar.carMake || null,
          model: newCar.carModel || null,
          modelYear: newCar.carYear ? Number(newCar.carYear) : null,
          mileage: newCar.mileage ? Number(newCar.mileage) : null,
          tyreSizeFront: newCar.tyreSizeFront || null,
          tyreSizeBack: newCar.tyreSizeBack || null,
          registrationExpiry: newCar.registrationExpiry || null,
          registrationCardFileId: newCar.registrationCardFileId || null,
          notes: null,
        },
      };
      const res = await fetch(`/api/customers/${customerId}/cars?companyId=${companyId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to add car");
      }
      setNewCar(EMPTY_CAR_FORM);
      setAddCarOpen(false);
      await loadCustomer(companyId, customerId);
    } catch (err: any) {
      alert(err?.message ?? "Failed to add car");
    } finally {
      setSavingCar(false);
    }
  }

  const selectedCarLabel =
    linkedCars.find((c) => c.car?.id === selectedCarId)?.car?.plate_number ??
    linkedCars.find((c) => c.car?.id === selectedCarId)?.car?.plateNumber ??
    "All cars";

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Customer Details</h1>
            <p className="text-sm text-muted-foreground">Manage customer, linked cars, and history.</p>
          </div>
          <Link
            href={companyId ? `/company/${companyId}/customers` : "#"}
            className="text-sm text-primary hover:underline"
          >
            Back to customers
          </Link>
        </div>

        {error && <div className="text-sm text-destructive">{error}</div>}

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold">Customer</div>
                {loading && <div className="text-xs text-muted-foreground">Loading...</div>}
                {!loading && companyId && customerId && (
                  <>
                    {customer?.is_active !== false ? (
                      <button
                        type="button"
                        className="text-xs text-destructive underline"
                        onClick={async () => {
                          const confirmMsg = "Archive this customer? They can be re-activated later.";
                          if (!window.confirm(confirmMsg)) return;
                          await fetch(`/api/customers/${customerId}?companyId=${companyId}`, { method: "DELETE" });
                          window.location.href = `/company/${companyId}/customers`;
                        }}
                      >
                        Archive
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="text-xs text-primary underline"
                        onClick={async () => {
                          await fetch(`/api/customers/${customerId}?companyId=${companyId}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ scope: "company", companyId, is_active: true }),
                          });
                          await loadCustomer(companyId, customerId);
                        }}
                      >
                        Unarchive
                      </button>
                    )}
                  </>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Name" value={customer?.name ?? "—"} />
                <Field label="Email" value={customer?.email ?? "—"} />
                <Field label="Phone" value={customer?.phone ?? "—"} />
                <Field label="WhatsApp" value={customer?.whatsapp_phone ?? customer?.phone ?? "—"} />
                <Field label="Code" value={customer?.code ?? "—"} />
                <Field label="Type" value={customer?.customer_type ?? "—"} />
                <Field label="Address" value={customer?.address ?? "—"} className="md:col-span-2" />
              </div>
            </Card>

            <Card className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold">History</div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Filter</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={`rounded-md border px-2 py-1 ${selectedCarId ? "hover:border-primary" : "border-primary text-primary"}`}
                      onClick={() => setSelectedCarId(null)}
                    >
                      All cars
                    </button>
                    {linkedCars.map((c) => (
                      <button
                        key={c.car?.id}
                        type="button"
                        className={`rounded-md border px-2 py-1 text-xs ${
                          selectedCarId === c.car?.id ? "border-primary text-primary" : "hover:border-primary"
                        }`}
                        onClick={() => setSelectedCarId(c.car?.id ?? null)}
                      >
                        {c.car?.plate_number || c.car?.plateNumber || c.car?.vin || "Car"}
                      </button>
                    ))}
                    {historicalCars.map((c) => (
                      <button
                        key={c.car?.id ?? c.link?.id}
                        type="button"
                        className={`rounded-md border px-2 py-1 text-xs ${
                          selectedCarId === c.car?.id ? "border-primary text-primary" : "hover:border-primary"
                        }`}
                        onClick={() => setSelectedCarId(c.car?.id ?? null)}
                      >
                        {(c.car?.plate_number || c.car?.vin || "Historical car") + " (historic)"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {historyLoading && <div className="text-sm text-muted-foreground">Loading history...</div>}
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
              {historyTab === "leads" && (
                <HistorySection
                  title="Leads"
                  items={filteredHistory.leads}
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
                  items={filteredHistory.inspections}
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
                  items={filteredHistory.estimates}
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
                  items={filteredHistory.invoices}
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
              <div className="text-lg font-semibold">Linked Cars</div>
              {linkedCars.length === 0 && <div className="text-sm text-muted-foreground">No cars linked yet.</div>}
              <div className="space-y-2">
                {linkedCars.map((c) => (
                  <div
                    key={c.link?.id ?? c.car?.id}
                    className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
                      selectedCarId === c.car?.id ? "border-primary text-primary" : ""
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{c.car?.plate_number || c.car?.plateNumber || "Car"}</span>
                      <span className="text-xs text-muted-foreground">
                        {[c.car?.make, c.car?.model, c.car?.model_year].filter(Boolean).join(" ")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => setSelectedCarId(c.car?.id ?? null)}
                      >
                        Select
                      </button>
                      <button
                        type="button"
                        className="text-xs text-destructive hover:underline"
                        onClick={() => c.link?.id && handleUnlink(c.link.id, c)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {historicalCars.length > 0 && (
              <Card className="space-y-3">
                <div className="text-lg font-semibold">Historical Cars</div>
                <div className="space-y-2">
                  {historicalCars.map((c) => (
                    <button
                      key={c.link?.id ?? c.car?.id ?? Math.random()}
                      type="button"
                      className="w-full rounded-md border px-3 py-2 text-left text-sm hover:border-primary"
                      onClick={() => setSelectedCarId(c.car?.id ?? null)}
                    >
                      <div className="font-medium truncate">{c.car?.plate_number || c.car?.vin || "Car"}</div>
                      <div className="text-xs text-muted-foreground">
                        {[c.car?.make, c.car?.model, c.car?.model_year].filter(Boolean).join(" ")}
                      </div>
                    </button>
                  ))}
                </div>
              </Card>
            )}

            <Card className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold">Add / Link Car</div>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => setAddCarOpen((v) => !v)}
                >
                  {addCarOpen ? "Hide" : "Add / Link"}
                </button>
              </div>
              {addCarOpen && (
                <form className="space-y-3" onSubmit={handleAddCar}>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">Link existing car</label>
                    <input
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      placeholder="Search plate, VIN, make or model"
                      value={existingCarSearch}
                      onChange={(e) => {
                        setExistingCarSearch(e.target.value);
                        setExistingCarId("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                        }
                      }}
                    />
                    <select
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      size={4}
                      value={existingCarId}
                      onChange={(e) => setExistingCarId(e.target.value)}
                    >
                      {existingCars
                        .slice(0, 30)
                        .map((c) => {
                          // allow numeric search to match plates without prefix (e.g., 42001 vs "I 42001")
                          const displayPlate = (c.plate_number ?? "").trim();
                          const display =
                            displayPlate ||
                            (c.vin ?? "").trim() ||
                            `${c.make ?? ""} ${c.model ?? ""}`.trim() ||
                            c.id;
                          return (
                            <option key={c.id} value={c.id}>
                              {display}
                            </option>
                          );
                        })}
                    </select>
                    {existingCarLoading && <div className="text-xs text-muted-foreground">Searching...</div>}
                    <button
                      type="button"
                      className="w-full rounded-md border px-3 py-2 text-sm hover:border-primary disabled:opacity-60"
                      disabled={!existingCarId || !companyId || existingCarLoading}
                      onClick={async () => {
                        if (!existingCarId || !companyId || !customerId) return;
                        try {
                          const payload = {
                            relationType: "owner",
                            priority: linkedCars.length + 1,
                            isPrimary: linkedCars.length === 0,
                            existingCarId,
                          };
                          const resp = await fetch(`/api/customers/${customerId}/cars?companyId=${companyId}`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(payload),
                          });
                          if (!resp.ok) throw new Error("Failed to link car");
                          setExistingCarId("");
                          setExistingCarSearch("");
                          await loadCustomer(companyId, customerId);
                        } catch (err: any) {
                          alert(err?.message ?? "Failed to link car");
                        }
                      }}
                    >
                      Link selected car
                    </button>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">Relation</label>
                    <select
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={newCar.relationType}
                      onChange={(e) =>
                        setNewCar((prev) => ({ ...prev, relationType: e.target.value as "owner" | "driver" | "other" }))
                      }
                    >
                      <option value="owner">Owner</option>
                      <option value="driver">Driver</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <CarMakeModelSelect
                    value={{
                      make: newCar.carMake,
                      model: newCar.carModel,
                      year: newCar.carYear ? Number(newCar.carYear) : undefined,
                    }}
                    onChange={(v) =>
                      setNewCar((prev) => ({
                        ...prev,
                        carMake: v.make,
                        carModel: v.model ?? "",
                        carYear: v.year ? String(v.year) : "",
                      }))
                    }
                    minYear={1900}
                  />
                  <PlateInput
                    value={{
                      country: newCar.plateCountry,
                      locationMode: newCar.plateLocationMode,
                      state: newCar.plateState,
                      city: newCar.plateCity,
                      series: newCar.plateCode,
                      number: newCar.plateNumber,
                    }}
                    onChange={(v) =>
                      setNewCar((prev) => ({
                        ...prev,
                        plateCountry: v.country,
                        plateLocationMode: v.locationMode,
                        plateState: v.state ?? "",
                        plateCity: v.city ?? "",
                        plateCode: v.series ?? "",
                        plateNumber: v.number ?? "",
                      }))
                    }
                  />
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">VIN</label>
                    <input
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={newCar.vinNumber}
                      onChange={(e) => setNewCar((prev) => ({ ...prev, vinNumber: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">Tire Size (Front)</label>
                    <input
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={newCar.tyreSizeFront}
                      onChange={(e) => setNewCar((prev) => ({ ...prev, tyreSizeFront: e.target.value }))}
                      placeholder="e.g. 235/55R18"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">Tire Size (Rear)</label>
                    <input
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={newCar.tyreSizeBack}
                      onChange={(e) => setNewCar((prev) => ({ ...prev, tyreSizeBack: e.target.value }))}
                      placeholder="e.g. 255/50R18"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">Registration Expiry</label>
                    <input
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      type="date"
                      value={newCar.registrationExpiry}
                      onChange={(e) => setNewCar((prev) => ({ ...prev, registrationExpiry: e.target.value }))}
                    />
                  </div>
                  <FileUploader
                    label="Registration Card Attachment"
                    value={newCar.registrationCardFileId}
                    onChange={(id) => setNewCar((prev) => ({ ...prev, registrationCardFileId: id ?? "" }))}
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                      disabled={savingCar}
                    >
                      {savingCar ? "Saving..." : "Save Car"}
                    </button>
                    <button
                      type="button"
                      className="rounded-md border px-4 py-2 text-sm"
                      onClick={() => setAddCarOpen(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function Field({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
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
  items: HistoryItem[];
  emptyLabel: string;
  renderItem: (item: HistoryItem) => React.ReactNode;
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
