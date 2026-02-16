"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MainPageShell } from "./MainPageShell";
import { useTheme } from "../theme";
import type {
  Estimate,
  EstimateItem,
  EstimateItemCostType,
  EstimateItemQuoteCosts,
  EstimateItemStatus,
  EstimateStatus,
} from "@repo/ai-core/workshop/estimates/types";

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
  approvedType?: EstimateItemCostType | null;
  quoteCosts?: EstimateItemQuoteCosts;
  approvedCost?: number | null;
};

type DraftState = {
  status: EstimateStatus;
  vatRate: number;
  discountAmount: number;
  customerComplain: string;
  inspectorRemarks: string;
  items: ItemDraft[];
};
type JobCardSummary = {
  id: string;
  status?: string | null;
  createdAt?: string | null;
  completeAt?: string | null;
};

const COST_DISPLAY_ORDER: Array<{ key: EstimateItemCostType; label: string }> = [
  { key: "oe", label: "OE" },
  { key: "oem", label: "OEM" },
  { key: "aftm", label: "AFTM" },
  { key: "used", label: "Used" },
];
const NEW_JOB_PRODUCT_INDEX_OFFSET = 10000;

const formatCostValue = (value?: number | null) => (value != null ? value.toFixed(2) : "0.00");
type PersistedNewJobLineItemDraft = {
  cost?: number | null;
  sale?: number | null;
  approvedSale?: number | null;
  discount?: number | null;
  approvedType?: EstimateItemCostType | null;
  approvedCost?: number | null;
  gpPercent?: number | null;
};
type PersistedNewJobDraftMap = Record<string, PersistedNewJobLineItemDraft>;

