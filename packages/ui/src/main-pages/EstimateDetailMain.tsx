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
type ProductOption = {
  id: string;
  name: string;
  label: string;
  partNumber?: string | null;
  type?: string | null;
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
  discountPercent: number;
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
  discountPercent?: number | null;
  approvedType?: EstimateItemCostType | null;
  approvedCost?: number | null;
  gpPercent?: number | null;
};
type PersistedNewJobDraftMap = Record<string, PersistedNewJobLineItemDraft>;
type CostType = EstimateItemCostType;
type MarketPricingResponse = {
  averages?: Partial<Record<CostType, number | null>>;
  threshold?: {
    basisType?: CostType;
    basisCost?: number;
    minSale?: number;
    targetSale?: number;
    maxSale?: number;
  };
  sampleSize?: number;
  source?: string;
  confidence?: "low" | "medium" | "high";
  note?: string | null;
};
type MarketPricingInsight = {
  averages: Partial<Record<CostType, number>>;
  threshold: {
    basisType: CostType;
    basisCost: number;
    minSale: number;
    targetSale: number;
    maxSale: number;
  };
  sampleSize: number;
  source: string;
  confidence?: "low" | "medium" | "high";
  note?: string | null;
};
type PersistedMarketPricingMap = Record<
  string,
  {
    averages?: Partial<Record<CostType, number | null>>;
    threshold?: {
      basisType?: CostType;
      basisCost?: number;
      minSale?: number;
      targetSale?: number;
      maxSale?: number;
    };
    sampleSize?: number;
    source?: string;
    confidence?: "low" | "medium" | "high";
    note?: string | null;
  }
>;

const toFiniteNumberOrNull = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const roundTo2 = (value: number) => Math.round(value * 100) / 100;
const SALE_RATIO_BY_TYPE: Record<CostType, { min: number; target: number; max: number }> = {
  oe: { min: 1.2, target: 1.35, max: 1.6 },
  oem: { min: 1.18, target: 1.3, max: 1.55 },
  aftm: { min: 1.15, target: 1.25, max: 1.45 },
  used: { min: 1.1, target: 1.2, max: 1.35 },
};
const extractPartNumber = (item: ItemDraft): string => {
  const direct = String(item.description ?? "").trim();
  if (/^[A-Za-z0-9-]{5,}$/.test(direct)) return direct;
  const candidate = `${String(item.partName ?? "")} ${String(item.description ?? "")}`;
  const matched = candidate.match(/\b[A-Za-z0-9-]{5,}\b/g);
  return matched?.[0] ?? "";
};
const buildMarketPricingKey = (scope: "main" | "new", item: ItemDraft, index: number) =>
  `${scope}:${String(item.inspectionItemId ?? item.id ?? `${item.partName}-${index}`)}`;
const normalizeThresholdStatus = (
  sale: number,
  threshold: MarketPricingInsight["threshold"] | null
): "below" | "within" | "above" | "none" => {
  if (!threshold) return "none";
  if (sale < threshold.minSale) return "below";
  if (sale > threshold.maxSale) return "above";
  return "within";
};
const getPersistentLineItemId = (item: ItemDraft): string =>
  String(item.inspectionItemId ?? item.id ?? "").trim();
const getLineSaleTotal = (item: Pick<ItemDraft, "sale" | "approvedSale">): number =>
  Number(item.sale ?? item.approvedSale) || 0;
const getSelectedTypeMinSubtotal = (
  item: Pick<ItemDraft, "approvedType" | "quoteCosts" | "cost" | "quantity">
): number => {
  const type = item.approvedType;
  if (!type) return 0;
  const qty = Number(item.quantity) || 0;
  if (qty <= 0) return 0;
  const unitCost = Number(item.quoteCosts?.[type] ?? item.cost) || 0;
  if (unitCost <= 0) return 0;
  return roundTo2(unitCost * SALE_RATIO_BY_TYPE[type].min * qty);
};
const requiresDiscountApproval = (
  item: Pick<ItemDraft, "approvedType" | "quoteCosts" | "cost" | "quantity" | "sale" | "approvedSale" | "discount">
): boolean => {
  const discount = Number(item.discount) || 0;
  if (discount <= 0) return false;
  const minSubtotal = getSelectedTypeMinSubtotal(item);
  if (minSubtotal <= 0) return false;
  const subTotal = Math.max(0, getLineSaleTotal(item) - discount);
  return subTotal < minSubtotal;
};

