"use client";

import { AppLayout } from "@repo/ui";
import { useParams } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";

type Props = { params: { companyId: string; vendorId: string } };
type QuoteTypeKey = "oem" | "oe" | "aftm" | "used";
type PartFormData = {
  partNumber: string;
  remarks: string;
  oemAmount: string;
  oeAmount: string;
  aftmAmount: string;
  usedAmount: string;
  oemQty: string;
  oeQty: string;
  aftmQty: string;
  usedQty: string;
  oemEtd: string;
  oeEtd: string;
  aftmEtd: string;
  usedEtd: string;
  oemTime: string;
  oeTime: string;
  aftmTime: string;
  usedTime: string;
};

type TabId = "inquiries" | "bids" | "new_orders" | "completed" | "returns";

const TAB_CONFIG: Array<{ id: TabId; label: string; subtitle: string }> = [
  { id: "inquiries", label: "New Inquiries", subtitle: "All parts inquiry list." },
  { id: "bids", label: "Bids", subtitle: "Vendor bids across parts and quotes." },
  { id: "new_orders", label: "New Orders", subtitle: "Accepted orders awaiting delivery." },
  { id: "completed", label: "Completed Orders", subtitle: "Delivered orders and invoices." },
  { id: "returns", label: "Returns", subtitle: "Return requests and updates." },
];

const MAKES = [
  "Audi",
  "BMW",
  "Ford",
  "Honda",
  "Hyundai",
  "Kia",
  "Lexus",
  "Mazda",
  "Mercedes",
  "Nissan",
  "Toyota",
  "Volkswagen",
];

const createEmptyPartForm = (): PartFormData => ({
  partNumber: "",
  remarks: "",
  oemAmount: "",
  oeAmount: "",
  aftmAmount: "",
  usedAmount: "",
  oemQty: "1",
  oeQty: "1",
  aftmQty: "1",
  usedQty: "1",
  oemEtd: "Same Day",
  oeEtd: "Same Day",
  aftmEtd: "Same Day",
  usedEtd: "Same Day",
  oemTime: "",
  oeTime: "",
  aftmTime: "",
  usedTime: "",
});