const toFiniteNumberOrNull = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getPersistedNewJobDraftMap = (meta: any): PersistedNewJobDraftMap => {
  const raw = meta?.newJobDraftByLineItemId;
  if (!raw || typeof raw !== "object") return {};
  const map: PersistedNewJobDraftMap = {};
  for (const [lineItemId, value] of Object.entries(raw as Record<string, any>)) {
    if (!lineItemId) continue;
    map[lineItemId] = {
      cost: toFiniteNumberOrNull(value?.cost),
      sale: toFiniteNumberOrNull(value?.sale),
      approvedSale: toFiniteNumberOrNull(value?.approvedSale),
      discount: toFiniteNumberOrNull(value?.discount),
      approvedType:
        value?.approvedType === "oe" ||
        value?.approvedType === "oem" ||
        value?.approvedType === "aftm" ||
        value?.approvedType === "used"
          ? value.approvedType
          : null,
      approvedCost: toFiniteNumberOrNull(value?.approvedCost),
      gpPercent: toFiniteNumberOrNull(value?.gpPercent),
    };
  }
  return map;
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
  const [isRefreshingQuotes, setIsRefreshingQuotes] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [jobCardMessage, setJobCardMessage] = useState<string | null>(null);
  const [activeJobCardId, setActiveJobCardId] = useState<string | null>(null);
  const [jobCards, setJobCards] = useState<JobCardSummary[]>([]);
  const [inspectionLineItems, setInspectionLineItems] = useState<any[]>([]);
  const [newJobItems, setNewJobItems] = useState<ItemDraft[]>([]);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceConvertError, setInvoiceConvertError] = useState<string | null>(null);
  const [isConvertingInvoice, setIsConvertingInvoice] = useState(false);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 2500);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const renderOrderBadge = (item: ItemDraft) => {
    if (item.status !== "approved") {
      return null;
    }
    const trimmedOrderStatus = (item.orderStatus ?? "").trim();
    if (!trimmedOrderStatus) {
      return null;
    }
    const badgeLabel = trimmedOrderStatus;
    const normalizedLabel = badgeLabel.toLowerCase();
    const badgeClass =
      normalizedLabel === "received"
        ? "bg-emerald-500 text-white"
        : normalizedLabel === "returned"
        ? "bg-sky-500 text-white"
        : normalizedLabel === "order pending"
        ? "bg-amber-100 text-amber-700"
        : "bg-amber-400 text-slate-900";
    return (
      <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${badgeClass}`}>
        {badgeLabel}
      </span>
    );
  };

  const isApprovedOrderLocked = (item: Pick<ItemDraft, "status" | "orderStatus" | "partOrdered">) => {
    if (item.status !== "approved") return false;
    const normalizedOrderStatus = String(item.orderStatus ?? "").toLowerCase();
    return (
      normalizedOrderStatus === "ordered" ||
      normalizedOrderStatus === "received" ||
      normalizedOrderStatus === "returned"
    );
  };

  const mapAdditionalLineItemsToDraft = (
    value: any[],
    persistedByLineItemId: PersistedNewJobDraftMap = {}
  ): ItemDraft[] => {
    if (!Array.isArray(value)) return [];
    return value
      .map((item: any, idx: number) => {
        const lineItemId = String(item?.id ?? "");
        const persisted = lineItemId ? persistedByLineItemId[lineItemId] ?? {} : {};
        return {
          id: undefined,
          lineNo: item?.lineNo ?? idx + 1,
          inspectionItemId: item?.id ?? null,
          partName: String(item?.productName ?? item?.product_name ?? "").trim(),
          description: item?.description ?? item?.reason ?? "",
          type: "genuine" as const,
          productType: item?.productType ?? item?.product_type ?? null,
          quantity: Number(item?.quantity ?? 1) || 1,
          cost: Number(persisted?.cost ?? 0) || 0,
          sale: Number(persisted?.sale ?? 0) || 0,
          approvedSale: Number(persisted?.approvedSale ?? 0) || 0,
          discount: Number(persisted?.discount ?? 0) || 0,
          gpPercent:
            persisted?.gpPercent != null && Number.isFinite(Number(persisted.gpPercent))
              ? Number(persisted.gpPercent)
              : null,
          status:
            String(item?.status ?? "Pending").toLowerCase() === "approved"
              ? ("approved" as EstimateItemStatus)
              : String(item?.status ?? "Pending").toLowerCase() === "rejected"
              ? ("rejected" as EstimateItemStatus)
              : String(item?.status ?? "Pending").toLowerCase() === "inquiry"
              ? ("inquiry" as EstimateItemStatus)
              : ("pending" as EstimateItemStatus),
          source: "estimate" as const,
          partOrdered: item?.partOrdered ?? item?.part_ordered ?? 0,
          orderStatus: item?.orderStatus ?? item?.order_status ?? null,
          quoteCosts: item?.quoteCosts ?? item?.quote_costs ?? undefined,
          approvedType: (persisted?.approvedType ?? null) as EstimateItemCostType | null,
          approvedCost:
            persisted?.approvedCost != null && Number.isFinite(Number(persisted.approvedCost))
              ? Number(persisted.approvedCost)
              : null,
        };
      })
      .filter((item) => item.partName);
  };

  const mapEstimateStatusToLineItemStatus = (status?: EstimateItemStatus) => {
    if (status === "approved") return "Approved";
    if (status === "rejected") return "Rejected";
    if (status === "inquiry") return "Inquiry";
    return "Pending";
  };


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
        let inspectionSnapshot: any | null = null;
        if (estimate?.inspectionId) {
          try {
            const inspRes = await fetch(`/api/company/${companyId}/workshop/inspections/${estimate.inspectionId}`);
            if (inspRes.ok) {
              const inspJson = await inspRes.json();
              inspectionSnapshot = inspJson?.data?.inspection ?? inspJson?.data ?? null;
            }
          } catch {
            inspectionSnapshot = null;
          }
        }
        const inspectionStatus = String(inspectionSnapshot?.status ?? "").toLowerCase();
        const inspectionCompleted =
          inspectionStatus === "completed" ||
          Boolean(inspectionSnapshot?.completeAt ?? inspectionSnapshot?.complete_at);
        let items: EstimateItem[] = json.data?.items ?? json.items ?? json.data?.data?.items ?? [];
        let lineItemOrderMap: Record<string, number> = {};
        let lineItemOrderStatusMap: Record<string, string> = {};
        let additionalNewJobItems: ItemDraft[] = [];
        const persistedNewJobDraftByLineItemId = getPersistedNewJobDraftMap(estimate?.meta);
        if (estimate?.inspectionId) {
          try {
            const liRes = await fetch(
              `/api/company/${companyId}/workshop/inspections/${estimate.inspectionId}/line-items`
            );
            if (liRes.ok) {
              const liJson = await liRes.json();
              const liItems = liJson?.data ?? [];
              additionalNewJobItems = mapAdditionalLineItemsToDraft(
                liItems.filter(
                  (li: any) =>
                    Number(li?.isAdd ?? li?.is_add ?? 0) === 1 &&
                    String(li?.source ?? "").toLowerCase() === "estimate"
                ),
                persistedNewJobDraftByLineItemId
              );
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
        if (items.length === 0 && estimate?.inspectionId && inspectionCompleted) {
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
        if (!inspectionCompleted) {
          items = items.filter((item: any) => !item?.inspectionItemId && !item?.inspection_item_id);
        }
        if (!cancelled) {
          setLoadState({ status: "loaded", data: { estimate, items }, error: null });
          setDraft({
            status: estimate.status,
            vatRate: estimate.vatRate,
            discountAmount: estimate.totalDiscount ?? 0,
            customerComplain: estimate.meta?.customerComplain ?? "",
            inspectorRemarks: estimate.meta?.inspectorRemarks ?? "",
            items: items.map((i) => {
              return {
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
                quoteCosts: i.quoteCosts,
                approvedType: i.approvedType ?? null,
                approvedCost: i.approvedCost ?? null,
              };
            }),
          });
          setNewJobItems(additionalNewJobItems);
          setCustomer(null);
          setCar(null);
          setLead(null);
          setInspection(inspectionSnapshot);
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
          if (estimate.inspectionId && !inspectionSnapshot) {
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
    const inspectionId = inspection?.id ?? loadState.data?.estimate?.inspectionId;
    if (!inspectionId || !loadState.data?.estimate?.id) return;
    let cancelled = false;
    async function loadJobMeta() {
      try {
        const [jobsRes, lineItemsRes] = await Promise.all([
          fetch(`/api/company/${companyId}/workshop/job-cards?estimateId=${estimateId}&all=1`),
          fetch(`/api/company/${companyId}/workshop/inspections/${inspectionId}/line-items`),
        ]);
        if (!jobsRes.ok || !lineItemsRes.ok) return;
        const [jobsJson, lineItemsJson] = await Promise.all([jobsRes.json(), lineItemsRes.json()]);
        if (cancelled) return;
        setJobCards(Array.isArray(jobsJson?.data) ? jobsJson.data : []);
        setInspectionLineItems(Array.isArray(lineItemsJson?.data) ? lineItemsJson.data : []);
      } catch {
        if (cancelled) return;
        setJobCards([]);
        setInspectionLineItems([]);
      }
    }
    loadJobMeta();
    return () => {
      cancelled = true;
    };
  }, [companyId, estimateId, inspection?.id, loadState.data?.estimate?.inspectionId]);

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
    const isNewJobIndex = productOpenIndex >= NEW_JOB_PRODUCT_INDEX_OFFSET;
    const queryIndex = isNewJobIndex ? productOpenIndex - NEW_JOB_PRODUCT_INDEX_OFFSET : productOpenIndex;
    const query = isNewJobIndex
      ? newJobItems[queryIndex]?.partName?.trim() ?? ""
      : draft?.items[queryIndex]?.partName?.trim() ?? "";
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
  }, [productOpenIndex, draft, newJobItems]);

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

  async function saveEstimate(): Promise<ItemDraft[] | null> {
    if (!draft) return null;
    setIsSaving(true);
    setSaveError(null);
    try {
      const newJobItemsToSave = newJobItems.filter((item) => item.partName.trim());
      const nextMeta: Record<string, any> = {
        ...(loadState.status === "loaded" ? loadState.data?.estimate?.meta ?? {} : {}),
        customerComplain: draft.customerComplain ?? "",
        inspectorRemarks: draft.inspectorRemarks ?? "",
      };
      let savedNewJobItems: ItemDraft[] = newJobItems;
      if (estimate.inspectionId) {
        const upserted = await Promise.all(
          newJobItemsToSave.map(async (item, idx) => {
            const payload = {
              leadId: loadState.status === "loaded" ? loadState.data?.estimate?.leadId ?? null : null,
              source: "estimate",
              isAdd: 1,
              productName: item.partName,
              description: item.description ?? null,
              quantity: item.quantity ?? 1,
              reason: item.description ?? null,
              status: mapEstimateStatusToLineItemStatus(item.status),
            };
            if (item.inspectionItemId) {
              const res = await fetch(
                `/api/company/${companyId}/workshop/inspections/${estimate.inspectionId}/line-items/${item.inspectionItemId}`,
                {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                }
              );
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const json = await res.json().catch(() => ({}));
              const updated = json?.data ?? null;
              return {
                ...item,
                lineNo: item.lineNo ?? idx + 1,
                inspectionItemId: updated?.id ?? item.inspectionItemId,
              };
            }
            const res = await fetch(
              `/api/company/${companyId}/workshop/inspections/${estimate.inspectionId}/line-items`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              }
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json().catch(() => ({}));
            const created = json?.data ?? null;
            return {
              ...item,
              lineNo: item.lineNo ?? idx + 1,
              inspectionItemId: created?.id ?? null,
            };
          })
        );
        const existingAdditionalIds = (inspectionLineItems ?? [])
          .filter(
            (li: any) =>
              Number(li?.isAdd ?? li?.is_add ?? 0) === 1 &&
              String(li?.source ?? "").toLowerCase() === "estimate" &&
              !String(li?.jobCardId ?? li?.job_card_id ?? "").trim()
          )
          .map((li: any) => String(li?.id ?? ""))
          .filter(Boolean);
        const keptIds = new Set(
          upserted.map((item) => String(item.inspectionItemId ?? "")).filter(Boolean)
        );
        const toDelete = existingAdditionalIds.filter((id) => !keptIds.has(id));
        if (toDelete.length) {
          await Promise.all(
            toDelete.map((lineItemId) =>
              fetch(
                `/api/company/${companyId}/workshop/inspections/${estimate.inspectionId}/line-items/${lineItemId}`,
                { method: "DELETE" }
              )
            )
          );
        }
        const blankDrafts = newJobItems.filter((item) => !item.partName.trim());
        savedNewJobItems = [...upserted, ...blankDrafts];
      }
      nextMeta.newJobDraftByLineItemId = savedNewJobItems.reduce((acc, item) => {
        const lineItemId = String(item.inspectionItemId ?? "").trim();
        if (!lineItemId) return acc;
        acc[lineItemId] = {
          cost: toFiniteNumberOrNull(item.cost),
          sale: toFiniteNumberOrNull(item.sale),
          approvedSale: toFiniteNumberOrNull(item.approvedSale),
          discount: toFiniteNumberOrNull(item.discount),
          approvedType: item.approvedType ?? null,
          approvedCost: toFiniteNumberOrNull(item.approvedCost),
          gpPercent: toFiniteNumberOrNull(item.gpPercent),
        };
        return acc;
      }, {} as PersistedNewJobDraftMap);
      const body = {
        status: draft.status,
        vatRate: draft.vatRate,
        discountAmount: draft.discountAmount,
        meta: nextMeta,
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
          approvedType: i.approvedType ?? null,
          approvedCost: i.approvedCost ?? null,
        })),
      };
      const res = await fetch(`/api/company/${companyId}/workshop/estimates/${estimateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setLoadState((prev) =>
        prev.status === "loaded"
          ? {
              ...prev,
              data: {
                ...prev.data,
                estimate: { ...prev.data.estimate, meta: nextMeta },
              },
            }
          : prev
      );
      setNewJobItems(savedNewJobItems);
      setLastSavedAt(new Date());
      return savedNewJobItems;
    } catch (err) {
      console.error(err);
      setSaveError("Save failed");
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  async function orderApprovedParts(silent = false, itemsOverride?: ItemDraft[]) {
    if (!estimate.inspectionId) {
      if (!silent) window.alert("Inspection not found for this estimate.");
      return;
    }
    if (!draft) {
      if (!silent) window.alert("Estimate data is not ready.");
      return;
    }
    const approvedNames = (itemsOverride ?? draft.items)
      .filter((item) => item.status === "approved" && item.partName.trim())
      .map((item) => item.partName.trim());
    if (approvedNames.length === 0) return;
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
      if (!silent) window.alert(`Ordered ${updated} approved parts.`);
    } catch (err) {
      console.error(err);
      if (!silent) window.alert("Failed to order approved parts.");
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
    const isPendingLike = (status: EstimateItemStatus) => status === "pending" || status === "inquiry";
    const getLineValues = (item: ItemDraft) => {
      const qty = Number(item.quantity) || 0;
      const baseCost = Number(item.cost) || 0;
      const approvedCostRaw = Number(item.approvedCost);
      const approvedCost = Number.isFinite(approvedCostRaw) ? approvedCostRaw : baseCost * qty;
      const saleValue = Number(item.sale) || 0;
      const approvedValue = Number(item.approvedSale) || 0;
      const saleBase = approvedValue > 0 ? approvedValue : saleValue;
      const discountAmount = Number(item.discount) || 0;
      const costTotal = approvedCost;
      const saleTotal = saleBase;
      const subTotal = Math.max(0, saleTotal - discountAmount);
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
      } else if (isPendingLike(item.status)) {
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
  const lineItemTableTotals = useMemo(() => {
    if (!draft) return null;
    const summary = {
      qty: 0,
      oe: 0,
      oem: 0,
      aftm: 0,
      used: 0,
      approvedCost: 0,
      approvedSale: 0,
      discount: 0,
      subTotal: 0,
    };
    for (const item of draft.items) {
      if (item.status === "rejected") continue;
      const qty = Number(item.quantity) || 0;
      const oe = Number(item.quoteCosts?.oe) || 0;
      const oem = Number(item.quoteCosts?.oem) || 0;
      const aftm = Number(item.quoteCosts?.aftm) || 0;
      const used = Number(item.quoteCosts?.used) || 0;
      const approvedCostRaw = Number(item.approvedCost);
      const approvedCost = Number.isFinite(approvedCostRaw) ? approvedCostRaw : (Number(item.cost) || 0) * qty;
      const approvedSale = Number(item.approvedSale ?? item.sale) || 0;
      const lineSale = approvedSale;
      const lineDiscount = Number(item.discount) || 0;
      summary.qty += qty;
      summary.oe += oe * qty;
      summary.oem += oem * qty;
      summary.aftm += aftm * qty;
      summary.used += used * qty;
      summary.approvedCost += approvedCost;
      summary.approvedSale += lineSale;
      summary.discount += lineDiscount;
      summary.subTotal += Math.max(0, lineSale - lineDiscount);
    }
    return summary;
  }, [draft]);

  async function createWorkOrder() {
    try {
      if (!draft) return;
      if (draft.items.some((item) => item.status === "approved")) {
        await orderApprovedParts(true);
      }
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
          approvedType: patch.approvedType ?? current.approvedType ?? null,
          approvedCost: patch.approvedCost ?? current.approvedCost ?? null,
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
                  quoteCosts: undefined,
                  approvedType: undefined,
                  approvedCost: undefined,
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
  async function refreshQuoteUpdates() {
    setIsRefreshingQuotes(true);
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/estimates/${estimateId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const refreshedEstimate: Estimate =
        json.data?.estimate ?? json.data?.data ?? json.data?.estimate ?? json.data;
      let refreshedItems: EstimateItem[] = json.data?.items ?? json.items ?? json.data?.data?.items ?? [];
      let lineItemOrderMap: Record<string, number> = {};
      let lineItemOrderStatusMap: Record<string, string> = {};
      let additionalNewJobItems: ItemDraft[] = [];
      const persistedNewJobDraftByLineItemId = getPersistedNewJobDraftMap(refreshedEstimate?.meta);
      let inspectionSnapshot: any | null = null;
      if (refreshedEstimate?.inspectionId) {
        try {
          const inspectionRes = await fetch(
            `/api/company/${companyId}/workshop/inspections/${refreshedEstimate.inspectionId}`
          );
          if (inspectionRes.ok) {
            const inspectionJson = await inspectionRes.json();
            inspectionSnapshot = inspectionJson?.data?.inspection ?? inspectionJson?.data ?? null;
          }
        } catch {
          inspectionSnapshot = null;
        }
        try {
          const liRes = await fetch(
            `/api/company/${companyId}/workshop/inspections/${refreshedEstimate.inspectionId}/line-items`
          );
          if (liRes.ok) {
            const liJson = await liRes.json();
            const liItems = liJson?.data ?? [];
            additionalNewJobItems = mapAdditionalLineItemsToDraft(
              liItems.filter(
                (li: any) =>
                  Number(li?.isAdd ?? li?.is_add ?? 0) === 1 &&
                  String(li?.source ?? "").toLowerCase() === "estimate"
              ),
              persistedNewJobDraftByLineItemId
            );
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
            const inspectionStatus = String(inspectionSnapshot?.status ?? "").toLowerCase();
            const inspectionCompleted =
              inspectionStatus === "completed" ||
              Boolean(inspectionSnapshot?.completeAt ?? inspectionSnapshot?.complete_at);
            if (refreshedItems.length === 0 && inspectionCompleted) {
              refreshedItems = liItems.map((item: any, idx: number) => ({
                id: item.id ?? `inspection-${idx}`,
                estimateId: refreshedEstimate.id,
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
            if (!inspectionCompleted) {
              refreshedItems = refreshedItems.filter(
                (item: any) => !item?.inspectionItemId && !item?.inspection_item_id
              );
            }
          }
        } catch {
          lineItemOrderMap = {};
          lineItemOrderStatusMap = {};
        }
      }
      setLoadState({ status: "loaded", data: { estimate: refreshedEstimate, items: refreshedItems }, error: null });
      setDraft({
        status: refreshedEstimate.status,
        vatRate: refreshedEstimate.vatRate,
        discountAmount: refreshedEstimate.totalDiscount ?? 0,
        customerComplain: refreshedEstimate.meta?.customerComplain ?? "",
        inspectorRemarks: refreshedEstimate.meta?.inspectorRemarks ?? "",
        items: refreshedItems.map((i) => {
          return {
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
            quoteCosts: i.quoteCosts,
            approvedType: i.approvedType ?? null,
            approvedCost: i.approvedCost ?? null,
          };
        }),
      });
      setNewJobItems(additionalNewJobItems);
      setInspection(inspectionSnapshot);
    } catch (err) {
      console.error("Failed to refresh quotes", err);
      setSaveError("Failed to refresh quotes.");
    } finally {
      setIsRefreshingQuotes(false);
    }
  }

  function addNewJobItem() {
    setNewJobItems((prev) => [
      ...prev,
      {
        partName: "",
        description: "",
        type: "genuine",
        quantity: 1,
        cost: 0,
        sale: 0,
        approvedSale: 0,
        discount: 0,
        status: "pending",
        source: "estimate",
        approvedType: null,
        approvedCost: null,
      },
    ]);
  }

  function updateNewJobItem(index: number, patch: Partial<ItemDraft>) {
    setNewJobItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        if (isApprovedOrderLocked(item)) return item;
        return {
          ...item,
          ...patch,
          partName: patch.partName ?? item.partName ?? "",
          type: patch.type ?? item.type ?? "genuine",
          quantity: patch.quantity ?? item.quantity ?? 0,
          cost: patch.cost ?? item.cost ?? 0,
          sale: patch.sale ?? item.sale ?? 0,
          approvedSale: patch.approvedSale ?? item.approvedSale ?? 0,
          discount: patch.discount ?? item.discount ?? 0,
          productType: patch.productType ?? item.productType ?? null,
          inspectionItemId: patch.inspectionItemId ?? item.inspectionItemId ?? null,
          gpPercent: patch.gpPercent ?? item.gpPercent ?? null,
          status: patch.status ?? item.status ?? "pending",
          partOrdered: patch.partOrdered ?? item.partOrdered ?? 0,
          approvedType: patch.approvedType ?? item.approvedType ?? null,
          approvedCost: patch.approvedCost ?? item.approvedCost ?? null,
        };
      })
    );
  }

  function removeNewJobItem(index: number) {
    setNewJobItems((prev) => prev.filter((_, idx) => idx !== index));
  }

  async function createAdditionalJobCard() {
    if (!inspection?.id) return;
    const inspectionLocked =
      Boolean(inspection?.verifiedAt ?? inspection?.verified_at) ||
      String(inspection?.status ?? "").toLowerCase() === "cancelled" ||
      Boolean(inspection?.cancelledAt ?? inspection?.cancelled_at);
    if (inspectionLocked) {
      setToastMessage({ type: "error", text: "Job card cannot be created because this inspection is locked." });
      return;
    }
    const approved = newJobItems.filter((item) => item.partName.trim() && item.status === "approved");
    if (!approved.length) {
      setSaveError("Add approved line items for the new job.");
      return;
    }
    try {
      const savedItems = await saveEstimate();
      if (!savedItems) {
        setSaveError("Please save line items first.");
        return;
      }
      const approvedLineItemIds = savedItems
        .filter((item) => item.partName.trim() && item.status === "approved")
        .map((item) => String(item.inspectionItemId ?? "").trim())
        .filter(Boolean);
      if (!approvedLineItemIds.length) {
        setSaveError("Approved new-job line items were not saved yet.");
        return;
      }
      const res = await fetch(`/api/company/${companyId}/workshop/job-cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimateId, isAdd: true, lineItemIds: approvedLineItemIds }),
      });
      if (res.status === 409) {
        setJobCardMessage("Job card already active for this estimate.");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json().catch(() => ({}));
      const id: string | null = json?.data?.id ?? json?.data?.jobCard?.id ?? null;
      if (id) {
        setJobCardMessage("Additional job card created successfully.");
        setActiveJobCardId(id);
      }
      await refreshQuoteUpdates();
    } catch (err) {
      console.error(err);
      setSaveError("Failed to create additional job card.");
    }
  }

  async function convertToInvoice() {
    setInvoiceConvertError(null);
    setIsConvertingInvoice(true);
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimateId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInvoiceConvertError(json?.error ?? "Failed to convert to invoice.");
        return;
      }
      setShowInvoiceModal(false);
      setJobCardMessage("Invoice created successfully.");
    } catch {
      setInvoiceConvertError("Failed to convert to invoice.");
    } finally {
      setIsConvertingInvoice(false);
    }
  }
  function applyApprovedTypeToAll(type: EstimateItemCostType, checked: boolean) {
    setDraft((prev) => {
      if (!prev) return prev;
      const nextItems = prev.items.map((item) => {
        const isLocked = isApprovedOrderLocked(item);
        if (isLocked) return item;
        if (!checked) {
          if (item.approvedType !== type) return item;
          return { ...item, approvedType: null };
        }
        const costByType = Number(item.quoteCosts?.[type]) || 0;
        const currentApprovedCost = Number(item.approvedCost ?? item.cost ?? 0);
        const qty = Number(item.quantity) || 0;
        const approvedCost = costByType * qty;
        if (item.approvedType === type && currentApprovedCost === approvedCost) {
          return item;
        }
        return {
          ...item,
          approvedType: type,
          approvedCost,
          cost: costByType,
        };
      });
      return { ...prev, items: nextItems };
    });
  }

  function applyApprovedTypeToAllNewJob(type: EstimateItemCostType, checked: boolean) {
    setNewJobItems((prev) =>
      prev.map((item) => {
        const isLocked = isApprovedOrderLocked(item);
        if (isLocked) return item;
        if (!checked) {
          if (item.approvedType !== type) return item;
          return { ...item, approvedType: null };
        }
        const costByType = Number(item.quoteCosts?.[type]) || 0;
        const currentApprovedCost = Number(item.approvedCost ?? item.cost ?? 0);
        const qty = Number(item.quantity) || 0;
        const approvedCost = costByType * qty;
        if (item.approvedType === type && currentApprovedCost === approvedCost) {
          return item;
        }
        return {
          ...item,
          approvedType: type,
          approvedCost,
          cost: costByType,
        };
      })
    );
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
  const approvedItemsCount = draft.items.filter((item) => item.status === "approved").length;
  const pendingItemsCount = draft.items.filter((item) => item.status === "pending" || item.status === "inquiry").length;
  const estimateStatusTone =
    estimate.status === "approved"
      ? "bg-emerald-500/15 text-emerald-600"
      : estimate.status === "pending_approval"
      ? "bg-amber-500/15 text-amber-600"
      : "bg-cyan-500/15 text-cyan-600";
  const editableItems = draft.items.filter((item) => !(item.partOrdered === 1 && item.status === "approved"));
  const typeSelectable = {
    oe: editableItems.some((item) => item.quoteCosts?.oe != null),
    oem: editableItems.some((item) => item.quoteCosts?.oem != null),
    aftm: editableItems.some((item) => item.quoteCosts?.aftm != null),
    used: editableItems.some((item) => item.quoteCosts?.used != null),
  };
  const allTypeChecked = {
    oe: editableItems.length > 0 && editableItems.every((item) => item.approvedType === "oe"),
    oem: editableItems.length > 0 && editableItems.every((item) => item.approvedType === "oem"),
    aftm: editableItems.length > 0 && editableItems.every((item) => item.approvedType === "aftm"),
    used: editableItems.length > 0 && editableItems.every((item) => item.approvedType === "used"),
  };
  const newJobLineItemTableTotals = (() => {
    const summary = {
      qty: 0,
      oe: 0,
      oem: 0,
      aftm: 0,
      used: 0,
      approvedCost: 0,
      approvedSale: 0,
      discount: 0,
      subTotal: 0,
    };
    for (const item of newJobItems) {
      if (item.status === "rejected") continue;
      const qty = Number(item.quantity) || 0;
      const oe = Number(item.quoteCosts?.oe) || 0;
      const oem = Number(item.quoteCosts?.oem) || 0;
      const aftm = Number(item.quoteCosts?.aftm) || 0;
      const used = Number(item.quoteCosts?.used) || 0;
      const approvedCostRaw = Number(item.approvedCost);
      const approvedCost = Number.isFinite(approvedCostRaw) ? approvedCostRaw : (Number(item.cost) || 0) * qty;
      const approvedSale = Number(item.approvedSale ?? item.sale) || 0;
      const lineDiscount = Number(item.discount) || 0;
      summary.qty += qty;
      summary.oe += oe * qty;
      summary.oem += oem * qty;
      summary.aftm += aftm * qty;
      summary.used += used * qty;
      summary.approvedCost += approvedCost;
      summary.approvedSale += approvedSale;
      summary.discount += lineDiscount;
      summary.subTotal += Math.max(0, approvedSale - lineDiscount);
    }
    return summary;
  })();
  const newJobEditableItems = newJobItems.filter((item) => !isApprovedOrderLocked(item));
  const newJobTypeSelectable = {
    oe: newJobEditableItems.some((item) => item.quoteCosts?.oe != null),
    oem: newJobEditableItems.some((item) => item.quoteCosts?.oem != null),
    aftm: newJobEditableItems.some((item) => item.quoteCosts?.aftm != null),
    used: newJobEditableItems.some((item) => item.quoteCosts?.used != null),
  };
  const newJobAllTypeChecked = {
    oe: newJobEditableItems.length > 0 && newJobEditableItems.every((item) => item.approvedType === "oe"),
    oem: newJobEditableItems.length > 0 && newJobEditableItems.every((item) => item.approvedType === "oem"),
    aftm: newJobEditableItems.length > 0 && newJobEditableItems.every((item) => item.approvedType === "aftm"),
    used: newJobEditableItems.length > 0 && newJobEditableItems.every((item) => item.approvedType === "used"),
  };
  const approvedShare =
    totals && totals.approved.grandTotal + totals.pending.grandTotal > 0
      ? (totals.approved.grandTotal / (totals.approved.grandTotal + totals.pending.grandTotal)) * 100
      : 0;
  const approvedProfit = totals ? totals.approved.subTotal - totals.approved.cost : 0;
  const approvedMargin = totals && totals.approved.subTotal > 0 ? (approvedProfit / totals.approved.subTotal) * 100 : 0;
  const newJobSummary = (() => {
    const isPendingLike = (status: EstimateItemStatus) => status === "pending" || status === "inquiry";
    const approved = { cost: 0, sale: 0, discount: 0, subTotal: 0 };
    const pending = { cost: 0, sale: 0, discount: 0, subTotal: 0 };
    for (const item of newJobItems) {
      if (item.status === "rejected" || !item.partName.trim()) continue;
      const qty = Number(item.quantity) || 0;
      const baseCost = Number(item.cost) || 0;
      const approvedCostRaw = Number(item.approvedCost);
      const approvedCost = Number.isFinite(approvedCostRaw) ? approvedCostRaw : baseCost * qty;
      const saleValue = Number(item.sale) || 0;
      const approvedValue = Number(item.approvedSale) || 0;
      const saleBase = approvedValue > 0 ? approvedValue : saleValue;
      const discountAmount = Number(item.discount) || 0;
      const subTotal = Math.max(0, saleBase - discountAmount);
      const hasApprovedPricing = saleBase > 0;
      if (item.status === "approved" && hasApprovedPricing) {
        approved.cost += approvedCost;
        approved.sale += saleBase;
        approved.discount += discountAmount;
        approved.subTotal += subTotal;
      } else if (isPendingLike(item.status) || item.status === "approved") {
        pending.cost += approvedCost;
        pending.sale += saleBase;
        pending.discount += discountAmount;
        pending.subTotal += subTotal;
      }
    }
    const vatRate = Number(draft?.vatRate ?? 0) || 0;
    const approvedVat = (approved.subTotal * vatRate) / 100;
    const pendingVat = (pending.subTotal * vatRate) / 100;
    return {
      approved: { ...approved, vat: approvedVat, grandTotal: approved.subTotal + approvedVat },
      pending: { ...pending, vat: pendingVat, grandTotal: pending.subTotal + pendingVat },
      vatRate,
    };
  })();
  const newJobApprovedShare =
    newJobSummary.approved.grandTotal + newJobSummary.pending.grandTotal > 0
      ? (newJobSummary.approved.grandTotal /
          (newJobSummary.approved.grandTotal + newJobSummary.pending.grandTotal)) *
        100
      : 0;
  const newJobApprovedProfit = newJobSummary.approved.subTotal - newJobSummary.approved.cost;
  const newJobApprovedMargin =
    newJobSummary.approved.subTotal > 0
      ? (newJobApprovedProfit / newJobSummary.approved.subTotal) * 100
      : 0;
  const hasActiveJobCard = Boolean(activeJobCardId);
  const canStartAdditionalJobCard =
    newJobItems.some((item) => item.partName.trim() && item.status === "approved");
  const openJobCards = jobCards.filter((job) => {
    const s = String(job.status ?? "").toLowerCase();
    return s === "pending" || s === "re-assigned";
  });
  const approvedLineItemsNotReceived = inspectionLineItems.filter((item) => {
    const status = String(item?.status ?? "").toLowerCase();
    const orderStatus = String(item?.orderStatus ?? item?.order_status ?? "").toLowerCase();
    return status === "approved" && orderStatus !== "received";
  });
  const hasReassignedJobCards = jobCards.some((job) => String(job.status ?? "").toLowerCase() === "re-assigned");
  const convertBlocked = openJobCards.length > 0 || approvedLineItemsNotReceived.length > 0;
  const estimateItemByInspectionId = new Map(
    draft.items
      .filter((item) => item.inspectionItemId)
      .map((item) => [String(item.inspectionItemId), item] as const)
  );
  const jobCardTotals = jobCards.map((job) => {
    const relatedLineItems = inspectionLineItems.filter((li) => String(li.jobCardId ?? li.job_card_id ?? "") === job.id);
    const total = relatedLineItems.reduce((acc, li) => {
      const mapped = estimateItemByInspectionId.get(String(li.id));
      if (!mapped) return acc;
      const sale = Number(mapped.approvedSale ?? mapped.sale ?? 0);
      const discount = Number(mapped.discount ?? 0);
      return acc + Math.max(0, sale - discount);
    }, 0);
    return { jobId: job.id, status: job.status ?? "", total };
  });
  const invoiceSubTotalPreview = jobCardTotals.reduce((sum, row) => sum + row.total, 0);
  const invoiceVatPreview = (invoiceSubTotalPreview * (Number(draft.vatRate) || 0)) / 100;
  const invoiceGrandTotalPreview = invoiceSubTotalPreview + invoiceVatPreview;

  return (
    <MainPageShell
      title={`Create Estimate - ${estimate.id.slice(0, 8)}`}
      subtitle="Estimate workflow with inspection alignment, pricing approval, and job-card readiness."
      scopeLabel=""
      primaryAction={
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/company/${companyId}/workshop/estimates/${estimate.id}/quote`}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-slate-400/40 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-white/15"
          >
            Print Quotation
          </a>
          <button
            type="button"
            className="rounded-md border border-sky-400/50 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-200 shadow-sm transition hover:bg-sky-500/25"
          >
            Print Estimate - Approved
          </button>
          <button
            type="button"
            className="rounded-md border border-teal-400/50 bg-teal-500/15 px-3 py-1.5 text-xs font-semibold text-teal-200 shadow-sm transition hover:bg-teal-500/25"
          >
            Print Estimate - Pending
          </button>
          <button
            type="button"
            className="rounded-md border border-amber-400/50 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-200 shadow-sm transition hover:bg-amber-500/25"
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
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className={`rounded-xl border border-slate-600/60 px-3 py-2 ${theme.cardBg}`}>
          <div className="text-[11px] text-muted-foreground">Estimate Status</div>
          <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${estimateStatusTone}`}>
            {estimate.status.replace("_", " ")}
          </span>
        </div>
        <div className={`rounded-xl border border-slate-600/60 px-3 py-2 ${theme.cardBg}`}>
          <div className="text-[11px] text-muted-foreground">Approved Items</div>
          <div className="mt-1 text-lg font-semibold text-emerald-400">{approvedItemsCount}</div>
        </div>
        <div className={`rounded-xl border border-slate-600/60 px-3 py-2 ${theme.cardBg}`}>
          <div className="text-[11px] text-muted-foreground">Pending Items</div>
          <div className="mt-1 text-lg font-semibold text-amber-400">{pendingItemsCount}</div>
        </div>
        <div className={`rounded-xl border border-slate-600/60 px-3 py-2 ${theme.cardBg}`}>
          <div className="text-[11px] text-muted-foreground">Grand Total (Approved)</div>
          <div className="mt-1 text-lg font-semibold">{totals ? totals.approved.grandTotal.toFixed(2) : "0.00"}</div>
        </div>
        <div className={`rounded-xl border border-slate-600/60 px-3 py-2 ${theme.cardBg}`}>
          <div className="text-[11px] text-muted-foreground">Save Status</div>
          <div className="mt-1 text-xs font-semibold">{saveStatusText}</div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <section className={`rounded-xl border border-slate-600/60 ${theme.cardBg}`}>
            <div
              className={`flex items-center justify-between rounded-t-xl border-b border-slate-600/60 px-4 py-3 text-xs font-semibold ${theme.surfaceSubtle} ${theme.appText}`}
            >
              <span>Estimate Details</span>
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
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={refreshQuoteUpdates}
                  className="rounded-md border border-slate-500/60 bg-slate-800/60 px-3 py-1.5 text-xs font-semibold text-slate-100"
                  disabled={isRefreshingQuotes}
                >
                  {isRefreshingQuotes ? "Refreshing..." : "Refresh Quotes"}
                </button>
              </div>
              <div className="rounded-md border border-slate-600/60 bg-slate-900/20 px-3 py-2 text-[11px] text-slate-300">
                Step flow: Select cost type, confirm approved cost, enter approved sale and discount, then set status.
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-600/60">
                <table className="min-w-full text-xs">
                  <thead className={`${theme.surfaceSubtle} ${theme.appText} text-[10px] uppercase tracking-[0.08em]`}>
                    <tr>
                      <th className="px-2 py-1 text-left">Part Name</th>
                      <th className="px-2 py-1 text-left">Description</th>
                      <th className="px-2 py-1 text-left">Qty</th>
                      <th className="px-2 py-1 text-left">OE Cost</th>
                      <th className="px-2 py-1 text-left">OEM Cost</th>
                      <th className="px-2 py-1 text-left">AFTM Cost</th>
                      <th className="px-2 py-1 text-left">Used Cost</th>
                      <th className="px-2 py-1 text-left">Approved Cost</th>
                      <th className="px-2 py-1 text-left">GP</th>
                      <th className="px-2 py-1 text-left">Approved Sale</th>
                      <th className="px-2 py-1 text-left">Discount</th>
                      <th className="px-2 py-1 text-left">Sub Total</th>
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
                        const oeCost = Number(item.quoteCosts?.oe) || 0;
                        const oemCost = Number(item.quoteCosts?.oem) || 0;
                        const aftmCost = Number(item.quoteCosts?.aftm) || 0;
                        const usedCost = Number(item.quoteCosts?.used) || 0;
                        const baseCost = Number(item.cost) || 0;
                        const discountAmount = Number(item.discount) || 0;
                        const approvedCostRaw = Number(item.approvedCost);
                        const approvedCostValue = Number.isFinite(approvedCostRaw) ? approvedCostRaw : baseCost * qty;
                        const saleBase = Number(item.approvedSale ?? item.sale) || 0;
                        const lineSale = saleBase;
                        const subTotal = Math.max(0, lineSale - discountAmount);
                        const lineCost = approvedCostValue;
                        const gpPercent =
                          subTotal > 0 ? ((subTotal - lineCost) / subTotal) * 100 : 0;
                        const isLocked = item.partOrdered === 1 && item.status === "approved";
                        const selectedApprovedType = item.approvedType ?? null;
                        return (
                          <tr key={idx} className="border-b border-slate-600/60 transition-colors odd:bg-slate-900/15 hover:bg-slate-800/25 last:border-0">
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
                                onChange={(e) => {
                                  const nextQty = Number(e.target.value) || 0;
                                  const selectedType = item.approvedType ?? null;
                                  const selectedUnitCost = selectedType ? Number(item.quoteCosts?.[selectedType]) || 0 : 0;
                                  updateItem(idx, {
                                    quantity: nextQty,
                                    approvedCost: selectedType ? selectedUnitCost * nextQty : item.approvedCost,
                                  });
                                }}
                              />
                            </td>
                            {COST_DISPLAY_ORDER.map(({ key }) => {
                              const costByType =
                                key === "oe" ? oeCost : key === "oem" ? oemCost : key === "aftm" ? aftmCost : usedCost;
                              const isChecked = selectedApprovedType === key;
                              const hasQuoteForType = item.quoteCosts?.[key] != null;
                              return (
                                <td key={`${idx}-${key}`} className="px-2 py-1">
                                  <div className="flex flex-col items-start gap-1">
                                    <span className="inline-flex min-w-[74px] justify-end rounded-md border border-slate-500/60 bg-slate-100/80 px-2 py-1 font-semibold text-slate-900 dark:border-slate-600/50 dark:bg-slate-900/60 dark:text-slate-100">
                                      {formatCostValue(costByType)}
                                    </span>
                                    <label className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      disabled={isLocked || !hasQuoteForType}
                                      onChange={(e) => {
                                        if (!e.target.checked) {
                                          updateItem(idx, { approvedType: null });
                                          return;
                                        }
                                        const approvedType = key;
                                        const approvedCost = costByType * qty;
                                        updateItem(idx, {
                                          approvedType,
                                          approvedCost,
                                          cost: costByType,
                                        });
                                      }}
                                    />
                                      <span className={isChecked ? "text-emerald-300" : ""}>{isChecked ? "Selected" : "Select"}</span>
                                    </label>
                                  </div>
                                </td>
                              );
                            })}
                            <td className="px-2 py-1">
                              <input
                                type="number"
                                step="0.01"
                                className={`${theme.input} h-8 w-24 text-xs`}
                                value={item.approvedCost ?? ""}
                                disabled={isLocked}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  const approvedCost =
                                    raw === "" ? null : Number(raw);
                                  updateItem(idx, {
                                    approvedCost,
                                  });
                                }}
                              />
                            </td>
                            <td className="px-2 py-1">
                              <input
                                type="number"
                                step="0.01"
                                className={`${theme.input} h-8 w-20 text-xs`}
                                value={Number.isFinite(gpPercent) ? gpPercent.toFixed(2) : "0.00"}
                                disabled={isLocked}
                                onChange={(e) => {
                                  const gp = Number(e.target.value);
                                  updateItem(idx, {
                                    gpPercent: gp,
                                  });
                                }}
                              />
                            </td>
                            <td className="px-2 py-1">
                              <div className="space-y-1">
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
                                    });
                                  }}
                                />
                              </div>
                            </td>
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
                                  <option value="inquiry">Inquiry</option>
                                  <option value="approved">Approved</option>
                                  <option value="rejected">Rejected</option>
                                </select>
                                {renderOrderBadge(item)}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {draft.items.length > 0 && lineItemTableTotals && (
                    <tfoot className={`${theme.surfaceSubtle} ${theme.appText}`}>
                      <tr className="border-t border-slate-600/60 font-semibold">
                        <td className="px-2 py-2 text-left">Totals</td>
                        <td className="px-2 py-2 text-left">-</td>
                        <td className="px-2 py-2 text-left">{lineItemTableTotals.qty.toFixed(2)}</td>
                        <td className="px-2 py-2 text-left">
                          <label className="flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={allTypeChecked.oe}
                              disabled={!typeSelectable.oe}
                              onChange={(e) => applyApprovedTypeToAll("oe", e.target.checked)}
                            />
                            <span>{lineItemTableTotals.oe.toFixed(2)}</span>
                          </label>
                        </td>
                        <td className="px-2 py-2 text-left">
                          <label className="flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={allTypeChecked.oem}
                              disabled={!typeSelectable.oem}
                              onChange={(e) => applyApprovedTypeToAll("oem", e.target.checked)}
                            />
                            <span>{lineItemTableTotals.oem.toFixed(2)}</span>
                          </label>
                        </td>
                        <td className="px-2 py-2 text-left">
                          <label className="flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={allTypeChecked.aftm}
                              disabled={!typeSelectable.aftm}
                              onChange={(e) => applyApprovedTypeToAll("aftm", e.target.checked)}
                            />
                            <span>{lineItemTableTotals.aftm.toFixed(2)}</span>
                          </label>
                        </td>
                        <td className="px-2 py-2 text-left">
                          <label className="flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={allTypeChecked.used}
                              disabled={!typeSelectable.used}
                              onChange={(e) => applyApprovedTypeToAll("used", e.target.checked)}
                            />
                            <span>{lineItemTableTotals.used.toFixed(2)}</span>
                          </label>
                        </td>
                        <td className="px-2 py-2 text-left">{lineItemTableTotals.approvedCost.toFixed(2)}</td>
                        <td className="px-2 py-2 text-left">
                          {lineItemTableTotals.subTotal > 0
                            ? (((lineItemTableTotals.subTotal - lineItemTableTotals.approvedCost) /
                                lineItemTableTotals.subTotal) *
                                100
                              ).toFixed(2)
                            : "0.00"}
                        </td>
                        <td className="px-2 py-2 text-left">{lineItemTableTotals.approvedSale.toFixed(2)}</td>
                        <td className="px-2 py-2 text-left">{lineItemTableTotals.discount.toFixed(2)}</td>
                        <td className="px-2 py-2 text-left">{lineItemTableTotals.subTotal.toFixed(2)}</td>
                        <td className="px-2 py-2 text-left">-</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-600/60 bg-slate-900/20 p-2">
                <button
                  type="button"
                  onClick={addItem}
                  className="rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white"
                  disabled={hasActiveJobCard}
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
                  disabled={
                    hasActiveJobCard ||
                    !draft.items.some((item) => !item.inspectionItemId && item.source !== "inspection")
                  }
                >
                  Remove ?
                </button>
              </div>
              <div className="flex justify-end">
                <div
                  className={`flex items-center gap-2 rounded-md border border-slate-600/60 px-3 py-2 text-xs font-semibold ${theme.surfaceSubtle} ${theme.appText}`}
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
              <div className="rounded-lg border border-slate-600/60 bg-slate-900/30 p-3">
                <div className="mb-3 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-emerald-300">Approved Share</div>
                    <div className="text-sm font-semibold text-emerald-200">{approvedShare.toFixed(2)}%</div>
                  </div>
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-amber-300">Pending Value</div>
                    <div className="text-sm font-semibold text-amber-200">
                      {totals ? totals.pending.grandTotal.toFixed(2) : "0.00"}
                    </div>
                  </div>
                  <div className="rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-sky-300">Approved Profit</div>
                    <div className="text-sm font-semibold text-sky-200">
                      {approvedProfit.toFixed(2)} ({approvedMargin.toFixed(2)}%)
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-md border border-slate-600/60">
                  <table className="min-w-full text-xs">
                    <thead className={`${theme.surfaceSubtle} ${theme.appText}`}>
                      <tr>
                        <th className="px-3 py-2 text-left">Metric</th>
                        <th className="px-3 py-2 text-right">Pending</th>
                        <th className="px-3 py-2 text-right">Approved</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-slate-600/60">
                        <td className="px-3 py-2">Total Cost</td>
                        <td className="px-3 py-2 text-right">{totals ? totals.pending.cost.toFixed(2) : "0.00"}</td>
                        <td className="px-3 py-2 text-right">{totals ? totals.approved.cost.toFixed(2) : "0.00"}</td>
                      </tr>
                      <tr className="border-t border-slate-600/60">
                        <td className="px-3 py-2">Total Sale</td>
                        <td className="px-3 py-2 text-right">{totals ? totals.pending.sale.toFixed(2) : "0.00"}</td>
                        <td className="px-3 py-2 text-right">{totals ? totals.approved.sale.toFixed(2) : "0.00"}</td>
                      </tr>
                      <tr className="border-t border-slate-600/60">
                        <td className="px-3 py-2">Discount</td>
                        <td className="px-3 py-2 text-right">{totals ? totals.pending.discount.toFixed(2) : "0.00"}</td>
                        <td className="px-3 py-2 text-right">{totals ? totals.approved.discount.toFixed(2) : "0.00"}</td>
                      </tr>
                      <tr className="border-t border-slate-600/60">
                        <td className="px-3 py-2">Sub Total</td>
                        <td className="px-3 py-2 text-right">{totals ? totals.pending.subTotal.toFixed(2) : "0.00"}</td>
                        <td className="px-3 py-2 text-right">{totals ? totals.approved.subTotal.toFixed(2) : "0.00"}</td>
                      </tr>
                      <tr className="border-t border-slate-600/60">
                        <td className="px-3 py-2">{`VAT (${totals ? totals.vatRate : 0}%)`}</td>
                        <td className="px-3 py-2 text-right">{totals ? totals.pending.vat.toFixed(2) : "0.00"}</td>
                        <td className="px-3 py-2 text-right">{totals ? totals.approved.vat.toFixed(2) : "0.00"}</td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-500/80 bg-slate-800/40 font-semibold">
                        <td className="px-3 py-2">Grand Total</td>
                        <td className="px-3 py-2 text-right">{totals ? totals.pending.grandTotal.toFixed(2) : "0.00"}</td>
                        <td className="px-3 py-2 text-right">{totals ? totals.approved.grandTotal.toFixed(2) : "0.00"}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-600/60 bg-background/30 p-3">
                <div className="text-xs text-muted-foreground">{saveStatusText}</div>
                <div className="flex items-center gap-2">
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
          <section className={`rounded-xl border border-slate-600/60 ${theme.cardBg}`}>
            <div
              className={`flex items-center justify-between rounded-t-xl border-b border-slate-600/60 px-4 py-3 text-xs font-semibold ${theme.surfaceSubtle} ${theme.appText}`}
            >
              <span>New Job</span>
              <button
                type="button"
                onClick={addNewJobItem}
                className="rounded-md border border-cyan-500/60 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200"
              >
                Start New Job
              </button>
            </div>
            {newJobItems.length > 0 ? (
              <div className="space-y-3 p-4">
                <div className="text-xs font-semibold text-slate-200">New Job Line Items</div>
                <div className="rounded-md border border-slate-600/60 bg-slate-900/20 px-3 py-2 text-[11px] text-slate-300">
                  Same process as main job card. Keep status `Pending` until advisor confirms.
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-600/60">
                  <table className="min-w-full text-xs">
                    <thead className={`${theme.surfaceSubtle} ${theme.appText} text-[10px] uppercase tracking-[0.08em]`}>
                      <tr>
                        <th className="px-2 py-1 text-left">Part Name</th>
                        <th className="px-2 py-1 text-left">Description</th>
                        <th className="px-2 py-1 text-left">Qty</th>
                        <th className="px-2 py-1 text-left">OE Cost</th>
                        <th className="px-2 py-1 text-left">OEM Cost</th>
                        <th className="px-2 py-1 text-left">AFTM Cost</th>
                        <th className="px-2 py-1 text-left">Used Cost</th>
                        <th className="px-2 py-1 text-left">Approved Cost</th>
                        <th className="px-2 py-1 text-left">GP</th>
                        <th className="px-2 py-1 text-left">Approved Sale</th>
                        <th className="px-2 py-1 text-left">Discount</th>
                        <th className="px-2 py-1 text-left">Sub Total</th>
                        <th className="px-2 py-1 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {newJobItems.map((item, idx) => {
                        const qty = Number(item.quantity) || 0;
                        const oeCost = Number(item.quoteCosts?.oe) || 0;
                        const oemCost = Number(item.quoteCosts?.oem) || 0;
                        const aftmCost = Number(item.quoteCosts?.aftm) || 0;
                        const usedCost = Number(item.quoteCosts?.used) || 0;
                        const discountAmount = Number(item.discount) || 0;
                        const approvedCostRaw = Number(item.approvedCost);
                        const approvedCostValue = Number.isFinite(approvedCostRaw)
                          ? approvedCostRaw
                          : (Number(item.cost) || 0) * qty;
                        const lineSale = Number(item.approvedSale ?? item.sale) || 0;
                        const subTotal = Math.max(0, lineSale - discountAmount);
                        const lineCost = approvedCostValue;
                        const gpPercent = subTotal > 0 ? ((subTotal - lineCost) / subTotal) * 100 : 0;
                        const selectedApprovedType = item.approvedType ?? null;
                        const isLocked = isApprovedOrderLocked(item);

                        return (
                          <tr key={`new-job-${idx}`} className="border-b border-slate-600/60 transition-colors odd:bg-slate-900/15 hover:bg-slate-800/25 last:border-0">
                            <td className="px-2 py-1">
                              <input
                                ref={(el) => {
                                  productInputRefs.current[NEW_JOB_PRODUCT_INDEX_OFFSET + idx] = el;
                                }}
                                className={`${theme.input} h-8 text-xs`}
                                value={item.partName}
                                disabled={isLocked}
                                onChange={(e) => updateNewJobItem(idx, { partName: e.target.value })}
                                placeholder="Part Name"
                                onFocus={() => setProductOpenIndex(NEW_JOB_PRODUCT_INDEX_OFFSET + idx)}
                              />
                            </td>
                            <td className="px-2 py-1">
                              <input
                                className={`${theme.input} h-8 text-xs`}
                                value={item.description ?? ""}
                                disabled={isLocked}
                                onChange={(e) => updateNewJobItem(idx, { description: e.target.value })}
                                placeholder="Description"
                              />
                            </td>
                            <td className="px-2 py-1">
                              <input
                                type="number"
                                className={`${theme.input} h-8 w-20 text-xs`}
                                value={item.quantity}
                                disabled={isLocked}
                                onChange={(e) => {
                                  const nextQty = Number(e.target.value) || 0;
                                  const selectedType = item.approvedType ?? null;
                                  const selectedUnitCost = selectedType ? Number(item.quoteCosts?.[selectedType]) || 0 : 0;
                                  updateNewJobItem(idx, {
                                    quantity: nextQty,
                                    approvedCost: selectedType ? selectedUnitCost * nextQty : item.approvedCost,
                                  });
                                }}
                              />
                            </td>
                            {COST_DISPLAY_ORDER.map(({ key }) => {
                              const costByType =
                                key === "oe" ? oeCost : key === "oem" ? oemCost : key === "aftm" ? aftmCost : usedCost;
                              const isChecked = selectedApprovedType === key;
                              const hasQuoteForType = item.quoteCosts?.[key] != null;
                              return (
                                <td key={`new-${idx}-${key}`} className="px-2 py-1">
                                  <div className="flex flex-col items-start gap-1">
                                    <span className="inline-flex min-w-[74px] justify-end rounded-md border border-slate-500/60 bg-slate-100/80 px-2 py-1 font-semibold text-slate-900 dark:border-slate-600/50 dark:bg-slate-900/60 dark:text-slate-100">
                                      {formatCostValue(costByType)}
                                    </span>
                                    <label className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      disabled={isLocked || !hasQuoteForType}
                                      onChange={(e) => {
                                        if (!e.target.checked) {
                                          updateNewJobItem(idx, { approvedType: null });
                                          return;
                                        }
                                        const approvedType = key;
                                        const approvedCost = costByType * qty;
                                        updateNewJobItem(idx, {
                                          approvedType,
                                          approvedCost,
                                          cost: costByType,
                                        });
                                      }}
                                    />
                                      <span className={isChecked ? "text-emerald-300" : ""}>{isChecked ? "Selected" : "Select"}</span>
                                    </label>
                                  </div>
                                </td>
                              );
                            })}
                            <td className="px-2 py-1">
                              <input
                                type="number"
                                className={`${theme.input} h-8 w-24 text-xs`}
                                value={item.approvedCost ?? ""}
                                disabled={isLocked}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  const approvedCost = raw === "" ? null : Number(raw);
                                  updateNewJobItem(idx, { approvedCost });
                                }}
                              />
                            </td>
                            <td className="px-2 py-1">
                              <input
                                type="number"
                                step="0.01"
                                className={`${theme.input} h-8 w-20 text-xs`}
                                value={Number.isFinite(gpPercent) ? gpPercent.toFixed(2) : "0.00"}
                                disabled={isLocked}
                                onChange={(e) => updateNewJobItem(idx, { gpPercent: Number(e.target.value) || 0 })}
                              />
                            </td>
                            <td className="px-2 py-1">
                              <input
                                type="number"
                                className={`${theme.input} h-8 w-24 text-xs`}
                                value={item.approvedSale}
                                disabled={isLocked}
                                onChange={(e) => updateNewJobItem(idx, { approvedSale: Number(e.target.value) || 0 })}
                              />
                            </td>
                            <td className="px-2 py-1">
                              <input
                                type="number"
                                className={`${theme.input} h-8 w-20 text-xs`}
                                value={item.discount}
                                disabled={isLocked}
                                onChange={(e) => updateNewJobItem(idx, { discount: Number(e.target.value) || 0 })}
                              />
                            </td>
                            <td className="px-2 py-1 text-xs">{subTotal.toFixed(2)}</td>
                            <td className="px-2 py-1">
                              <div className="flex items-center gap-1">
                                <select
                                  className={`${theme.input} h-8 w-24 text-xs`}
                                  value={item.status}
                                  disabled={isLocked}
                                  onChange={(e) => updateNewJobItem(idx, { status: e.target.value as EstimateItemStatus })}
                                >
                                  <option value="pending">Pending</option>
                                  <option value="inquiry">Inquiry</option>
                                  <option value="approved">Approved</option>
                                  <option value="rejected">Rejected</option>
                                </select>
                                <button
                                  type="button"
                                  className="rounded-md bg-rose-600 px-2 py-1 text-[10px] font-semibold text-white"
                                  onClick={() => removeNewJobItem(idx)}
                                  disabled={isLocked}
                                >
                                  X
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {newJobItems.length > 0 && (
                      <tfoot className={`${theme.surfaceSubtle} ${theme.appText}`}>
                        <tr className="border-t border-slate-600/60 font-semibold">
                          <td className="px-2 py-2 text-left">Totals</td>
                          <td className="px-2 py-2 text-left">-</td>
                          <td className="px-2 py-2 text-left">{newJobLineItemTableTotals.qty.toFixed(2)}</td>
                          <td className="px-2 py-2 text-left">
                            <label className="flex items-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={newJobAllTypeChecked.oe}
                                disabled={!newJobTypeSelectable.oe}
                                onChange={(e) => applyApprovedTypeToAllNewJob("oe", e.target.checked)}
                              />
                              <span>{newJobLineItemTableTotals.oe.toFixed(2)}</span>
                            </label>
                          </td>
                          <td className="px-2 py-2 text-left">
                            <label className="flex items-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={newJobAllTypeChecked.oem}
                                disabled={!newJobTypeSelectable.oem}
                                onChange={(e) => applyApprovedTypeToAllNewJob("oem", e.target.checked)}
                              />
                              <span>{newJobLineItemTableTotals.oem.toFixed(2)}</span>
                            </label>
                          </td>
                          <td className="px-2 py-2 text-left">
                            <label className="flex items-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={newJobAllTypeChecked.aftm}
                                disabled={!newJobTypeSelectable.aftm}
                                onChange={(e) => applyApprovedTypeToAllNewJob("aftm", e.target.checked)}
                              />
                              <span>{newJobLineItemTableTotals.aftm.toFixed(2)}</span>
                            </label>
                          </td>
                          <td className="px-2 py-2 text-left">
                            <label className="flex items-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={newJobAllTypeChecked.used}
                                disabled={!newJobTypeSelectable.used}
                                onChange={(e) => applyApprovedTypeToAllNewJob("used", e.target.checked)}
                              />
                              <span>{newJobLineItemTableTotals.used.toFixed(2)}</span>
                            </label>
                          </td>
                          <td className="px-2 py-2 text-left">{newJobLineItemTableTotals.approvedCost.toFixed(2)}</td>
                          <td className="px-2 py-2 text-left">
                            {newJobLineItemTableTotals.subTotal > 0
                              ? (((newJobLineItemTableTotals.subTotal - newJobLineItemTableTotals.approvedCost) /
                                  newJobLineItemTableTotals.subTotal) *
                                  100
                                ).toFixed(2)
                              : "0.00"}
                          </td>
                          <td className="px-2 py-2 text-left">{newJobLineItemTableTotals.approvedSale.toFixed(2)}</td>
                          <td className="px-2 py-2 text-left">{newJobLineItemTableTotals.discount.toFixed(2)}</td>
                          <td className="px-2 py-2 text-left">{newJobLineItemTableTotals.subTotal.toFixed(2)}</td>
                          <td className="px-2 py-2 text-left">-</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
                <div className="flex items-center gap-2 rounded-md border border-slate-600/60 bg-slate-900/20 p-2">
                  <button
                    type="button"
                    onClick={addNewJobItem}
                    className="rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    + Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const lastIndex = newJobItems.length - 1;
                      if (lastIndex >= 0) removeNewJobItem(lastIndex);
                    }}
                    className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white"
                    disabled={newJobItems.length === 0}
                  >
                    Remove ?
                  </button>
                </div>
                <div className="rounded-lg border border-slate-600/60 bg-slate-900/30 p-3">
                  <div className="mb-3 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-emerald-300">Approved Share</div>
                      <div className="text-sm font-semibold text-emerald-200">{newJobApprovedShare.toFixed(2)}%</div>
                    </div>
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-amber-300">Pending Value</div>
                      <div className="text-sm font-semibold text-amber-200">
                        {newJobSummary.pending.grandTotal.toFixed(2)}
                      </div>
                    </div>
                    <div className="rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-sky-300">Approved Profit</div>
                      <div className="text-sm font-semibold text-sky-200">
                        {newJobApprovedProfit.toFixed(2)} ({newJobApprovedMargin.toFixed(2)}%)
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto rounded-md border border-slate-600/60">
                    <table className="min-w-full text-xs">
                      <thead className={`${theme.surfaceSubtle} ${theme.appText}`}>
                        <tr>
                          <th className="px-3 py-2 text-left">Metric</th>
                          <th className="px-3 py-2 text-right">Pending</th>
                          <th className="px-3 py-2 text-right">Approved</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t border-slate-600/60">
                          <td className="px-3 py-2">Total Cost</td>
                          <td className="px-3 py-2 text-right">{newJobSummary.pending.cost.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right">{newJobSummary.approved.cost.toFixed(2)}</td>
                        </tr>
                        <tr className="border-t border-slate-600/60">
                          <td className="px-3 py-2">Total Sale</td>
                          <td className="px-3 py-2 text-right">{newJobSummary.pending.sale.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right">{newJobSummary.approved.sale.toFixed(2)}</td>
                        </tr>
                        <tr className="border-t border-slate-600/60">
                          <td className="px-3 py-2">Discount</td>
                          <td className="px-3 py-2 text-right">{newJobSummary.pending.discount.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right">{newJobSummary.approved.discount.toFixed(2)}</td>
                        </tr>
                        <tr className="border-t border-slate-600/60">
                          <td className="px-3 py-2">Sub Total</td>
                          <td className="px-3 py-2 text-right">{newJobSummary.pending.subTotal.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right">{newJobSummary.approved.subTotal.toFixed(2)}</td>
                        </tr>
                        <tr className="border-t border-slate-600/60">
                          <td className="px-3 py-2">{`VAT (${newJobSummary.vatRate}%)`}</td>
                          <td className="px-3 py-2 text-right">{newJobSummary.pending.vat.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right">{newJobSummary.approved.vat.toFixed(2)}</td>
                        </tr>
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-slate-500/80 bg-slate-800/40 font-semibold">
                          <td className="px-3 py-2">Grand Total</td>
                          <td className="px-3 py-2 text-right">{newJobSummary.pending.grandTotal.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right">{newJobSummary.approved.grandTotal.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={saveEstimate}
                    className="rounded-md border border-emerald-500/60 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200"
                    disabled={isSaving}
                  >
                    {isSaving ? "Saving..." : "Save Line Items"}
                  </button>
                  <button
                    type="button"
                    onClick={createAdditionalJobCard}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                      canStartAdditionalJobCard
                        ? "bg-indigo-600 text-white"
                        : "cursor-not-allowed bg-slate-600/60 text-white/60"
                    }`}
                    disabled={!canStartAdditionalJobCard}
                  >
                    Create New Job Card
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 text-xs text-muted-foreground">
                Start a new job to open a separate line-items card and create a different job card.
              </div>
            )}
          </section>
        </div>
        <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <section className={`rounded-xl border border-slate-600/60 ${theme.cardBg}`}>
            <div
              className={`rounded-t-xl border-b border-slate-600/60 px-3 py-2 text-xs font-semibold ${theme.surfaceSubtle} ${theme.appText}`}
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
          <section className={`rounded-xl border border-slate-600/60 ${theme.cardBg}`}>
            <div
              className={`rounded-t-xl border-b border-slate-600/60 px-3 py-2 text-xs font-semibold ${theme.surfaceSubtle} ${theme.appText}`}
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
          <section className={`rounded-xl border border-slate-600/60 ${theme.cardBg}`}>
            <div
              className={`rounded-t-xl border-b border-slate-600/60 px-3 py-2 text-xs font-semibold ${theme.surfaceSubtle} ${theme.appText}`}
            >
              Invoice Summary
            </div>
            <div className="space-y-2 p-3 text-xs">
              <div className="rounded-md border border-slate-600/60 bg-slate-900/30 px-2 py-2">
                <div className="mb-1 text-[11px] font-semibold text-slate-200">Readiness</div>
                <div className="space-y-1 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span>All job cards completed</span>
                    <span className={openJobCards.length === 0 ? "text-emerald-300" : "text-rose-300"}>
                      {openJobCards.length === 0 ? "Ready" : "Blocked"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>All approved parts received</span>
                    <span className={approvedLineItemsNotReceived.length === 0 ? "text-emerald-300" : "text-rose-300"}>
                      {approvedLineItemsNotReceived.length === 0 ? "Ready" : "Blocked"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>No active reassignment</span>
                    <span className={!hasReassignedJobCards ? "text-emerald-300" : "text-rose-300"}>
                      {!hasReassignedJobCards ? "Ready" : "Blocked"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="rounded-md border border-slate-600/60 px-2 py-2">
                <div className="mb-1 text-[11px] font-semibold text-slate-200">Job Cards</div>
                {jobCardTotals.length === 0 ? (
                  <div className="text-muted-foreground">No job cards yet.</div>
                ) : (
                  <div className="space-y-1">
                    {jobCardTotals.map((row) => (
                      <a
                        key={row.jobId}
                        href={`/company/${companyId}/workshop/job-cards/${row.jobId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between rounded-md border border-slate-600/60 px-2 py-1.5 hover:bg-slate-800/40"
                      >
                        <span className="font-semibold">{row.jobId.slice(0, 8)}...</span>
                        <span className="text-[10px] text-muted-foreground">{String(row.status || "").toUpperCase()}</span>
                        <span className="font-semibold">AED {row.total.toFixed(2)}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-md border border-slate-500/70 bg-slate-800/40 px-2 py-2">
                <div className="mb-1 text-[11px] font-semibold text-slate-200">Invoice Preview</div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>AED {invoiceSubTotalPreview.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">VAT ({Number(draft.vatRate || 0).toFixed(2)}%)</span>
                  <span>AED {invoiceVatPreview.toFixed(2)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between border-t border-slate-600/60 pt-1 text-sm font-semibold">
                  <span>Grand Total</span>
                  <span>AED {invoiceGrandTotalPreview.toFixed(2)}</span>
                </div>
              </div>
              <button
                type="button"
                className={`w-full rounded-md px-3 py-2 text-xs font-semibold ${
                  convertBlocked ? "cursor-not-allowed bg-slate-700/70 text-slate-300" : "bg-emerald-600 text-white"
                }`}
                disabled={convertBlocked}
                onClick={() => {
                  setInvoiceConvertError(null);
                  setShowInvoiceModal(true);
                }}
              >
                Review & Convert
              </button>
              {convertBlocked && (
                <div className="space-y-1 text-[11px] text-amber-300">
                  {openJobCards.length > 0 && <div>{openJobCards.length} job card(s) still open.</div>}
                  {approvedLineItemsNotReceived.length > 0 && (
                    <div>{approvedLineItemsNotReceived.length} approved part(s) not received.</div>
                  )}
                </div>
              )}
            </div>
          </section>
          <div className={`rounded-xl border border-slate-600/60 ${theme.cardBg} p-3`}>
            <span className="inline-flex rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white">
              CarGuru 3000 Promo Consumed
            </span>
          </div>
        </div>
      </div>
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className={`w-full max-w-2xl rounded-xl border border-slate-600/60 ${theme.cardBg}`}>
            <div className={`flex items-center justify-between rounded-t-xl border-b border-slate-600/60 px-4 py-3 ${theme.surfaceSubtle}`}>
              <div>
                <div className="text-sm font-semibold">Invoice Verification</div>
                <div className="text-[11px] text-muted-foreground">Review job totals before converting.</div>
              </div>
              <button
                type="button"
                className="rounded-md border border-slate-500/60 px-2 py-1 text-xs"
                onClick={() => setShowInvoiceModal(false)}
              >
                Close
              </button>
            </div>
            <div className="space-y-3 p-4 text-xs">
              <div className="space-y-2">
                {jobCardTotals.map((row) => (
                  <div key={`modal-${row.jobId}`} className="flex items-center justify-between rounded-md border border-slate-600/60 px-3 py-2">
                    <div>
                      <div className="font-semibold">{row.jobId.slice(0, 8)}...</div>
                      <div className="text-[11px] text-muted-foreground">{String(row.status || "").toUpperCase()}</div>
                    </div>
                    <div className="font-semibold">AED {row.total.toFixed(2)}</div>
                  </div>
                ))}
                <div className="rounded-md border border-slate-500/70 bg-slate-800/40 px-3 py-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>AED {invoiceSubTotalPreview.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">VAT ({Number(draft.vatRate || 0).toFixed(2)}%)</span>
                    <span>AED {invoiceVatPreview.toFixed(2)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between border-t border-slate-600/60 pt-1 font-semibold">
                    <span>Grand Total</span>
                    <span>AED {invoiceGrandTotalPreview.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              {(openJobCards.length > 0 || approvedLineItemsNotReceived.length > 0) && (
                <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-amber-200">
                  {openJobCards.length > 0 && <div>{openJobCards.length} job card(s) are still open.</div>}
                  {approvedLineItemsNotReceived.length > 0 && (
                    <div>{approvedLineItemsNotReceived.length} approved part(s) are not received.</div>
                  )}
                </div>
              )}
              {invoiceConvertError && (
                <div className="rounded-md border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-rose-200">
                  {invoiceConvertError}
                </div>
              )}
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="rounded-md border border-slate-500/60 px-3 py-1.5 text-xs font-semibold"
                  onClick={() => setShowInvoiceModal(false)}
                >
                  Keep
                </button>
                <button
                  type="button"
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                    convertBlocked ? "cursor-not-allowed bg-slate-700/70 text-slate-300" : "bg-emerald-600 text-white"
                  }`}
                  disabled={convertBlocked || isConvertingInvoice}
                  onClick={convertToInvoice}
                >
                  {isConvertingInvoice ? "Converting..." : "Convert Invoice"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {toastMessage && (
        <div className="fixed right-4 top-4 z-[70]">
          <div
            className={`rounded-md px-3 py-2 text-xs font-semibold text-white shadow-lg ${
              toastMessage.type === "success" ? "bg-emerald-500" : "bg-rose-500"
            }`}
          >
            {toastMessage.text}
          </div>
        </div>
      )}
      {productOpenIndex !== null && productAnchor
        ? createPortal(
            <div
              ref={productDropdownRef}
              className="fixed z-50 max-h-64 overflow-y-auto rounded-md border border-slate-600/60 bg-slate-950 text-xs shadow-lg"
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
                    if (productOpenIndex >= NEW_JOB_PRODUCT_INDEX_OFFSET) {
                      const newJobIdx = productOpenIndex - NEW_JOB_PRODUCT_INDEX_OFFSET;
                      updateNewJobItem(newJobIdx, {
                        partName: product.name,
                        productType: product.type ?? null,
                      });
                    } else {
                      updateItem(productOpenIndex, {
                        partName: product.name,
                        productType: product.type ?? null,
                      });
                    }
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