const normalizePersistedMarketPricing = (value: unknown): PersistedMarketPricingMap => {
  if (!value || typeof value !== "object") return {};
  const map: PersistedMarketPricingMap = {};
  for (const [rawId, rawInsight] of Object.entries(value as Record<string, unknown>)) {
    const id = String(rawId ?? "").trim();
    if (!id) continue;
    const insight = (rawInsight ?? {}) as Record<string, unknown>;
    const averages: Partial<Record<CostType, number | null>> = {};
    for (const key of ["oe", "oem", "aftm", "used"] as const) {
      const n = toFiniteNumberOrNull((insight.averages as any)?.[key]);
      if (n != null) averages[key] = roundTo2(n);
    }
    const t = (insight.threshold ?? {}) as Record<string, unknown>;
    const basisType = String(t.basisType ?? "").toLowerCase();
    const threshold =
      basisType === "oe" || basisType === "oem" || basisType === "aftm" || basisType === "used"
        ? {
            basisType: basisType as CostType,
            basisCost: toFiniteNumberOrNull(t.basisCost) ?? undefined,
            minSale: toFiniteNumberOrNull(t.minSale) ?? undefined,
            targetSale: toFiniteNumberOrNull(t.targetSale) ?? undefined,
            maxSale: toFiniteNumberOrNull(t.maxSale) ?? undefined,
          }
        : undefined;
    map[id] = {
      averages,
      threshold,
      sampleSize: toFiniteNumberOrNull(insight.sampleSize) ?? undefined,
      source: String(insight.source ?? "").trim() || undefined,
      confidence:
        insight.confidence === "low" || insight.confidence === "medium" || insight.confidence === "high"
          ? (insight.confidence as "low" | "medium" | "high")
          : undefined,
      note: String(insight.note ?? "").trim() || undefined,
    };
  }
  return map;
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
      discountPercent: toFiniteNumberOrNull(value?.discountPercent),
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
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productResults, setProductResults] = useState<ProductOption[]>([]);
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
  const [customerApprovalUrl, setCustomerApprovalUrl] = useState<string | null>(null);
  const [customerApprovalStatus, setCustomerApprovalStatus] = useState<string | null>(null);
  const [isSharingCustomerApproval, setIsSharingCustomerApproval] = useState(false);
  const [activeJobCardId, setActiveJobCardId] = useState<string | null>(null);
  const [jobCards, setJobCards] = useState<JobCardSummary[]>([]);
  const [inspectionLineItems, setInspectionLineItems] = useState<any[]>([]);
  const [newJobItems, setNewJobItems] = useState<ItemDraft[]>([]);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceConvertError, setInvoiceConvertError] = useState<string | null>(null);
  const [isConvertingInvoice, setIsConvertingInvoice] = useState(false);
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupForm, setTopupForm] = useState({
    amount: "",
    method: "cash",
    paymentDate: "",
    proofFileId: "",
  });
  const [topupSaving, setTopupSaving] = useState(false);
  const [topupError, setTopupError] = useState<string | null>(null);
  const [marketPricingByKey, setMarketPricingByKey] = useState<Record<string, MarketPricingInsight>>({});
  const [marketPricingLoadingByKey, setMarketPricingLoadingByKey] = useState<Record<string, boolean>>({});
  const [isApplyingMarketPricingAll, setIsApplyingMarketPricingAll] = useState(false);
  const [persistedMarketPricingByLineItemId, setPersistedMarketPricingByLineItemId] =
    useState<PersistedMarketPricingMap>({});
  const autoPricingAttemptedRef = useRef<Set<string>>(new Set());
  const [discountModeByKey] = useState<Record<string, "amount" | "percent">>({});
  const [invoiceDiscountMode, setInvoiceDiscountMode] = useState<"amount" | "percent">("amount");
  const [invoiceDiscountPercent, setInvoiceDiscountPercent] = useState(0);
  const isEstimateClosed =
    (loadState.status === "loaded" && loadState.data?.estimate?.status === "invoiced") ||
    (loadState.status === "loaded" &&
      String(loadState.data?.estimate?.meta?.legacy_source ?? "").trim().toLowerCase() === "carguru2.estimates" &&
      String(loadState.data?.estimate?.meta?.legacy_invoice_status ?? "").trim().toLowerCase() === "invoiced");
  const estimateVin = useMemo(() => {
    const meta = loadState.status === "loaded" ? loadState.data?.estimate?.meta ?? {} : {};
    const candidates = [
      inspection?.draftPayload?.inspectionVin,
      inspection?.draftPayload?.inspection_vin,
      inspection?.inspectionVin,
      inspection?.inspection_vin,
      inspection?.vin,
      car?.vin,
      lead?.vin,
      meta?.inspectionVin,
      meta?.inspection_vin,
      meta?.carVin,
      meta?.car_vin,
      meta?.vin,
    ];
    for (const value of candidates) {
      const vin = String(value ?? "").trim().toUpperCase();
      if (vin) return vin;
    }
    return "";
  }, [loadState, inspection, car, lead]);

  const hydrateMarketPricingState = (
    mainItems: ItemDraft[],
    addItems: ItemDraft[],
    persisted: PersistedMarketPricingMap
  ) => {
    const next: Record<string, MarketPricingInsight> = {};
    mainItems.forEach((item, index) => {
      const id = getPersistentLineItemId(item);
      const persistedInsight = id ? persisted[id] : null;
      if (!persistedInsight?.threshold) return;
      next[buildMarketPricingKey("main", item, index)] = {
        averages: (persistedInsight.averages ?? {}) as Partial<Record<CostType, number>>,
        threshold: {
          basisType: persistedInsight.threshold.basisType ?? "oem",
          basisCost: Number(persistedInsight.threshold.basisCost ?? 0),
          minSale: Number(persistedInsight.threshold.minSale ?? 0),
          targetSale: Number(persistedInsight.threshold.targetSale ?? 0),
          maxSale: Number(persistedInsight.threshold.maxSale ?? 0),
        },
        sampleSize: Number(persistedInsight.sampleSize ?? 0),
        source: String(persistedInsight.source ?? "saved"),
        confidence: persistedInsight.confidence,
        note: persistedInsight.note ?? null,
      };
    });
    addItems.forEach((item, index) => {
      const id = getPersistentLineItemId(item);
      const persistedInsight = id ? persisted[id] : null;
      if (!persistedInsight?.threshold) return;
      next[buildMarketPricingKey("new", item, index)] = {
        averages: (persistedInsight.averages ?? {}) as Partial<Record<CostType, number>>,
        threshold: {
          basisType: persistedInsight.threshold.basisType ?? "oem",
          basisCost: Number(persistedInsight.threshold.basisCost ?? 0),
          minSale: Number(persistedInsight.threshold.minSale ?? 0),
          targetSale: Number(persistedInsight.threshold.targetSale ?? 0),
          maxSale: Number(persistedInsight.threshold.maxSale ?? 0),
        },
        sampleSize: Number(persistedInsight.sampleSize ?? 0),
        source: String(persistedInsight.source ?? "saved"),
        confidence: persistedInsight.confidence,
        note: persistedInsight.note ?? null,
      };
    });
    setMarketPricingByKey(next);
    setPersistedMarketPricingByLineItemId(persisted);
  };

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 2500);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    if (loadState.status !== "loaded") return;
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch(
          `/api/company/${companyId}/workshop/estimates/${estimateId}/customer-approval`
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok || cancelled) return;
        const url = String(json?.data?.url ?? "").trim();
        if (url) {
          setCustomerApprovalUrl(url);
          setCustomerApprovalStatus(String(json?.data?.status ?? "").trim() || null);
        }
      } catch {
        // ignore optional load
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [companyId, estimateId, loadState.status]);

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
  const isReceivedOrderLocked = (item: Pick<ItemDraft, "orderStatus">) =>
    String(item.orderStatus ?? "").trim().toLowerCase() === "received";
  const isLineItemLocked = (item: Pick<ItemDraft, "status" | "orderStatus" | "partOrdered">) =>
    isApprovedOrderLocked(item) || isReceivedOrderLocked(item);
  const isAllowedLockedFinancialPatch = (patch: Partial<ItemDraft>) => {
    const keys = Object.keys(patch);
    if (!keys.length) return false;
    return keys.every((key) => key === "approvedSale" || key === "discount" || key === "discountPercent");
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
          discountPercent: Number(persisted?.discountPercent ?? 0) || 0,
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
                discountPercent: 0,
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
          const persistedPricing = normalizePersistedMarketPricing(estimate?.meta?.aiMarketPricingByLineItemId);
          const mappedMainItems = items.map((i) => {
            const itemId = String((i as any).inspectionItemId ?? (i as any).inspection_item_id ?? i.id ?? "").trim();
            const persistedCosts = itemId ? (persistedPricing[itemId]?.averages as EstimateItemQuoteCosts | undefined) : undefined;
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
              approvedSale: (i as any).approvedSale ?? i.sale ?? 0,
              discount: (i as any).discount ?? 0,
              discountPercent: (i as any).discountPercent ?? 0,
              gpPercent: i.gpPercent ?? null,
              status: i.status,
              source: i.inspectionItemId ? "inspection" : "estimate",
              partOrdered: i.inspectionItemId ? lineItemOrderMap[i.inspectionItemId] ?? 0 : 0,
              orderStatus: i.inspectionItemId ? lineItemOrderStatusMap[i.inspectionItemId] ?? null : null,
              quoteCosts: i.quoteCosts ?? persistedCosts,
              approvedType: i.approvedType ?? null,
              approvedCost: i.approvedCost ?? null,
            };
          });
          setLoadState({ status: "loaded", data: { estimate, items }, error: null });
          setDraft({
            status: estimate.status,
            vatRate: estimate.vatRate,
            discountAmount: estimate.totalDiscount ?? 0,
            customerComplain: estimate.meta?.customerComplain ?? "",
            inspectorRemarks: estimate.meta?.inspectorRemarks ?? "",
            items: mappedMainItems,
          });
          setNewJobItems(additionalNewJobItems);
          hydrateMarketPricingState(mappedMainItems, additionalNewJobItems, persistedPricing);
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
    if (loadState.status !== "loaded") return;
    if (!estimateVin) {
      setProducts([]);
      return;
    }
    const url = `/api/company/${companyId}/workshop/estimates/${estimateId}/vin-parts?vin=${encodeURIComponent(
      estimateVin
    )}`;
    fetch(url)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setProducts(Array.isArray(data?.data) ? data.data : []))
      .catch(() => setProducts([]));
  }, [companyId, estimateId, estimateVin, loadState.status]);

  useEffect(() => {
    if (productOpenIndex === null) {
      setProductResults([]);
      return;
    }
    if (!estimateVin) {
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
      const params = new URLSearchParams();
      params.set("vin", estimateVin);
      if (query) params.set("search", query);
      const url = `/api/company/${companyId}/workshop/estimates/${estimateId}/vin-parts?${params.toString()}`;
      fetch(url)
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data) => {
          if (!active) return;
          setProductResults(Array.isArray(data?.data) ? data.data : []);
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
  }, [productOpenIndex, draft, newJobItems, companyId, estimateId, estimateVin]);

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
    const legacySource =
      loadState.status === "loaded"
        ? String(loadState.data?.estimate?.meta?.legacy_source ?? "").trim().toLowerCase()
        : "";
    const legacyInvoiceStatus =
      loadState.status === "loaded"
        ? String(loadState.data?.estimate?.meta?.legacy_invoice_status ?? "").trim().toLowerCase()
        : "";
    const isLegacyInvoiced = legacySource === "carguru2.estimates" && legacyInvoiceStatus === "invoiced";
    if (loadState.status === "loaded" && (loadState.data?.estimate?.status === "invoiced" || isLegacyInvoiced)) {
      setSaveError("Invoiced estimates are closed.");
      return null;
    }
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
          discountPercent: toFiniteNumberOrNull((item as any).discountPercent),
          approvedType: item.approvedType ?? null,
          approvedCost: toFiniteNumberOrNull(item.approvedCost),
          gpPercent: toFiniteNumberOrNull(item.gpPercent),
        };
        return acc;
      }, {} as PersistedNewJobDraftMap);
      const persistedMarketPricing: PersistedMarketPricingMap = {};
      draft.items.forEach((item, idx) => {
        const id = getPersistentLineItemId(item);
        if (!id) return;
        const key = buildMarketPricingKey("main", item, idx);
        const insight = marketPricingByKey[key];
        if (!insight) return;
        persistedMarketPricing[id] = {
          averages: {
            oe: insight.averages.oe ?? null,
            oem: insight.averages.oem ?? null,
            aftm: insight.averages.aftm ?? null,
            used: insight.averages.used ?? null,
          },
          threshold: { ...insight.threshold },
          sampleSize: insight.sampleSize,
          source: insight.source,
          confidence: insight.confidence,
          note: insight.note ?? null,
        };
      });
      savedNewJobItems.forEach((item, idx) => {
        const id = getPersistentLineItemId(item);
        if (!id) return;
        const key = buildMarketPricingKey("new", item, idx);
        const insight = marketPricingByKey[key];
        if (!insight) return;
        persistedMarketPricing[id] = {
          averages: {
            oe: insight.averages.oe ?? null,
            oem: insight.averages.oem ?? null,
            aftm: insight.averages.aftm ?? null,
            used: insight.averages.used ?? null,
          },
          threshold: { ...insight.threshold },
          sampleSize: insight.sampleSize,
          source: insight.source,
          confidence: insight.confidence,
          note: insight.note ?? null,
        };
      });
      nextMeta.aiMarketPricingByLineItemId = persistedMarketPricing;
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
          sale: i.sale ?? i.approvedSale ?? 0,
          gpPercent: i.gpPercent ?? null,
          status: i.status ?? "pending",
          approvedType: i.approvedType ?? null,
          approvedCost: i.approvedCost ?? null,
          discountPercent: i.discountPercent ?? null,
        })),
      };
      const res = await fetch(`/api/company/${companyId}/workshop/estimates/${estimateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error ?? `HTTP ${res.status}`);
      }
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
      setPersistedMarketPricingByLineItemId(
        normalizePersistedMarketPricing(nextMeta.aiMarketPricingByLineItemId)
      );
      setNewJobItems(savedNewJobItems);
      setLastSavedAt(new Date());
      return savedNewJobItems;
    } catch (err) {
      console.error(err);
      setSaveError(err instanceof Error ? err.message : "Save failed");
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

  useEffect(() => {
    if (!draft || isEstimateClosed || isSaving) return;
    let cancelled = false;
    const hasAnyCost = (item: ItemDraft) =>
      Boolean(
        (item.quoteCosts?.oe ?? 0) > 0 ||
          (item.quoteCosts?.oem ?? 0) > 0 ||
          (item.quoteCosts?.aftm ?? 0) > 0 ||
          (item.quoteCosts?.used ?? 0) > 0
      );
    const run = async () => {
      const mainTargets = draft.items
        .map((item, index) => ({ scope: "main" as const, item, index }))
        .filter(({ item, index }) => {
          if (!item.partName.trim()) return false;
          if (isLineItemLocked(item)) return false;
          const persistedId = getPersistentLineItemId(item);
          if (persistedId && persistedMarketPricingByLineItemId[persistedId]) return false;
          if (hasAnyCost(item)) return false;
          const rowKey = buildMarketPricingKey("main", item, index);
          if (autoPricingAttemptedRef.current.has(rowKey)) return false;
          return true;
        });
      const newTargets = newJobItems
        .map((item, index) => ({ scope: "new" as const, item, index }))
        .filter(({ item, index }) => {
          if (!item.partName.trim()) return false;
          if (isLineItemLocked(item)) return false;
          const persistedId = getPersistentLineItemId(item);
          if (persistedId && persistedMarketPricingByLineItemId[persistedId]) return false;
          if (hasAnyCost(item)) return false;
          const rowKey = buildMarketPricingKey("new", item, index);
          if (autoPricingAttemptedRef.current.has(rowKey)) return false;
          return true;
        });
      const targets = [...mainTargets, ...newTargets];
      if (!targets.length) return;
      for (const target of targets) {
        const rowKey = buildMarketPricingKey(target.scope, target.item, target.index);
        autoPricingAttemptedRef.current.add(rowKey);
      }
      let appliedAny = false;
      for (const target of targets) {
        // Sequential by design to avoid API bursts.
        await fetchAndApplyMarketPricing(target.scope, target.index, { silent: true, skipIfSaved: true });
        appliedAny = true;
      }
      if (appliedAny && !cancelled) {
        await saveEstimate();
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [draft, newJobItems, isEstimateClosed, isSaving, persistedMarketPricingByLineItemId]);

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
      const saleBase = saleValue > 0 ? saleValue : approvedValue;
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
      const oeSale = oe * SALE_RATIO_BY_TYPE.oe.target;
      const oemSale = oem * SALE_RATIO_BY_TYPE.oem.target;
      const aftmSale = aftm * SALE_RATIO_BY_TYPE.aftm.target;
      const usedSale = used * SALE_RATIO_BY_TYPE.used.target;
      const approvedCostRaw = Number(item.approvedCost);
      const approvedCost = Number.isFinite(approvedCostRaw) ? approvedCostRaw : (Number(item.cost) || 0) * qty;
      const approvedSale = Number(item.sale ?? item.approvedSale) || 0;
      const lineSale = approvedSale;
      const lineDiscount = Number(item.discount) || 0;
      summary.qty += qty;
      summary.oe += oeSale * qty;
      summary.oem += oemSale * qty;
      summary.aftm += aftmSale * qty;
      summary.used += usedSale * qty;
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
      const legacySource =
        loadState.status === "loaded"
          ? String(loadState.data?.estimate?.meta?.legacy_source ?? "").trim().toLowerCase()
          : "";
      const legacyInvoiceStatus =
        loadState.status === "loaded"
          ? String(loadState.data?.estimate?.meta?.legacy_invoice_status ?? "").trim().toLowerCase()
          : "";
      const isLegacyInvoiced = legacySource === "carguru2.estimates" && legacyInvoiceStatus === "invoiced";
      const isClosed =
        (loadState.status === "loaded" && loadState.data?.estimate?.status === "invoiced") || isLegacyInvoiced;
      if (isClosed) {
        setSaveError("Invoiced estimates are closed.");
        return;
      }
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
      if (isLineItemLocked(current) && !isAllowedLockedFinancialPatch(patch)) {
        return prev;
      }
        let updated: ItemDraft = {
          ...current,
          ...patch,
          partName: patch.partName ?? current.partName ?? "",
          type: patch.type ?? current.type ?? "genuine",
          quantity: patch.quantity ?? current.quantity ?? 0,
          cost: patch.cost ?? current.cost ?? 0,
          sale: patch.sale ?? current.sale ?? 0,
          approvedSale: patch.approvedSale ?? current.approvedSale ?? 0,
          discount: patch.discount ?? current.discount ?? 0,
          discountPercent: patch.discountPercent ?? current.discountPercent ?? 0,
          productType: patch.productType ?? current.productType ?? null,
          inspectionItemId: patch.inspectionItemId ?? current.inspectionItemId ?? null,
          gpPercent: patch.gpPercent ?? current.gpPercent ?? null,
          status: patch.status ?? current.status ?? "pending",
          partOrdered: patch.partOrdered ?? current.partOrdered ?? 0,
          approvedType: patch.approvedType ?? current.approvedType ?? null,
          approvedCost: patch.approvedCost ?? current.approvedCost ?? null,
        };
      if (requiresDiscountApproval(updated)) {
        updated = { ...updated, status: "pending" };
      }
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
                  discountPercent: 0,
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
      if (current.source === "inspection" || current.inspectionItemId || current.partOrdered === 1 || isLineItemLocked(current)) {
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
                discountPercent: 0,
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
      const persistedPricing = normalizePersistedMarketPricing(refreshedEstimate?.meta?.aiMarketPricingByLineItemId);
      const mappedMainItems = refreshedItems.map((i) => {
        const itemId = String((i as any).inspectionItemId ?? (i as any).inspection_item_id ?? i.id ?? "").trim();
        const persistedCosts = itemId ? (persistedPricing[itemId]?.averages as EstimateItemQuoteCosts | undefined) : undefined;
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
          approvedSale: (i as any).approvedSale ?? i.sale ?? 0,
          discount: (i as any).discount ?? 0,
          discountPercent: (i as any).discountPercent ?? 0,
          gpPercent: i.gpPercent ?? null,
          status: i.status,
          source: i.inspectionItemId ? "inspection" : "estimate",
          partOrdered: i.inspectionItemId ? lineItemOrderMap[i.inspectionItemId] ?? 0 : 0,
          orderStatus: i.inspectionItemId ? lineItemOrderStatusMap[i.inspectionItemId] ?? null : null,
          quoteCosts: i.quoteCosts ?? persistedCosts,
          approvedType: i.approvedType ?? null,
          approvedCost: i.approvedCost ?? null,
        };
      });
      setLoadState({ status: "loaded", data: { estimate: refreshedEstimate, items: refreshedItems }, error: null });
      setDraft({
        status: refreshedEstimate.status,
        vatRate: refreshedEstimate.vatRate,
        discountAmount: refreshedEstimate.totalDiscount ?? 0,
        customerComplain: refreshedEstimate.meta?.customerComplain ?? "",
        inspectorRemarks: refreshedEstimate.meta?.inspectorRemarks ?? "",
        items: mappedMainItems,
      });
      setNewJobItems(additionalNewJobItems);
      hydrateMarketPricingState(mappedMainItems, additionalNewJobItems, persistedPricing);
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
        discountPercent: 0,
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
        if (isLineItemLocked(item) && !isAllowedLockedFinancialPatch(patch)) return item;
        let updated: ItemDraft = {
          ...item,
          ...patch,
          partName: patch.partName ?? item.partName ?? "",
          type: patch.type ?? item.type ?? "genuine",
          quantity: patch.quantity ?? item.quantity ?? 0,
          cost: patch.cost ?? item.cost ?? 0,
          sale: patch.sale ?? item.sale ?? 0,
          approvedSale: patch.approvedSale ?? item.approvedSale ?? 0,
          discount: patch.discount ?? item.discount ?? 0,
          discountPercent: patch.discountPercent ?? item.discountPercent ?? 0,
          productType: patch.productType ?? item.productType ?? null,
          inspectionItemId: patch.inspectionItemId ?? item.inspectionItemId ?? null,
          gpPercent: patch.gpPercent ?? item.gpPercent ?? null,
          status: patch.status ?? item.status ?? "pending",
          partOrdered: patch.partOrdered ?? item.partOrdered ?? 0,
          approvedType: patch.approvedType ?? item.approvedType ?? null,
          approvedCost: patch.approvedCost ?? item.approvedCost ?? null,
        };
        if (requiresDiscountApproval(updated)) {
          updated = { ...updated, status: "pending" };
        }
        return updated;
      })
    );
  }

  function removeNewJobItem(index: number) {
    setNewJobItems((prev) => prev.filter((_, idx) => idx !== index));
  }

  async function fetchAndApplyMarketPricing(
    scope: "main" | "new",
    index: number,
    opts?: { silent?: boolean; skipIfSaved?: boolean }
  ) {
    const item = scope === "main" ? draft.items[index] : newJobItems[index];
    if (!item) return;
    const persistedId = getPersistentLineItemId(item);
    if (opts?.skipIfSaved && persistedId && persistedMarketPricingByLineItemId[persistedId]) return;
    const rowKey = buildMarketPricingKey(scope, item, index);
    setMarketPricingLoadingByKey((prev) => ({ ...prev, [rowKey]: true }));
    try {
      const partNumber = extractPartNumber(item);
      const res = await fetch(`/api/company/${companyId}/workshop/estimates/ai-market-pricing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estimateId,
          lineItem: {
            partName: item.partName,
            description: item.description ?? "",
            partNumber,
            quantity: item.quantity,
            approvedType: item.approvedType ?? null,
            currentCosts: item.quoteCosts ?? {},
          },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = (await res.json()) as MarketPricingResponse;
      const averages: Partial<Record<CostType, number>> = {};
      for (const key of ["oe", "oem", "aftm", "used"] as const) {
        const value = Number(payload?.averages?.[key]);
        if (Number.isFinite(value) && value > 0) averages[key] = roundTo2(value);
      }
      const pickBasis = (
        source: Partial<Record<CostType, number>>,
        preferred: CostType | null | undefined
      ): { type: CostType; cost: number } | null => {
        const order: CostType[] = preferred
          ? [preferred, "oe", "oem", "aftm", "used"].filter(
              (v, idx, arr) => arr.indexOf(v as CostType) === idx
            ) as CostType[]
          : ["oe", "oem", "aftm", "used"];
        for (const type of order) {
          const value = Number(source[type] ?? 0);
          if (value > 0) return { type, cost: value };
        }
        return null;
      };
      const basis = pickBasis(averages, item.approvedType ?? null);
      const threshold = (() => {
        const incoming = payload?.threshold;
        const hasIncoming =
          incoming &&
          (incoming.basisType === "oe" ||
            incoming.basisType === "oem" ||
            incoming.basisType === "aftm" ||
            incoming.basisType === "used") &&
          Number.isFinite(Number(incoming.minSale)) &&
          Number.isFinite(Number(incoming.targetSale)) &&
          Number.isFinite(Number(incoming.maxSale));
        if (hasIncoming) {
          return {
            basisType: incoming.basisType as CostType,
            basisCost: roundTo2(Number(incoming.basisCost ?? basis?.cost ?? 0)),
            minSale: roundTo2(Number(incoming.minSale)),
            targetSale: roundTo2(Number(incoming.targetSale)),
            maxSale: roundTo2(Number(incoming.maxSale)),
          };
        }
        if (!basis) return null;
        const ratios: Record<CostType, { min: number; target: number; max: number }> = {
          oe: { min: 1.2, target: 1.35, max: 1.6 },
          oem: { min: 1.18, target: 1.3, max: 1.55 },
          aftm: { min: 1.15, target: 1.25, max: 1.45 },
          used: { min: 1.1, target: 1.2, max: 1.35 },
        };
        const ratio = ratios[basis.type];
        return {
          basisType: basis.type,
          basisCost: roundTo2(basis.cost),
          minSale: roundTo2(basis.cost * ratio.min),
          targetSale: roundTo2(basis.cost * ratio.target),
          maxSale: roundTo2(basis.cost * ratio.max),
        };
      })();

      if (!threshold) throw new Error("No threshold returned");
      const insight: MarketPricingInsight = {
        averages,
        threshold,
        sampleSize: Number(payload?.sampleSize ?? 0) || 0,
        source: String(payload?.source ?? "ai").trim() || "ai",
        confidence: payload?.confidence,
        note: payload?.note ?? null,
      };
      setMarketPricingByKey((prev) => ({ ...prev, [rowKey]: insight }));

      const nextQuoteCosts: EstimateItemQuoteCosts = {
        ...(item.quoteCosts ?? {}),
        ...averages,
      };
      const patch: Partial<ItemDraft> = { quoteCosts: nextQuoteCosts };
      if (item.approvedType && averages[item.approvedType] != null) {
        const nextUnitCost = Number(averages[item.approvedType]) || 0;
        patch.cost = nextUnitCost;
        patch.approvedCost = roundTo2(nextUnitCost * (Number(item.quantity) || 0));
      }
      if (scope === "main") {
        updateItem(index, patch);
      } else {
        updateNewJobItem(index, patch);
      }
      if (!opts?.silent) {
        setToastMessage({ type: "success", text: "AI market pricing applied." });
      }
    } catch {
      if (!opts?.silent) {
        setToastMessage({ type: "error", text: "Failed to fetch AI market pricing." });
      }
    } finally {
      setMarketPricingLoadingByKey((prev) => ({ ...prev, [rowKey]: false }));
    }
  }

  async function applyMarketPricingToAllMainItems() {
    if (isApplyingMarketPricingAll) return;
    const targets = draft.items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !isEstimateClosed && !isLineItemLocked(item) && item.partName.trim());
    if (!targets.length) {
      setToastMessage({ type: "error", text: "No editable line items to apply AI pricing." });
      return;
    }
    setIsApplyingMarketPricingAll(true);
    try {
      for (const target of targets) {
        // Sequential calls avoid rate-limit bursts on the AI endpoint.
        await fetchAndApplyMarketPricing("main", target.index);
      }
    } finally {
      setIsApplyingMarketPricingAll(false);
    }
  }

  async function createAdditionalJobCard() {
    if (!inspection?.id) return;
    if (loadState.status === "loaded" && loadState.data?.estimate?.status === "invoiced") {
      setSaveError("Invoiced estimates are closed.");
      return;
    }
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
      const saved = await saveEstimate();
      if (!saved && !isEstimateClosed) {
        setInvoiceConvertError("Please save estimate changes before converting.");
        return;
      }
      const res = await fetch(`/api/company/${companyId}/workshop/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estimateId,
          autoSettleOnConvert: true,
          autoCarOutOnAutoPaid: true,
          handoverType: "branch",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInvoiceConvertError(json?.error ?? "Failed to convert to invoice.");
        return;
      }
      setShowInvoiceModal(false);
      const autoPaid = Boolean(json?.data?.autoSettlement?.autoPaid);
      const autoReason = String(json?.data?.autoSettlement?.reason ?? "");
      const gatepassId = String(json?.data?.carOut?.gatepassId ?? "").trim();
      if (autoPaid) {
        const reasonLabel = autoReason === "wallet" ? "wallet" : "zero balance";
        setJobCardMessage(
          `Invoice created and auto-paid (${reasonLabel})${gatepassId ? `, car-out gatepass created (${gatepassId.slice(0, 8)}...)` : ""}.`
        );
      } else {
        setJobCardMessage("Invoice created. Wallet is insufficient for auto-payment.");
      }
    } catch {
      setInvoiceConvertError("Failed to convert to invoice.");
    } finally {
      setIsConvertingInvoice(false);
    }
  }

  async function shareEstimateToCustomer(regenerate = false) {
    setIsSharingCustomerApproval(true);
    try {
      const res = await fetch(
        `/api/company/${companyId}/workshop/estimates/${estimateId}/customer-approval`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ regenerate }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(json?.error ?? `HTTP ${res.status}`));
      const url = String(json?.data?.url ?? "").trim();
      const status = String(json?.data?.status ?? "").trim();
      if (!url) throw new Error("Customer approval URL was not returned.");
      setCustomerApprovalUrl(url);
      setCustomerApprovalStatus(status || null);
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setToastMessage({ type: "success", text: "Customer approval link copied." });
      } else {
        setToastMessage({ type: "success", text: "Customer approval link generated." });
      }
    } catch (err: any) {
      setToastMessage({
        type: "error",
        text: String(err?.message ?? "Failed to share estimate with customer."),
      });
    } finally {
      setIsSharingCustomerApproval(false);
    }
  }

  function openTopupModal(requiredAmount: number) {
    const minimum = Math.max(0, Number(requiredAmount) || 0);
    setTopupError(null);
    setTopupForm((prev) => ({
      ...prev,
      amount: minimum > 0 ? minimum.toFixed(2) : "",
    }));
    setTopupOpen(true);
  }

  async function submitTopupFromInvoiceModal(requiredAmount: number) {
    const customerId = String(customer?.id ?? "").trim();
    if (!companyId || !customerId) {
      setTopupError("Customer is required for wallet topup.");
      return;
    }
    const minAmount = Math.max(0, Number(requiredAmount) || 0);
    const amount = Number(topupForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setTopupError("Enter a valid topup amount.");
      return;
    }
    if (amount + 1e-9 < minAmount) {
      setTopupError(`Topup amount must be at least AED ${minAmount.toFixed(2)}.`);
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error ?? "Failed to create topup"));

      let balance: number | null = null;
      const summaryRes = await fetch(`/api/customers/${customerId}/wallet/summary?companyId=${companyId}`);
      if (summaryRes.ok) {
        const summary = await summaryRes.json().catch(() => ({}));
        balance = Number(summary?.balance ?? 0);
      }
      setCustomer((prev: any) => ({
        ...(prev ?? {}),
        id: customerId,
        wallet_amount: balance ?? Number(prev?.wallet_amount ?? prev?.walletAmount ?? 0) + amount,
        walletAmount: balance ?? Number(prev?.walletAmount ?? prev?.wallet_amount ?? 0) + amount,
      }));
      setTopupOpen(false);
      setTopupForm({ amount: "", method: "cash", paymentDate: "", proofFileId: "" });
      setJobCardMessage("Wallet topup submitted successfully.");
    } catch (err: any) {
      setTopupError(String(err?.message ?? "Failed to create topup."));
    } finally {
      setTopupSaving(false);
    }
  }

  function applyApprovedTypeToAll(type: EstimateItemCostType, checked: boolean) {
    setDraft((prev) => {
      if (!prev) return prev;
      const nextItems = prev.items.map((item, index) => {
        const isLocked = isLineItemLocked(item);
        if (isLocked) return item;
        if (!checked) {
          if (item.approvedType !== type) return item;
          return { ...item, approvedType: null };
        }
        const costByType = Number(item.quoteCosts?.[type]) || 0;
        const currentApprovedCost = Number(item.approvedCost ?? item.cost ?? 0);
        const qty = Number(item.quantity) || 0;
        const approvedCost = costByType * qty;
        const nextSale = roundTo2(costByType * SALE_RATIO_BY_TYPE[type].target * qty);
        if (item.approvedType === type && currentApprovedCost === approvedCost && Number(item.sale) === nextSale) {
          return item;
        }
        const discountPercent = Number(item.discountPercent ?? 0) || 0;
        const rowKey = buildMarketPricingKey("main", item, index);
        const isPercentMode =
          discountModeByKey[rowKey] === "percent" || isLegacyEstimate || discountPercent > 0;
        return {
          ...item,
          approvedType: type,
          approvedCost,
          cost: costByType,
          sale: nextSale,
          ...(isPercentMode
            ? {
                discount: Number(((nextSale * discountPercent) / 100).toFixed(2)),
              }
            : {}),
        };
      });
      return { ...prev, items: nextItems };
    });
  }

  function applyApprovedTypeToAllNewJob(type: EstimateItemCostType, checked: boolean) {
    setNewJobItems((prev) =>
      prev.map((item, index) => {
        const isLocked = isLineItemLocked(item);
        if (isLocked) return item;
        if (!checked) {
          if (item.approvedType !== type) return item;
          return { ...item, approvedType: null };
        }
        const costByType = Number(item.quoteCosts?.[type]) || 0;
        const currentApprovedCost = Number(item.approvedCost ?? item.cost ?? 0);
        const qty = Number(item.quantity) || 0;
        const approvedCost = costByType * qty;
        const nextSale = roundTo2(costByType * SALE_RATIO_BY_TYPE[type].target * qty);
        if (item.approvedType === type && currentApprovedCost === approvedCost && Number(item.sale) === nextSale) {
          return item;
        }
        const discountPercent = Number(item.discountPercent ?? 0) || 0;
        const rowKey = buildMarketPricingKey("new", item, index);
        const isPercentMode =
          discountModeByKey[rowKey] === "percent" || isLegacyEstimate || discountPercent > 0;
        return {
          ...item,
          approvedType: type,
          approvedCost,
          cost: costByType,
          sale: nextSale,
          ...(isPercentMode
            ? {
                discount: Number(((nextSale * discountPercent) / 100).toFixed(2)),
              }
            : {}),
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
  const hasApprovedItems = draft.items.some((item) => item.status === "approved");
  const hasAnyItems = draft.items.length > 0;
  const canStartJobCard = hasAnyItems && hasApprovedItems;
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
      discountPercent: 0,
      subTotal: 0,
    };
    for (const item of newJobItems) {
      if (item.status === "rejected") continue;
      const qty = Number(item.quantity) || 0;
      const oe = Number(item.quoteCosts?.oe) || 0;
      const oem = Number(item.quoteCosts?.oem) || 0;
      const aftm = Number(item.quoteCosts?.aftm) || 0;
      const used = Number(item.quoteCosts?.used) || 0;
      const oeSale = oe * SALE_RATIO_BY_TYPE.oe.target;
      const oemSale = oem * SALE_RATIO_BY_TYPE.oem.target;
      const aftmSale = aftm * SALE_RATIO_BY_TYPE.aftm.target;
      const usedSale = used * SALE_RATIO_BY_TYPE.used.target;
      const approvedCostRaw = Number(item.approvedCost);
      const approvedCost = Number.isFinite(approvedCostRaw) ? approvedCostRaw : (Number(item.cost) || 0) * qty;
      const approvedSale = Number(item.sale ?? item.approvedSale) || 0;
      const lineDiscount = Number(item.discount) || 0;
      summary.qty += qty;
      summary.oe += oeSale * qty;
      summary.oem += oemSale * qty;
      summary.aftm += aftmSale * qty;
      summary.used += usedSale * qty;
      summary.approvedCost += approvedCost;
      summary.approvedSale += approvedSale;
      summary.discount += lineDiscount;
      summary.subTotal += Math.max(0, approvedSale - lineDiscount);
    }
    return summary;
  })();
  const newJobEditableItems = newJobItems.filter((item) => !isLineItemLocked(item));
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
      const saleBase = saleValue > 0 ? saleValue : approvedValue;
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
  const legacySource = String(estimate.meta?.legacy_source ?? "").trim().toLowerCase();
  const legacyInvoiceStatus = String(estimate.meta?.legacy_invoice_status ?? "").trim().toLowerCase();
  const isLegacyEstimate = legacySource === "carguru2.estimates";
  const computeDiscountAmountFromPercent = (saleTotal: number, percent: number) =>
    Number(((Math.max(0, saleTotal) * Math.max(0, percent)) / 100).toFixed(2));
  const derivePercentFromAmount = (saleTotal: number, amount: number) =>
    saleTotal > 0 ? Number(((Math.max(0, amount) / saleTotal) * 100).toFixed(2)) : 0;
  const getDiscountMode = (rowKey: string, item: ItemDraft): "amount" | "percent" => {
    const explicit = discountModeByKey[rowKey];
    if (explicit) return explicit;
    if (isLegacyEstimate) return "percent";
    return Number(item.discountPercent ?? 0) > 0 ? "percent" : "amount";
  };
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
  const isConvertDisabled = convertBlocked || isEstimateClosed;
  const convertDisabledReason = isEstimateClosed
    ? "Closed (Invoiced)"
    : convertBlocked
    ? "Pending Dependencies"
    : null;
  const reviewConvertLabel = isEstimateClosed
    ? "Closed (Invoiced)"
    : convertBlocked
    ? "Blocked - Resolve Items"
    : "Review & Convert";
  const convertInvoiceLabel = isConvertingInvoice
    ? "Converting..."
    : isEstimateClosed
    ? "Closed (Invoiced)"
    : convertBlocked
    ? "Blocked - Resolve Items"
    : "Convert Invoice";
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
      const sale = Number(mapped.sale ?? mapped.approvedSale ?? 0);
      return acc + Math.max(0, sale);
    }, 0);
    return { jobId: job.id, status: job.status ?? "", total };
  });
  const invoiceSubTotalPreview = jobCardTotals.reduce((sum, row) => sum + row.total, 0);
  const invoiceDiscountAmountPreview =
    invoiceDiscountMode === "percent"
      ? Number(((invoiceSubTotalPreview * Math.max(0, invoiceDiscountPercent)) / 100).toFixed(2))
      : Number(draft.discountAmount || 0);
  const invoiceNetSubTotalPreview = Math.max(0, invoiceSubTotalPreview - invoiceDiscountAmountPreview);
  const invoiceVatPreview = (invoiceNetSubTotalPreview * (Number(draft.vatRate) || 0)) / 100;
  const invoiceGrandTotalPreview = invoiceNetSubTotalPreview + invoiceVatPreview;
  const customerWalletBalance = Number(customer?.wallet_amount ?? customer?.walletAmount ?? 0) || 0;
  const customerIdForWallet = String(customer?.id ?? "").trim();
  const isZeroBillInvoice = invoiceGrandTotalPreview <= 0.00001;
  const walletCanAutoPayInvoice = customerWalletBalance + 1e-9 >= invoiceGrandTotalPreview;
  const invoiceCanAutoSettle = isZeroBillInvoice || walletCanAutoPayInvoice;
  const invoicePreviewLineItems = draft.items
    .filter((item) => item.status === "approved" && (Number(item.quantity) || 0) > 0)
    .map((item, idx) => {
      const qty = Number(item.quantity) || 0;
      const lineSale = Number(item.sale ?? item.approvedSale ?? 0) || 0;
      const lineDiscount = Number(item.discount ?? 0) || 0;
      const lineTotal = Math.max(0, lineSale - lineDiscount);
      const unitRate = qty > 0 ? lineSale / qty : lineSale;
      return {
        key: String(item.id ?? item.inspectionItemId ?? `${item.partName}-${idx}`),
        lineNo: item.lineNo ?? idx + 1,
        partName: item.partName || "Part",
        description: item.description || "-",
        qty,
        unitRate,
        total: lineTotal,
      };
    });

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
          <button
            type="button"
            onClick={() => void shareEstimateToCustomer(false)}
            disabled={isSharingCustomerApproval}
            className="rounded-md border border-cyan-400/50 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-200 shadow-sm transition hover:bg-cyan-500/25 disabled:opacity-60"
          >
            {isSharingCustomerApproval ? "Sharing..." : "Copy Customer Approval Link"}
          </button>
          <button
            type="button"
            onClick={() => void shareEstimateToCustomer(true)}
            disabled={isSharingCustomerApproval}
            className="rounded-md border border-cyan-400/30 bg-cyan-500/5 px-3 py-1.5 text-xs font-semibold text-cyan-200 shadow-sm transition hover:bg-cyan-500/20 disabled:opacity-60"
          >
            Regenerate Link
          </button>
          {customerApprovalUrl ? (
            <a
              href={customerApprovalUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-cyan-500/50 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 shadow-sm transition hover:bg-cyan-500/25"
            >
              Open Customer View{customerApprovalStatus ? ` (${customerApprovalStatus})` : ""}
            </a>
          ) : null}
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
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={applyMarketPricingToAllMainItems}
                  className="rounded-md border border-cyan-500/60 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200"
                  disabled={isApplyingMarketPricingAll || isEstimateClosed}
                >
                  {isApplyingMarketPricingAll ? "Applying AI..." : "AI Market Pricing (All)"}
                </button>
                <button
                  type="button"
                  onClick={refreshQuoteUpdates}
                  className="rounded-md border border-slate-500/60 bg-slate-800/60 px-3 py-1.5 text-xs font-semibold text-slate-100"
                  disabled={isRefreshingQuotes || isEstimateClosed}
                >
                  {isRefreshingQuotes ? "Refreshing..." : "Refresh Quotes"}
                </button>
              </div>
              <div className="rounded-md border border-slate-600/60 bg-slate-900/20 px-3 py-2 text-[11px] text-slate-300">
                Step flow: Review AI type-sale thresholds, select type, edit type sale, then set status. Final discount is set in Invoice Summary.
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-600/60">
                <table className="min-w-full text-xs">
                  <thead className={`${theme.surfaceSubtle} ${theme.appText} text-[10px] uppercase tracking-[0.08em]`}>
                    <tr>
                      <th className="px-2 py-1 text-left">Part Name</th>
                      <th className="px-2 py-1 text-left">Description</th>
                      <th className="px-2 py-1 text-left">Qty</th>
                      <th className="px-2 py-1 text-left">OE Sale</th>
                      <th className="px-2 py-1 text-left">OEM Sale</th>
                      <th className="px-2 py-1 text-left">AFTM Sale</th>
                      <th className="px-2 py-1 text-left">Used Sale</th>
                      <th className="px-2 py-1 text-left">Sub Total</th>
                      <th className="px-2 py-1 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.items.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-3 text-xs text-muted-foreground">
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
                        const discountAmount = Number(item.discount) || 0;
                        const saleBase = Number(item.sale ?? item.approvedSale) || 0;
                        const lineSale = saleBase;
                        const subTotal = Math.max(0, lineSale - discountAmount);
                        const isLocked = isEstimateClosed || (item.partOrdered === 1 && item.status === "approved");
                        const selectedApprovedType = item.approvedType ?? null;
                        const marketPricingKey = buildMarketPricingKey("main", item, idx);
                        const discountMode = getDiscountMode(marketPricingKey, item);
                        const marketPricingInsight = marketPricingByKey[marketPricingKey] ?? null;
                        const marketPricingLoading = Boolean(marketPricingLoadingByKey[marketPricingKey]);
                        const thresholdStatus = normalizeThresholdStatus(lineSale, marketPricingInsight?.threshold ?? null);
                        const minAllowedSubtotal = getSelectedTypeMinSubtotal(item);
                        const needsApproval = requiresDiscountApproval(item);
                        return (
                          <tr key={idx} className="border-b border-slate-600/60 transition-colors odd:bg-slate-900/15 hover:bg-slate-800/25 last:border-0">
                            <td className="px-2 py-1">
                              <div className="relative space-y-1">
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
                                <div className="flex items-center justify-between gap-2">
                                  <button
                                    type="button"
                                    className="rounded-md border border-cyan-500/60 bg-cyan-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                                    disabled={isLocked || marketPricingLoading || !item.partName.trim()}
                                    onClick={() => void fetchAndApplyMarketPricing("main", idx)}
                                  >
                                    {marketPricingLoading ? "AI..." : "AI Avg"}
                                  </button>
                                  {marketPricingInsight?.source ? (
                                    <span className="text-[9px] text-slate-400 uppercase">{marketPricingInsight.source}</span>
                                  ) : null}
                                </div>
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
                                  const selectedUnitSale = selectedType
                                    ? qty > 0
                                      ? lineSale / qty
                                      : roundTo2(selectedUnitCost * SALE_RATIO_BY_TYPE[selectedType].target)
                                    : 0;
                                  const nextSale = selectedType ? roundTo2(selectedUnitSale * nextQty) : item.sale;
                                  const discountPercent = Number(item.discountPercent ?? 0) || 0;
                                  updateItem(idx, {
                                    quantity: nextQty,
                                    approvedCost: selectedType ? selectedUnitCost * nextQty : item.approvedCost,
                                    sale: nextSale,
                                    ...(discountMode === "percent"
                                      ? { discount: computeDiscountAmountFromPercent(nextSale, discountPercent) }
                                      : {}),
                                  });
                                }}
                              />
                            </td>
                            {COST_DISPLAY_ORDER.map(({ key }) => {
                              const costByType =
                                key === "oe" ? oeCost : key === "oem" ? oemCost : key === "aftm" ? aftmCost : usedCost;
                              const thresholdByType = {
                                minSale: roundTo2(costByType * SALE_RATIO_BY_TYPE[key].min),
                                targetSale: roundTo2(costByType * SALE_RATIO_BY_TYPE[key].target),
                                maxSale: roundTo2(costByType * SALE_RATIO_BY_TYPE[key].max),
                              };
                              const isChecked = selectedApprovedType === key;
                              const hasQuoteForType = item.quoteCosts?.[key] != null;
                              return (
                                <td key={`${idx}-${key}`} className="px-2 py-1">
                                  <div className="flex min-w-[112px] flex-col items-stretch gap-1">
                                    <input
                                      type="number"
                                      step="0.01"
                                      className={`${theme.input} h-8 w-full text-xs`}
                                      value={
                                        isChecked
                                          ? formatCostValue(qty > 0 ? lineSale / qty : thresholdByType.targetSale)
                                          : formatCostValue(thresholdByType.targetSale)
                                      }
                                      min={thresholdByType.minSale}
                                      disabled={isLocked}
                                      onChange={(e) => {
                                        const nextUnitSale = Number(e.target.value) || 0;
                                        const nextTotalSale = roundTo2(nextUnitSale * qty);
                                        const approvedCost = costByType * qty;
                                        const discountPercent = Number(item.discountPercent ?? 0) || 0;
                                        updateItem(idx, {
                                          approvedType: key,
                                          approvedCost,
                                          cost: costByType,
                                          sale: nextTotalSale,
                                          ...(discountMode === "percent"
                                            ? {
                                                discount: computeDiscountAmountFromPercent(nextTotalSale, discountPercent),
                                              }
                                            : {}),
                                        });
                                      }}
                                    />
                                    <div className="grid grid-cols-2 gap-1 text-[9px]">
                                      <div className="rounded border border-slate-600/60 bg-slate-900/25 px-1 py-0.5 text-center">
                                        <div className="text-[8px] uppercase text-slate-400">Min</div>
                                        <div className="font-semibold text-slate-200">{thresholdByType.minSale.toFixed(2)}</div>
                                      </div>
                                      <div className="rounded border border-cyan-500/40 bg-cyan-500/10 px-1 py-0.5 text-center">
                                        <div className="text-[8px] uppercase text-cyan-300">Avg</div>
                                        <div className="font-semibold text-cyan-100">{thresholdByType.targetSale.toFixed(2)}</div>
                                      </div>
                                    </div>
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
                                        const nextTotalSale = roundTo2(thresholdByType.targetSale * qty);
                                        const discountPercent = Number(item.discountPercent ?? 0) || 0;
                                        updateItem(idx, {
                                          approvedType,
                                          approvedCost,
                                          cost: costByType,
                                          sale: nextTotalSale,
                                          ...(discountMode === "percent"
                                            ? {
                                                discount: computeDiscountAmountFromPercent(nextTotalSale, discountPercent),
                                              }
                                            : {}),
                                        });
                                      }}
                                    />
                                      <span className={isChecked ? "font-semibold text-emerald-300" : ""}>{isChecked ? "Using this type" : "Use type"}</span>
                                    </label>
                                    {isChecked && marketPricingInsight?.threshold ? (
                                      <div
                                        className={`text-[9px] ${
                                          thresholdStatus === "below"
                                            ? "text-amber-300"
                                            : thresholdStatus === "above"
                                            ? "text-sky-300"
                                            : "text-emerald-300"
                                        }`}
                                      >
                                        {thresholdStatus === "below"
                                          ? "Below threshold"
                                          : thresholdStatus === "above"
                                          ? "Above threshold"
                                          : "Within threshold"}
                                      </div>
                                    ) : null}
                                  </div>
                                </td>
                              );
                            })}
                            <td className="px-2 py-1 text-xs">{subTotal.toFixed(2)}</td>
                            <td className="px-2 py-1">
                              <div className="flex flex-col items-start gap-1">
                                <select
                                  className={`${theme.input} h-8 w-24 text-xs`}
                                  value={item.status}
                                  disabled={isLocked || item.partOrdered === 1}
                                  onChange={(e) =>
                                    updateItem(idx, {
                                      status:
                                        needsApproval && e.target.value === "approved"
                                          ? "pending"
                                          : (e.target.value as EstimateItemStatus),
                                    })
                                  }
                                >
                                  <option value="pending">Pending</option>
                                  <option value="inquiry">Inquiry</option>
                                  <option value="approved" disabled={needsApproval}>
                                    Approved
                                  </option>
                                  <option value="rejected">Rejected</option>
                                </select>
                                {needsApproval ? (
                                  <div className="text-[9px] text-amber-300">
                                    Approval needed: subtotal {subTotal.toFixed(2)} below min {minAllowedSubtotal.toFixed(2)}
                                  </div>
                                ) : null}
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
                              disabled={!typeSelectable.oe || isEstimateClosed}
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
                              disabled={!typeSelectable.oem || isEstimateClosed}
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
                              disabled={!typeSelectable.aftm || isEstimateClosed}
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
                              disabled={!typeSelectable.used || isEstimateClosed}
                              onChange={(e) => applyApprovedTypeToAll("used", e.target.checked)}
                            />
                            <span>{lineItemTableTotals.used.toFixed(2)}</span>
                          </label>
                        </td>
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
                  disabled={hasActiveJobCard || isEstimateClosed}
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
                    isEstimateClosed ||
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
                        canStartJobCard && !isEstimateClosed
                          ? "bg-indigo-600 text-white"
                          : "cursor-not-allowed border border-slate-500/40 bg-slate-700/35 text-slate-300/70 opacity-70"
                      }`}
                      disabled={!canStartJobCard || isEstimateClosed}
                    >
                      Create Job Card
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={saveEstimate}
                    className={`rounded-md px-4 py-2 text-xs font-semibold shadow-sm ${
                      isSaving || isEstimateClosed
                        ? "cursor-not-allowed border border-slate-500/40 bg-slate-700/35 text-slate-300/70 opacity-70"
                        : "bg-emerald-600 text-white"
                    }`}
                    disabled={isSaving || isEstimateClosed}
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
                disabled={isEstimateClosed}
              >
                Start New Job
              </button>
            </div>
            {newJobItems.length > 0 ? (
              <div className="space-y-3 p-4">
                <div className="text-xs font-semibold text-slate-200">New Job Line Items</div>
                <div className="rounded-md border border-slate-600/60 bg-slate-900/20 px-3 py-2 text-[11px] text-slate-300">
                  Same process as main job card with type-sale thresholds. Final discount is set in Invoice Summary.
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-600/60">
                  <table className="min-w-full text-xs">
                    <thead className={`${theme.surfaceSubtle} ${theme.appText} text-[10px] uppercase tracking-[0.08em]`}>
                      <tr>
                        <th className="px-2 py-1 text-left">Part Name</th>
                        <th className="px-2 py-1 text-left">Description</th>
                        <th className="px-2 py-1 text-left">Qty</th>
                        <th className="px-2 py-1 text-left">OE Sale</th>
                        <th className="px-2 py-1 text-left">OEM Sale</th>
                        <th className="px-2 py-1 text-left">AFTM Sale</th>
                        <th className="px-2 py-1 text-left">Used Sale</th>
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
                        const lineSale = Number(item.sale ?? item.approvedSale) || 0;
                        const subTotal = Math.max(0, lineSale - discountAmount);
                        const selectedApprovedType = item.approvedType ?? null;
                        const isLocked = isEstimateClosed || isLineItemLocked(item);
                        const marketPricingKey = buildMarketPricingKey("new", item, idx);
                        const discountMode = getDiscountMode(marketPricingKey, item);
                        const marketPricingInsight = marketPricingByKey[marketPricingKey] ?? null;
                        const marketPricingLoading = Boolean(marketPricingLoadingByKey[marketPricingKey]);
                        const thresholdStatus = normalizeThresholdStatus(lineSale, marketPricingInsight?.threshold ?? null);
                        const minAllowedSubtotal = getSelectedTypeMinSubtotal(item);
                        const needsApproval = requiresDiscountApproval(item);

                        return (
                          <tr key={`new-job-${idx}`} className="border-b border-slate-600/60 transition-colors odd:bg-slate-900/15 hover:bg-slate-800/25 last:border-0">
                            <td className="px-2 py-1">
                              <div className="space-y-1">
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
                                <div className="flex items-center justify-between gap-2">
                                  <button
                                    type="button"
                                    className="rounded-md border border-cyan-500/60 bg-cyan-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                                    disabled={isLocked || marketPricingLoading || !item.partName.trim()}
                                    onClick={() => void fetchAndApplyMarketPricing("new", idx)}
                                  >
                                    {marketPricingLoading ? "AI..." : "AI Avg"}
                                  </button>
                                  {marketPricingInsight?.source ? (
                                    <span className="text-[9px] text-slate-400 uppercase">{marketPricingInsight.source}</span>
                                  ) : null}
                                </div>
                              </div>
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
                                  const selectedUnitSale = selectedType
                                    ? qty > 0
                                      ? lineSale / qty
                                      : roundTo2(selectedUnitCost * SALE_RATIO_BY_TYPE[selectedType].target)
                                    : 0;
                                  const nextSale = selectedType ? roundTo2(selectedUnitSale * nextQty) : item.sale;
                                  const discountPercent = Number(item.discountPercent ?? 0) || 0;
                                  updateNewJobItem(idx, {
                                    quantity: nextQty,
                                    approvedCost: selectedType ? selectedUnitCost * nextQty : item.approvedCost,
                                    sale: nextSale,
                                    ...(discountMode === "percent"
                                      ? { discount: computeDiscountAmountFromPercent(nextSale, discountPercent) }
                                      : {}),
                                  });
                                }}
                              />
                            </td>
                            {COST_DISPLAY_ORDER.map(({ key }) => {
                              const costByType =
                                key === "oe" ? oeCost : key === "oem" ? oemCost : key === "aftm" ? aftmCost : usedCost;
                              const thresholdByType = {
                                minSale: roundTo2(costByType * SALE_RATIO_BY_TYPE[key].min),
                                targetSale: roundTo2(costByType * SALE_RATIO_BY_TYPE[key].target),
                                maxSale: roundTo2(costByType * SALE_RATIO_BY_TYPE[key].max),
                              };
                              const isChecked = selectedApprovedType === key;
                              const hasQuoteForType = item.quoteCosts?.[key] != null;
                              return (
                                <td key={`new-${idx}-${key}`} className="px-2 py-1">
                                  <div className="flex min-w-[112px] flex-col items-stretch gap-1">
                                    <input
                                      type="number"
                                      step="0.01"
                                      className={`${theme.input} h-8 w-full text-xs`}
                                      value={
                                        isChecked
                                          ? formatCostValue(qty > 0 ? lineSale / qty : thresholdByType.targetSale)
                                          : formatCostValue(thresholdByType.targetSale)
                                      }
                                      min={thresholdByType.minSale}
                                      disabled={isLocked}
                                      onChange={(e) => {
                                        const nextUnitSale = Number(e.target.value) || 0;
                                        const nextTotalSale = roundTo2(nextUnitSale * qty);
                                        const approvedCost = costByType * qty;
                                        const discountPercent = Number(item.discountPercent ?? 0) || 0;
                                        updateNewJobItem(idx, {
                                          approvedType: key,
                                          approvedCost,
                                          cost: costByType,
                                          sale: nextTotalSale,
                                          ...(discountMode === "percent"
                                            ? {
                                                discount: computeDiscountAmountFromPercent(nextTotalSale, discountPercent),
                                              }
                                            : {}),
                                        });
                                      }}
                                    />
                                    <div className="grid grid-cols-2 gap-1 text-[9px]">
                                      <div className="rounded border border-slate-600/60 bg-slate-900/25 px-1 py-0.5 text-center">
                                        <div className="text-[8px] uppercase text-slate-400">Min</div>
                                        <div className="font-semibold text-slate-200">{thresholdByType.minSale.toFixed(2)}</div>
                                      </div>
                                      <div className="rounded border border-cyan-500/40 bg-cyan-500/10 px-1 py-0.5 text-center">
                                        <div className="text-[8px] uppercase text-cyan-300">Avg</div>
                                        <div className="font-semibold text-cyan-100">{thresholdByType.targetSale.toFixed(2)}</div>
                                      </div>
                                    </div>
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
                                        const nextTotalSale = roundTo2(thresholdByType.targetSale * qty);
                                        const discountPercent = Number(item.discountPercent ?? 0) || 0;
                                        updateNewJobItem(idx, {
                                          approvedType,
                                          approvedCost,
                                          cost: costByType,
                                          sale: nextTotalSale,
                                          ...(discountMode === "percent"
                                            ? {
                                                discount: computeDiscountAmountFromPercent(nextTotalSale, discountPercent),
                                              }
                                            : {}),
                                        });
                                      }}
                                    />
                                      <span className={isChecked ? "font-semibold text-emerald-300" : ""}>{isChecked ? "Using this type" : "Use type"}</span>
                                    </label>
                                    {isChecked && marketPricingInsight?.threshold ? (
                                      <div
                                        className={`text-[9px] ${
                                          thresholdStatus === "below"
                                            ? "text-amber-300"
                                            : thresholdStatus === "above"
                                            ? "text-sky-300"
                                            : "text-emerald-300"
                                        }`}
                                      >
                                        {thresholdStatus === "below"
                                          ? "Below threshold"
                                          : thresholdStatus === "above"
                                          ? "Above threshold"
                                          : "Within threshold"}
                                      </div>
                                    ) : null}
                                  </div>
                                </td>
                              );
                            })}
                            <td className="px-2 py-1 text-xs">{subTotal.toFixed(2)}</td>
                            <td className="px-2 py-1">
                              <div className="flex items-center gap-1">
                                <select
                                  className={`${theme.input} h-8 w-24 text-xs`}
                                  value={item.status}
                                  disabled={isLocked}
                                  onChange={(e) =>
                                    updateNewJobItem(idx, {
                                      status:
                                        needsApproval && e.target.value === "approved"
                                          ? "pending"
                                          : (e.target.value as EstimateItemStatus),
                                    })
                                  }
                                >
                                  <option value="pending">Pending</option>
                                  <option value="inquiry">Inquiry</option>
                                  <option value="approved" disabled={needsApproval}>
                                    Approved
                                  </option>
                                  <option value="rejected">Rejected</option>
                                </select>
                                {needsApproval ? (
                                  <span className="text-[9px] text-amber-300">
                                    Approval: {subTotal.toFixed(2)} &lt; {minAllowedSubtotal.toFixed(2)}
                                  </span>
                                ) : null}
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
                                disabled={!newJobTypeSelectable.oe || isEstimateClosed}
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
                                disabled={!newJobTypeSelectable.oem || isEstimateClosed}
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
                                disabled={!newJobTypeSelectable.aftm || isEstimateClosed}
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
                                disabled={!newJobTypeSelectable.used || isEstimateClosed}
                                onChange={(e) => applyApprovedTypeToAllNewJob("used", e.target.checked)}
                              />
                              <span>{newJobLineItemTableTotals.used.toFixed(2)}</span>
                            </label>
                          </td>
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
                    disabled={isEstimateClosed}
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
                    disabled={newJobItems.length === 0 || isEstimateClosed}
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
                    disabled={isSaving || isEstimateClosed}
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
                    disabled={!canStartAdditionalJobCard || isEstimateClosed}
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
                <div className="mt-2 rounded-md border border-slate-600/60 bg-slate-900/30 p-2">
                  <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-300">Invoice Discount</div>
                  <div className="space-y-2">
                    <div className="inline-flex rounded-md border border-slate-600/70 bg-slate-950/50 p-0.5">
                      <button
                        type="button"
                        className={`h-7 rounded px-2.5 text-[11px] font-semibold transition ${
                          invoiceDiscountMode === "amount"
                            ? "bg-cyan-500/20 text-cyan-200"
                            : "text-slate-300 hover:bg-slate-700/40"
                        }`}
                        onClick={() => {
                          const mode: "amount" | "percent" = "amount";
                          setInvoiceDiscountMode(mode);
                          setDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  discountAmount: Number(
                                    ((invoiceSubTotalPreview * Math.max(0, invoiceDiscountPercent)) / 100).toFixed(2)
                                  ),
                                }
                              : prev
                          );
                        }}
                      >
                        Amount
                      </button>
                      <button
                        type="button"
                        className={`h-7 rounded px-2.5 text-[11px] font-semibold transition ${
                          invoiceDiscountMode === "percent"
                            ? "bg-cyan-500/20 text-cyan-200"
                            : "text-slate-300 hover:bg-slate-700/40"
                        }`}
                        onClick={() => {
                          const mode: "amount" | "percent" = "percent";
                          setInvoiceDiscountMode(mode);
                          const pct = derivePercentFromAmount(invoiceSubTotalPreview, Number(draft.discountAmount || 0));
                          setInvoiceDiscountPercent(pct);
                          setDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  discountAmount: Number(
                                    ((invoiceSubTotalPreview * Math.max(0, pct)) / 100).toFixed(2)
                                  ),
                                }
                              : prev
                          );
                        }}
                      >
                        %
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className={`${theme.input} h-9 flex-1 text-sm font-semibold`}
                        value={
                          invoiceDiscountMode === "percent"
                            ? invoiceDiscountPercent
                            : Number(draft.discountAmount || 0)
                        }
                        onChange={(e) => {
                          const value = Number(e.target.value) || 0;
                          if (invoiceDiscountMode === "percent") {
                            const safePercent = Math.max(0, Math.min(100, value));
                            setInvoiceDiscountPercent(safePercent);
                            setDraft((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    discountAmount: Number(
                                      ((invoiceSubTotalPreview * safePercent) / 100).toFixed(2)
                                    ),
                                  }
                                : prev
                            );
                            return;
                          }
                          setDraft((prev) => (prev ? { ...prev, discountAmount: Math.max(0, value) } : prev));
                        }}
                      />
                      <div className="inline-flex h-9 min-w-[52px] items-center justify-center rounded border border-slate-600/70 bg-slate-950/60 px-2 text-[11px] font-semibold text-slate-200">
                        {invoiceDiscountMode === "percent" ? "%" : "AED"}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>
                        {invoiceDiscountMode === "percent"
                          ? `Applied: ${invoiceDiscountPercent.toFixed(2)}%`
                          : "Applied as fixed amount"}
                      </span>
                      <span>Discount Value: AED {invoiceDiscountAmountPreview.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Discount</span>
                  <span>AED {invoiceDiscountAmountPreview.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Net Subtotal</span>
                  <span>AED {invoiceNetSubTotalPreview.toFixed(2)}</span>
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
                  isConvertDisabled
                    ? "cursor-not-allowed border border-slate-500/40 bg-slate-700/70 text-slate-300"
                    : "bg-emerald-600 text-white"
                }`}
                disabled={isConvertDisabled}
                onClick={() => {
                  setInvoiceConvertError(null);
                  setShowInvoiceModal(true);
                }}
              >
                {reviewConvertLabel}
              </button>
              {convertDisabledReason && (
                <div className="text-center text-[11px] text-slate-400">{convertDisabledReason}</div>
              )}
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
                <div className="rounded-md border border-slate-600/60 bg-slate-900/30 p-2">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-[11px] font-semibold text-slate-200">Invoice Line Items</div>
                    <div className="text-[10px] text-slate-400">{invoicePreviewLineItems.length} item(s)</div>
                  </div>
                  {invoicePreviewLineItems.length === 0 ? (
                    <div className="text-[11px] text-slate-400">No approved line items available.</div>
                  ) : (
                    <div className="max-h-56 overflow-auto rounded-md border border-slate-700/60">
                      <table className="min-w-full text-[11px]">
                        <thead className={`${theme.surfaceSubtle} ${theme.appText}`}>
                          <tr>
                            <th className="px-2 py-1 text-left">#</th>
                            <th className="px-2 py-1 text-left">Part</th>
                            <th className="px-2 py-1 text-left">Description</th>
                            <th className="px-2 py-1 text-right">Qty</th>
                            <th className="px-2 py-1 text-right">Rate</th>
                            <th className="px-2 py-1 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoicePreviewLineItems.map((item) => (
                            <tr key={`inv-line-${item.key}`} className="border-t border-slate-700/50">
                              <td className="px-2 py-1">{item.lineNo}</td>
                              <td className="px-2 py-1 font-semibold">{item.partName}</td>
                              <td className="px-2 py-1 text-slate-300">{item.description}</td>
                              <td className="px-2 py-1 text-right">{item.qty.toFixed(2)}</td>
                              <td className="px-2 py-1 text-right">AED {item.unitRate.toFixed(2)}</td>
                              <td className="px-2 py-1 text-right font-semibold">AED {item.total.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="rounded-md border border-slate-500/70 bg-slate-800/40 px-3 py-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>AED {invoiceSubTotalPreview.toFixed(2)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Discount</span>
                    <span>AED {invoiceDiscountAmountPreview.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Net Subtotal</span>
                    <span>AED {invoiceNetSubTotalPreview.toFixed(2)}</span>
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
                <div
                  className={`rounded-md border px-3 py-2 ${
                    invoiceCanAutoSettle
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
                      : "border-amber-500/50 bg-amber-500/10 text-amber-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px]">Customer Wallet Balance</span>
                    <span className="font-semibold">AED {customerWalletBalance.toFixed(2)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[11px]">Amount Required</span>
                    <span className="font-semibold">AED {invoiceGrandTotalPreview.toFixed(2)}</span>
                  </div>
                  <div className="mt-1 text-[11px]">
                    {isZeroBillInvoice
                      ? "Invoice bill is zero: direct payment and car-out will run automatically."
                      : walletCanAutoPayInvoice
                      ? "Wallet is sufficient: direct payment and car-out will run automatically."
                      : "Wallet is not sufficient: invoice will be created without auto-payment."}
                  </div>
                  {!isZeroBillInvoice && !walletCanAutoPayInvoice && customerIdForWallet && (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => openTopupModal(invoiceGrandTotalPreview)}
                        className="inline-flex rounded-md border border-amber-300/60 bg-amber-500/20 px-2 py-1 text-[11px] font-semibold text-amber-100 transition hover:bg-amber-500/30"
                      >
                        Top Up Wallet
                      </button>
                    </div>
                  )}
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
                    isConvertDisabled
                      ? "cursor-not-allowed border border-slate-500/40 bg-slate-700/70 text-slate-300"
                      : "bg-emerald-600 text-white"
                  }`}
                  disabled={isConvertDisabled || isConvertingInvoice}
                  onClick={convertToInvoice}
                >
                  {convertInvoiceLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {topupOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className={`w-full max-w-lg rounded-xl border border-slate-600/60 ${theme.cardBg}`}>
            <div className={`flex items-center justify-between rounded-t-xl border-b border-slate-600/60 px-4 py-3 ${theme.surfaceSubtle}`}>
              <div>
                <div className="text-sm font-semibold">Topup Wallet</div>
                <div className="text-[11px] text-muted-foreground">
                  Minimum topup required: AED {invoiceGrandTotalPreview.toFixed(2)}
                </div>
              </div>
              <button
                type="button"
                className="rounded-md border border-slate-500/60 px-2 py-1 text-xs"
                onClick={() => setTopupOpen(false)}
                disabled={topupSaving}
              >
                Close
              </button>
            </div>
            <div className="space-y-3 p-4 text-xs">
              {topupError && (
                <div className="rounded-md border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-rose-200">
                  {topupError}
                </div>
              )}
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Amount</label>
                <input
                  type="number"
                  min={invoiceGrandTotalPreview > 0 ? invoiceGrandTotalPreview.toFixed(2) : "0"}
                  step="0.01"
                  className={theme.input}
                  value={topupForm.amount}
                  onChange={(e) => setTopupForm((prev) => ({ ...prev, amount: e.target.value }))}
                  placeholder="Enter topup amount"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Payment Method</label>
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
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Payment Date</label>
                <input
                  type="date"
                  className={theme.input}
                  value={topupForm.paymentDate}
                  onChange={(e) => setTopupForm((prev) => ({ ...prev, paymentDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Payment Proof File ID (Optional)</label>
                <input
                  type="text"
                  className={theme.input}
                  value={topupForm.proofFileId}
                  onChange={(e) => setTopupForm((prev) => ({ ...prev, proofFileId: e.target.value }))}
                  placeholder="Enter file id"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="rounded-md border border-slate-500/60 px-3 py-1.5 text-xs font-semibold"
                  onClick={() => setTopupOpen(false)}
                  disabled={topupSaving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  disabled={topupSaving}
                  onClick={() => void submitTopupFromInvoiceModal(invoiceGrandTotalPreview)}
                >
                  {topupSaving ? "Saving..." : "Save Topup"}
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
                      const currentDescription = String(newJobItems[newJobIdx]?.description ?? "").trim();
                      updateNewJobItem(newJobIdx, {
                        partName: product.name,
                        description: currentDescription || product.partNumber || undefined,
                        productType: product.type ?? null,
                      });
                    } else {
                      const currentDescription = String(draft?.items[productOpenIndex]?.description ?? "").trim();
                      updateItem(productOpenIndex, {
                        partName: product.name,
                        description: currentDescription || product.partNumber || undefined,
                        productType: product.type ?? null,
                      });
                    }
                    setProductOpenIndex(null);
                  }}
                >
                  <span className="font-semibold">{product.label || product.name}</span>
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