function TableShell({
  title,
  subtitle,
  columns,
  emptyText,
  body,
}: {
  title: string;
  subtitle: string;
  columns: string[];
  emptyText: string;
  body?: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-slate-950/85 shadow-[0_30px_70px_-40px_rgba(8,15,30,0.9)] ring-1 ring-white/5">
      <div className="flex items-center justify-between border-b border-white/5 bg-gradient-to-r from-slate-950/70 via-slate-900/60 to-slate-950/80 px-4 py-3">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs text-muted-foreground">{subtitle}</div>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-white/60">
          Live
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-900/70 text-xs uppercase tracking-wide text-slate-300">
            <tr>
              {columns.map((col) => (
                <th key={col} className="px-3 py-2 text-left font-medium">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {body ?? (
              <tr>
                <td className="px-3 py-8 text-center text-sm text-slate-300/80" colSpan={columns.length}>
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function VendorDashboardPage({ params }: Props) {
  const routeParams = useParams();
  const companyId =
    params?.companyId ??
    (typeof routeParams?.companyId === "string" ? routeParams.companyId : routeParams?.companyId?.[0]) ??
    "";
  const vendorId =
    params?.vendorId ??
    (typeof routeParams?.vendorId === "string" ? routeParams.vendorId : routeParams?.vendorId?.[0]) ??
    "";
  const [activeTab, setActiveTab] = useState<TabId>("inquiries");
  const [selectedMakes, setSelectedMakes] = useState<string[]>([]);
  const [inquiries, setInquiries] = useState<
    Array<{
      inquiryId: string;
      sourceType: "inventory" | "estimate";
      requestNumber?: string | null;
      carMake?: string | null;
      carModel?: string | null;
      carPlate?: string | null;
      carVin?: string | null;
      updatedAt?: string | null;
    }>
  >([]);
  const [inquiriesLoading, setInquiriesLoading] = useState(false);
  const [inquiriesError, setInquiriesError] = useState<string | null>(null);
  const [partsOpen, setPartsOpen] = useState(false);
  const [partsLoading, setPartsLoading] = useState(false);
  const [partsError, setPartsError] = useState<string | null>(null);
  const [partForms, setPartForms] = useState<Record<string, PartFormData>>({});
  const [submitStatus, setSubmitStatus] = useState<Record<string, "idle" | "saving" | "saved" | "error">>({});
  const [submitErrors, setSubmitErrors] = useState<Record<string, string>>({});
  const [submitAt, setSubmitAt] = useState<Record<string, string>>({});
  const [draftSavedAt, setDraftSavedAt] = useState<Record<string, string>>({});
  const [selectedInquiry, setSelectedInquiry] = useState<{
    inquiryId: string;
    sourceType: "inventory" | "estimate";
    requestNumber?: string | null;
    carMake?: string | null;
    carModel?: string | null;
    carPlate?: string | null;
    carVin?: string | null;
  } | null>(null);
  const [partsRows, setPartsRows] = useState<
    Array<{
      id: string;
      partName: string;
      description?: string | null;
      quantity?: number | null;
      partType?: string | null;
      itemSource?: "line_item";
      isSubmitted?: boolean;
    }>
  >([]);
  const [bids, setBids] = useState<
    Array<{
      id: string;
      partName: string;
      carMake?: string | null;
      carModel?: string | null;
      carPlate?: string | null;
      carVin?: string | null;
      oem?: number | null;
      oe?: number | null;
      aftm?: number | null;
      used?: number | null;
      oemQty?: number | null;
      oeQty?: number | null;
      aftmQty?: number | null;
      usedQty?: number | null;
      oemEtd?: string | null;
      oeEtd?: string | null;
      aftmEtd?: string | null;
      usedEtd?: string | null;
      remarks?: string | null;
      status?: string | null;
      updatedAt?: string | null;
    }>
  >([]);
  const [bidsLoading, setBidsLoading] = useState(false);
  const [bidsError, setBidsError] = useState<string | null>(null);
  const [orders, setOrders] = useState<typeof bids>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<typeof bids>([]);
  const [completedLoading, setCompletedLoading] = useState(false);
  const [completedError, setCompletedError] = useState<string | null>(null);
  const [returns, setReturns] = useState<typeof bids>([]);
  const [returnsLoading, setReturnsLoading] = useState(false);
  const [returnsError, setReturnsError] = useState<string | null>(null);

  const currentTab = useMemo(
    () => TAB_CONFIG.find((tab) => tab.id === activeTab) ?? TAB_CONFIG[0]!,
    [activeTab]
  );

  const summaryCards = useMemo(
    () => [
      { label: "Inquiries", value: inquiries.length, tone: "text-emerald-200" },
      { label: "Bids", value: bids.length, tone: "text-sky-200" },
      { label: "Orders", value: orders.length, tone: "text-amber-200" },
      { label: "Returns", value: returns.length, tone: "text-rose-200" },
    ],
    [inquiries.length, bids.length, orders.length, returns.length]
  );

  const tabCounts = useMemo(
    () => ({
      inquiries: inquiries.length,
      bids: bids.length,
      new_orders: orders.length,
      completed: completed.length,
      returns: returns.length,
    }),
    [inquiries.length, bids.length, orders.length, completed.length, returns.length]
  );

  useEffect(() => {
    if (!partsRows.length) return;
    setPartForms((prev) => {
      const next = { ...prev };
      for (const row of partsRows) {
        if (!next[row.id]) {
          next[row.id] = createEmptyPartForm();
        }
      }
      return next;
    });
  }, [partsRows]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadBids() {
      if (!companyId || !vendorId || activeTab !== "bids") return;
      setBidsLoading(true);
      setBidsError(null);
      try {
        const res = await fetch(`/api/company/${companyId}/vendors/${vendorId}/bids`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`Failed to load bids (${res.status})`);
        }
        const data = await res.json();
        if (!cancelled) {
          setBids(Array.isArray(data?.data) ? data.data : []);
        }
      } catch (err: any) {
        if (!cancelled && err?.name !== "AbortError") {
          setBidsError(err?.message ?? "Failed to load bids");
        }
      } finally {
        if (!cancelled) setBidsLoading(false);
      }
    }

    loadBids();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeTab, companyId, vendorId]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadStatus(status: "Ordered" | "completed" | "returns") {
      if (!companyId || !vendorId) return;
      const setState =
        status === "Ordered"
          ? { set: setOrders, setLoading: setOrdersLoading, setError: setOrdersError }
          : status === "completed"
          ? { set: setCompleted, setLoading: setCompletedLoading, setError: setCompletedError }
          : { set: setReturns, setLoading: setReturnsLoading, setError: setReturnsError };

      setState.setLoading(true);
      setState.setError(null);
      try {
        const res = await fetch(
          `/api/company/${companyId}/vendors/${vendorId}/bids?status=${status}`,
          { signal: controller.signal }
        );
        if (!res.ok) {
          throw new Error(`Failed to load bids (${res.status})`);
        }
        const data = await res.json();
        if (!cancelled) {
          setState.set(Array.isArray(data?.data) ? data.data : []);
        }
      } catch (err: any) {
        if (!cancelled && err?.name !== "AbortError") {
          setState.setError(err?.message ?? "Failed to load bids");
        }
      } finally {
        if (!cancelled) setState.setLoading(false);
      }
    }

    if (activeTab === "new_orders") {
      loadStatus("Ordered");
    } else if (activeTab === "completed") {
      loadStatus("completed");
    } else if (activeTab === "returns") {
      loadStatus("returns");
    }

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeTab, companyId, vendorId]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadInquiries() {
      if (!companyId || !vendorId) {
        setInquiries([]);
        setInquiriesError("Company and vendor are required.");
        setInquiriesLoading(false);
        return;
      }
      setInquiriesLoading(true);
      setInquiriesError(null);
      try {
        const res = await fetch(`/api/company/${companyId}/vendors/${vendorId}/inquiries`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`Failed to load inquiries (${res.status})`);
        }
        const data = await res.json();
        if (!cancelled) {
          setInquiries(Array.isArray(data?.data) ? data.data : []);
        }
      } catch (err: any) {
        if (!cancelled && err?.name !== "AbortError") {
          setInquiriesError(err?.message ?? "Failed to load inquiries");
        }
      } finally {
        if (!cancelled) setInquiriesLoading(false);
      }
    }

    loadInquiries();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [companyId, vendorId]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function preloadCounts() {
      if (!companyId || !vendorId) return;
      try {
        const [bidsRes, ordersRes, completedRes, returnsRes] = await Promise.all([
          fetch(`/api/company/${companyId}/vendors/${vendorId}/bids`, { signal: controller.signal }),
          fetch(`/api/company/${companyId}/vendors/${vendorId}/bids?status=Ordered`, {
            signal: controller.signal,
          }),
          fetch(`/api/company/${companyId}/vendors/${vendorId}/bids?status=completed`, {
            signal: controller.signal,
          }),
          fetch(`/api/company/${companyId}/vendors/${vendorId}/bids?status=returns`, {
            signal: controller.signal,
          }),
        ]);

        if (cancelled) return;

        if (bidsRes.ok) {
          const data = await bidsRes.json();
          setBids(Array.isArray(data?.data) ? data.data : []);
        }
        if (ordersRes.ok) {
          const data = await ordersRes.json();
          setOrders(Array.isArray(data?.data) ? data.data : []);
        }
        if (completedRes.ok) {
          const data = await completedRes.json();
          setCompleted(Array.isArray(data?.data) ? data.data : []);
        }
        if (returnsRes.ok) {
          const data = await returnsRes.json();
          setReturns(Array.isArray(data?.data) ? data.data : []);
        }
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          console.warn("preloadCounts failed", err);
        }
      }
    }

    preloadCounts();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [companyId, vendorId]);

  const visibleInquiries = useMemo(() => {
    if (!selectedMakes.length) return inquiries;
    const needle = new Set(selectedMakes.map((m) => m.toLowerCase()));
    return inquiries.filter((row) => needle.has((row.carMake ?? "").toLowerCase()));
  }, [inquiries, selectedMakes]);

  const inquiriesBody = useMemo(() => {
    if (inquiriesLoading) {
      return (
        <tr>
          <td className="px-3 py-8 text-center text-sm text-slate-300/80" colSpan={6}>
            Loading inquiries...
          </td>
        </tr>
      );
    }
    if (inquiriesError) {
      return (
        <tr>
          <td className="px-3 py-8 text-center text-sm text-rose-300" colSpan={6}>
            {inquiriesError}
          </td>
        </tr>
      );
    }
    if (!visibleInquiries.length) {
      return (
        <tr>
          <td className="px-3 py-8 text-center text-sm text-slate-300/80" colSpan={6}>
            No new inquiries yet.
          </td>
        </tr>
      );
    }
    return visibleInquiries.map((row, index) => (
      <tr key={row.inquiryId} className="border-t border-white/5">
        <td className="px-3 py-3 text-xs text-slate-300/80">{index + 1}</td>
        <td className="px-3 py-3">
          {row.sourceType === "inventory" ? "Inventory" : row.carMake ?? "—"}
        </td>
        <td className="px-3 py-3">
          {row.sourceType === "inventory" ? row.requestNumber ?? "Request" : row.carModel ?? "—"}
        </td>
        <td className="px-3 py-3">{row.sourceType === "inventory" ? "—" : row.carVin ?? "—"}</td>
        <td className="px-3 py-3 text-xs text-slate-300/80">
          {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : "—"}
        </td>
        <td className="px-3 py-3">
          <button
            type="button"
            onClick={async () => {
              setSelectedInquiry({
                inquiryId: row.inquiryId,
                sourceType: row.sourceType,
                requestNumber: row.requestNumber ?? null,
                carMake: row.carMake,
                carModel: row.carModel,
                carPlate: row.carPlate,
                carVin: row.carVin,
              });
              setPartsOpen(true);
              setPartsLoading(true);
              setPartsError(null);
              try {
                const sourceParam = row.sourceType === "inventory" ? "?source=inventory" : "";
                const res = await fetch(
                  `/api/company/${companyId}/vendors/${vendorId}/inquiries/${row.inquiryId}/parts${sourceParam}`
                );
                if (!res.ok) {
                  throw new Error(`Failed to load parts (${res.status})`);
                }
                const data = await res.json();
                const rows = Array.isArray(data?.data) ? data.data : [];
                setPartsRows(rows);
                setSubmitStatus((prev) => {
                  const next = { ...prev };
                  for (const part of rows) {
                    next[part.id] = part?.isSubmitted ? "saved" : "idle";
                  }
                  return next;
                });
                setPartForms({});
              } catch (err: any) {
                setPartsError(err?.message ?? "Failed to load parts");
                setPartsRows([]);
              } finally {
                setPartsLoading(false);
              }
            }}
            className="rounded-md bg-emerald-500/90 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
          >
            View parts
          </button>
        </td>
      </tr>
    ));
  }, [companyId, inquiriesError, inquiriesLoading, visibleInquiries]);

  const bidsBody = useMemo(() => {
    if (bidsLoading) {
      return (
        <tr>
          <td className="px-3 py-8 text-center text-sm text-slate-300/80" colSpan={10}>
            Loading bids...
          </td>
        </tr>
      );
    }
    if (bidsError) {
      return (
        <tr>
          <td className="px-3 py-8 text-center text-sm text-rose-300" colSpan={10}>
            {bidsError}
          </td>
        </tr>
      );
    }
    if (!bids.length) {
      return (
        <tr>
          <td className="px-3 py-8 text-center text-sm text-slate-300/80" colSpan={10}>
            No bids submitted yet.
          </td>
        </tr>
      );
    }
    const cell = "px-4 py-4 align-top";
    const formatQuote = (amount?: number | null, qty?: number | null, etd?: string | null) => {
      if (!amount && !qty && !etd) return { amount: "—", qty: null, etd: null };
      return {
        amount: amount != null ? `${amount} AED` : "—",
        qty: qty != null ? `QTY ${qty}` : null,
        etd: etd ? `ETD ${etd}` : null,
      };
    };
    return bids.map((row, index) => (
      <tr key={row.id} className="border-t border-white/5 hover:bg-white/[0.02]">
        <td className={cell}>{index + 1}</td>
        <td className={cell}>
          <div className="text-sm font-semibold text-slate-100">{row.partName}</div>
          <div className="mt-1 text-[11px] text-slate-400">{row.remarks ?? "—"}</div>
        </td>
        <td className={cell}>
          <div className="text-xs font-semibold text-slate-100">{row.carMake ?? "—"}</div>
          <div className="text-[11px] text-slate-400">{row.carModel ?? "—"}</div>
          <div className="text-[11px] text-slate-500">{row.carVin ?? "—"}</div>
        </td>
        <td className={cell}>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                { label: "OEM", data: formatQuote(row.oem, row.oemQty, row.oemEtd) },
                { label: "OE", data: formatQuote(row.oe, row.oeQty, row.oeEtd) },
                { label: "After Market", data: formatQuote(row.aftm, row.aftmQty, row.aftmEtd) },
                { label: "Used", data: formatQuote(row.used, row.usedQty, row.usedEtd) },
              ] as const
            ).map((quote) => (
              <div key={quote.label} className="rounded-lg border border-white/10 bg-slate-950/60 p-2">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">{quote.label}</div>
                <div className="text-sm font-semibold text-slate-100">{quote.data.amount}</div>
                <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-400">
                  {quote.data.qty ? <span>{quote.data.qty}</span> : null}
                  {quote.data.etd ? <span>{quote.data.etd}</span> : null}
                  {!quote.data.qty && !quote.data.etd ? <span>—</span> : null}
                </div>
              </div>
            ))}
          </div>
        </td>
        <td className={cell}>
          <div className="text-xs text-slate-300">
            {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : "—"}
          </div>
        </td>
      </tr>
    ));
  }, [bids, bidsError, bidsLoading]);

  const statusRows = useMemo(() => {
    const pickQuote = (row: (typeof bids)[number]) => {
      if (row.oem != null) return { type: "OEM", amount: row.oem, qty: row.oemQty, etd: row.oemEtd };
      if (row.oe != null) return { type: "OE", amount: row.oe, qty: row.oeQty, etd: row.oeEtd };
      if (row.aftm != null) return { type: "AFTM", amount: row.aftm, qty: row.aftmQty, etd: row.aftmEtd };
      if (row.used != null) return { type: "USED", amount: row.used, qty: row.usedQty, etd: row.usedEtd };
      return { type: "—", amount: null, qty: null, etd: null };
    };
    return { pickQuote };
  }, []);

  const allowedTypesForRow = (partType?: string | null) => {
    if (!partType) return new Set(["oem", "oe", "aftm", "used"]);
    const normalized = partType.toLowerCase();
    if (normalized === "oe") return new Set(["oe"]);
    if (normalized === "oem") return new Set(["oem"]);
    if (normalized.includes("after")) return new Set(["aftm"]);
    if (normalized === "used") return new Set(["used"]);
    return new Set(["oem", "oe", "aftm", "used"]);
  };

  const isTypeEnabled = (row: { partType?: string | null }, type: "oem" | "oe" | "aftm" | "used") => {
    if (selectedInquiry?.sourceType !== "inventory") return true;
    return allowedTypesForRow(row.partType).has(type);
  };

  const updatePartForm = (rowId: string, key: keyof PartFormData, value: string) => {
    setPartForms((prev) => ({
      ...prev,
      [rowId]: { ...(prev[rowId] ?? createEmptyPartForm()), [key]: value },
    }));
  };

  const markDraftSaved = (rowId: string) => {
    setDraftSavedAt((prev) => ({ ...prev, [rowId]: new Date().toLocaleTimeString() }));
  };

  const toPositiveNumber = (value: string | undefined) => {
    const parsed = Number(value ?? "");
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };

  const getRowValidationError = (
    row: { partType?: string | null },
    form: PartFormData | undefined
  ): string | null => {
    if (!form) return "Enter at least one quote amount.";
    const amountKeys: Array<keyof PartFormData> = ["oemAmount", "oeAmount", "aftmAmount", "usedAmount"];
    const hasAnyAmount = amountKeys.some((key) => toPositiveNumber(form[key] as string) > 0);
    if (!hasAnyAmount) return "Enter at least one quote amount.";

    const validations: Array<{ type: QuoteTypeKey; amount: string; etd: string; time: string }> = [
      { type: "oem", amount: form.oemAmount, etd: form.oemEtd, time: form.oemTime },
      { type: "oe", amount: form.oeAmount, etd: form.oeEtd, time: form.oeTime },
      { type: "aftm", amount: form.aftmAmount, etd: form.aftmEtd, time: form.aftmTime },
      { type: "used", amount: form.usedAmount, etd: form.usedEtd, time: form.usedTime },
    ];

    for (const check of validations) {
      if (!isTypeEnabled(row, check.type)) continue;
      if (toPositiveNumber(check.amount) <= 0) continue;
      if (check.etd === "Custom" && !String(check.time ?? "").trim()) {
        return "Fill custom time for selected quote type.";
      }
    }
    return null;
  };

  const ordersBody = useMemo(() => {
    if (ordersLoading) {
      return (
        <tr>
          <td className="px-3 py-8 text-center text-sm text-slate-300/80" colSpan={11}>
            Loading orders...
          </td>
        </tr>
      );
    }
    if (ordersError) {
      return (
        <tr>
          <td className="px-3 py-8 text-center text-sm text-rose-300" colSpan={11}>
            {ordersError}
          </td>
        </tr>
      );
    }
    if (!orders.length) {
      return (
        <tr>
          <td className="px-3 py-8 text-center text-sm text-slate-300/80" colSpan={11}>
            No accepted bids yet.
          </td>
        </tr>
      );
    }
    return orders.map((row, index) => {
      const quote = statusRows.pickQuote(row);
      return (
        <tr key={row.id} className="border-t border-white/5">
          <td className="px-3 py-3 text-xs text-slate-300/80">{index + 1}</td>
          <td className="px-3 py-3">
            <div className="text-sm font-semibold text-slate-100">{row.partName}</div>
          </td>
          <td className="px-3 py-3">{row.carPlate ?? "—"}</td>
          <td className="px-3 py-3">{row.carMake ?? "—"}</td>
          <td className="px-3 py-3">{row.carModel ?? "—"}</td>
          <td className="px-3 py-3">{row.carVin ?? "—"}</td>
          <td className="px-3 py-3">{quote.qty ?? "—"} ({quote.type})</td>
          <td className="px-3 py-3">{quote.amount != null ? `${quote.amount} AED` : "—"}</td>
          <td className="px-3 py-3">{row.status ?? "Ordered"}</td>
          <td className="px-3 py-3">—</td>
          <td className="px-3 py-3 text-xs text-slate-300/80">
            {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : "—"}
          </td>
        </tr>
      );
    });
  }, [orders, ordersError, ordersLoading, statusRows]);

  const completedBody = useMemo(() => {
    if (completedLoading) {
      return (
        <tr>
          <td className="px-3 py-8 text-center text-sm text-slate-300/80" colSpan={10}>
            Loading completed bids...
          </td>
        </tr>
      );
    }
    if (completedError) {
      return (
        <tr>
          <td className="px-3 py-8 text-center text-sm text-rose-300" colSpan={10}>
            {completedError}
          </td>
        </tr>
      );
    }
    if (!completed.length) {
      return (
        <tr>
          <td className="px-3 py-8 text-center text-sm text-slate-300/80" colSpan={10}>
            No completed bids yet.
          </td>
        </tr>
      );
    }
    return completed.map((row, index) => {
      const quote = statusRows.pickQuote(row);
      return (
        <tr key={row.id} className="border-t border-white/5">
          <td className="px-3 py-3 text-xs text-slate-300/80">{index + 1}</td>
          <td className="px-3 py-3">
            <div className="text-sm font-semibold text-slate-100">{row.partName}</div>
          </td>
          <td className="px-3 py-3">{row.carPlate ?? "—"}</td>
          <td className="px-3 py-3">{row.carMake ?? "—"}</td>
          <td className="px-3 py-3">{row.carModel ?? "—"}</td>
          <td className="px-3 py-3">{row.carVin ?? "—"}</td>
          <td className="px-3 py-3">{quote.qty ?? "—"} ({quote.type})</td>
          <td className="px-3 py-3">{quote.amount != null ? `${quote.amount} AED` : "—"}</td>
          <td className="px-3 py-3">
            {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : "—"}
          </td>
          <td className="px-3 py-3">—</td>
        </tr>
      );
    });
  }, [completed, completedError, completedLoading, statusRows]);

  const returnsBody = useMemo(() => {
    if (returnsLoading) {
      return (
        <tr>
          <td className="px-3 py-8 text-center text-sm text-slate-300/80" colSpan={10}>
            Loading returns...
          </td>
        </tr>
      );
    }
    if (returnsError) {
      return (
        <tr>
          <td className="px-3 py-8 text-center text-sm text-rose-300" colSpan={10}>
            {returnsError}
          </td>
        </tr>
      );
    }
    if (!returns.length) {
      return (
        <tr>
          <td className="px-3 py-8 text-center text-sm text-slate-300/80" colSpan={10}>
            No returned items yet.
          </td>
        </tr>
      );
    }
    return returns.map((row, index) => {
      const quote = statusRows.pickQuote(row);
      return (
        <tr key={row.id} className="border-t border-white/5">
          <td className="px-3 py-3 text-xs text-slate-300/80">{index + 1}</td>
          <td className="px-3 py-3">
            <div className="text-sm font-semibold text-slate-100">{row.partName}</div>
          </td>
          <td className="px-3 py-3">{row.carPlate ?? "—"}</td>
          <td className="px-3 py-3">{row.carMake ?? "—"}</td>
          <td className="px-3 py-3">{row.carModel ?? "—"}</td>
          <td className="px-3 py-3">{row.carVin ?? "—"}</td>
          <td className="px-3 py-3">{quote.qty ?? "—"} ({quote.type})</td>
          <td className="px-3 py-3">
            {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : "—"}
          </td>
          <td className="px-3 py-3">{row.status ?? "Returned"}</td>
          <td className="px-3 py-3">—</td>
        </tr>
      );
    });
  }, [returns, returnsError, returnsLoading, statusRows]);

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-[1600px] space-y-6 px-3 py-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950/90 via-slate-900/80 to-slate-950/90 p-6 shadow-[0_35px_80px_-45px_rgba(8,15,30,0.9)]">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-24 -top-24 h-56 w-56 rounded-full bg-emerald-400/15 blur-3xl" />
            <div className="absolute -right-16 top-6 h-48 w-48 rounded-full bg-sky-400/10 blur-3xl" />
            <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/30 to-transparent" />
          </div>
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-white/40">
                <span>Vendor Portal</span>
                <span className="h-1 w-1 rounded-full bg-white/30" />
                <span>Live Operations</span>
              </div>
              <h1 className="text-2xl font-semibold text-white">800CarGuru Parts Portal</h1>
              <p className="text-sm text-white/60">Vendor workspace for parts inquiries, bids, and deliveries.</p>
              <div className="flex flex-wrap gap-2 text-xs text-white/60">
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                  Company {companyId.slice(0, 8)}…
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                  Vendor {vendorId.slice(0, 8)}…
                </span>
              </div>
            </div>
            <div className="grid w-full max-w-sm gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">Car Make Filter</div>
                <button
                  type="button"
                  onClick={() => setSelectedMakes([])}
                  className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-white/70"
                >
                  Clear
                </button>
              </div>
              <select
                multiple
                className="min-h-[92px] rounded-xl bg-slate-900/80 px-2 py-2 text-sm text-slate-100 shadow-inner outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-emerald-400/60"
                value={selectedMakes}
                onChange={(e) =>
                  setSelectedMakes(Array.from(e.target.selectedOptions).map((opt) => opt.value))
                }
              >
                {MAKES.map((make) => (
                  <option key={make} value={make}>
                    {make}
                  </option>
                ))}
              </select>
              <div className="text-[11px] text-white/50">
                {selectedMakes.length ? `${selectedMakes.length} selected` : "Showing all makes"}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-white/5 bg-slate-950/80 p-4 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.9)]"
            >
              <div className="text-[11px] uppercase tracking-[0.2em] text-white/40">{card.label}</div>
              <div className={`mt-2 text-2xl font-semibold ${card.tone}`}>{card.value}</div>
              <div className="text-xs text-white/50">Updated just now</div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[240px,1fr]">
          <aside className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-slate-950/85 via-slate-900/70 to-slate-950/85 p-4 text-sm text-slate-100 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.85)]">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -right-12 -top-16 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl" />
              <div className="absolute -left-20 -bottom-20 h-44 w-44 rounded-full bg-amber-400/15 blur-3xl" />
              <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/5 to-transparent" />
            </div>
            <div className="relative mb-3 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/50">Section</span>
              <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.2em] text-white/80">
                Main
              </span>
            </div>
            <div className="relative space-y-2">
              {TAB_CONFIG.map((tab) => {
                const isActive = tab.id === activeTab;
                const count = tabCounts[tab.id] ?? 0;
                return (
                  <div key={tab.id} className="rounded-xl bg-white/[0.02]">
                    <button
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`group relative flex w-full items-center justify-between rounded-xl px-4 py-2.5 pl-6 text-left text-sm font-medium transition ${
                        isActive
                          ? "bg-white/12 text-white"
                          : "text-white/80 hover:bg-white/6"
                      }`}
                    >
                      <span
                        className={`absolute left-2 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full transition ${
                          isActive
                            ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]"
                            : "bg-white/10 group-hover:bg-white/30"
                        }`}
                      />
                      <span className="truncate">{tab.label}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          isActive
                            ? "bg-emerald-500/20 text-emerald-200"
                            : "bg-white/10 text-white/50"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </aside>

          <section className="space-y-4">
            {currentTab.id === "inquiries" && (
              <TableShell
                title="New Inquiries"
                subtitle={currentTab.subtitle}
                columns={["#", "Car Make", "Car Model", "Car Vin#", "Date", "Action"]}
                emptyText="No new inquiries yet."
                body={inquiriesBody}
              />
            )}

            {currentTab.id === "bids" && (
              <TableShell
                title="My Bids"
                subtitle={currentTab.subtitle}
                columns={[
                  "#",
                  "Part",
                  "Vehicle",
                  "Quotes",
                  "Date",
                ]}
                emptyText="No bids submitted yet."
                body={bidsBody}
              />
            )}

            {currentTab.id === "new_orders" && (
              <TableShell
                title="New Orders"
                subtitle={currentTab.subtitle}
                columns={[
                  "#",
                  "Part Name",
                  "Car Plate",
                  "Car Make",
                  "Car Model",
                  "Car Vin#",
                  "Quantity",
                  "Price (inc. VAT)",
                  "Status",
                  "Invoice",
                  "Date",
                ]}
                emptyText="No new orders yet."
                body={ordersBody}
              />
            )}

            {currentTab.id === "completed" && (
              <TableShell
                title="Completed Orders"
                subtitle={currentTab.subtitle}
                columns={[
                  "#",
                  "Part Name",
                  "Car Plate",
                  "Car Make",
                  "Car Model",
                  "Car Vin#",
                  "Quantity",
                  "Price (inc. VAT)",
                  "Purchase Date",
                  "Invoice",
                ]}
                emptyText="No completed orders yet."
                body={completedBody}
              />
            )}

            {currentTab.id === "returns" && (
              <TableShell
                title="Returns"
                subtitle={currentTab.subtitle}
                columns={[
                  "#",
                  "Part Name",
                  "Car Plate",
                  "Car Make",
                  "Car Model",
                  "Car Vin#",
                  "Quantity",
                  "Purchase Date",
                  "Status",
                  "Invoice",
                ]}
                emptyText="No return requests yet."
                body={returnsBody}
              />
            )}
          </section>
        </div>
      </div>

      {partsOpen && selectedInquiry ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-2 backdrop-blur-sm">
          <div className="w-full max-w-[1600px] overflow-hidden rounded-2xl border border-white/15 bg-slate-900/85 text-slate-100 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.85)]">
            <div className="flex items-center justify-between border-b border-white/10 bg-slate-900/70 px-4 py-3 text-sm font-semibold text-slate-100">
              <span>Enter Part Details.</span>
              <button
                type="button"
                onClick={() => {
                  setPartsOpen(false);
                  setPartsError(null);
                  setPartsRows([]);
                }}
                className="text-lg font-semibold text-slate-200 hover:text-white"
              >
                ×
              </button>
            </div>
            <div className="grid gap-3 border-b border-white/10 p-4 md:grid-cols-4">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-slate-300">Car Make</div>
                <input
                  readOnly
                  value={
                    selectedInquiry.sourceType === "inventory"
                      ? "Inventory"
                      : selectedInquiry.carMake ?? ""
                  }
                  className="w-full rounded-md border border-white/15 bg-slate-900/70 px-2 py-1 text-sm text-slate-100 placeholder:text-slate-400"
                />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold text-slate-300">Car Model</div>
                <input
                  readOnly
                  value={
                    selectedInquiry.sourceType === "inventory"
                      ? selectedInquiry.requestNumber ?? "Request"
                      : selectedInquiry.carModel ?? ""
                  }
                  className="w-full rounded-md border border-white/15 bg-slate-900/70 px-2 py-1 text-sm text-slate-100 placeholder:text-slate-400"
                />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold text-slate-300">Car Plate</div>
                <input
                  readOnly
                  value={selectedInquiry.sourceType === "inventory" ? "" : selectedInquiry.carPlate ?? ""}
                  className="w-full rounded-md border border-white/15 bg-slate-900/70 px-2 py-1 text-sm text-slate-100 placeholder:text-slate-400"
                />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold text-slate-300">Car Vin#</div>
                <input
                  readOnly
                  value={selectedInquiry.sourceType === "inventory" ? "" : selectedInquiry.carVin ?? ""}
                  className="w-full rounded-md border border-white/15 bg-slate-900/70 px-2 py-1 text-sm text-slate-100 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="max-h-[72vh] overflow-y-auto bg-slate-900/30 px-4 pb-6">
              {partsLoading ? (
                <div className="py-8 text-center text-sm text-slate-500">Loading parts...</div>
              ) : partsError ? (
                <div className="py-8 text-center text-sm text-rose-600">{partsError}</div>
              ) : partsRows.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400">No inquiry parts found.</div>
              ) : (
                <div className="space-y-4 pt-4">
                  {partsRows.map((row) => {
                    const form = partForms[row.id];
                    const status = submitStatus[row.id] ?? "idle";
                    const validationError = getRowValidationError(row, form);
                    const alreadySubmitted = Boolean(row.isSubmitted) || status === "saved";
                    const submitDisabled = status === "saving" || alreadySubmitted;
                    const options: Array<{
                      key: QuoteTypeKey;
                      label: string;
                      amountKey: keyof PartFormData;
                      qtyKey: keyof PartFormData;
                      etdKey: keyof PartFormData;
                      timeKey: keyof PartFormData;
                    }> = [
                      { key: "oem", label: "OEM", amountKey: "oemAmount", qtyKey: "oemQty", etdKey: "oemEtd", timeKey: "oemTime" },
                      { key: "oe", label: "Original", amountKey: "oeAmount", qtyKey: "oeQty", etdKey: "oeEtd", timeKey: "oeTime" },
                      { key: "aftm", label: "After Market", amountKey: "aftmAmount", qtyKey: "aftmQty", etdKey: "aftmEtd", timeKey: "aftmTime" },
                      { key: "used", label: "Used", amountKey: "usedAmount", qtyKey: "usedQty", etdKey: "usedEtd", timeKey: "usedTime" },
                    ];

                    return (
                      <div key={row.id} className="rounded-xl border border-slate-700/70 bg-slate-900/45 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-100">{row.partName}</div>
                            <div className="text-xs text-slate-400">{row.description || "No description"}</div>
                          </div>
                          <div className="flex gap-2 text-[11px]">
                            <span className="rounded-full border border-slate-600 px-2 py-1 text-slate-300">Qty: {row.quantity ?? "-"}</span>
                            <span className="rounded-full border border-slate-600 px-2 py-1 text-slate-300">Type: {row.partType ?? "Any"}</span>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-3 md:grid-cols-[1fr,1fr]">
                          <div className="space-y-2 rounded-lg border border-slate-700/60 bg-slate-950/30 p-3">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">Part Info</div>
                            <input
                              className="w-full rounded border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500"
                              placeholder="Part Number"
                              value={form?.partNumber ?? ""}
                              onChange={(e) => updatePartForm(row.id, "partNumber", e.target.value)}
                              onBlur={() => markDraftSaved(row.id)}
                            />
                            <input type="file" className="w-full text-xs text-slate-300" />
                            <textarea
                              className="h-20 w-full rounded border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500"
                              placeholder="Remarks"
                              value={form?.remarks ?? ""}
                              onChange={(e) => updatePartForm(row.id, "remarks", e.target.value)}
                              onBlur={() => markDraftSaved(row.id)}
                            />
                          </div>

                          <div className="space-y-2 rounded-lg border border-slate-700/60 bg-slate-950/30 p-3">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">Quote Options</div>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {options.map((opt) => {
                                const enabled = isTypeEnabled(row, opt.key);
                                return (
                                  <div key={opt.key} className={`rounded-lg border p-2 ${enabled ? "border-slate-700 bg-slate-900/40" : "border-slate-800 bg-slate-900/20 opacity-50"}`}>
                                    <div className="mb-1 text-[11px] font-semibold text-slate-300">{opt.label}</div>
                                    <input
                                      className="w-full rounded border border-slate-700 bg-slate-950/80 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500"
                                      placeholder={`${opt.label} Unit Price`}
                                      value={(form?.[opt.amountKey] as string) ?? ""}
                                      onChange={(e) => updatePartForm(row.id, opt.amountKey, e.target.value)}
                                      onBlur={() => markDraftSaved(row.id)}
                                      disabled={!enabled}
                                    />
                                    <div className="mt-1 grid grid-cols-2 gap-1">
                                      <input
                                        className="rounded border border-slate-700 bg-slate-950/80 px-2 py-1 text-xs text-slate-100"
                                        placeholder="Qty"
                                        value={(form?.[opt.qtyKey] as string) ?? "1"}
                                        onChange={(e) => updatePartForm(row.id, opt.qtyKey, e.target.value)}
                                        onBlur={() => markDraftSaved(row.id)}
                                        disabled={!enabled}
                                      />
                                      <select
                                        className="rounded border border-slate-700 bg-slate-950/80 px-2 py-1 text-xs text-slate-100"
                                        value={(form?.[opt.etdKey] as string) ?? "Same Day"}
                                        onChange={(e) => updatePartForm(row.id, opt.etdKey, e.target.value)}
                                        onBlur={() => markDraftSaved(row.id)}
                                        disabled={!enabled}
                                      >
                                        <option>Same Day</option>
                                        <option>1-2 Days</option>
                                        <option>Custom</option>
                                      </select>
                                    </div>
                                    <input
                                      className="mt-1 w-full rounded border border-slate-700 bg-slate-950/80 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500"
                                      placeholder={(form?.[opt.etdKey] as string) === "Custom" ? "Enter custom time" : "--:--"}
                                      value={(form?.[opt.timeKey] as string) ?? ""}
                                      onChange={(e) => updatePartForm(row.id, opt.timeKey, e.target.value)}
                                      onBlur={() => markDraftSaved(row.id)}
                                      disabled={!enabled}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-700/60 pt-3">
                          <div className="text-[11px]">
                            {submitErrors[row.id] ? (
                              <span className="text-rose-400">{submitErrors[row.id]}</span>
                            ) : alreadySubmitted ? (
                              <span className="text-emerald-300">Already submitted.</span>
                            ) : validationError ? (
                              <span className="text-amber-300">{validationError}</span>
                            ) : draftSavedAt[row.id] ? (
                              <span className="text-slate-400">Draft saved at {draftSavedAt[row.id]}</span>
                            ) : (
                              <span className="text-slate-400">Fill at least one quote option.</span>
                            )}
                          </div>
                          <button
                            type="button"
                            disabled={submitDisabled}
                            onClick={async () => {
                              if (!selectedInquiry || !form) return;
                              if (alreadySubmitted) return;
                              if (validationError) {
                                setSubmitStatus((prev) => ({ ...prev, [row.id]: "error" }));
                                setSubmitErrors((prev) => ({ ...prev, [row.id]: validationError }));
                                return;
                              }
                              setSubmitStatus((prev) => ({ ...prev, [row.id]: "saving" }));
                              setSubmitErrors((prev) => ({ ...prev, [row.id]: "" }));
                              try {
                                const res = await fetch(`/api/company/${companyId}/vendors/${vendorId}/part-quotes`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    ...(selectedInquiry.sourceType === "inventory"
                                      ? { inventoryRequestId: selectedInquiry.inquiryId, inventoryRequestItemId: row.id }
                                      : { inspectionId: selectedInquiry.inquiryId, lineItemId: row.id }),
                                    partNumber: form.partNumber ?? "",
                                    remarks: form.remarks ?? "",
                                    oemAmount: form.oemAmount ?? "",
                                    oeAmount: form.oeAmount ?? "",
                                    aftmAmount: form.aftmAmount ?? "",
                                    usedAmount: form.usedAmount ?? "",
                                    oemQty: form.oemQty ?? "",
                                    oeQty: form.oeQty ?? "",
                                    aftmQty: form.aftmQty ?? "",
                                    usedQty: form.usedQty ?? "",
                                    oemEtd: form.oemEtd ?? "",
                                    oeEtd: form.oeEtd ?? "",
                                    aftmEtd: form.aftmEtd ?? "",
                                    usedEtd: form.usedEtd ?? "",
                                    oemTime: form.oemTime ?? "",
                                    oeTime: form.oeTime ?? "",
                                    aftmTime: form.aftmTime ?? "",
                                    usedTime: form.usedTime ?? "",
                                  }),
                                });
                                if (!res.ok) {
                                  const payload = await res.json().catch(() => null);
                                  if (res.status === 409) {
                                    setPartsRows((prev) =>
                                      prev.map((p) => (p.id === row.id ? { ...p, isSubmitted: true } : p))
                                    );
                                    setSubmitStatus((prev) => ({ ...prev, [row.id]: "saved" }));
                                    setSubmitErrors((prev) => ({ ...prev, [row.id]: "" }));
                                    return;
                                  }
                                  throw new Error(payload?.error ?? `Failed to submit (${res.status})`);
                                }
                                setSubmitStatus((prev) => ({ ...prev, [row.id]: "saved" }));
                                setSubmitAt((prev) => ({ ...prev, [row.id]: new Date().toLocaleTimeString() }));
                                setPartsRows((prev) =>
                                  prev.map((p) => (p.id === row.id ? { ...p, isSubmitted: true } : p))
                                );
                              } catch (err: any) {
                                setSubmitStatus((prev) => ({ ...prev, [row.id]: "error" }));
                                setSubmitErrors((prev) => ({
                                  ...prev,
                                  [row.id]: err?.message ?? "Failed to submit",
                                }));
                              }
                            }}
                            className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {status === "saving"
                              ? "Saving..."
                              : alreadySubmitted
                              ? "Submitted"
                              : "Submit Quote"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            </div>
          </div>
      ) : null}
    </AppLayout>
  );
}
