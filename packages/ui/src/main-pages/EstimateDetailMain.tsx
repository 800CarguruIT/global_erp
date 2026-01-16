"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MainPageShell } from "./MainPageShell";
import { useTheme } from "../theme";
import type { Estimate, EstimateItem, EstimateItemStatus, EstimateStatus } from "@repo/ai-core/workshop/estimates/types";

type EstimateDetailMainProps = {
  companyId: string;
  estimateId: string;
};

type LoadState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "loaded"; data: T; error: null }
  | { status: "error"; data: null; error: string };

type ItemDraft = {
  id?: string;
  lineNo?: number;
  inspectionItemId?: string | null;
  partName: string;
  description?: string;
  type: EstimateItem["type"];
  productType?: string | null;
  quantity: number;
  cost: number;
  sale: number;
  approvedSale: number;
  discount: number;
  gpPercent?: number | null;
  status: EstimateItemStatus;
  source?: "inspection" | "estimate";
  partOrdered?: number | null;
  orderStatus?: string | null;
};

type DraftState = {
  status: EstimateStatus;
  vatRate: number;
  discountAmount: number;
  customerComplain: string;
  inspectorRemarks: string;
  items: ItemDraft[];
};

export function EstimateDetailMain({ companyId, estimateId }: EstimateDetailMainProps) {
  const { theme } = useTheme();
  const [loadState, setLoadState] = useState<LoadState<{ estimate: Estimate; items: EstimateItem[] }>>({
    status: "loading",
    data: null,
    error: null,
  });
  const [customer, setCustomer] = useState<any | null>(null);
  const [car, setCar] = useState<any | null>(null);
  const [lead, setLead] = useState<any | null>(null);
  const [inspection, setInspection] = useState<any | null>(null);
  const [products, setProducts] = useState<Array<{ id: number; name: string; type?: string }>>([]);
  const [productResults, setProductResults] = useState<Array<{ id: number; name: string; type?: string }>>([]);
  const [productOpenIndex, setProductOpenIndex] = useState<number | null>(null);
  const [productAnchor, setProductAnchor] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const productInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const productDropdownRef = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [jobCardMessage, setJobCardMessage] = useState<string | null>(null);
  const [activeJobCardId, setActiveJobCardId] = useState<string | null>(null);

  const productTypeByName = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((p) => {
      if (p.name) {
        map.set(p.name.trim().toLowerCase(), p.type ?? "");
      }
    });
    return map;
  }, [products]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadState({ status: "loading", data: null, error: null });
      try {
        const res = await fetch(`/api/company/${companyId}/workshop/estimates/${estimateId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const estimate: Estimate = json.data?.estimate ?? json.data?.data ?? json.data.estimate ?? json.data;
        let items: EstimateItem[] = json.data?.items ?? json.items ?? json.data?.data?.items ?? [];
        let lineItemOrderMap: Record<string, number> = {};
        let lineItemOrderStatusMap: Record<string, string> = {};
        if (estimate?.inspectionId) {
          try {
            const liRes = await fetch(
              `/api/company/${companyId}/workshop/inspections/${estimate.inspectionId}/line-items`
            );
            if (liRes.ok) {
              const liJson = await liRes.json();
              const liItems = liJson?.data ?? [];
              lineItemOrderMap = liItems.reduce((acc: Record<string, number>, li: any) => {
                if (li?.id) acc[li.id] = li.partOrdered ?? li.part_ordered ?? 0;
                return acc;
              }, {});
              lineItemOrderStatusMap = liItems.reduce((acc: Record<string, string>, li: any) => {
                if (li?.id) {
                  const status = li.orderStatus ?? li.order_status ?? "";
                  if (status) acc[li.id] = status;
                }
                return acc;
              }, {});
            }
          } catch {
            lineItemOrderMap = {};
            lineItemOrderStatusMap = {};
          }
        }
        if (items.length === 0 && estimate?.inspectionId) {
          try {
            const inspRes = await fetch(
              `/api/company/${companyId}/workshop/inspections/${estimate.inspectionId}/line-items`
            );
            if (inspRes.ok) {
              const inspJson = await inspRes.json();
              const inspItems = inspJson?.data ?? [];
              items = inspItems.map((item: any, idx: number) => ({
                id: item.id ?? `inspection-${idx}`,
                estimateId: estimate.id,
                inspectionItemId: item.id ?? null,
                lineNo: item.lineNo ?? idx + 1,
                partName: item.productName ?? item.product_name ?? "",
                description: item.description ?? item.reason ?? "",
                type: "genuine",
                productType: item.productType ?? item.product_type ?? item.type ?? null,
                quantity: Number(item.quantity ?? 1),
                cost: 0,
                sale: 0,
                approvedSale: 0,
                discount: 0,
                gpPercent: null,
                status: "pending",
                source: "inspection",
                partOrdered: item.partOrdered ?? item.part_ordered ?? 0,
                orderStatus: item.orderStatus ?? item.order_status ?? null,
                createdAt: item.createdAt ?? new Date().toISOString(),
                updatedAt: item.updatedAt ?? new Date().toISOString(),
              }));
            }
          } catch (err) {
            // ignore inspection fallback
          }
        }
        if (!cancelled) {
          setLoadState({ status: "loaded", data: { estimate, items }, error: null });
          setDraft({
            status: estimate.status,
            vatRate: estimate.vatRate,
            discountAmount: estimate.totalDiscount ?? 0,
            customerComplain: estimate.meta?.customerComplain ?? "",
            inspectorRemarks: estimate.meta?.inspectorRemarks ?? "",
            items: items.map((i) => ({
              id: i.id,
              lineNo: i.lineNo,
                partName: i.partName ?? "",
                description: i.description ?? "",
                type: i.type,
                productType: (i as any).productType ?? (i as any).product_type ?? null,
                inspectionItemId: (i as any).inspectionItemId ?? (i as any).inspection_item_id ?? null,
                quantity: i.quantity ?? 1,
                cost: i.cost ?? 0,
                sale: i.sale ?? 0,
                approvedSale: i.sale ?? 0,
              discount: 0,
              gpPercent: i.gpPercent ?? null,
              status: i.status,
              source: i.inspectionItemId ? "inspection" : "estimate",
              partOrdered: i.inspectionItemId ? lineItemOrderMap[i.inspectionItemId] ?? 0 : 0,
              orderStatus: i.inspectionItemId ? lineItemOrderStatusMap[i.inspectionItemId] ?? null : null,
            })),
          });
          setCustomer(null);
          setCar(null);
          setLead(null);
          setInspection(null);
          if (estimate.customerId) {
            fetch(`/api/customers/${estimate.customerId}?companyId=${companyId}`)
              .then((res) => (res.ok ? res.json() : Promise.reject()))
              .then((data) => setCustomer(data))
              .catch(() => setCustomer(null));
          }
          if (estimate.carId) {
            fetch(`/api/cars/${estimate.carId}?companyId=${companyId}`)
              .then((res) => (res.ok ? res.json() : Promise.reject()))
              .then((data) => setCar(data))
              .catch(() => setCar(null));
          }
          if (estimate.leadId) {
            fetch(`/api/company/${companyId}/sales/leads/${estimate.leadId}`)
              .then((res) => (res.ok ? res.json() : Promise.reject()))
              .then((data) => setLead(data?.data?.lead ?? data?.data?.data ?? data?.data ?? data))
              .catch(() => setLead(null));
          }
          if (estimate.inspectionId) {
            fetch(`/api/company/${companyId}/workshop/inspections/${estimate.inspectionId}`)
              .then((res) => (res.ok ? res.json() : Promise.reject()))
              .then((data) => setInspection(data?.data?.inspection ?? data?.data ?? data))
              .catch(() => setInspection(null));
          }
          if (estimate.id) {
            fetch(`/api/company/${companyId}/workshop/job-cards?estimateId=${estimate.id}`)
              .then((res) => (res.ok ? res.json() : Promise.reject()))
              .then((data) => setActiveJobCardId(data?.data?.id ?? null))
              .catch(() => setActiveJobCardId(null));
          }
        }
      } catch (err) {
        if (!cancelled) {
          setLoadState({ status: "error", data: null, error: "Failed to load estimate." });
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [companyId, estimateId]);

  useEffect(() => {
    fetch("/api/products")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setProducts(data?.data ?? []))
      .catch(() => setProducts([]));
  }, []);

  useEffect(() => {
    if (productOpenIndex === null) {
      setProductResults([]);
      return;
    }
    const query = draft?.items[productOpenIndex]?.partName?.trim() ?? "";
    let active = true;
    const timer = setTimeout(() => {
      const url = query ? `/api/products?search=${encodeURIComponent(query)}` : "/api/products";
      fetch(url)
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data) => {
          if (!active) return;
          setProductResults(data?.data ?? []);
        })
        .catch(() => {
          if (!active) return;
          setProductResults([]);
        });
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [productOpenIndex, draft]);

  useEffect(() => {
    if (!draft || productTypeByName.size === 0) return;
    let changed = false;
    const nextItems = draft.items.map((item) => {
      if (item.productType) return item;
      const type = productTypeByName.get(item.partName.trim().toLowerCase());
      if (!type) return item;
      changed = true;
      return { ...item, productType: type };
    });
    if (changed) {
      setDraft((prev) => (prev ? { ...prev, items: nextItems } : prev));
    }
  }, [draft, productTypeByName]);

  useEffect(() => {
    if (productOpenIndex === null) {
      setProductAnchor(null);
      return;
    }
    const updateAnchor = () => {
      const input = productInputRefs.current[productOpenIndex];
      if (!input) return;
      const rect = input.getBoundingClientRect();
      setProductAnchor({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 260),
      });
    };
    updateAnchor();
    window.addEventListener("resize", updateAnchor);
    window.addEventListener("scroll", updateAnchor, true);
    return () => {
      window.removeEventListener("resize", updateAnchor);
      window.removeEventListener("scroll", updateAnchor, true);
    };
  }, [productOpenIndex]);

  useEffect(() => {
    if (productOpenIndex === null) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      const input = productInputRefs.current[productOpenIndex];
      if (productDropdownRef.current?.contains(target)) return;
      if (input && input.contains(target)) return;
      setProductOpenIndex(null);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [productOpenIndex]);

  async function saveEstimate() {
    if (!draft) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const body = {
        status: draft.status,
        vatRate: draft.vatRate,
        discountAmount: draft.discountAmount,
        items: draft.items.map((i, idx) => ({
          id: i.id,
          lineNo: i.lineNo ?? idx + 1,
          inspectionItemId: i.inspectionItemId ?? null,
          partName: i.partName ?? "",
          description: i.description ?? "",
          type: i.type,
          quantity: i.quantity ?? 1,
          cost: i.cost ?? 0,
          sale:
            i.status === "approved"
              ? i.approvedSale && i.approvedSale > 0
                ? i.approvedSale
                : i.sale ?? 0
              : i.sale ?? 0,
          gpPercent: i.gpPercent ?? null,
          status: i.status ?? "pending",
        })),
      };
      const res = await fetch(`/api/company/${companyId}/workshop/estimates/${estimateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setLastSavedAt(new Date());
    } catch (err) {
      console.error(err);
      setSaveError("Save failed");
    } finally {
      setIsSaving(false);
    }
  }

  async function orderApprovedParts() {
    if (!estimate.inspectionId) {
      window.alert("Inspection not found for this estimate.");
      return;
    }
    const approvedNames = draft.items
      .filter((item) => item.status === "approved" && item.partName.trim())
      .map((item) => item.partName.trim());
    try {
      const res = await fetch(
        `/api/company/${companyId}/workshop/inspections/${estimate.inspectionId}/line-items`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "order_approved", approvedNames }),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json().catch(() => ({}));
      const updated = json?.data?.updated ?? 0;
      window.alert(`Ordered ${updated} approved parts.`);
    } catch (err) {
      console.error(err);
      window.alert("Failed to order approved parts.");
    }
  }

  useEffect(() => {
    if (!draft) return;
    const leadComplaint =
      lead?.customerRemark ??
      lead?.customer_remark ??
      lead?.remark ??
      lead?.remarks ??
      "";
    const inspectionRemark =
      inspection?.draftPayload?.inspectorRemarks ??
      inspection?.inspectorRemarks ??
      inspection?.inspector_remarks ??
      "";
    if (!draft.customerComplain && leadComplaint) {
      setDraft((prev) => (prev ? { ...prev, customerComplain: leadComplaint } : prev));
    }
    if (!draft.inspectorRemarks && inspectionRemark) {
      setDraft((prev) => (prev ? { ...prev, inspectorRemarks: inspectionRemark } : prev));
    }
  }, [draft, lead, inspection]);

  useEffect(() => {
    if (!jobCardMessage) return;
    const timer = setTimeout(() => setJobCardMessage(null), 2500);
    return () => clearTimeout(timer);
  }, [jobCardMessage]);

  const totals = useMemo(() => {
    if (!draft) return null;
    const getLineValues = (item: ItemDraft) => {
      const qty = Number(item.quantity) || 0;
      const cost = Number(item.cost) || 0;
      const saleValue = Number(item.sale) || 0;
      const approvedValue = Number(item.approvedSale) || 0;
      const saleBase = approvedValue > 0 ? approvedValue : saleValue;
      const discountPct = Number(item.discount) || 0;
      const costTotal = cost * qty;
      const saleTotal = saleBase * qty;
      const discountAmount = (saleTotal * discountPct) / 100;
      const subTotal = saleTotal - discountAmount;
      return { costTotal, saleTotal, discountAmount, subTotal };
    };
    const approved = { cost: 0, sale: 0, discount: 0, subTotal: 0 };
    const pending = { cost: 0, sale: 0, discount: 0, subTotal: 0 };
    for (const item of draft.items) {
      if (item.status === "rejected") continue;
      const line = getLineValues(item);
      if (item.status === "approved") {
        approved.cost += line.costTotal;
        approved.sale += line.saleTotal;
        approved.discount += line.discountAmount;
        approved.subTotal += line.subTotal;
      } else if (item.status === "pending") {
        pending.cost += line.costTotal;
        pending.sale += line.saleTotal;
        pending.discount += line.discountAmount;
        pending.subTotal += line.subTotal;
      }
    }
    const vatRate = Number(draft.vatRate) || 0;
    const approvedVat = (approved.subTotal * vatRate) / 100;
    const pendingVat = (pending.subTotal * vatRate) / 100;
    return {
      approved: {
        ...approved,
        vat: approvedVat,
        grandTotal: approved.subTotal + approvedVat,
      },
      pending: {
        ...pending,
        vat: pendingVat,
        grandTotal: pending.subTotal + pendingVat,
      },
      vatRate,
    };
  }, [draft]);

  async function createWorkOrder() {
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/job-cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimateId }),
      });
      if (res.status === 409) {
        setJobCardMessage("Job card already active for this estimate.");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const id: string = json.data?.id ?? json.data?.jobCard?.id;
      if (id) {
        setJobCardMessage("Job card created successfully.");
        setActiveJobCardId(id);
      }
    } catch (err) {
      console.error("Failed to create work order", err);
    }
  }

  if (loadState.status === "loading" || !draft) {
    return (
      <MainPageShell title="Estimate" subtitle="Loading estimate…" scopeLabel="">
        <p className="text-sm text-muted-foreground">Loading estimate…</p>
      </MainPageShell>
    );
  }

  if (loadState.status === "error") {
    return (
      <MainPageShell title="Estimate" subtitle="Unable to load estimate" scopeLabel="">
        <p className="text-sm text-destructive">{loadState.error}</p>
      </MainPageShell>
    );
  }

  const saveStatusText = saveError ? saveError : isSaving ? "Saving…" : lastSavedAt ? `Saved ${lastSavedAt.toLocaleTimeString()}` : "All changes saved";

  function updateItem(index: number, patch: Partial<ItemDraft>) {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = [...prev.items];
      const current = next[index];
      if (!current) return prev;
      if (current.partOrdered === 1 && current.status === "approved") {
        return prev;
      }
      const updated: ItemDraft = {
        ...current,
        ...patch,
        partName: patch.partName ?? current.partName ?? "",
        type: patch.type ?? current.type ?? "genuine",
        quantity: patch.quantity ?? current.quantity ?? 0,
        cost: patch.cost ?? current.cost ?? 0,
        sale: patch.sale ?? current.sale ?? 0,
        approvedSale: patch.approvedSale ?? current.approvedSale ?? 0,
        discount: patch.discount ?? current.discount ?? 0,
        productType: patch.productType ?? current.productType ?? null,
        inspectionItemId: patch.inspectionItemId ?? current.inspectionItemId ?? null,
        gpPercent: patch.gpPercent ?? current.gpPercent ?? null,
        status: patch.status ?? current.status ?? "pending",
        partOrdered: patch.partOrdered ?? current.partOrdered ?? 0,
      };
      next[index] = updated;
      return { ...prev, items: next };
    });
  }

  function addItem() {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            items: [
              ...prev.items,
              {
                partName: "",
                description: "",
                type: "genuine",
                productType: null,
                quantity: 1,
                cost: 0,
                sale: 0,
                approvedSale: 0,
                discount: 0,
                status: "pending",
                source: "estimate",
              },
            ],
          }
        : prev
    );
  }

  function removeItem(index: number) {
    setDraft((prev) => {
      if (!prev) return prev;
      const current = prev.items[index];
      if (!current) return prev;
      if (current.source === "inspection" || current.inspectionItemId || current.partOrdered === 1) {
        return prev;
      }
      const next = prev.items.filter((_, i) => i !== index);
      return { ...prev, items: next };
    });
  }

  function updateStatus(status: EstimateStatus) {
    setDraft((prev) => (prev ? { ...prev, status } : prev));
    if (status === "approved") {
      createWorkOrder();
    }
  }

  function updateVatRate(rate: number) {
    setDraft((prev) => (prev ? { ...prev, vatRate: rate } : prev));
  }

  function updateDiscount(amount: number) {
    setDraft((prev) => (prev ? { ...prev, discountAmount: amount } : prev));
  }

  const estimate = loadState.data!.estimate;
  const meta = estimate.meta ?? {};
  const advisorName =
    meta.advisorName ?? lead?.branchName ?? lead?.branch_name ?? "";
  const inspectorName =
    meta.inspectorName ?? lead?.agentName ?? lead?.agent_name ?? "";
  const carInMileage =
    meta.carInMileage ?? lead?.carInMileage ?? lead?.car_in_mileage ?? "";
  const customerComplain = draft.customerComplain ?? "";
  const inspectorRemarks = draft.inspectorRemarks ?? "";
  const customerName =
    customer?.name ?? customer?.customer_name ?? meta.customerName ?? "";
  const customerPhone =
    customer?.phone ?? customer?.customer_phone ?? meta.customerPhone ?? "";
  const carPlate =
    car?.plate_number ?? car?.plateNumber ?? meta.carPlate ?? "";
  const carModel =
    [car?.make, car?.model].filter(Boolean).join(" ") || meta.carModel || "";
  const normalizeProductType = (value?: string | null) =>
    (value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ");
  const resolveProductType = (item: ItemDraft) => {
    if (item.productType) return item.productType;
    const match = productTypeByName.get(item.partName.trim().toLowerCase());
    return match ?? "";
  };
  const hasApprovedSpareParts =
    draft.items.some((item) => {
      if (item.status !== "approved") return false;
      const productType = normalizeProductType(resolveProductType(item));
      if (productType.includes("spare") && productType.includes("part")) return true;
      const lineType = normalizeProductType(item.type as any);
      return lineType !== "repair";
    }) ?? false;
  const hasApprovedItems = draft.items.some((item) => item.status === "approved");
  const hasAnyItems = draft.items.length > 0;
  const sparePartsApproved = draft.items.filter((item) => {
    if (item.status !== "approved") return false;
    const productType = normalizeProductType(resolveProductType(item));
    if (productType.includes("spare") && productType.includes("part")) return true;
    const lineType = normalizeProductType(item.type as any);
    return lineType !== "repair";
  });
  const allApprovedSparePartsOrdered =
    sparePartsApproved.length === 0
      ? false
      : sparePartsApproved.every((item) => {
          const status = (item.orderStatus ?? "").toLowerCase();
          return item.partOrdered === 1 || status === "ordered" || status === "received" || status === "returned";
        });
  const canStartJobCard =
    hasAnyItems && ((hasApprovedSpareParts && allApprovedSparePartsOrdered) || (!hasApprovedSpareParts && hasApprovedItems));

  return (
    <MainPageShell
      title={`Create Estimate - ${estimate.id.slice(0, 8)}`}
      subtitle=""
      scopeLabel=""
      primaryAction={
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/company/${companyId}/workshop/estimates/${estimate.id}/quote`}
            target="_blank"
            rel="noreferrer"
            className="rounded-md bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
          >
            Print Quotation
          </a>
          <button
            type="button"
            className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
          >
            Print Estimate - Approved
          </button>
          <button
            type="button"
            className="rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
          >
            Print Estimate - Pending
          </button>
          <button
            type="button"
            className="rounded-md bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm"
          >
            View Inspection
          </button>
        </div>
      }
      secondaryActions={null}
      contentClassName="p-0"
    >
      {jobCardMessage && (
        <div className="fixed right-6 top-6 z-50">
          <div className="rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-lg">
            {jobCardMessage}
          </div>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <section className={`rounded-md ${theme.cardBg} ${theme.cardBorder}`}>
            <div
              className={`flex items-center justify-between rounded-t-md px-3 py-2 text-xs font-semibold ${theme.surfaceSubtle} ${theme.appText} border-b border-border/60`}
            >
              <span>Estimate Details</span>
              <span className="text-base leading-none">-</span>
            </div>
            <div className="space-y-4 p-4 text-sm">
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="space-y-1">
                  <div className="text-xs font-semibold">Lead Advisor</div>
                  <input
                    className={`${theme.input} h-9`}
                    value={advisorName}
                    readOnly
                    placeholder="Advisor"
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-semibold">Inspector Name</div>
                  <input
                    className={`${theme.input} h-9`}
                    value={inspectorName}
                    readOnly
                    placeholder="Stage"
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-semibold">Car In Mileage</div>
                  <input
                    className={`${theme.input} h-9`}
                    value={carInMileage}
                    readOnly
                    placeholder="Mileage"
                  />
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-1">
                  <div className="text-xs font-semibold">Customer Complain</div>
                  <textarea
                    className={`${theme.input} h-24 resize-none`}
                    value={customerComplain}
                    readOnly
                    placeholder="Customer Complain"
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-semibold">Inspector Remarks</div>
                  <textarea
                    className={`${theme.input} h-24 resize-none`}
                    value={inspectorRemarks}
                    readOnly
                    placeholder="Inspector Remarks"
                  />
                </div>
              </div>
              <div className={`overflow-x-auto rounded-md ${theme.cardBorder}`}>
                <table className="min-w-full text-xs">
                  <thead className={`${theme.surfaceSubtle} ${theme.appText}`}>
                    <tr>
                      <th className="px-2 py-1 text-left">Part Name</th>
                      <th className="px-2 py-1 text-left">Description</th>
                      <th className="px-2 py-1 text-left">Quantity</th>
                      <th className="px-2 py-1 text-left">Cost</th>
                      <th className="px-2 py-1 text-left">Approved Cost</th>
                      <th className="px-2 py-1 text-left">Cost Total</th>
                      <th className="px-2 py-1 text-left">GP</th>
                      <th className="px-2 py-1 text-left">Sale</th>
                      <th className="px-2 py-1 text-left">Approved Sale</th>
                      <th className="px-2 py-1 text-left">Sale Total</th>
                      <th className="px-2 py-1 text-left">Discount</th>
                      <th className="px-2 py-1 text-left">Sub-Total</th>
                      <th className="px-2 py-1 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.items.length === 0 ? (
                      <tr>
                        <td colSpan={13} className="px-3 py-3 text-xs text-muted-foreground">
                          No items added yet.
                        </td>
                      </tr>
                    ) : (
                      draft.items.map((item, idx) => {
                        const qty = Number(item.quantity) || 0;
                        const cost = Number(item.cost) || 0;
                        const discountPct = Number(item.discount) || 0;
                        const saleValue = Number(item.sale) || 0;
                        const approvedValue = Number(item.approvedSale) || 0;
                        const saleBase = approvedValue > 0 ? approvedValue : saleValue;
                        const lineCost = cost * qty;
                        const lineSale = saleBase * qty;
                        const discountAmount = (lineSale * discountPct) / 100;
                        const subTotal = lineSale - discountAmount;
                        const gpPercent =
                          subTotal > 0 ? ((subTotal - lineCost) / subTotal) * 100 : 0;
                        const isLocked = item.partOrdered === 1 && item.status === "approved";
                        return (
                          <tr key={idx} className="border-b border-border/60 last:border-0">
                            <td className="px-2 py-1">
                              <div className="relative">
                                <input
                                  ref={(el) => {
                                    productInputRefs.current[idx] = el;
                                  }}
                                  className={`${theme.input} h-8 text-xs`}
                                  value={item.partName}
                                  disabled={isLocked}
                                  onChange={(e) => updateItem(idx, { partName: e.target.value })}
                                  placeholder="Part name"
                                  onFocus={() => setProductOpenIndex(idx)}
                                />
                              </div>
                            </td>
                            <td className="px-2 py-1">
                              <input
                                className={`${theme.input} h-8 text-xs`}
                                value={item.description ?? ""}
                                disabled={isLocked}
                                onChange={(e) => updateItem(idx, { description: e.target.value })}
                                placeholder="Description"
                              />
                            </td>
                            <td className="px-2 py-1">
                              <input
                                type="number"
                                step="0.01"
                                className={`${theme.input} h-8 w-20 text-xs`}
                                value={item.quantity}
                                disabled={isLocked}
                                onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) || 0 })}
                              />
                            </td>
                            <td className="px-2 py-1">
                              <input
                                type="number"
                                step="0.01"
                                className={`${theme.input} h-8 w-24 text-xs`}
                                value={item.cost}
                                disabled={isLocked}
                                onChange={(e) => {
                                  const cost = Number(e.target.value) || 0;
                                  const sale = item.sale ?? 0;
                                  const gp = sale > 0 ? ((sale - cost) / sale) * 100 : item.gpPercent ?? null;
                                  updateItem(idx, { cost, gpPercent: gp ?? null });
                                }}
                              />
                            </td>
                            <td className="px-2 py-1">
                              <input
                                className={`${theme.input} h-8 w-24 text-xs`}
                                value={item.cost.toFixed(2)}
                                readOnly
                              />
                            </td>
                            <td className="px-2 py-1 text-xs">{lineCost.toFixed(2)}</td>
                            <td className="px-2 py-1">
                              <input
                                type="number"
                                step="0.01"
                                className={`${theme.input} h-8 w-20 text-xs`}
                                value={Number.isFinite(gpPercent) ? gpPercent : 0}
                                disabled={isLocked}
                                onChange={(e) => {
                                  const gp = Number(e.target.value);
                                  const cost = item.cost ?? 0;
                                  const sale = gp ? cost * (100 / (100 - gp)) : item.sale;
                                  updateItem(idx, {
                                    gpPercent: gp,
                                    sale,
                                    approvedSale: item.status === "approved" ? sale : item.approvedSale,
                                  });
                                }}
                              />
                            </td>
                            <td className="px-2 py-1">
                              <input
                                type="number"
                                step="0.01"
                                className={`${theme.input} h-8 w-24 text-xs`}
                                value={item.sale}
                                disabled={isLocked}
                                onChange={(e) => {
                                  const sale = Number(e.target.value) || 0;
                                  const cost = item.cost ?? 0;
                                  const gp = sale > 0 ? ((sale - cost) / sale) * 100 : null;
                                  updateItem(idx, { sale, gpPercent: gp });
                                }}
                              />
                            </td>
                            <td className="px-2 py-1">
                              <input
                                type="number"
                                step="0.01"
                                className={`${theme.input} h-8 w-24 text-xs`}
                                value={item.approvedSale}
                                disabled={isLocked}
                                onChange={(e) => {
                                  const approvedSale = Number(e.target.value) || 0;
                                  updateItem(idx, {
                                    approvedSale,
                                    sale:
                                      item.status === "pending" && !item.sale ? approvedSale : item.sale,
                                  });
                                }}
                              />
                            </td>
                            <td className="px-2 py-1 text-xs">{lineSale.toFixed(2)}</td>
                            <td className="px-2 py-1">
                              <input
                                type="number"
                                step="0.01"
                                className={`${theme.input} h-8 w-20 text-xs`}
                                value={item.discount}
                                disabled={isLocked}
                                onChange={(e) => updateItem(idx, { discount: Number(e.target.value) || 0 })}
                              />
                            </td>
                            <td className="px-2 py-1 text-xs">{subTotal.toFixed(2)}</td>
                            <td className="px-2 py-1">
                              <div className="flex flex-col items-start gap-1">
                                <select
                                  className={`${theme.input} h-8 w-24 text-xs`}
                                  value={item.status}
                                  disabled={isLocked || item.partOrdered === 1}
                                  onChange={(e) =>
                                    updateItem(idx, { status: e.target.value as EstimateItemStatus })
                                  }
                                >
                                  <option value="pending">Pending</option>
                                  <option value="approved">Approved</option>
                                  <option value="rejected">Rejected</option>
                                </select>
                                {item.status === "approved" && (item.partOrdered === 1 || item.orderStatus) && (() => {
                                  const statusLabel = (item.orderStatus ?? "Ordered").toLowerCase();
                                  const badgeClass =
                                    statusLabel === "received"
                                      ? "bg-emerald-500 text-white"
                                      : statusLabel === "returned"
                                      ? "bg-sky-500 text-white"
                                      : "bg-amber-400 text-slate-900";
                                  return (
                                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${badgeClass}`}>
                                      {item.orderStatus ?? "Ordered"}
                                    </span>
                                  );
                                })()}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={addItem}
                  className="rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  + Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const lastRemovableIndex = [...draft.items]
                      .map((item, idx) => ({ item, idx }))
                      .reverse()
                      .find(({ item }) => !item.inspectionItemId && item.source !== "inspection")?.idx;
                    if (lastRemovableIndex === undefined) return;
                    removeItem(lastRemovableIndex);
                  }}
                  className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white"
                  disabled={!draft.items.some((item) => !item.inspectionItemId && item.source !== "inspection")}
                >
                  Remove ?
                </button>
              </div>
              <div className="flex justify-end">
                <div
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold ${theme.surfaceSubtle} ${theme.appText} ${theme.cardBorder}`}
                >
                  <span>Show Total in Estimate</span>
                  <label className="flex items-center gap-1 text-xs">
                    <input type="radio" name="show-total" defaultChecked />
                    Yes
                  </label>
                  <label className="flex items-center gap-1 text-xs">
                    <input type="radio" name="show-total" />
                    No.
                  </label>
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <TotalsInput
                    label="Total Cost - Approved"
                    value={totals ? totals.approved.cost.toFixed(2) : "0"}
                  />
                  <TotalsInput
                    label="Total Sale - Approved"
                    value={totals ? totals.approved.sale.toFixed(2) : "0"}
                  />
                  <TotalsInput
                    label="Discount - Approved"
                    value={totals ? totals.approved.discount.toFixed(2) : "0"}
                  />
                  <TotalsInput
                    label="Sub-Total - Approved"
                    value={totals ? totals.approved.subTotal.toFixed(2) : "0"}
                  />
                  <TotalsInput
                    label={`Tax - VAT ${totals ? totals.vatRate : 0}% - Approved`}
                    value={totals ? totals.approved.vat.toFixed(2) : "0"}
                  />
                  <TotalsInput
                    label="Grand Total - Approved"
                    value={totals ? totals.approved.grandTotal.toFixed(2) : "0"}
                  />
                </div>
                <div className="space-y-3">
                  <TotalsInput
                    label="Total Cost - Pending"
                    value={totals ? totals.pending.cost.toFixed(2) : "0"}
                  />
                  <TotalsInput
                    label="Total Sale - Pending"
                    value={totals ? totals.pending.sale.toFixed(2) : "0"}
                  />
                  <TotalsInput
                    label="Discount - Pending"
                    value={totals ? totals.pending.discount.toFixed(2) : "0"}
                  />
                  <TotalsInput
                    label="Sub-Total - Pending"
                    value={totals ? totals.pending.subTotal.toFixed(2) : "0"}
                  />
                  <TotalsInput
                    label={`Tax - VAT ${totals ? totals.vatRate : 0}% - Pending`}
                    value={totals ? totals.pending.vat.toFixed(2) : "0"}
                  />
                  <TotalsInput
                    label="Grand Total - Pending"
                    value={totals ? totals.pending.grandTotal.toFixed(2) : "0"}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">{saveStatusText}</div>
                <div className="flex items-center gap-2">
                  {lastSavedAt && hasApprovedSpareParts && (
                    <button
                      type="button"
                      onClick={orderApprovedParts}
                      className="rounded-md bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-900 shadow-sm"
                    >
                      Order Approved Parts
                    </button>
                  )}
                  {activeJobCardId ? (
                    <a
                      href={`/company/${companyId}/workshop/job-cards/${activeJobCardId}`}
                      className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm"
                    >
                      View Job Card
                    </a>
                  ) : jobCardMessage ? (
                    <span className="rounded-md bg-emerald-600/20 px-3 py-2 text-xs font-semibold text-emerald-200">
                      {jobCardMessage}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={createWorkOrder}
                      className={`rounded-md px-4 py-2 text-xs font-semibold shadow-sm ${
                        canStartJobCard
                          ? "bg-indigo-600 text-white"
                          : "cursor-not-allowed bg-slate-600/60 text-white/60"
                      }`}
                      disabled={!canStartJobCard}
                    >
                      Create Job Card
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={saveEstimate}
                    className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm"
                    disabled={isSaving}
                  >
                    {isSaving ? "Saving..." : "Save Estimate"}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
        <div className="space-y-3">
          <section className={`rounded-md ${theme.cardBg} ${theme.cardBorder}`}>
            <div
              className={`rounded-t-md px-3 py-2 text-xs font-semibold ${theme.surfaceSubtle} ${theme.appText} border-b border-border/60`}
            >
              Customer Details
            </div>
            <div className="space-y-2 p-3 text-xs">
              <div>
                <div className="text-[11px] text-muted-foreground">Customer</div>
                <div className={`text-sm font-semibold ${theme.appText}`}>{customerName || "N/A"}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">Phone</div>
                <div className={`text-sm font-semibold ${theme.appText}`}>{customerPhone || "N/A"}</div>
              </div>
            </div>
          </section>
          <section className={`rounded-md ${theme.cardBg} ${theme.cardBorder}`}>
            <div
              className={`rounded-t-md px-3 py-2 text-xs font-semibold ${theme.surfaceSubtle} ${theme.appText} border-b border-border/60`}
            >
              Car Details
            </div>
            <div className="space-y-2 p-3 text-xs">
              <div>
                <div className="text-[11px] text-muted-foreground">Plate</div>
                <div className={`text-sm font-semibold ${theme.appText}`}>{carPlate || "N/A"}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">Car</div>
                <div className={`text-sm font-semibold ${theme.appText}`}>{carModel || "N/A"}</div>
              </div>
            </div>
          </section>
          <div className={`rounded-md ${theme.cardBg} ${theme.cardBorder} p-3`}>
            <span className="inline-flex rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white">
              CarGuru 3000 Promo Consumed
            </span>
          </div>
        </div>
      </div>
      {productOpenIndex !== null && productAnchor
        ? createPortal(
            <div
              ref={productDropdownRef}
              className="fixed z-50 max-h-64 overflow-y-auto rounded-md border border-white/10 bg-slate-950 text-xs shadow-lg"
              style={{
                top: productAnchor.top,
                left: productAnchor.left,
                width: productAnchor.width,
              }}
            >
              {(productResults.length ? productResults : products).map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-white/80 hover:bg-white/10"
                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    updateItem(productOpenIndex, {
                                      partName: product.name,
                                      productType: product.type ?? null,
                                    });
                                    setProductOpenIndex(null);
                                  }}
                                >
                  <span className="font-semibold">{product.name}</span>
                  {product.type && <span className="text-[10px] text-white/50">{product.type}</span>}
                </button>
              ))}
              {productResults.length === 0 && products.length === 0 && (
                <div className="px-3 py-2 text-white/50">No products found.</div>
              )}
            </div>,
            document.body
          )
        : null}
    </MainPageShell>
  );
}

function TotalsInput({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <div className="space-y-1">
      <div className={`text-xs font-semibold ${theme.mutedText}`}>{label}</div>
      <input
        className={`${theme.input} h-9`}
        value={value}
        readOnly
      />
    </div>
  );
}
