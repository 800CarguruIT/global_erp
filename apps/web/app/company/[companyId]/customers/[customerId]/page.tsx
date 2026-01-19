"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AppLayout, Card, FileUploader, useTheme } from "@repo/ui";

type Params = {
  params:
    | { companyId: string; customerId: string }
    | Promise<{ companyId: string; customerId: string }>;
};

type CustomerCarLink = {
  car: any;
  link: any;
};

type TabId =
  | "leads"
  | "inspections"
  | "estimates"
  | "invoices"
  | "contracts"
  | "followups"
  | "calls";

type WalletTransactionRow = {
  id: string;
  amount: number;
  payment_method?: string | null;
  payment_date?: string | null;
  payment_proof_file_id?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  created_at?: string | null;
};

export default function CustomerDetailPage({ params }: Params) {
  const { theme } = useTheme();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [linkedCars, setLinkedCars] = useState<CustomerCarLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("invoices");
  const [walletTransactions, setWalletTransactions] = useState<WalletTransactionRow[]>([]);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupForm, setTopupForm] = useState({
    amount: "",
    method: "cash",
    paymentDate: "",
    proofFileId: "",
  });
  const [topupSaving, setTopupSaving] = useState(false);
  const [topupError, setTopupError] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [addCarOpen, setAddCarOpen] = useState(false);
  const [addCarForm, setAddCarForm] = useState({
    plateNumber: "",
    make: "",
    model: "",
    modelYear: "",
    bodyType: "Regular",
    isInsurance: false,
  });
  const [addCarSaving, setAddCarSaving] = useState(false);
  const [addCarError, setAddCarError] = useState<string | null>(null);
  const [viewCar, setViewCar] = useState<any | null>(null);
  const [selectedCarId, setSelectedCarId] = useState<string | null>(null);
  const [selectActionOpen, setSelectActionOpen] = useState(false);
  const [selectActionCar, setSelectActionCar] = useState<any | null>(null);
  const [selectActionMode, setSelectActionMode] = useState<"menu" | "appointment">("menu");
  const [selectActionSaving, setSelectActionSaving] = useState(false);
  const [selectActionError, setSelectActionError] = useState<string | null>(null);
  const [appointmentForm, setAppointmentForm] = useState({
    appointmentAt: "",
    type: "walkin",
    recoveryType: "pickup",
    pickupLocation: "",
    dropoffLocation: "",
    remarks: "",
  });
  const [companyDropoffLocation, setCompanyDropoffLocation] = useState("");

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
    if (!companyId || !customerId) return;
    loadWalletTransactions(companyId, customerId);
  }, [companyId, customerId]);

  useEffect(() => {
    if (!companyId) return;
    let active = true;
    async function loadCompanyLocation() {
      try {
        const res = await fetch(`/api/company/${companyId}/profile`, { cache: "no-store" });
        if (!res.ok) return;
        const body = await res.json().catch(() => ({}));
        if (!active) return;
        const data = body?.data ?? {};
        const googleLocation = data.googleLocation ?? "";
        const address = data.address ?? {};
        const addressParts = [
          address.line1,
          address.line2,
          address.city,
          address.stateRegion,
          address.country,
        ].filter(Boolean);
        const fallbackAddress = addressParts.join(", ");
        const location = googleLocation || fallbackAddress;
        if (location) {
          setCompanyDropoffLocation(location);
        }
      } catch {
        // ignore
      }
    }
    loadCompanyLocation();
    return () => {
      active = false;
    };
  }, [companyId]);

  useEffect(() => {
    if (!companyDropoffLocation) return;
    if (appointmentForm.type !== "recovery") return;
    setAppointmentForm((prev) =>
      prev.dropoffLocation ? prev : { ...prev, dropoffLocation: companyDropoffLocation }
    );
  }, [companyDropoffLocation, appointmentForm.type]);

  async function loadCustomer(cId: string, custId: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${custId}?companyId=${cId}`);
      if (!res.ok) throw new Error("Failed to load customer");
      const data = await res.json();
      setCustomer(data);
      setWalletBalance(Number(data?.wallet_amount ?? 0));
      const cars: CustomerCarLink[] = data?.cars ?? [];
      setLinkedCars(cars);
      const primaryLink = cars.find((item) => item?.link?.is_primary);
      setSelectedCarId(primaryLink?.car?.id ?? null);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load customer");
    } finally {
      setLoading(false);
    }
  }

  async function loadWalletTransactions(cId: string, custId: string) {
    setWalletLoading(true);
    setWalletError(null);
    try {
      const res = await fetch(
        `/api/customers/${custId}/wallet/transactions?companyId=${cId}&approvedOnly=false`
      );
      if (!res.ok) throw new Error("Failed to load wallet transactions");
      const data = await res.json().catch(() => ({}));
      setWalletTransactions(Array.isArray(data?.data) ? data.data : []);
    } catch (err: any) {
      setWalletError(err?.message ?? "Failed to load wallet transactions");
    } finally {
      setWalletLoading(false);
    }
  }


  const cards = [
    { label: "Total Invoices", value: "AED 8,240" },
    { label: "Open Leads", value: "12" },
    { label: "Active Contracts", value: "2" },
  ];
  const actions = [
    { label: "Service Request", key: "service_request" },
    { label: "Follow-Up" },
    { label: "Create Contract" },
    { label: "Create Appointment" },
    { label: "Create Complaint" },
  ];
  const tabLabels = [
    { id: "leads", label: "Leads" },
    { id: "inspections", label: "Inspections" },
    { id: "estimates", label: "Estimates" },
    { id: "invoices", label: "Invoices & Transactions" },
    { id: "contracts", label: "Contracts" },
    { id: "followups", label: "Follow Ups" },
    { id: "calls", label: "Call Recordings" },
  ] as const;

  const formatDateTime = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };

  const isRecoveryAppointment = appointmentForm.type === "recovery";
  const recoveryMissing =
    isRecoveryAppointment &&
    (!appointmentForm.pickupLocation.trim() || !companyDropoffLocation.trim());
  const appointmentDisabled = selectActionSaving || !appointmentForm.appointmentAt || recoveryMissing;


  const openProforma = (txn: WalletTransactionRow) => {
    if (!companyId || !customerId) return;
    const url = `/api/customers/${customerId}/wallet/transactions/${txn.id}/proforma?companyId=${companyId}`;
    window.open(url, "_blank", "width=900,height=1000");
  };

  const runCarAction = async (action: "car_in" | "appointment") => {
    if (!companyId || !customerId || !selectActionCar) return;
    setSelectActionSaving(true);
    setSelectActionError(null);
    try {
      const res = await fetch(`/api/customers/${customerId}/cars/select?companyId=${companyId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carId: selectActionCar.id,
          action,
          appointmentAt: action === "appointment" ? appointmentForm.appointmentAt || null : null,
          appointmentType: action === "appointment" ? appointmentForm.type : null,
          recoveryType: action === "appointment" ? appointmentForm.recoveryType : null,
          pickupLocation: action === "appointment" ? appointmentForm.pickupLocation : null,
          dropoffLocation: action === "appointment" ? companyDropoffLocation || null : null,
          remarks: appointmentForm.remarks,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to create lead");
      }
      setSelectActionOpen(false);
      setSelectActionMode("menu");
      setAppointmentForm({
        appointmentAt: "",
        type: "walkin",
        recoveryType: "pickup",
        pickupLocation: "",
        dropoffLocation: "",
        remarks: "",
      });
    } catch (err: any) {
      setSelectActionError(err?.message ?? "Failed to create lead");
    } finally {
      setSelectActionSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">Customer Dashboard</h1>
            <p className={`text-sm ${theme.mutedText}`}>
              Track leads, inspections, invoices, and service history in one place.
            </p>
          </div>
          <Link
            href={companyId ? `/company/${companyId}/customers` : "#"}
            className="text-sm text-primary hover:underline"
          >
            Back to customers
          </Link>
        </div>

        {error && <div className="text-sm text-destructive">{error}</div>}

        <div className="flex flex-wrap items-center gap-2">
          {actions.map((action) => {
            const isServiceRequest = action.key === "service_request";
            const isDisabled = isServiceRequest && !selectedCarId;
            return (
            <button
              key={action.label}
              type="button"
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${
                isDisabled ? "opacity-50 cursor-not-allowed" : `${theme.mutedText} hover:bg-white/10`
              }`}
              disabled={isDisabled}
              onClick={() => {
                if (!isServiceRequest) return;
                if (!selectedCarId) return;
                const car = linkedCars.find((item) => item?.car?.id === selectedCarId)?.car ?? null;
                if (!car) return;
                setSelectActionCar(car);
                setSelectActionMode("menu");
                setSelectActionError(null);
                setSelectActionOpen(true);
              }}
            >
              {action.label}
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[10px]">
                v
              </span>
            </button>
          );
          })}
        </div>

        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-4">
            <Card className={`relative overflow-hidden ${theme.cardBg} ${theme.cardBorder}`}>
              <div className="absolute right-0 top-0 h-16 w-16 translate-x-6 -translate-y-6 rounded-full bg-emerald-500/30" />
              <div className="absolute -left-8 top-20 h-20 w-20 rounded-full bg-amber-500/30" />
              <div className="space-y-4 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 rounded-full bg-white/10 text-2xl flex items-center justify-center">
                    C
                  </div>
                  <div>
                    <div className={`text-sm ${theme.mutedText}`}>Customer</div>
                    <div className="text-lg font-semibold">{customer?.name ?? "Mohammed Mahdy"}</div>
                    <div className="text-xs text-rose-400">Not App User</div>
                  </div>
                </div>
                <div className={`space-y-2 text-sm ${theme.mutedText}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Phone</span>
                    <span>{customer?.phone ?? "+971 54 228 7649"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Email</span>
                    <span>{customer?.email ?? "mohdmahdy94@gmail.com"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Location</span>
                    <span>{customer?.city ?? "Abu Hail"}, {customer?.country ?? "Dubai"}</span>
                  </div>
                </div>
                <div className={`rounded-lg ${theme.cardBorder} ${theme.surfaceSubtle} p-3`}>
                  <div className={`text-xs uppercase tracking-wide ${theme.mutedText}`}>Wallet</div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-xl font-semibold">AED {walletBalance.toFixed(2)}</div>
                    <button
                      type="button"
                      className="rounded-md bg-amber-400 px-3 py-1 text-xs font-semibold text-black"
                      onClick={() => {
                        setTopupError(null);
                        setTopupOpen(true);
                      }}
                    >
                      Topup
                    </button>
                  </div>
                </div>
              </div>
            </Card>

            <Card className={`space-y-3 ${theme.cardBg} ${theme.cardBorder}`}>
              <div className="flex items-center justify-between px-4 pt-4">
                <div className="text-sm font-semibold">Customer Cars</div>
                <button
                  type="button"
                  onClick={() => {
                    setAddCarError(null);
                    setAddCarOpen(true);
                  }}
                  className={`rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-white/10`}
                >
                  Add New Car
                </button>
              </div>
              <div className="space-y-2 px-4 pb-4">
                {linkedCars.length === 0 ? (
                  <div className={`rounded-md ${theme.cardBorder} ${theme.surfaceSubtle} px-3 py-2 text-sm ${theme.mutedText}`}>
                    No cars linked yet.
                  </div>
                ) : (
                  linkedCars.map((c) => {
                    const car = c.car ?? {};
                    const plate = car.plate_number || car.plateNumber || "N/A";
                    const label = [car.make, car.model, car.model_year].filter(Boolean).join(" ") || "Car";
                    const type = car.body_type || "Regular";
                    const carId = car.id ?? c.link?.id ?? "";
                    const isSelected = carId && selectedCarId === carId;
                    return (
                      <div
                        key={carId || `${plate}-${label}`}
                        className={`rounded-md px-3 py-2 text-sm ${theme.cardBorder} ${theme.surfaceSubtle} ${
                          isSelected ? "ring-1 ring-blue-500/70" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-semibold">{plate}</div>
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/70">
                            {type}
                          </span>
                        </div>
                        <div className={`text-xs ${theme.mutedText}`}>{label}</div>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            className="rounded-md bg-amber-400 px-2 py-1 text-[10px] font-semibold text-black"
                            onClick={() => setViewCar(car)}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className={`rounded-md px-2 py-1 text-[10px] font-semibold ${
                              isSelected ? "bg-blue-600 text-white" : "bg-slate-700/80 text-white"
                            }`}
                            onClick={async () => {
                              if (!carId || !companyId || !customerId) return;
                              if (isSelected) {
                                setSelectActionCar(car);
                                setSelectActionMode("menu");
                                setSelectActionError(null);
                                setSelectActionOpen(true);
                                return;
                              }
                              const linkId = c.link?.id;
                              if (!linkId) return;
                              setSelectedCarId(carId);
                              try {
                                const res = await fetch(
                                  `/api/customers/${customerId}/cars?companyId=${companyId}&linkId=${linkId}`,
                                  {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ isPrimary: true }),
                                  }
                                );
                                if (!res.ok) {
                                  throw new Error("Failed to update car selection");
                                }
                                await loadCustomer(companyId, customerId);
                                setSelectActionCar(car);
                                setSelectActionMode("menu");
                                setSelectActionError(null);
                                setSelectActionOpen(true);
                              } catch (err) {
                                setSelectedCarId(null);
                              }
                            }}
                          >
                            {isSelected ? "Selected" : "Select"}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>

            <Card className={`space-y-3 ${theme.cardBg} ${theme.cardBorder}`}>
              <div className="px-4 pt-4 text-sm font-semibold">Customer Spending</div>
              <div className="space-y-2 px-4 pb-4">
                {cards.map((card) => (
                  <div key={card.label} className={`rounded-md ${theme.cardBorder} ${theme.surfaceSubtle} px-3 py-2 text-sm`}>
                    <div className={`text-xs ${theme.mutedText}`}>{card.label}</div>
                    <div className="text-lg font-semibold">{card.value}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className={`p-4 ${theme.cardBg} ${theme.cardBorder}`}>
              <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
                {tabLabels.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide ${
                      activeTab === tab.id
                        ? "bg-blue-600 text-white"
                        : "text-white/60 hover:bg-white/10"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === "invoices" && (
                <div className="space-y-4 pt-4">
                  <SectionCard title="Customer Invoices">
                    <DataTable
                      headers={[
                        "Invoice ID",
                        "Invoice Date",
                        "Plate#",
                        "Sales Agent",
                        "Technician",
                        "Total Amount",
                        "Status",
                        "Mode",
                        "Print",
                        "Payment Date",
                      ]}
                      rows={dummyInvoices}
                    />
                  </SectionCard>
                  <SectionCard title="Sale Returns">
                    <DataTable
                      headers={[
                        "Txn ID",
                        "Against Invoice#",
                        "Payment Amount",
                        "Added By",
                        "Remarks",
                        "Date",
                      ]}
                      rows={dummyReturns}
                    />
                  </SectionCard>
                  <SectionCard title="Customer Transactions">
                    <DataTable
                      headers={[
                        "Txn ID",
                        "Payment Mode",
                        "Payment Proof",
                        "Payment Amount",
                        "Collect By",
                        "Proforma",
                        "Status",
                        "Payment Date",
                      ]}
                      rows={
                        walletLoading
                          ? [[
                              "Loading...",
                              "-",
                              "-",
                              "-",
                              "-",
                              "-",
                              "-",
                              "-",
                            ]]
                          : walletTransactions.length === 0
                          ? [[
                              walletError ?? "No transactions found.",
                              "-",
                              "-",
                              "-",
                              "-",
                              "-",
                              "-",
                              "-",
                            ]]
                          : walletTransactions.map((txn) => [
                              txn.id,
                              txn.payment_method ?? "-",
                              txn.payment_proof_file_id ? (
                                <a
                                  key={`${txn.id}-proof`}
                                  href={`/api/files/${txn.payment_proof_file_id}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-md border border-white/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/70 hover:bg-white/10"
                                >
                                  View
                                </a>
                              ) : (
                                "-"
                              ),
                              `AED ${Number(txn.amount ?? 0).toFixed(2)}`,
                              txn.approved_by ?? "-",
                              <button
                                key={`${txn.id}-proforma`}
                                type="button"
                                className="rounded-md border border-white/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/70 hover:bg-white/10"
                                onClick={() => openProforma(txn)}
                              >
                                Proforma
                              </button>,
                              txn.approved_at ? "Approved" : "Unapproved",
                              formatDateTime(txn.payment_date),
                            ])
                      }
                    />
                  </SectionCard>
                </div>
              )}

              {activeTab !== "invoices" && (
                <div className={`pt-6 text-sm ${theme.mutedText}`}>
                  <div className="rounded-md border border-dashed border-white/15 p-6 text-center">
                    Dummy data for {tabLabels.find((tab) => tab.id === activeTab)?.label}.
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
      {topupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className={`w-full max-w-lg rounded-xl shadow-xl ${theme.cardBg} ${theme.cardBorder}`}>
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="text-sm font-semibold">Topup Wallet</div>
              <button
                type="button"
                onClick={() => setTopupOpen(false)}
                className={`rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-white/10`}
              >
                Close
              </button>
            </div>
            <div className="space-y-4 p-4">
              {topupError && <div className="text-sm text-red-400">{topupError}</div>}
              <div className="space-y-2">
                <label className={`text-xs font-semibold ${theme.mutedText}`}>Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={theme.input}
                  value={topupForm.amount}
                  onChange={(e) => setTopupForm((prev) => ({ ...prev, amount: e.target.value }))}
                  placeholder="Enter amount"
                />
              </div>
              <div className="space-y-2">
                <label className={`text-xs font-semibold ${theme.mutedText}`}>Payment Method</label>
                <select
                  className={theme.input}
                  value={topupForm.method}
                  onChange={(e) => setTopupForm((prev) => ({ ...prev, method: e.target.value }))}
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="online">Online</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className={`text-xs font-semibold ${theme.mutedText}`}>Payment Date</label>
                <input
                  type="date"
                  className={theme.input}
                  value={topupForm.paymentDate}
                  onChange={(e) => setTopupForm((prev) => ({ ...prev, paymentDate: e.target.value }))}
                />
              </div>
              <FileUploader
                label="Payment Proof"
                value={topupForm.proofFileId}
                onChange={(id) => setTopupForm((prev) => ({ ...prev, proofFileId: id ?? "" }))}
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className={`rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-white/10`}
                  onClick={() => setTopupOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-md bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary-foreground"
                  disabled={topupSaving}
                  onClick={async () => {
                    if (!companyId || !customerId) return;
                    const amount = Number(topupForm.amount);
                    if (!amount || amount <= 0) {
                      setTopupError("Enter a valid amount.");
                      return;
                    }
                    setTopupSaving(true);
                    setTopupError(null);
                    try {
                      const res = await fetch(`/api/customers/${customerId}/wallet/transactions`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          companyId,
                          amount,
                          paymentMethod: topupForm.method,
                          paymentDate: topupForm.paymentDate || null,
                          paymentProofFileId: topupForm.proofFileId || null,
                        }),
                      });
                      if (!res.ok) {
                        const data = await res.json().catch(() => ({}));
                        throw new Error(data?.error ?? "Failed to create topup");
                      }
                      const summaryRes = await fetch(
                        `/api/customers/${customerId}/wallet/summary?companyId=${companyId}`
                      );
                      if (summaryRes.ok) {
                        const summary = await summaryRes.json().catch(() => ({}));
                        setWalletBalance(Number(summary?.balance ?? 0));
                      } else {
                        setWalletBalance((prev) => prev + amount);
                      }
                      setTopupForm({
                        amount: "",
                        method: "cash",
                        paymentDate: "",
                        proofFileId: "",
                      });
                      setTopupOpen(false);
                    } catch (err: any) {
                      setTopupError(err?.message ?? "Failed to create topup");
                    } finally {
                      setTopupSaving(false);
                    }
                  }}
                >
                  {topupSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {addCarOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className={`w-full max-w-2xl rounded-xl shadow-xl ${theme.cardBg} ${theme.cardBorder}`}>
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="text-sm font-semibold">Add New Car</div>
              <button
                type="button"
                onClick={() => setAddCarOpen(false)}
                className={`rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-white/10`}
              >
                Close
              </button>
            </div>
            <div className="space-y-4 p-4">
              {addCarError && <div className="text-sm text-red-400">{addCarError}</div>}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className={`text-xs font-semibold ${theme.mutedText}`}>Plate Number</label>
                  <input
                    type="text"
                    className={theme.input}
                    value={addCarForm.plateNumber}
                    onChange={(e) => setAddCarForm((prev) => ({ ...prev, plateNumber: e.target.value }))}
                    placeholder="DXB-A-1234"
                  />
                </div>
                <div className="space-y-2">
                  <label className={`text-xs font-semibold ${theme.mutedText}`}>Car Type</label>
                  <select
                    className={theme.input}
                    value={addCarForm.bodyType}
                    onChange={(e) => setAddCarForm((prev) => ({ ...prev, bodyType: e.target.value }))}
                  >
                    <option value="Regular">Regular</option>
                    <option value="Sedan">Sedan</option>
                    <option value="SUV">SUV</option>
                    <option value="Truck">Truck</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className={`text-xs font-semibold ${theme.mutedText}`}>Make</label>
                  <select
                    className={theme.input}
                    value={addCarForm.make}
                    onChange={(e) =>
                      setAddCarForm((prev) => ({
                        ...prev,
                        make: e.target.value,
                        model: carModelsByMake[e.target.value]?.includes(prev.model)
                          ? prev.model
                          : "",
                      }))
                    }
                  >
                    <option value="">Select Make</option>
                    {carMakes.map((make) => (
                      <option key={make} value={make}>
                        {make}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className={`text-xs font-semibold ${theme.mutedText}`}>Model</label>
                  <select
                    className={theme.input}
                    value={addCarForm.model}
                    onChange={(e) => setAddCarForm((prev) => ({ ...prev, model: e.target.value }))}
                    disabled={!addCarForm.make}
                  >
                    <option value="">Select Model</option>
                    {(carModelsByMake[addCarForm.make] ?? []).map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className={`text-xs font-semibold ${theme.mutedText}`}>Model Year</label>
                  <select
                    className={theme.input}
                    value={addCarForm.modelYear}
                    onChange={(e) => setAddCarForm((prev) => ({ ...prev, modelYear: e.target.value }))}
                  >
                    <option value="">Select Year</option>
                    {carYears.map((year) => (
                      <option key={year} value={String(year)}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-white/70">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={addCarForm.isInsurance}
                  onChange={(e) => setAddCarForm((prev) => ({ ...prev, isInsurance: e.target.checked }))}
                />
                Insurance Car
              </label>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className={`rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-white/10`}
                  onClick={() => setAddCarOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-md bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary-foreground"
                  disabled={addCarSaving}
                  onClick={async () => {
                    if (!companyId || !customerId) return;
                    const yearValue = addCarForm.modelYear ? Number(addCarForm.modelYear) : null;
                    if (addCarForm.modelYear && (Number.isNaN(yearValue) || yearValue <= 0)) {
                      setAddCarError("Enter a valid model year.");
                      return;
                    }
                    setAddCarSaving(true);
                    setAddCarError(null);
                    try {
                      const res = await fetch(`/api/customers/${customerId}/cars?companyId=${companyId}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          relationType: "owner",
                          newCar: {
                            plateNumber: addCarForm.plateNumber || null,
                            make: addCarForm.make || null,
                            model: addCarForm.model || null,
                            modelYear: yearValue || null,
                            bodyType: addCarForm.bodyType || null,
                            isInsurance: addCarForm.isInsurance,
                          },
                        }),
                      });
                      if (!res.ok) {
                        const data = await res.json().catch(() => ({}));
                        throw new Error(data?.error ?? "Failed to add car");
                      }
                      await loadCustomer(companyId, customerId);
                      setAddCarForm({
                        plateNumber: "",
                        make: "",
                        model: "",
                        modelYear: "",
                        bodyType: "Regular",
                        isInsurance: false,
                      });
                      setAddCarOpen(false);
                    } catch (err: any) {
                      setAddCarError(err?.message ?? "Failed to add car");
                    } finally {
                      setAddCarSaving(false);
                    }
                  }}
                >
                  {addCarSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {viewCar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className={`w-full max-w-lg rounded-xl shadow-xl ${theme.cardBg} ${theme.cardBorder}`}>
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="text-sm font-semibold">Car Details</div>
              <button
                type="button"
                onClick={() => setViewCar(null)}
                className={`rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-white/10`}
              >
                Close
              </button>
            </div>
            <div className="space-y-3 p-4 text-sm">
              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <span className={theme.mutedText}>Plate</span>
                  <span className="font-semibold">
                    {viewCar.plate_number || viewCar.plateNumber || "N/A"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={theme.mutedText}>Make</span>
                  <span className="font-semibold">{viewCar.make || "N/A"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={theme.mutedText}>Model</span>
                  <span className="font-semibold">{viewCar.model || "N/A"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={theme.mutedText}>Year</span>
                  <span className="font-semibold">{viewCar.model_year || viewCar.modelYear || "N/A"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={theme.mutedText}>Type</span>
                  <span className="font-semibold">{viewCar.body_type || viewCar.bodyType || "N/A"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={theme.mutedText}>Insurance</span>
                  <span className="font-semibold">
                    {viewCar.is_insurance || viewCar.isInsurance ? "Yes" : "No"}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {selectActionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className={`w-full max-w-lg rounded-xl shadow-xl ${theme.cardBg} ${theme.cardBorder}`}>
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="text-sm font-semibold">Customer Car Action</div>
              <button
                type="button"
                onClick={() => setSelectActionOpen(false)}
                className={`rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-white/10`}
              >
                Close
              </button>
            </div>
            <div className="space-y-4 p-4">
              {selectActionError && <div className="text-sm text-red-400">{selectActionError}</div>}
              <div className={`rounded-md ${theme.cardBorder} ${theme.surfaceSubtle} px-3 py-2 text-sm`}>
                <div className="font-semibold">
                  {selectActionCar?.plate_number || selectActionCar?.plateNumber || "N/A"}
                </div>
                <div className={`text-xs ${theme.mutedText}`}>
                  {[selectActionCar?.make, selectActionCar?.model, selectActionCar?.model_year]
                    .filter(Boolean)
                    .join(" ") || "Car"}
                </div>
              </div>

              {selectActionMode === "menu" && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className={`text-xs font-semibold ${theme.mutedText}`}>Remarks</label>
                    <textarea
                      className={theme.input}
                      value={appointmentForm.remarks}
                      onChange={(e) =>
                        setAppointmentForm((prev) => ({ ...prev, remarks: e.target.value }))
                      }
                      placeholder="Enter remarks"
                      rows={3}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      className="rounded-md bg-primary px-3 py-2 text-xs font-semibold uppercase tracking-wide text-primary-foreground"
                      disabled={selectActionSaving}
                      onClick={() => runCarAction("car_in")}
                    >
                      {selectActionSaving ? "Working..." : "Car In (Walkin)"}
                    </button>
                    <button
                      type="button"
                      className={`rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-white/10`}
                      onClick={() => setSelectActionMode("appointment")}
                    >
                      Create Appointment
                    </button>
                  </div>
                </div>
              )}

              {selectActionMode === "appointment" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className={`text-xs font-semibold ${theme.mutedText}`}>Appointment Date</label>
                    <input
                      type="datetime-local"
                      className={theme.input}
                      value={appointmentForm.appointmentAt}
                      onChange={(e) =>
                        setAppointmentForm((prev) => ({ ...prev, appointmentAt: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={`text-xs font-semibold ${theme.mutedText}`}>Appointment Type</label>
                    <select
                      className={theme.input}
                      value={appointmentForm.type}
                      onChange={(e) =>
                        setAppointmentForm((prev) => ({ ...prev, type: e.target.value }))
                      }
                    >
                      <option value="walkin">Walkin</option>
                      <option value="recovery">Recovery</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className={`text-xs font-semibold ${theme.mutedText}`}>Remarks</label>
                    <textarea
                      className={theme.input}
                      value={appointmentForm.remarks}
                      onChange={(e) =>
                        setAppointmentForm((prev) => ({ ...prev, remarks: e.target.value }))
                      }
                      placeholder="Enter remarks"
                      rows={3}
                    />
                  </div>
                  {isRecoveryAppointment && (
                    <>
                      <div className="space-y-2">
                        <label className={`text-xs font-semibold ${theme.mutedText}`}>Pickup Location</label>
                        <input
                          type="text"
                          className={theme.input}
                          value={appointmentForm.pickupLocation}
                          onChange={(e) =>
                            setAppointmentForm((prev) => ({ ...prev, pickupLocation: e.target.value }))
                          }
                          placeholder="Enter pickup location"
                        />
                      </div>
                    </>
                  )}
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      className={`rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-white/10`}
                      onClick={() => setSelectActionMode("menu")}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      className="rounded-md bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary-foreground"
                      disabled={appointmentDisabled}
                      onClick={() => runCarAction("appointment")}
                    >
                      {selectActionSaving ? "Working..." : "Create Appointment"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </AppLayout>
  );
}

const dummyInvoices = [
  ["CG-INV-000158680", "2026-01-10 06:01:47", "DXB-A-1234", "master_admin", "SC_Department", "AED 367.50", "Paid", "Loyalty Points", "Print", "2026-01-10 06:01:47"],
  ["CG-INV-000158681", "2026-01-10 06:01:01", "DXB-D-1000", "master_admin", "SC_Department", "AED 105.00", "Paid", "Loyalty Points", "Print", "2026-01-10 06:01:01"],
];

const carMakes = ["Audi", "BMW", "Ford", "Honda", "Hyundai", "Kia", "Mazda", "Nissan", "Toyota"];

const carModelsByMake: Record<string, string[]> = {
  Audi: ["A3", "A4", "Q5"],
  BMW: ["3 Series", "5 Series", "X5"],
  Ford: ["Escape", "Explorer", "Focus"],
  Honda: ["Accord", "Civic", "CR-V"],
  Hyundai: ["Accent", "Elantra", "Sonata"],
  Kia: ["Cerato", "Optima", "Sportage"],
  Mazda: ["3", "6", "CX-5"],
  Nissan: ["Altima", "Patrol", "Sunny"],
  Toyota: ["Camry", "Corolla", "Land Cruiser"],
};

const carYears = Array.from({ length: 30 }, (_, index) => new Date().getFullYear() - index);

const dummyReturns = [
  ["CG-RTN-000201", "CG-INV-000158680", "AED 50.00", "master_admin", "Refund issued", "2026-01-11 10:02:12"],
];

const dummyTransactions = [
  ["CG-TXN-000208521", "Paid Cash", "View", "AED 1000.00", "master_admin", "Print", "Pending Verification", "2025-12-06 20:30:47"],
  ["CG-TXN-000208522", "Paid Cash", "View", "AED 1000.00", "master_admin", "Print", "Pending Verification", "2025-12-06 20:35:58"],
  ["CG-TXN-000208523", "Paid Cash", "View", "AED 500.00", "master_admin", "Print", "Pending Verification", "2025-12-06 20:38:15"],
];

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <div className="overflow-hidden rounded-md border border-white/15">
      <div className={`flex items-center justify-between px-4 py-2 text-sm font-semibold ${theme.surfaceSubtle} ${theme.cardBorder}`}>
        <span>{title}</span>
        <span className="text-lg leading-none">-</span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: Array<Array<React.ReactNode>>;
}) {
  const { theme } = useTheme();
  return (
    <div className={`overflow-x-auto rounded-md ${theme.cardBorder} ${theme.surfaceSubtle}`}>
      <table className="min-w-full text-xs">
        <thead className="bg-white/5 text-white/70">
          <tr>
            {headers.map((header) => (
              <th key={header} className="whitespace-nowrap px-3 py-2 text-left font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={`${row[0]}-${idx}`} className="border-t border-white/10 text-white/80">
              {row.map((cell, cellIdx) => (
                <td key={`${row[0]}-${cellIdx}`} className="whitespace-nowrap px-3 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
