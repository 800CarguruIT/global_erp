"use client";

import { AppLayout } from "@repo/ui";
import { DropzoneFileInput } from "@repo/ui/components/common/DropzoneFileInput";
import { useParams } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

type QuoteTypeKey = "oem" | "oe" | "aftm" | "used";
type PartFormData = {
  attachmentName: string;
  partNumber: string;
  diagramFileId: string;
  diagramFileName: string;
  remarks: string;
  oemBrand: string;
  oeBrand: string;
  aftmBrand: string;
  usedBrand: string;
  oemCustomBrandName: string;
  oeCustomBrandName: string;
  aftmCustomBrandName: string;
  usedCustomBrandName: string;
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
  attachmentName: "",
  partNumber: "",
  diagramFileId: "",
  diagramFileName: "",
  remarks: "",
  oemBrand: "",
  oeBrand: "",
  aftmBrand: "",
  usedBrand: "",
  oemCustomBrandName: "",
  oeCustomBrandName: "",
  aftmCustomBrandName: "",
  usedCustomBrandName: "",
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

const BRAND_OTHER_VALUE = "__other__";

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
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 bg-gradient-to-r from-slate-950/70 via-slate-900/60 to-slate-950/80 px-3 py-3 sm:px-4">
        <div>
          <div className="text-sm font-semibold sm:text-base">{title}</div>
          <div className="text-xs text-muted-foreground">{subtitle}</div>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-white/60">
          Live
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[920px] text-xs sm:min-w-full sm:text-sm">
          <thead className="bg-slate-900/70 text-xs uppercase tracking-wide text-slate-300">
            <tr>
              {columns.map((col) => (
                <th key={col} className="px-2 py-2 text-left font-medium sm:px-3">
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

export default function VendorDashboardPage() {
  const routeParams = useParams();
  const companyId =
    (typeof routeParams?.companyId === "string" ? routeParams.companyId : routeParams?.companyId?.[0]) ??
    "";
  const vendorId =
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
  const [diagramUploading, setDiagramUploading] = useState<Record<string, boolean>>({});
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
      partNumber?: string | null;
      description?: string | null;
      quantity?: number | null;
      partType?: string | null;
      itemSource?: "line_item";
      isSubmitted?: boolean;
    }>
  >([]);
  const [brandOptionsByRow, setBrandOptionsByRow] = useState<Record<string, string[]>>({});
  const [brandLoadingByRow, setBrandLoadingByRow] = useState<Record<string, boolean>>({});
  const [brandTypeaheadByField, setBrandTypeaheadByField] = useState<Record<string, string[]>>({});
  const brandTypeaheadTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const savedTypedBrandsRef = useRef<Set<string>>(new Set());
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
      deliveryNoteNo?: string | null;
      deliveryNoteStatus?: string | null;
      deliveryDestinationBranchId?: string | null;
      deliverySourceName?: string | null;
      deliverySourceLocation?: string | null;
      deliverySourceUrl?: string | null;
      deliveryDestinationName?: string | null;
      deliveryDestinationLocation?: string | null;
      deliveryDestinationUrl?: string | null;
      vendorPartNumber?: string | null;
      diagramFileId?: string | null;
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
  const [deliveryNoteModal, setDeliveryNoteModal] = useState<{
    noteNo?: string | null;
    status?: string | null;
    sourceName?: string | null;
    sourceLocation?: string | null;
    sourceUrl?: string | null;
    destinationName?: string | null;
    destinationLocation?: string | null;
    destinationBranchId?: string | null;
    destinationUrl?: string | null;
    items: Array<{ partName: string; qty: string; price: string }>;
    updatedAt?: string | null;
  } | null>(null);

  // Part details modal (part number + diagram before viewing order)
  const [partDetailsModal, setPartDetailsModal] = useState<{
    quoteId: string;
    partName: string;
    carInfo: string;
  } | null>(null);
  const [partDetailsForm, setPartDetailsForm] = useState({ partNumber: "", diagramFileId: "", diagramFileName: "" });
  const [partDetailsSaving, setPartDetailsSaving] = useState(false);
  const [partDetailsError, setPartDetailsError] = useState<string | null>(null);

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
  const activeTabCount = tabCounts[activeTab] ?? 0;

  useEffect(() => {
    if (!partsRows.length) return;
    setPartForms((prev) => {
      const next = { ...prev };
      for (const row of partsRows) {
        if (!next[row.id]) {
          next[row.id] = {
            ...createEmptyPartForm(),
            partNumber: String(row.partNumber ?? "").trim(),
          };
        }
      }
      return next;
    });
  }, [partsRows]);

  useEffect(() => {
    if (!partsOpen || !partsRows.length || !companyId || !vendorId) return;
    let cancelled = false;
    const controller = new AbortController();

    async function loadBrandSuggestions() {
      const pendingRows = partsRows.filter((row) => !brandOptionsByRow[row.id]?.length);
      if (!pendingRows.length) return;

      const setLoading = (rowId: string, loading: boolean) => {
        setBrandLoadingByRow((prev) => ({ ...prev, [rowId]: loading }));
      };

      await Promise.all(
        pendingRows.map(async (row) => {
          setLoading(row.id, true);
          try {
            const res = await fetch(`/api/company/${companyId}/vendors/${vendorId}/brand-suggestions`, {
              method: "POST",
              signal: controller.signal,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                partName: row.partName,
                partNumber: row.partNumber ?? "",
                carMake: selectedInquiry?.carMake ?? "",
                carModel: selectedInquiry?.carModel ?? "",
              }),
            });
            if (!res.ok) throw new Error(`Failed (${res.status})`);
            const payload = await res.json();
            const options = Array.isArray(payload?.data)
              ? payload.data.map((item: unknown) => String(item ?? "").trim()).filter(Boolean)
              : [];
            if (!cancelled) {
              setBrandOptionsByRow((prev) => ({
                ...prev,
                [row.id]: options.length ? options : ["Other"],
              }));
            }
          } catch {
            if (!cancelled) {
              setBrandOptionsByRow((prev) => ({
                ...prev,
                [row.id]: prev[row.id]?.length ? prev[row.id] : ["Other"],
              }));
            }
          } finally {
            if (!cancelled) setLoading(row.id, false);
          }
        })
      );
    }

    loadBrandSuggestions();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [partsOpen, partsRows, companyId, vendorId, selectedInquiry?.carMake, selectedInquiry?.carModel, brandOptionsByRow]);

  useEffect(() => {
    return () => {
      Object.values(brandTypeaheadTimersRef.current).forEach((timer) => clearTimeout(timer));
      brandTypeaheadTimersRef.current = {};
    };
  }, []);

  // Load ALL tab data on mount so counts show immediately
  useEffect(() => {
    if (!companyId || !vendorId) return;
    const controller = new AbortController();
    const fetchQuiet = async (url: string) => {
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data?.data) ? data.data : [];
      } catch { return []; }
    };
    Promise.all([
      fetchQuiet(`/api/company/${companyId}/vendors/${vendorId}/bids`),
      fetchQuiet(`/api/company/${companyId}/vendors/${vendorId}/bids?status=Ordered`),
      fetchQuiet(`/api/company/${companyId}/vendors/${vendorId}/bids?status=completed`),
      fetchQuiet(`/api/company/${companyId}/vendors/${vendorId}/bids?status=returns`),
    ]).then(([b, o, c, r]) => {
      setBids(b); setOrders(o); setCompleted(c); setReturns(r);
    });
    return () => controller.abort();
  }, [companyId, vendorId]);

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
                setBrandOptionsByRow({});
                setBrandLoadingByRow({});
                setBrandTypeaheadByField({});
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

  const openDeliveryNoteModal = useCallback(
    (row: (typeof bids)[number]) => {
      const allRows = [...orders, ...completed, ...returns, ...bids];
      const noteNo = String(row.deliveryNoteNo ?? "").trim();
      const sameNoteRows = noteNo
        ? allRows.filter((r) => String(r.deliveryNoteNo ?? "").trim() === noteNo)
        : [row];
      const uniqueRows = Array.from(new Map(sameNoteRows.map((r) => [r.id, r])).values());
      const items = uniqueRows.map((r) => {
        const q = statusRows.pickQuote(r);
        return {
          partName: String(r.partName ?? "-"),
          qty: `${q.qty ?? "-"} (${q.type})`,
          price: q.amount != null ? `${q.amount} AED` : "-",
        };
      });
      const firstWithDestination =
        uniqueRows.find((r) => r.deliveryDestinationName || r.deliveryDestinationBranchId) ?? row;
      const firstWithSourceUrl = uniqueRows.find((r) => r.deliverySourceUrl) ?? row;
      const firstWithDestinationUrl = uniqueRows.find((r) => r.deliveryDestinationUrl) ?? firstWithDestination;
      const firstWithDestinationLocation =
        uniqueRows.find((r) => r.deliveryDestinationLocation || r.deliveryDestinationName) ?? firstWithDestination;
      setDeliveryNoteModal({
        noteNo: row.deliveryNoteNo ?? null,
        status: row.deliveryNoteStatus ?? null,
        sourceName: row.deliverySourceName ?? null,
        sourceLocation: row.deliverySourceLocation ?? null,
        sourceUrl: firstWithSourceUrl.deliverySourceUrl ?? null,
        destinationName: firstWithDestination.deliveryDestinationName ?? null,
        destinationLocation: firstWithDestinationLocation.deliveryDestinationLocation ?? null,
        destinationBranchId: firstWithDestination.deliveryDestinationBranchId ?? null,
        destinationUrl: firstWithDestinationUrl.deliveryDestinationUrl ?? null,
        items,
        updatedAt: row.updatedAt ?? null,
      });
    },
    [bids, orders, completed, returns, statusRows]
  );

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

  const requestBrandTypeahead = (row: { id: string; partName: string; partNumber?: string | null }, type: QuoteTypeKey, query: string) => {
    if (!companyId || !vendorId) return;
    const fieldKey = `${row.id}:${type}`;
    const existingTimer = brandTypeaheadTimersRef.current[fieldKey];
    if (existingTimer) clearTimeout(existingTimer);
    if (!query.trim()) {
      setBrandTypeaheadByField((prev) => {
        const next = { ...prev };
        delete next[fieldKey];
        return next;
      });
      return;
    }
    brandTypeaheadTimersRef.current[fieldKey] = setTimeout(async () => {
      try {
        const res = await fetch(`/api/company/${companyId}/vendors/${vendorId}/brand-suggestions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            partName: row.partName,
            partNumber: row.partNumber ?? "",
            carMake: selectedInquiry?.carMake ?? "",
            carModel: selectedInquiry?.carModel ?? "",
            query,
          }),
        });
        if (!res.ok) throw new Error(`Failed (${res.status})`);
        const payload = await res.json();
        const options = Array.isArray(payload?.data)
          ? payload.data
              .map((item: unknown) => String(item ?? "").trim())
              .filter((item: string) => item && item.toLowerCase() !== "other")
          : [];
        setBrandTypeaheadByField((prev) => ({ ...prev, [fieldKey]: options.slice(0, 15) }));
      } catch {
        // Keep typed value usable even when live suggestions fail.
      }
    }, 320);
  };

  const persistTypedBrand = async (brandNameRaw: string) => {
    const brandName = String(brandNameRaw ?? "").trim().replace(/\s+/g, " ");
    if (!brandName || !companyId || !vendorId) return;
    const key = brandName.toLowerCase();
    if (savedTypedBrandsRef.current.has(key)) return;
    savedTypedBrandsRef.current.add(key);
    try {
      await fetch(`/api/company/${companyId}/vendors/${vendorId}/brand-suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upsert", brandName }),
      });
    } catch {
      savedTypedBrandsRef.current.delete(key);
    }
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

    const validations: Array<{
      type: QuoteTypeKey;
      amount: string;
      etd: string;
      time: string;
      brand: string;
      customBrandName: string;
    }> = [
      {
        type: "oem",
        amount: form.oemAmount,
        etd: form.oemEtd,
        time: form.oemTime,
        brand: form.oemBrand,
        customBrandName: form.oemCustomBrandName,
      },
      {
        type: "oe",
        amount: form.oeAmount,
        etd: form.oeEtd,
        time: form.oeTime,
        brand: form.oeBrand,
        customBrandName: form.oeCustomBrandName,
      },
      {
        type: "aftm",
        amount: form.aftmAmount,
        etd: form.aftmEtd,
        time: form.aftmTime,
        brand: form.aftmBrand,
        customBrandName: form.aftmCustomBrandName,
      },
      {
        type: "used",
        amount: form.usedAmount,
        etd: form.usedEtd,
        time: form.usedTime,
        brand: form.usedBrand,
        customBrandName: form.usedCustomBrandName,
      },
    ];

    for (const check of validations) {
      if (!isTypeEnabled(row, check.type)) continue;
      if (toPositiveNumber(check.amount) <= 0) continue;
      const selectedBrand = String(check.brand ?? "").trim();
      if (!selectedBrand) {
        return `Select ${check.type.toUpperCase()} brand.`;
      }
      if (selectedBrand === BRAND_OTHER_VALUE && !String(check.customBrandName ?? "").trim()) {
        return `Enter custom brand for ${check.type.toUpperCase()}.`;
      }
      if (check.etd === "Same Day") {
        const hours = Number(String(check.time ?? "").trim());
        if (!Number.isFinite(hours) || hours < 1 || hours > 8) {
          return "For Same Day, select delivery hours (1-8).";
        }
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
      const qtyLabel = `${quote.qty ?? "—"} (${quote.type})`;
      const priceLabel = quote.amount != null ? `${quote.amount} AED` : "—";
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
          <td className="px-3 py-3">{qtyLabel}</td>
          <td className="px-3 py-3">{priceLabel}</td>
          <td className="px-3 py-3">{row.status ?? "Ordered"}</td>
          <td className="px-3 py-3 text-xs">
            <div className="font-semibold text-emerald-300">{row.deliveryNoteNo ?? "-"}</div>
            <div className="text-slate-300/80">{row.deliveryNoteStatus ?? "issued"}</div>
            <div className="text-[10px] text-slate-400">
              Location: {row.deliveryDestinationLocation ?? row.deliveryDestinationName ?? "Assigned Workshop"}
            </div>
            {row.deliveryDestinationName ? (
              <div className="text-[10px] text-slate-400">Destination: {row.deliveryDestinationName}</div>
            ) : null}
            {row.deliveryDestinationBranchId ? (
              <div className="text-[10px] text-slate-400">Dest: {row.deliveryDestinationBranchId}</div>
            ) : null}
            {row.vendorPartNumber && row.diagramFileId ? (
              <button
                type="button"
                onClick={() => openDeliveryNoteModal(row)}
                className="mt-1 rounded border border-cyan-500/60 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-500/20"
              >
                View
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setPartDetailsModal({
                    quoteId: row.id,
                    partName: row.partName ?? "Part",
                    carInfo: [row.carMake, row.carModel, row.carPlate].filter(Boolean).join(" | "),
                  });
                  setPartDetailsForm({ partNumber: row.vendorPartNumber ?? "", diagramFileId: row.diagramFileId ?? "", diagramFileName: "" });
                  setPartDetailsError(null);
                }}
                className="mt-1 rounded border border-amber-500/60 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200 hover:bg-amber-500/20"
              >
                Complete Details
              </button>
            )}
          </td>
          <td className="px-3 py-3 text-xs text-slate-300/80">
            {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : "—"}
          </td>
        </tr>
      );
    });
  }, [orders, ordersError, ordersLoading, statusRows, openDeliveryNoteModal]);

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
      const qtyLabel = `${quote.qty ?? "-"} (${quote.type})`;
      const priceLabel = quote.amount != null ? `${quote.amount} AED` : "-";
      return (
        <tr key={row.id} className="border-t border-white/5">
          <td className="px-3 py-3 text-xs text-slate-300/80">{index + 1}</td>
          <td className="px-3 py-3">
            <div className="text-sm font-semibold text-slate-100">{row.partName}</div>
          </td>
          <td className="px-3 py-3">{row.carPlate ?? "-"}</td>
          <td className="px-3 py-3">{row.carMake ?? "-"}</td>
          <td className="px-3 py-3">{row.carModel ?? "-"}</td>
          <td className="px-3 py-3">{row.carVin ?? "-"}</td>
          <td className="px-3 py-3">{qtyLabel}</td>
          <td className="px-3 py-3">{priceLabel}</td>
          <td className="px-3 py-3">
            {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : "-"}
          </td>
          <td className="px-3 py-3 text-xs">
            <div className="font-semibold text-emerald-300">{row.deliveryNoteNo ?? "-"}</div>
            <div className="text-slate-300/80">{row.deliveryNoteStatus ?? "received"}</div>
            <div className="text-[10px] text-slate-400">
              Location: {row.deliveryDestinationLocation ?? row.deliveryDestinationName ?? "Assigned Workshop"}
            </div>
            {row.deliveryDestinationName ? (
              <div className="text-[10px] text-slate-400">Destination: {row.deliveryDestinationName}</div>
            ) : null}
            {row.deliveryNoteNo || row.deliveryNoteStatus || row.deliverySourceName || row.deliveryDestinationName ? (
              <button
                type="button"
                onClick={() => openDeliveryNoteModal(row)}
                className="mt-1 rounded border border-cyan-500/60 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-500/20"
              >
                View
              </button>
            ) : null}
          </td>
        </tr>
      );
    });
  }, [completed, completedError, completedLoading, statusRows, openDeliveryNoteModal]);

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
      const qtyLabel = `${quote.qty ?? "-"} (${quote.type})`;
      return (
        <tr key={row.id} className="border-t border-white/5">
          <td className="px-3 py-3 text-xs text-slate-300/80">{index + 1}</td>
          <td className="px-3 py-3">
            <div className="text-sm font-semibold text-slate-100">{row.partName}</div>
          </td>
          <td className="px-3 py-3">{row.carPlate ?? "-"}</td>
          <td className="px-3 py-3">{row.carMake ?? "-"}</td>
          <td className="px-3 py-3">{row.carModel ?? "-"}</td>
          <td className="px-3 py-3">{row.carVin ?? "-"}</td>
          <td className="px-3 py-3">{qtyLabel}</td>
          <td className="px-3 py-3">
            {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : "-"}
          </td>
          <td className="px-3 py-3">{row.status ?? "Returned"}</td>
          <td className="px-3 py-3 text-xs">
            <div className="font-semibold text-emerald-300">{row.deliveryNoteNo ?? "-"}</div>
            <div className="text-slate-300/80">{row.deliveryNoteStatus ?? "return_pending"}</div>
            <div className="text-[10px] text-slate-400">
              Location: {row.deliveryDestinationLocation ?? row.deliveryDestinationName ?? "Assigned Workshop"}
            </div>
            {row.deliveryDestinationName ? (
              <div className="text-[10px] text-slate-400">Destination: {row.deliveryDestinationName}</div>
            ) : null}
            {row.deliveryNoteNo || row.deliveryNoteStatus || row.deliverySourceName || row.deliveryDestinationName ? (
              <button
                type="button"
                onClick={() => openDeliveryNoteModal(row)}
                className="mt-1 rounded border border-cyan-500/60 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-500/20"
              >
                View
              </button>
            ) : null}
          </td>
        </tr>
      );
    });
  }, [returns, returnsError, returnsLoading, statusRows, openDeliveryNoteModal]);

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-[1600px] space-y-6 px-3 py-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950/90 via-slate-900/80 to-slate-950/90 p-4 shadow-[0_35px_80px_-45px_rgba(8,15,30,0.9)] sm:p-6">
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
              <h1 className="text-xl font-semibold text-white sm:text-2xl">800CarGuru Parts Portal</h1>
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
            <div className="grid w-full gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:max-w-sm">
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
                className="min-h-[84px] rounded-xl bg-slate-900/80 px-2 py-2 text-sm text-slate-100 shadow-inner outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-emerald-400/60 sm:min-h-[92px]"
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

        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-950/80 p-3 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.9)]">
            <div className="space-y-3">
              <div className="rounded-2xl bg-white/[0.03] shadow-sm backdrop-blur">
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="w-full overflow-x-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20">
                    <div className="inline-flex min-w-max flex-nowrap gap-2 text-xs">
                      {TAB_CONFIG.map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`min-w-[120px] shrink-0 inline-flex items-center justify-between gap-2 rounded-full px-4 py-1.5 text-[11px] font-medium transition ${
                              isActive
                                ? "bg-gradient-to-b from-emerald-500/30 to-emerald-500/10 text-emerald-100 shadow-[0_0_8px_rgba(16,185,129,0.35)] border border-emerald-400/40"
                                : "bg-white/5 text-white/70 border border-white/10 hover:text-white hover:border-white/30"
                            }`}
                          >
                            <span>{tab.label}</span>
                            <span
                              className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                isActive ? "bg-emerald-200/20 text-emerald-100" : "bg-white/15 text-white/90"
                              }`}
                            >
                              {tabCounts[tab.id] ?? 0}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="text-xs text-white/70">{activeTabCount} entries</div>
                </div>
                <div className="px-4 pb-3 text-xs text-white/70">{currentTab.subtitle}</div>
              </div>
            </div>
          </div>

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
                  "Delivery Note",
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
                  "Delivery Note",
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
                  "Delivery Note",
                ]}
                emptyText="No return requests yet."
                body={returnsBody}
              />
            )}
          </section>
        </div>
      </div>

      {/* Part Details Modal */}
      {partDetailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-amber-400/25 bg-gradient-to-b from-slate-950 via-slate-900/95 to-slate-950 shadow-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-bold text-white">Complete Part Details</div>
                <div className="text-[11px] text-slate-400">Required before viewing order</div>
              </div>
              <button type="button" onClick={() => setPartDetailsModal(null)} className="text-slate-500 hover:text-white text-lg">&times;</button>
            </div>

            <div className="mb-4 rounded-lg border border-slate-700/60 bg-slate-950/50 p-3">
              <div className="text-sm font-semibold text-white">{partDetailsModal.partName}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{partDetailsModal.carInfo}</div>
            </div>

            {partDetailsError && <div className="mb-3 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-300">{partDetailsError}</div>}

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Part Number <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  className="h-9 w-full rounded border border-slate-700 bg-slate-950/80 px-3 text-xs text-slate-100 placeholder:text-slate-500"
                  placeholder="e.g. 4M0827211"
                  value={partDetailsForm.partNumber}
                  onChange={(e) => setPartDetailsForm((prev) => ({ ...prev, partNumber: e.target.value }))}
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Part Diagram <span className="text-red-400">*</span></label>
                {partDetailsForm.diagramFileId ? (
                  <div className="flex items-center justify-between rounded border border-emerald-700/50 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300">
                    <span className="truncate">{partDetailsForm.diagramFileName || "Diagram uploaded"}</span>
                    <button type="button" onClick={() => setPartDetailsForm((prev) => ({ ...prev, diagramFileId: "", diagramFileName: "" }))} className="ml-2 text-slate-400 hover:text-rose-400">&times;</button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded border-2 border-dashed border-slate-700 bg-slate-950/50 px-4 py-6 text-xs text-slate-400 hover:border-amber-500/40 hover:text-amber-300 transition">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setPartDetailsSaving(true);
                        try {
                          const fd = new FormData();
                          fd.append("file", file);
                          fd.append("kind", "image");
                          const res = await fetch("/api/files/upload", { method: "POST", body: fd });
                          const data = await res.json().catch(() => ({}));
                          if (!res.ok) throw new Error(data?.error ?? "Upload failed");
                          setPartDetailsForm((prev) => ({ ...prev, diagramFileId: String(data?.fileId ?? ""), diagramFileName: file.name }));
                        } catch (err: any) {
                          setPartDetailsError(err?.message ?? "Upload failed");
                        } finally {
                          setPartDetailsSaving(false);
                        }
                      }}
                    />
                    {partDetailsSaving ? "Uploading..." : "Click to upload diagram photo"}
                  </label>
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setPartDetailsModal(null)} className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700">Cancel</button>
              <button
                type="button"
                disabled={partDetailsSaving || !partDetailsForm.partNumber.trim() || !partDetailsForm.diagramFileId}
                className="rounded bg-amber-500 px-4 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
                onClick={async () => {
                  if (!partDetailsForm.partNumber.trim() || !partDetailsForm.diagramFileId) {
                    setPartDetailsError("Both part number and diagram are required.");
                    return;
                  }
                  setPartDetailsSaving(true);
                  setPartDetailsError(null);
                  try {
                    const res = await fetch(
                      `/api/company/${companyId}/vendors/${vendorId}/part-quotes/${partDetailsModal.quoteId}/part-details`,
                      {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          partNumber: partDetailsForm.partNumber.trim(),
                          diagramFileId: partDetailsForm.diagramFileId,
                        }),
                      }
                    );
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(data?.error ?? "Failed to save");
                    // Update local state so View button appears
                    setOrders((prev) => prev.map((o) => o.id === partDetailsModal.quoteId ? { ...o, vendorPartNumber: partDetailsForm.partNumber.trim(), diagramFileId: partDetailsForm.diagramFileId } : o));
                    setPartDetailsModal(null);
                  } catch (err: any) {
                    setPartDetailsError(err?.message ?? "Failed to save part details");
                  } finally {
                    setPartDetailsSaving(false);
                  }
                }}
              >
                {partDetailsSaving ? "Saving..." : "Save & Continue"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deliveryNoteModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-cyan-400/25 bg-gradient-to-b from-slate-950 via-slate-900/95 to-slate-950 shadow-[0_35px_90px_-45px_rgba(6,182,212,0.45)]">
            <div className="flex items-start justify-between border-b border-white/10 bg-white/[0.03] px-5 py-4">
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-[0.25em] text-white/45">Delivery Note</div>
                <div className="text-lg font-semibold text-cyan-200">
                  {deliveryNoteModal.noteNo ?? "Not Issued Yet"}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase ${
                      String(deliveryNoteModal.status ?? "").toLowerCase().includes("issue")
                        ? "border-amber-400/40 bg-amber-500/15 text-amber-200"
                        : String(deliveryNoteModal.status ?? "").toLowerCase().includes("return")
                        ? "border-rose-400/40 bg-rose-500/15 text-rose-200"
                        : "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
                    }`}
                  >
                    {deliveryNoteModal.status ?? "Pending"}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Updated{" "}
                    {deliveryNoteModal.updatedAt
                      ? new Date(deliveryNoteModal.updatedAt).toLocaleString()
                      : "-"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeliveryNoteModal(null)}
                className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80 hover:bg-white/20"
              >
                Close
              </button>
            </div>

            <div className="p-5">
              <div className="overflow-hidden rounded-xl border border-white/10">
                <table className="w-full text-xs text-slate-100">
                  <thead className="bg-slate-900/90 text-[10px] uppercase tracking-[0.2em] text-slate-400">
                    <tr>
                      <th className="px-3 py-2 text-left">Part</th>
                      <th className="px-3 py-2 text-left">Qty</th>
                      <th className="px-3 py-2 text-left">Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 bg-slate-950/60">
                    {(deliveryNoteModal.items.length ? deliveryNoteModal.items : [{ partName: "-", qty: "-", price: "-" }]).map(
                      (item, idx) => (
                        <tr key={`${item.partName}-${idx}`}>
                          <td className="px-3 py-2 font-medium text-cyan-100">{item.partName}</td>
                          <td className="px-3 py-2 text-emerald-100">{item.qty}</td>
                          <td className="px-3 py-2 text-amber-100">{item.price}</td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-3 border-t border-white/10 px-5 py-4 md:grid-cols-2">
              {(() => {
                const sourceMapUrl =
                  deliveryNoteModal.sourceUrl ??
                  (deliveryNoteModal.sourceLocation
                    ? `https://www.google.com/maps?q=${encodeURIComponent(deliveryNoteModal.sourceLocation)}`
                    : deliveryNoteModal.sourceName
                    ? `https://www.google.com/maps?q=${encodeURIComponent(deliveryNoteModal.sourceName)}`
                    : null);
                const destinationSearchText =
                  deliveryNoteModal.destinationLocation ??
                  deliveryNoteModal.destinationName ??
                  (deliveryNoteModal.destinationBranchId
                    ? `Workshop ${deliveryNoteModal.destinationBranchId}`
                    : "Assigned Workshop");
                const destinationMapUrl =
                  deliveryNoteModal.destinationUrl ??
                  `https://www.google.com/maps?q=${encodeURIComponent(destinationSearchText)}`;
                return (
                  <>
              <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Pickup Location</div>
                <div className="mt-1 text-sm font-medium text-slate-100">
                  {deliveryNoteModal.sourceName ?? "-"}
                  {deliveryNoteModal.sourceLocation ? ` (${deliveryNoteModal.sourceLocation})` : ""}
                </div>
                {sourceMapUrl ? (
                  <div className="mt-2 space-y-1">
                    <a
                      href={sourceMapUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex rounded border border-cyan-500/50 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-500/20"
                    >
                      Open Pickup Map
                    </a>
                    <div className="truncate text-[10px] text-slate-400">{sourceMapUrl}</div>
                  </div>
                ) : null}
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Destination</div>
                <div className="mt-1 text-sm font-medium text-slate-100">
                  Assigned Workshop
                  {deliveryNoteModal.destinationName ? ` - ${deliveryNoteModal.destinationName}` : ""}
                  {deliveryNoteModal.destinationBranchId ? ` (${deliveryNoteModal.destinationBranchId})` : ""}
                  {deliveryNoteModal.destinationLocation
                    ? ` • ${deliveryNoteModal.destinationLocation}`
                    : ""}
                </div>
                {destinationMapUrl ? (
                  <div className="mt-2 space-y-1">
                    <a
                      href={destinationMapUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex rounded border border-cyan-500/50 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-500/20"
                    >
                      Open Destination Map
                    </a>
                    <div className="truncate text-[10px] text-slate-400">{destinationMapUrl}</div>
                  </div>
                ) : null}
              </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      ) : null}

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
                  setBrandOptionsByRow({});
                  setBrandLoadingByRow({});
                  setBrandTypeaheadByField({});
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
                      brandKey: keyof PartFormData;
                      customBrandKey: keyof PartFormData;
                      amountKey: keyof PartFormData;
                      qtyKey: keyof PartFormData;
                      etdKey: keyof PartFormData;
                      timeKey: keyof PartFormData;
                    }> = [
                      { key: "oem", label: "OEM", brandKey: "oemBrand", customBrandKey: "oemCustomBrandName", amountKey: "oemAmount", qtyKey: "oemQty", etdKey: "oemEtd", timeKey: "oemTime" },
                      { key: "oe", label: "Original", brandKey: "oeBrand", customBrandKey: "oeCustomBrandName", amountKey: "oeAmount", qtyKey: "oeQty", etdKey: "oeEtd", timeKey: "oeTime" },
                      { key: "aftm", label: "After Market", brandKey: "aftmBrand", customBrandKey: "aftmCustomBrandName", amountKey: "aftmAmount", qtyKey: "aftmQty", etdKey: "aftmEtd", timeKey: "aftmTime" },
                      { key: "used", label: "Used", brandKey: "usedBrand", customBrandKey: "usedCustomBrandName", amountKey: "usedAmount", qtyKey: "usedQty", etdKey: "usedEtd", timeKey: "usedTime" },
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

                        <div className="mt-3 space-y-3">
                          {/* Remarks */}
                          <div className="rounded-lg border border-slate-700/60 bg-slate-950/30 p-3">
                            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Remarks <span className="normal-case font-normal text-slate-600">(optional)</span></div>
                            <textarea
                              className="h-16 w-full rounded border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500"
                              placeholder="Add notes about this part..."
                              value={form?.remarks ?? ""}
                              onChange={(e) => updatePartForm(row.id, "remarks", e.target.value)}
                              onBlur={() => markDraftSaved(row.id)}
                            />
                          </div>

                          <div className="rounded-lg border border-slate-700/60 bg-slate-950/30 p-3">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">Quote Options</div>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {options.map((opt) => {
                                const enabled = isTypeEnabled(row, opt.key);
                                return (
                                  <div key={opt.key} className={`rounded-lg border p-2 ${enabled ? "border-slate-700 bg-slate-900/40" : "border-slate-800 bg-slate-900/20 opacity-50"}`}>
                                    <div className="mb-1 text-[11px] font-semibold text-slate-300">{opt.label}</div>
                                    <select
                                      className="mb-1 w-full rounded border border-slate-700 bg-slate-950/80 px-2 py-1 text-xs text-slate-100"
                                      value={(form?.[opt.brandKey] as string) ?? ""}
                                      onChange={(e) => updatePartForm(row.id, opt.brandKey, e.target.value)}
                                      onBlur={() => markDraftSaved(row.id)}
                                      disabled={!enabled}
                                    >
                                      <option value="">
                                        {brandLoadingByRow[row.id] ? `Loading ${opt.label} brands...` : `Select ${opt.label} Brand`}
                                      </option>
                                      {(brandOptionsByRow[row.id] ?? ["Other"]).map((brandOption) => (
                                        <option
                                          key={`${opt.key}-${brandOption}`}
                                          value={brandOption.toLowerCase() === "other" ? BRAND_OTHER_VALUE : brandOption}
                                        >
                                          {brandOption}
                                        </option>
                                      ))}
                                    </select>
                                    {(String(form?.[opt.brandKey] ?? "") === BRAND_OTHER_VALUE) ? (
                                      <>
                                        <input
                                          className="mb-1 w-full rounded border border-slate-700 bg-slate-950/80 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500"
                                          placeholder={`Enter ${opt.label} brand`}
                                          value={(form?.[opt.customBrandKey] as string) ?? ""}
                                          onChange={(e) => {
                                            updatePartForm(row.id, opt.customBrandKey, e.target.value);
                                            requestBrandTypeahead(row, opt.key, e.target.value);
                                          }}
                                          onBlur={async (e) => {
                                            const typed = e.target.value;
                                            markDraftSaved(row.id);
                                            await persistTypedBrand(typed);
                                            if (typed.trim()) {
                                              setBrandOptionsByRow((prev) => {
                                                const rowOptions = prev[row.id] ?? [];
                                                const exists = rowOptions.some(
                                                  (item) => item.toLowerCase() === typed.trim().toLowerCase()
                                                );
                                                if (exists) return prev;
                                                return { ...prev, [row.id]: [typed.trim(), ...rowOptions] };
                                              });
                                            }
                                          }}
                                          disabled={!enabled}
                                          list={`brand-suggestions-${row.id}-${opt.key}`}
                                        />
                                        <datalist id={`brand-suggestions-${row.id}-${opt.key}`}>
                                          {(brandTypeaheadByField[`${row.id}:${opt.key}`] ?? brandOptionsByRow[row.id] ?? [])
                                            .filter((brandOption) => brandOption.toLowerCase() !== "other")
                                            .map((brandOption) => (
                                              <option key={`${row.id}-${opt.key}-suggestion-${brandOption}`} value={brandOption} />
                                            ))}
                                        </datalist>
                                      </>
                                    ) : null}
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
                                        onChange={(e) => {
                                          const nextEtd = e.target.value;
                                          updatePartForm(row.id, opt.etdKey, nextEtd);
                                          if (nextEtd !== "Same Day") {
                                            updatePartForm(row.id, opt.timeKey, "");
                                          }
                                        }}
                                        onBlur={() => markDraftSaved(row.id)}
                                        disabled={!enabled}
                                      >
                                        <option>Same Day</option>
                                        <option>1-2 Days</option>
                                        <option>Custom</option>
                                      </select>
                                    </div>
                                    {(form?.[opt.etdKey] as string) === "Same Day" ? (
                                      <select
                                        className="mt-1 w-full rounded border border-slate-700 bg-slate-950/80 px-2 py-1 text-xs text-slate-100"
                                        value={(form?.[opt.timeKey] as string) ?? ""}
                                        onChange={(e) => updatePartForm(row.id, opt.timeKey, e.target.value)}
                                        onBlur={() => markDraftSaved(row.id)}
                                        disabled={!enabled}
                                      >
                                        <option value="">Select hours</option>
                                        <option value="1">1 hour</option>
                                        <option value="2">2 hours</option>
                                        <option value="3">3 hours</option>
                                        <option value="4">4 hours</option>
                                        <option value="5">5 hours</option>
                                        <option value="6">6 hours</option>
                                        <option value="7">7 hours</option>
                                        <option value="8">8 hours</option>
                                      </select>
                                    ) : null}
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
                                    diagramFileId: form.diagramFileId ?? "",
                                    oemBrand: form.oemBrand ?? "",
                                    oeBrand: form.oeBrand ?? "",
                                    aftmBrand: form.aftmBrand ?? "",
                                    usedBrand: form.usedBrand ?? "",
                                    oemCustomBrandName: form.oemCustomBrandName ?? "",
                                    oeCustomBrandName: form.oeCustomBrandName ?? "",
                                    aftmCustomBrandName: form.aftmCustomBrandName ?? "",
                                    usedCustomBrandName: form.usedCustomBrandName ?? "",
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

