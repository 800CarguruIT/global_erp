"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { MainPageShell } from "./MainPageShell";
import { Card } from "../components/Card";
import type { Estimate } from "@repo/ai-core/workshop/estimates/types";
import type { Quote } from "@repo/ai-core/workshop/quotes/types";
import type { Inspection } from "@repo/ai-core/workshop/inspections/types";
import type { Lead } from "@repo/ai-core/crm/leads/types";
import { useTheme } from "../theme";
import { DateRange } from "react-date-range";

type JobCardRow = {
  id: string;
  status?: string | null;
  estimate_id?: string | null;
  lead_id?: string | null;
  start_at?: string | null;
  complete_at?: string | null;
  created_at?: string | null;
  branch_name?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  plate_number?: string | null;
  make?: string | null;
  model?: string | null;
  workshop_quote_id?: string | null;
  workshop_quote_status?: string | null;
  workshop_quote_total_amount?: number | null;
  workshop_quote_currency?: string | null;
  workshop_quote_verified_at?: string | null;
  workshop_quote_verified_by?: string | null;
};

type InspectionRow = Inspection & {
  car?: { plate_number?: string | null; make?: string | null; model?: string | null } | null;
  customer?: { name?: string | null; phone?: string | null } | null;
  branch?: { display_name?: string | null; name?: string | null; code?: string | null } | null;
};

type PendingInspectionRow = InspectionRow & {
  hasInspection: boolean;
  leadId?: string | null;
};

type LoadState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "loaded"; data: T; error: null }
  | { status: "error"; data: null; error: string };

type EstimateQuotesData = {
  jobCards: JobCardRow[];
  estimates: Estimate[];
  quotes: Quote[];
  inspections: InspectionRow[];
  leads: Lead[];
};

type TabKind = "jobCards" | "estimates" | "quotes" | "inspections";

type TabConfig = {
  id: string;
  label: string;
  kind: TabKind;
  group: "inspection" | "service" | "jc";
  filter: (data: EstimateQuotesData) => any[];
};

type QuotedJobCardGroup = {
  key: string;
  jobCardId: string | null;
  estimateId: string | null;
  carPlate: string;
  carModel: string;
  workshopName: string;
  updatedAt: string | null;
  quotes: Quote[];
};

type CostSettings = {
  inspectionFixedAmount: number;
  currency: string;
  vatRate: number;
};

type FineRow = {
  id: string;
  reason: string;
  amount: string;
};

type DatePresetId =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "last_30_days"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "all_time";

const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const getWeekStart = (date: Date) => {
  const d = startOfDay(date);
  const day = d.getDay();
  const diffToMonday = (day + 6) % 7;
  d.setDate(d.getDate() - diffToMonday);
  return d;
};

export function EstimateQuotesMain({
  companyId,
  title = "Estimate Quotes",
  subtitle = "Estimate quotation pipeline overview.",
}: {
  companyId: string;
  title?: string;
  subtitle?: string;
}) {
  const { theme } = useTheme();
  const [state, setState] = useState<LoadState<EstimateQuotesData>>({
    status: "loading",
    data: null,
    error: null,
  });
  const [activeTab, setActiveTab] = useState("pending-insp");
  const [query, setQuery] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignLeadId, setAssignLeadId] = useState<string | null>(null);
  const [assignBranchId, setAssignBranchId] = useState<string | null>(null);
  const [assignBranches, setAssignBranches] = useState<any[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyRow, setVerifyRow] = useState<PendingInspectionRow | null>(null);
  const [verifyInspection, setVerifyInspection] = useState<any | null>(null);
  const [verifyEarning, setVerifyEarning] = useState<any | null>(null);
  const [verifyLineItems, setVerifyLineItems] = useState<any[]>([]);
  const [verifyVideos, setVerifyVideos] = useState<string[]>([]);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifySubmitting, setVerifySubmitting] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [quoteWorkflowLoadingId, setQuoteWorkflowLoadingId] = useState<string | null>(null);
  const [jobVerifyLoadingId, setJobVerifyLoadingId] = useState<string | null>(null);
  const [jobVerifyOpen, setJobVerifyOpen] = useState(false);
  const [jobVerifyRow, setJobVerifyRow] = useState<JobCardRow | null>(null);
  const [jobVerifyDetails, setJobVerifyDetails] = useState<any | null>(null);
  const [jobVerifyDetailsLoading, setJobVerifyDetailsLoading] = useState(false);
  const [jobVerifyError, setJobVerifyError] = useState<string | null>(null);
  const [jobVerifyVatRate, setJobVerifyVatRate] = useState(0);
  const [jobVerifyCurrency, setJobVerifyCurrency] = useState("USD");
  const [quotesModalGroupKey, setQuotesModalGroupKey] = useState<string | null>(null);
  const [cancelRemarks, setCancelRemarks] = useState("");
  const [costSettings, setCostSettings] = useState<CostSettings>({
    inspectionFixedAmount: 0,
    currency: "USD",
    vatRate: 0,
  });
  const [verifyFines, setVerifyFines] = useState<FineRow[]>([]);
  const [showCompletedDatePicker, setShowCompletedDatePicker] = useState(false);
  const [completedDateFilterEnabled, setCompletedDateFilterEnabled] = useState(false);
  const [completedDatePreset, setCompletedDatePreset] = useState<DatePresetId | null>(null);
  const [completedDateRange, setCompletedDateRange] = useState<{
    startDate: Date;
    endDate: Date;
    key: "selection";
  }>({
    startDate: new Date(),
    endDate: new Date(),
    key: "selection",
  });

  const completedDatePresets = useMemo(
    () =>
      [
        { id: "today", label: "Today" },
        { id: "yesterday", label: "Yesterday" },
        { id: "last_7_days", label: "Last 7 Days" },
        { id: "last_30_days", label: "Last 30 Days" },
        { id: "this_week", label: "This Week" },
        { id: "last_week", label: "Last Week" },
        { id: "this_month", label: "This Month" },
        { id: "last_month", label: "Last Month" },
        { id: "all_time", label: "All Time" },
      ] as Array<{ id: DatePresetId; label: string }>,
    []
  );

  const applyCompletedDatePreset = useCallback((preset: DatePresetId) => {
    if (preset === "all_time") {
      setCompletedDatePreset("all_time");
      setCompletedDateFilterEnabled(false);
      setShowCompletedDatePicker(false);
      return;
    }

    const now = new Date();
    let start = startOfDay(now);
    let end = endOfDay(now);

    if (preset === "yesterday") {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      start = startOfDay(d);
      end = endOfDay(d);
    } else if (preset === "last_7_days") {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      start = startOfDay(d);
      end = endOfDay(now);
    } else if (preset === "last_30_days") {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      start = startOfDay(d);
      end = endOfDay(now);
    } else if (preset === "this_week") {
      start = getWeekStart(now);
      end = endOfDay(now);
    } else if (preset === "last_week") {
      const thisWeekStart = getWeekStart(now);
      const previousWeekStart = new Date(thisWeekStart);
      previousWeekStart.setDate(previousWeekStart.getDate() - 7);
      const previousWeekEnd = new Date(thisWeekStart);
      previousWeekEnd.setDate(previousWeekEnd.getDate() - 1);
      start = startOfDay(previousWeekStart);
      end = endOfDay(previousWeekEnd);
    } else if (preset === "this_month") {
      start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
      end = endOfDay(now);
    } else if (preset === "last_month") {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthEnd = new Date(monthStart);
      lastMonthEnd.setDate(0);
      start = startOfDay(new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1));
      end = endOfDay(lastMonthEnd);
    }

    setCompletedDatePreset(preset);
    setCompletedDateRange({
      key: "selection",
      startDate: start,
      endDate: end,
    });
    setCompletedDateFilterEnabled(true);
    setShowCompletedDatePicker(false);
  }, []);

  const load = useCallback(async () => {
    setState({ status: "loading", data: null, error: null });
    try {
      const [jobCardsRes, estimatesRes, quotesRes, inspectionsRes, leadsRes] = await Promise.all([
        fetch(`/api/company/${companyId}/workshop/job-cards`),
        fetch(`/api/company/${companyId}/workshop/estimates`),
        fetch(`/api/company/${companyId}/workshop/quotes`),
        fetch(`/api/company/${companyId}/workshop/inspections`),
        fetch(`/api/company/${companyId}/sales/leads`),
      ]);
      if (!jobCardsRes.ok) throw new Error(`Job cards HTTP ${jobCardsRes.status}`);
      if (!estimatesRes.ok) throw new Error(`Estimates HTTP ${estimatesRes.status}`);
      if (!quotesRes.ok) throw new Error(`Quotes HTTP ${quotesRes.status}`);
      if (!inspectionsRes.ok) throw new Error(`Inspections HTTP ${inspectionsRes.status}`);
      if (!leadsRes.ok) throw new Error(`Leads HTTP ${leadsRes.status}`);

      const [jobCardsJson, estimatesJson, quotesJson, inspectionsJson, leadsJson] = await Promise.all([
        jobCardsRes.json(),
        estimatesRes.json(),
        quotesRes.json(),
        inspectionsRes.json(),
        leadsRes.json(),
      ]);
      setState({
        status: "loaded",
        data: {
          jobCards: jobCardsJson.data ?? [],
          estimates: estimatesJson.data ?? [],
          quotes: quotesJson.data ?? [],
          inspections: inspectionsJson.data ?? [],
          leads: leadsJson.data ?? [],
        },
        error: null,
      });
    } catch (err) {
      setState({ status: "error", data: null, error: "Failed to load estimate quotes." });
    }
  }, [companyId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    if (activeTab !== "completed-insp") {
      setShowCompletedDatePicker(false);
    }
  }, [activeTab]);

  const data =
    state.status === "loaded"
      ? state.data
      : { jobCards: [], estimates: [], quotes: [], inspections: [], leads: [] };

  const leadById = useMemo(() => {
    const map = new Map<string, Lead>();
    data.leads.forEach((lead) => {
      if (lead?.id) map.set(lead.id, lead);
    });
    return map;
  }, [data.leads]);

  const latestInspectionByLead = useMemo(() => {
    const map = new Map<string, InspectionRow>();
    // inspections API is DESC by created_at; keep first per lead as latest
    data.inspections.forEach((row) => {
      if (!row?.leadId) return;
      if (!map.has(row.leadId)) {
        map.set(row.leadId, row);
      }
    });
    return map;
  }, [data.inspections]);

  const latestInspectionRows = useMemo(() => Array.from(latestInspectionByLead.values()), [latestInspectionByLead]);

  const pendingInspectionRows = useMemo(() => {
    const carInLeads = data.leads.filter((lead) => lead.leadStatus === "car_in");
    const rows: PendingInspectionRow[] = [];
    carInLeads.forEach((lead) => {
      const latest = latestInspectionByLead.get(lead.id);
      const latestStatus = String(latest?.status ?? "").toLowerCase();

      if (latest && latestStatus === "pending") {
        rows.push({ ...latest, hasInspection: true });
        return;
      }
      // completed latest inspection should not appear in pending list
      if (latest && latestStatus === "completed") {
        return;
      }
      // cancelled or missing latest inspection: show as pending candidate for (re)assignment
      rows.push({
        id: lead.id,
        leadId: lead.id,
        status: "pending",
        car: {
          plate_number: lead.carPlateNumber ?? null,
          model: lead.carModel ?? null,
        },
        customer: {
          name: lead.customerName ?? null,
          phone: lead.customerPhone ?? null,
        },
        branch: {
          display_name: lead.branchName ?? null,
        },
        updatedAt: lead.updatedAt,
        createdAt: lead.createdAt,
        hasInspection: false,
      });
    });
    return rows;
  }, [data.leads, latestInspectionByLead]);

  const latestJobCardByEstimateId = useMemo(() => {
    const map = new Map<string, JobCardRow>();
    data.jobCards.forEach((row) => {
      const estimateId = String(row.estimate_id ?? "").trim();
      if (!estimateId) return;
      if (!map.has(estimateId)) {
        map.set(estimateId, row);
      }
    });
    return map;
  }, [data.jobCards]);

  const latestBranchQuoteStatusByEstimateId = useMemo(() => {
    const map = new Map<string, string>();
    const sorted = [...data.quotes]
      .filter((row) => row.quoteType === "branch_labor" && !!row.estimateId)
      .sort(
        (a, b) =>
          new Date(b.updatedAt ?? b.createdAt ?? 0).getTime() -
          new Date(a.updatedAt ?? a.createdAt ?? 0).getTime()
      );
    sorted.forEach((row) => {
      const estimateId = String(row.estimateId ?? "").trim();
      if (!estimateId || map.has(estimateId)) return;
      map.set(estimateId, String(row.status ?? "").toLowerCase());
    });
    return map;
  }, [data.quotes]);

  const jobCardById = useMemo(() => {
    const map = new Map<string, JobCardRow>();
    data.jobCards.forEach((row) => {
      if (row?.id) map.set(row.id, row);
    });
    return map;
  }, [data.jobCards]);

  async function openVerifyModal(row: PendingInspectionRow) {
    if (row.hasInspection === false) return;
    setVerifyOpen(true);
    setVerifyRow(row);
    setVerifyInspection(null);
    setVerifyEarning(null);
    setVerifyLineItems([]);
    setVerifyVideos([]);
    setVerifyError(null);
    setCancelRemarks("");
    setVerifyFines([]);
    setVerifyLoading(true);
    try {
      const [inspectionRes, settingsRes] = await Promise.all([
        fetch(`/api/company/${companyId}/workshop/inspections/${row.id}`),
        fetch(`/api/company/${companyId}/workshop/cost-settings`),
      ]);
      if (!inspectionRes.ok) throw new Error("Failed to load inspection report.");
      const json = await inspectionRes.json();
      const inspection = json?.data?.inspection ?? null;
      const lineItems = Array.isArray(json?.data?.lineItems) ? json.data.lineItems : [];
      const existingFines = Array.isArray(json?.data?.fines) ? json.data.fines : [];
      const existingEarning = json?.data?.earnings ?? null;
      const lead = row.leadId ? leadById.get(row.leadId) : null;
      const leadCarInVideo = (lead as any)?.carInVideo ?? (lead as any)?.carin_video ?? null;
      const leadCarOutVideo = (lead as any)?.carOutVideo ?? (lead as any)?.carout_video ?? null;
      const inspectionCarInVideo =
        (inspection as any)?.carInVideo ?? (inspection as any)?.carin_video ?? null;
      const inspectionCarOutVideo =
        (inspection as any)?.carOutVideo ?? (inspection as any)?.carout_video ?? null;

      // Show only dedicated inspection videos (car in/out), not line-item media (which can be images).
      const videoRefs = [
        leadCarInVideo,
        leadCarOutVideo,
        inspectionCarInVideo,
        inspectionCarOutVideo,
      ]
        .map((value) => String(value ?? "").trim())
        .filter((value) => value.length > 0 && value.toLowerCase() !== "null");
      setVerifyInspection(inspection);
      setVerifyEarning(existingEarning);
      setVerifyLineItems(lineItems);
      setVerifyVideos(Array.from(new Set(videoRefs)));
      setVerifyFines(
        existingFines.map((fine: any) => ({
          id: String(fine?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
          reason: String(fine?.reason ?? ""),
          amount: String(Number(fine?.amount ?? 0)),
        }))
      );
      if (settingsRes.ok) {
        const settingsJson = await settingsRes.json().catch(() => ({}));
        const s = settingsJson?.data ?? {};
        setCostSettings({
          inspectionFixedAmount: Number(s.inspectionFixedAmount ?? 0),
          currency: String(s.currency ?? "USD"),
          vatRate: Number(s.vatRate ?? 0),
        });
      }
    } catch (err: any) {
      setVerifyError(err?.message ?? "Failed to load inspection report.");
    } finally {
      setVerifyLoading(false);
    }
  }

  async function openAssignModal(leadId: string | null | undefined) {
    if (!leadId) return;
    setAssignLeadId(leadId);
    setAssignBranchId(leadById.get(leadId)?.branchId ?? null);
    setAssignError(null);
    setAssignBranches([]);
    setAssignOpen(true);
    try {
      const res = await fetch(`/api/company/${companyId}/branches`);
      if (!res.ok) throw new Error("Failed to load branches.");
      const data = await res.json();
      const list = data.data ?? data.branches ?? [];
      const filtered = list.filter((branch: any) => {
        const rawTypes = branch.branch_types ?? branch.branchTypes ?? [];
        const rawServices = branch.service_types ?? branch.serviceTypes ?? [];
        const types = (Array.isArray(rawTypes) ? rawTypes : []).map((t: string) => t.toLowerCase());
        const services = (Array.isArray(rawServices) ? rawServices : []).map((s: string) => s.toLowerCase());
        const typesOk = types.includes("workshop");
        const servicesOk = services.some((s: string) => s === "workshop");
        return typesOk || servicesOk || services.length === 0;
      });
      setAssignBranches(filtered);
    } catch (err: any) {
      setAssignError(err?.message ?? "Failed to load branches.");
    }
  }

  function closeAssignModal() {
    setAssignOpen(false);
    setAssignLeadId(null);
    setAssignBranchId(null);
    setAssignBranches([]);
    setAssignError(null);
  }

  async function submitAssign() {
    if (!assignLeadId || !assignBranchId) return;
    setAssignLoading(true);
    setAssignError(null);
    try {
      const res = await fetch(`/api/company/${companyId}/sales/leads/${assignLeadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId: assignBranchId, ensureInspection: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to assign branch.");
      }
      await load();
      closeAssignModal();
    } catch (err: any) {
      setAssignError(err?.message ?? "Failed to assign branch.");
    } finally {
      setAssignLoading(false);
    }
  }

  function closeVerifyModal() {
    setVerifyOpen(false);
    setVerifyRow(null);
    setVerifyInspection(null);
    setVerifyEarning(null);
    setVerifyLineItems([]);
    setVerifyVideos([]);
    setVerifyError(null);
    setCancelRemarks("");
    setVerifyFines([]);
    setVerifyLoading(false);
    setVerifySubmitting(false);
  }

  async function submitVerify() {
    if (!verifyRow) return;
    setVerifySubmitting(true);
    setVerifyError(null);
    const finesPayload = verifyFines
      .map((fine) => ({
        reason: fine.reason.trim(),
        amount: Number(fine.amount || 0),
      }))
      .filter((fine) => fine.reason && Number.isFinite(fine.amount) && fine.amount > 0);
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/inspections/${verifyRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", fines: finesPayload }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to verify inspection.");
      }
      await load();
      closeVerifyModal();
    } catch (err: any) {
      setVerifyError(err?.message ?? "Failed to verify inspection.");
    } finally {
      setVerifySubmitting(false);
    }
  }

  async function submitCancelInspection() {
    if (!verifyRow) return;
    setVerifySubmitting(true);
    setVerifyError(null);
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/inspections/${verifyRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", cancelRemarks: cancelRemarks.trim() || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to cancel inspection.");
      }
      await load();
      closeVerifyModal();
    } catch (err: any) {
      setVerifyError(err?.message ?? "Failed to cancel inspection.");
    } finally {
      setVerifySubmitting(false);
    }
  }

  const fineTotal = useMemo(
    () =>
      verifyFines.reduce((sum, fine) => {
        const amount = Number(fine.amount || 0);
        return Number.isFinite(amount) && amount > 0 ? sum + amount : sum;
      }, 0),
    [verifyFines]
  );
  const netBeforeVat = Math.max(Number(costSettings.inspectionFixedAmount || 0) - fineTotal, 0);
  const vatAmount = netBeforeVat * (Number(costSettings.vatRate || 0) / 100);
  const totalPayable = netBeforeVat + vatAmount;

  const tabs: TabConfig[] = useMemo(
    () => [
      {
        id: "work-jc",
        label: "Open JC",
        kind: "jobCards",
        group: "jc",
        filter: (d) =>
          d.jobCards.filter(
            (row) => ["pending", "re-assigned"].includes((row.status ?? "Pending").toLowerCase())
          ),
      },
      {
        id: "in-process",
        label: "In Process",
        kind: "jobCards",
        group: "jc",
        filter: (d) =>
          d.jobCards.filter((row) => {
            const completedByTime = Boolean(row.complete_at);
            const completedByStatus = String(row.status ?? "").toLowerCase() === "completed";
            if (completedByTime || completedByStatus) return false;
            if (row.start_at && !row.complete_at) return true;
            const estimateId = String(row.estimate_id ?? "").trim();
            if (!estimateId) return false;
            return latestBranchQuoteStatusByEstimateId.get(estimateId) === "accepted";
          }),
      },
      {
        id: "completed",
        label: "Completed",
        kind: "jobCards",
        group: "jc",
        filter: (d) =>
          d.jobCards.filter(
            (row) => (row.status ?? "").toLowerCase() === "completed" || Boolean(row.complete_at)
          ),
      },
      {
        id: "verified",
        label: "Verified",
        kind: "quotes",
        group: "jc",
        filter: (d) => d.quotes.filter((row) => row.status === "verified"),
      },
      {
        id: "quoted-job-cards",
        label: "Quoted JC",
        kind: "quotes",
        group: "jc",
        filter: (d) =>
          d.quotes.filter(
            (row) =>
              row.quoteType === "branch_labor" &&
              ["pending", "quoted", "approved", "negotiation", "accepted", "rejected"].includes(row.status)
          ),
      },
      {
        id: "quotation-pending",
        label: "Pending Quote",
        kind: "estimates",
        group: "jc",
        filter: (d) =>
          d.estimates.filter((row) => ["pending_approval", "draft"].includes(row.status ?? "")),
      },
      {
        id: "pending-insp",
        label: "Pending Insp.",
        kind: "inspections",
        group: "inspection",
        filter: () => pendingInspectionRows,
      },
      {
        id: "completed-insp",
        label: "Completed Insp.",
        kind: "inspections",
        group: "inspection",
        filter: () => latestInspectionRows.filter((row) => String(row.status ?? "").toLowerCase() === "completed"),
      },
      {
        id: "service-pending",
        label: "Service Pending",
        kind: "estimates",
        group: "service",
        filter: (d) => d.estimates.filter((row) => row.status === "pending_approval"),
      },
      {
        id: "service-completed",
        label: "Service Completed",
        kind: "estimates",
        group: "service",
        filter: (d) => d.estimates.filter((row) => row.status === "approved"),
      },
    ],
    [pendingInspectionRows, latestInspectionRows, latestBranchQuoteStatusByEstimateId]
  );

  const activeConfig = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const activeRows = activeConfig ? activeConfig.filter(data) : [];
  async function applyQuoteWorkflowAction(
    quoteId: string,
    action: "accepted" | "negotiation" | "rejected"
  ) {
    if (!quoteId) return;
    let negotiatedAmount: number | null = null;
    if (action === "negotiation") {
      const entered = window.prompt("Enter negotiated amount");
      if (entered === null) return;
      const amount = Number(entered);
      if (!Number.isFinite(amount) || amount <= 0) {
        window.alert("Enter a valid negotiated amount.");
        return;
      }
      negotiatedAmount = amount;
    }
    setQuoteWorkflowLoadingId(quoteId);
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/quotes/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowAction: action,
          negotiatedAmount,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      await load();
    } catch (err: any) {
      window.alert(err?.message ?? "Failed to update quote workflow.");
    } finally {
      setQuoteWorkflowLoadingId(null);
    }
  }

  function canVerifyCompletedJob(row: JobCardRow) {
    const completed = Boolean(row.complete_at) || String(row.status ?? "").toLowerCase() === "completed";
    if (!completed) return false;
    const quoteStatus = String(row.workshop_quote_status ?? "").toLowerCase();
    if (quoteStatus !== "accepted") return false;
    if (row.workshop_quote_verified_at) return false;
    return true;
  }

  async function openJobVerifyModal(row: JobCardRow) {
    if (!canVerifyCompletedJob(row)) return;
    setJobVerifyOpen(true);
    setJobVerifyRow(row);
    setJobVerifyDetails(null);
    setJobVerifyError(null);
    setJobVerifyVatRate(0);
    setJobVerifyCurrency(String(row.workshop_quote_currency ?? "USD"));
    setJobVerifyDetailsLoading(true);
    try {
      const [jobRes, settingsRes] = await Promise.all([
        fetch(`/api/company/${companyId}/workshop/job-cards/${row.id}`),
        fetch(`/api/company/${companyId}/workshop/cost-settings`),
      ]);
      const jobJson = await jobRes.json().catch(() => ({}));
      if (!jobRes.ok) throw new Error(jobJson?.error ?? "Failed to load job card details.");
      setJobVerifyDetails(jobJson?.data ?? null);
      if (settingsRes.ok) {
        const settingsJson = await settingsRes.json().catch(() => ({}));
        const settings = settingsJson?.data ?? {};
        setJobVerifyVatRate(Number(settings.vatRate ?? 0));
        setJobVerifyCurrency(String(row.workshop_quote_currency ?? settings.currency ?? "USD"));
      }
    } catch (err: any) {
      setJobVerifyError(err?.message ?? "Failed to load job card details.");
    } finally {
      setJobVerifyDetailsLoading(false);
    }
  }

  function closeJobVerifyModal() {
    setJobVerifyOpen(false);
    setJobVerifyRow(null);
    setJobVerifyDetails(null);
    setJobVerifyError(null);
    setJobVerifyDetailsLoading(false);
  }

  async function submitJobVerify() {
    if (!jobVerifyRow) return;
    if (!canVerifyCompletedJob(jobVerifyRow)) return;
    setJobVerifyLoadingId(jobVerifyRow.id);
    setJobVerifyError(null);
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/job-cards/${jobVerifyRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to verify job card.");
      await load();
      closeJobVerifyModal();
    } catch (err: any) {
      setJobVerifyError(err?.message ?? "Failed to verify job card.");
    } finally {
      setJobVerifyLoadingId(null);
    }
  }
  const rangeFilteredRows = useMemo(() => {
    if (activeTab !== "completed-insp" || activeConfig.kind !== "inspections") return activeRows;
    if (!completedDateFilterEnabled) return activeRows;
    const from = new Date(completedDateRange.startDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(completedDateRange.endDate);
    to.setHours(23, 59, 59, 999);
    return (activeRows as InspectionRow[]).filter((row) => {
      const raw =
        (row as any).completeAt ??
        (row as any).complete_at ??
        row.updatedAt ??
        (row as any).updated_at ??
        row.createdAt ??
        (row as any).created_at;
      if (!raw) return false;
      const value = new Date(raw);
      if (Number.isNaN(value.getTime())) return false;
      return value >= from && value <= to;
    });
  }, [activeConfig.kind, activeRows, activeTab, completedDateFilterEnabled, completedDateRange.endDate, completedDateRange.startDate]);

  const filteredRows = useMemo(() => {
    if (!query) return rangeFilteredRows;
    const q = query.toLowerCase();
    switch (activeConfig.kind) {
      case "jobCards":
        return (rangeFilteredRows as JobCardRow[]).filter((row) =>
          [
            row.id,
            row.customer_name,
            row.customer_phone,
            row.plate_number,
            row.make,
            row.model,
            row.branch_name,
            row.status,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(q)
        );
      case "estimates":
        return (rangeFilteredRows as Estimate[]).filter((row) =>
          [row.id, row.inspectionId, row.status].filter(Boolean).join(" ").toLowerCase().includes(q)
        );
      case "quotes":
        return (rangeFilteredRows as Quote[]).filter((row) =>
          [row.id, row.estimateId, row.workOrderId, row.status, row.quoteType]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(q)
        );
      case "inspections":
        return (rangeFilteredRows as InspectionRow[]).filter((row) =>
          [
            row.id,
            row.status,
            row.car?.plate_number,
            row.car?.make,
            row.car?.model,
            row.customer?.name,
            row.customer?.phone,
            row.branch?.display_name ?? row.branch?.name ?? row.branch?.code,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(q)
        );
      default:
        return rangeFilteredRows;
    }
  }, [activeConfig.kind, query, rangeFilteredRows]);

  const quotedJobCardGroups = useMemo<QuotedJobCardGroup[]>(() => {
    if (activeTab !== "quoted-job-cards" || activeConfig.kind !== "quotes") return [];
    const rows = filteredRows as Quote[];
    const groups = new Map<string, QuotedJobCardGroup>();
    rows.forEach((row) => {
      const meta = (row.meta ?? {}) as Record<string, unknown>;
      const metaJobCardId = typeof meta.jobCardId === "string" ? meta.jobCardId : null;
      const byEstimate = row.estimateId ? latestJobCardByEstimateId.get(row.estimateId) : null;
      const linkedJobCard = (metaJobCardId ? jobCardById.get(metaJobCardId) : null) ?? byEstimate ?? null;
      const key = linkedJobCard?.id ?? row.estimateId ?? row.id;
      const lead = linkedJobCard?.lead_id ? leadById.get(linkedJobCard.lead_id) : null;
      const updatedAt = row.updatedAt ?? row.createdAt ?? null;

      const existing = groups.get(key);
      if (existing) {
        existing.quotes.push(row);
        if (updatedAt && (!existing.updatedAt || new Date(updatedAt).getTime() > new Date(existing.updatedAt).getTime())) {
          existing.updatedAt = updatedAt;
        }
        return;
      }

      groups.set(key, {
        key,
        jobCardId: linkedJobCard?.id ?? null,
        estimateId: row.estimateId ?? null,
        carPlate: linkedJobCard?.plate_number ?? lead?.carPlateNumber ?? "N/A",
        carModel: [linkedJobCard?.make, linkedJobCard?.model].filter(Boolean).join(" ") || lead?.carModel || "N/A",
        workshopName: linkedJobCard?.branch_name ?? lead?.branchName ?? row.branchId ?? "Unassigned",
        updatedAt,
        quotes: [row],
      });
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        quotes: [...group.quotes].sort(
          (a, b) => new Date(b.updatedAt ?? b.createdAt ?? 0).getTime() - new Date(a.updatedAt ?? a.createdAt ?? 0).getTime()
        ),
      }))
      .sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime());
  }, [activeConfig.kind, activeTab, filteredRows, jobCardById, latestJobCardByEstimateId, leadById]);

  const activeQuotesModalGroup = useMemo(
    () => quotedJobCardGroups.find((group) => group.key === quotesModalGroupKey) ?? null,
    [quotedJobCardGroups, quotesModalGroupKey]
  );
  const visibleRecordsCount = activeTab === "quoted-job-cards" ? quotedJobCardGroups.length : filteredRows.length;

  function formatDate(value?: string | null) {
    if (!value) return "N/A";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "N/A";
    return date.toLocaleString();
  }

  function formatShortDate(value: Date) {
    return value.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  const completedDateButtonLabel = (() => {
    if (completedDatePreset) {
      return completedDatePresets.find((p) => p.id === completedDatePreset)?.label ?? "Date Range";
    }
    if (completedDateFilterEnabled) {
      return `${formatShortDate(completedDateRange.startDate)} - ${formatShortDate(completedDateRange.endDate)}`;
    }
    return "Date Range";
  })();

  function inspectionStatusBadgeClass(status?: string | null) {
    const value = (status ?? "").toLowerCase();
    if (value === "completed") return "bg-emerald-500/15 text-emerald-600";
    if (value === "pending") return "bg-amber-500/15 text-amber-600";
    if (value === "cancelled") return "bg-rose-500/15 text-rose-500";
    return "bg-muted text-foreground";
  }

  function verificationStatus(row: PendingInspectionRow) {
    if (row.cancelledAt || row.cancelledBy || row.status === "cancelled") return "Cancelled";
    if (row.verifiedAt || row.verifiedBy) return "Verified";
    return "Pending";
  }

  function isInspectionVerified(row: PendingInspectionRow) {
    return Boolean(row.verifiedAt || row.verifiedBy);
  }

  function verificationStatusBadgeClass(value: string) {
    const v = value.toLowerCase();
    if (v === "verified") return "bg-emerald-500/15 text-emerald-600";
    if (v === "cancelled") return "bg-rose-500/15 text-rose-500";
    return "bg-amber-500/15 text-amber-600";
  }

  const verifyLocked = Boolean(verifyInspection?.verifiedAt ?? verifyInspection?.verified_at);

  return (
    <MainPageShell
      title={title}
      subtitle={subtitle}
      scopeLabel=""
      contentClassName="rounded-2xl bg-card/80 p-4"
    >
      {state.status === "loading" && <p className="text-sm text-muted-foreground">Loading estimate quotes...</p>}
      {state.status === "error" && <p className="text-sm text-destructive">{state.error}</p>}
      {state.status === "loaded" && (
        <>
          <div className="overflow-x-auto px-4 py-3 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20">
            <div className="flex min-w-max flex-nowrap gap-2 text-xs">
            {tabs.map((tab, index) => (
              <React.Fragment key={tab.id}>
                {index > 0 && tabs[index - 1]?.group !== tab.group ? (
                  <span
                    className="my-1 h-6 w-px shrink-0 bg-white/20"
                    aria-hidden="true"
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`min-w-[96px] shrink-0 rounded-full px-4 py-1.5 text-[11px] font-medium transition ${
                    activeTab === tab.id
                      ? "bg-gradient-to-b from-emerald-500/30 to-emerald-500/10 text-emerald-100 shadow-[0_0_8px_rgba(16,185,129,0.35)] border border-emerald-400/40"
                      : "bg-white/5 text-white/70 border border-white/10 hover:text-white hover:border-white/30"
                  }`}
                >
                  {tab.label}
                </button>
              </React.Fragment>
            ))}
            </div>
          </div>
          <Card className="border-0 p-0 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button
                  type="button"
                  className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
                  onClick={() => load()}
                >
                  Refresh
                </button>
                <span className="text-xs text-muted-foreground">{visibleRecordsCount} records</span>
                {activeTab === "completed-insp" && (
                  <div className="relative ml-2">
                    <button
                      type="button"
                      onClick={() => setShowCompletedDatePicker((prev) => !prev)}
                      className="inline-flex items-center gap-2 rounded-md border border-cyan-300/50 bg-cyan-50 px-3 py-1.5 text-[11px] font-semibold text-cyan-800 shadow-sm transition hover:bg-cyan-100"
                    >
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
                        <path
                          d="M7 2v3M17 2v3M3.5 9.5h17M5 5h14a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 19 20H5A1.5 1.5 0 0 1 3.5 18.5v-12A1.5 1.5 0 0 1 5 5Z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {completedDateButtonLabel}
                    </button>
                    {(completedDateFilterEnabled || completedDatePreset) && (
                      <button
                        type="button"
                        onClick={() => {
                          setCompletedDateFilterEnabled(false);
                          setCompletedDatePreset(null);
                          setShowCompletedDatePicker(false);
                        }}
                        className="ml-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Clear
                      </button>
                    )}
                    {showCompletedDatePicker && (
                      <div className="absolute left-0 top-9 z-20 rounded-lg border border-slate-200 bg-white p-3 shadow-xl">
                        <div className="flex flex-col gap-3 md:flex-row">
                          <div className="grid grid-cols-2 gap-1 md:w-44 md:grid-cols-1">
                            {completedDatePresets.map((preset) => (
                              <button
                                key={preset.id}
                                type="button"
                                onClick={() => applyCompletedDatePreset(preset.id)}
                                className={`rounded-md px-2 py-1.5 text-left text-[11px] font-semibold transition ${
                                  completedDatePreset === preset.id
                                    ? "bg-cyan-600 text-white"
                                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                }`}
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                          <DateRange
                            onChange={(ranges: any) => {
                              const selection = ranges?.selection;
                              if (!selection?.startDate || !selection?.endDate) return;
                              setCompletedDatePreset(null);
                              setCompletedDateRange({
                                key: "selection",
                                startDate: selection.startDate,
                                endDate: selection.endDate,
                              });
                              setCompletedDateFilterEnabled(true);
                            }}
                            moveRangeOnFirstSelection={false}
                            ranges={[completedDateRange]}
                            rangeColors={["#06b6d4"]}
                            months={1}
                            direction="horizontal"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="relative w-full max-w-xs">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                    <path
                      d="M15.5 15.5L21 21M10.5 18a7.5 7.5 0 1 1 0-15a7.5 7.5 0 0 1 0 15Z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </div>
            </div>
            {(activeTab === "quoted-job-cards" ? quotedJobCardGroups.length === 0 : filteredRows.length === 0) ? (
              <div className="px-4 py-6 text-xs text-muted-foreground">No records found.</div>
            ) : (
              <>
                <div className="space-y-3 px-3 pb-3 pt-2 md:hidden">
                  {activeConfig.kind === "jobCards" &&
                    (filteredRows as JobCardRow[]).map((row) => (
                      <div key={row.id} className="rounded-xl border border-border/30 bg-background/70 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-primary">{row.id.slice(0, 8)}...</div>
                            <div className="text-[10px] uppercase text-muted-foreground">
                              Lead {row.lead_id?.slice(0, 8) ?? "-"}
                            </div>
                          </div>
                          <span className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-[10px] font-semibold uppercase text-foreground">
                            {row.status ?? "Pending"}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <div className="text-muted-foreground">Car</div>
                            <div>{row.plate_number ?? "N/A"}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Branch</div>
                            <div>{row.branch_name ?? "Unassigned"}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Start</div>
                            <div>{formatDate(row.start_at)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Complete</div>
                            <div>{formatDate(row.complete_at)}</div>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <a
                            href={`/company/${companyId}/workshop/job-cards/${row.id}`}
                            className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50"
                          >
                            Open
                          </a>
                          {activeTab === "completed" && canVerifyCompletedJob(row) ? (
                            <button
                              type="button"
                              onClick={() => openJobVerifyModal(row)}
                              disabled={jobVerifyLoadingId === row.id}
                              className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white transition hover:bg-emerald-500 disabled:opacity-60"
                            >
                              {jobVerifyLoadingId === row.id ? "Verifying..." : "Verify"}
                            </button>
                          ) : null}
                          {activeTab === "completed" && row.workshop_quote_verified_at ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold uppercase text-emerald-400">
                              Verified
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))}

                  {activeConfig.kind === "estimates" &&
                    (filteredRows as Estimate[]).map((row) => {
                      const lead = row.leadId ? leadById.get(row.leadId) : null;
                      const jobCard = latestJobCardByEstimateId.get(row.id);
                      return (
                        <div key={row.id} className="rounded-xl border border-border/30 bg-background/70 p-3">
                          {activeTab === "quotation-pending" ? (
                            <div className="flex items-start justify-end gap-3">
                              <span className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-[10px] font-semibold uppercase text-foreground">
                                {row.status.replace("_", " ")}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-3">
                              <div className="text-sm font-semibold text-primary">{row.id.slice(0, 8)}...</div>
                              <span className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-[10px] font-semibold uppercase text-foreground">
                                {row.status.replace("_", " ")}
                              </span>
                            </div>
                          )}
                          {activeTab === "quotation-pending" ? (
                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <div className="text-muted-foreground">Car</div>
                                <div>{lead?.carPlateNumber ?? "N/A"}</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">Model</div>
                                <div>{lead?.carModel ?? "N/A"}</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">Job ID</div>
                                <div>{jobCard?.id ? `JC-${jobCard.id.slice(0, 8)}...` : "-"}</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">Job Status</div>
                                <div className="uppercase">{jobCard?.status ?? "-"}</div>
                              </div>
                              <div className="col-span-2">
                                <div className="text-muted-foreground">Date</div>
                                <div>{formatDate(row.updatedAt)}</div>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <div className="text-muted-foreground">Inspection</div>
                                <div>{row.inspectionId.slice(0, 8)}...</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">Total</div>
                                <div>{row.grandTotal.toFixed(2)}</div>
                              </div>
                              <div className="col-span-2">
                                <div className="text-muted-foreground">Updated</div>
                                <div>{formatDate(row.updatedAt)}</div>
                              </div>
                            </div>
                          )}
                          <div className="mt-3">
                            <a
                              href={`/company/${companyId}/estimates/${row.id}`}
                              className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50"
                            >
                              Open
                            </a>
                          </div>
                        </div>
                      );
                    })}

                  {activeConfig.kind === "quotes" &&
                    (activeTab === "quoted-job-cards" ? quotedJobCardGroups : (filteredRows as Quote[])).map((entry: any) => {
                      if (activeTab === "quoted-job-cards") {
                        const group = entry as QuotedJobCardGroup;
                        return (
                          <div key={group.key} className="rounded-xl border border-border/30 bg-background/70 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="text-sm font-semibold text-primary">
                                {group.jobCardId ? `JC-${group.jobCardId.slice(0, 8)}...` : group.estimateId ? `EST-${group.estimateId.slice(0, 8)}...` : "Quoted Job"}
                              </div>
                              <span className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-[10px] font-semibold uppercase text-foreground">
                                {group.quotes.length} Quotes
                              </span>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <div className="text-muted-foreground">Car</div>
                                <div>{group.carPlate}</div>
                                <div className="text-[10px] text-muted-foreground">{group.carModel}</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">Workshop</div>
                                <div>{group.workshopName}</div>
                              </div>
                              <div className="col-span-2">
                                <div className="text-muted-foreground">Latest Update</div>
                                <div>{formatDate(group.updatedAt)}</div>
                              </div>
                            </div>
                            <div className="mt-3">
                              <button
                                type="button"
                                onClick={() => setQuotesModalGroupKey(group.key)}
                                className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50"
                              >
                                View Quotes
                              </button>
                            </div>
                          </div>
                        );
                      }
                      const row = entry as Quote;
                      const quoteHref =
                        row.quoteType === "branch_labor"
                          ? `/company/${companyId}/quotes/branch/${row.id}`
                          : `/company/${companyId}/quotes/vendor/${row.id}`;
                      const jobCard = row.estimateId ? latestJobCardByEstimateId.get(row.estimateId) : null;
                      const lead = jobCard?.lead_id ? leadById.get(jobCard.lead_id) : null;
                      const carPlate = jobCard?.plate_number ?? lead?.carPlateNumber ?? "N/A";
                      const carModel =
                        [jobCard?.make, jobCard?.model].filter(Boolean).join(" ") ||
                        lead?.carModel ||
                        "N/A";
                      const workshopName = jobCard?.branch_name ?? lead?.branchName ?? row.branchId ?? "Unassigned";
                      return (
                        <div key={row.id} className="rounded-xl border border-border/30 bg-background/70 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-sm font-semibold text-primary">{row.id.slice(0, 8)}...</div>
                            <span className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-[10px] font-semibold uppercase text-foreground">
                              {row.status}
                            </span>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <div className="text-muted-foreground">Car</div>
                              <div>{carPlate}</div>
                              <div className="text-[10px] text-muted-foreground">{carModel}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Workshop</div>
                              <div>{workshopName}</div>
                            </div>
                            <div className="col-span-2">
                              <div className="text-muted-foreground">Total</div>
                              <div>{row.totalAmount.toFixed(2)}</div>
                            </div>
                          </div>
                          <div className="mt-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <a
                                href={quoteHref}
                                className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50"
                              >
                                Open
                              </a>
                              {activeTab === "quoted-job-cards" ? (
                                <>
                                  {["pending", "quoted", "negotiation"].includes(String(row.status ?? "").toLowerCase()) ? (
                                    <>
                                      <button
                                        type="button"
                                        disabled={quoteWorkflowLoadingId === row.id}
                                        onClick={() => applyQuoteWorkflowAction(row.id, "accepted")}
                                        className="rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-semibold uppercase text-white disabled:opacity-60"
                                      >
                                        Accept
                                      </button>
                                      <button
                                        type="button"
                                        disabled={quoteWorkflowLoadingId === row.id}
                                        onClick={() => applyQuoteWorkflowAction(row.id, "negotiation")}
                                        className="rounded-md bg-amber-500 px-2 py-1 text-[10px] font-semibold uppercase text-slate-900 disabled:opacity-60"
                                      >
                                        Negotiate
                                      </button>
                                      <button
                                        type="button"
                                        disabled={quoteWorkflowLoadingId === row.id}
                                        onClick={() => applyQuoteWorkflowAction(row.id, "rejected")}
                                        className="rounded-md bg-rose-600 px-2 py-1 text-[10px] font-semibold uppercase text-white disabled:opacity-60"
                                      >
                                        Reject
                                      </button>
                                    </>
                                  ) : null}
                                </>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                  {activeConfig.kind === "inspections" &&
                    (filteredRows as PendingInspectionRow[]).map((row) => {
                      const hasInspection = row.hasInspection !== false;
                      const actionHref = hasInspection
                        ? `/company/${companyId}/inspections/${row.id}`
                        : row.leadId
                        ? `/company/${companyId}/leads/${row.leadId}`
                        : null;
                      return (
                        <div key={row.id} className="rounded-xl border border-border/30 bg-background/70 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-sm font-semibold text-primary">{row.id.slice(0, 8)}...</div>
                            <span className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-[10px] font-semibold uppercase text-foreground">
                              {row.status}
                            </span>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <div className="text-muted-foreground">Car</div>
                              <div>{row.car?.plate_number ?? "N/A"}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Customer</div>
                              <div>{row.customer?.name ?? "N/A"}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Location</div>
                              <div>{row.branch?.display_name ?? row.branch?.name ?? row.branch?.code ?? "N/A"}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Updated</div>
                              <div>{formatDate(row.updatedAt)}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Inspection Status</div>
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${inspectionStatusBadgeClass(
                                  row.status
                                )}`}
                              >
                                {row.status}
                              </span>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Verification Status</div>
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${verificationStatusBadgeClass(
                                  verificationStatus(row)
                                )}`}
                              >
                                {verificationStatus(row)}
                              </span>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {!isInspectionVerified(row) ? (
                              <>
                                {actionHref && hasInspection ? (
                                  <a
                                    href={actionHref}
                                    className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm transition hover:bg-blue-500"
                                  >
                                    Open
                                  </a>
                                ) : null}
                                {actionHref && hasInspection ? (
                                  <button
                                    type="button"
                                    onClick={() => openVerifyModal(row)}
                                    className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm transition hover:bg-emerald-500"
                                  >
                                    Verify
                                  </button>
                                ) : null}
                                {row.leadId ? (
                                  <button
                                    type="button"
                                    onClick={() => openAssignModal(row.leadId)}
                                    className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm transition hover:bg-indigo-500"
                                  >
                                    {hasInspection ? "Reassign" : "Assign"}
                                  </button>
                                ) : null}
                              </>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">No actions</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  {activeConfig.kind === "jobCards" ? (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-xs text-muted-foreground">
                    <th className="py-2 pl-3 pr-4 text-left">Job Card</th>
                    <th className="py-2 px-4 text-left">Car</th>
                    <th className="py-2 px-4 text-left">Branch</th>
                    <th className="py-2 px-4 text-left">Status</th>
                    <th className="py-2 px-4 text-left">Start</th>
                    <th className="py-2 px-4 text-left">Completed</th>
                    <th className="py-2 px-4 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(filteredRows as JobCardRow[]).map((row) => (
                    <tr key={row.id}>
                      <td className="py-2 pl-3 pr-4">
                        <div className="font-medium">{row.id.slice(0, 8)}...</div>
                        <div className="text-[10px] uppercase text-muted-foreground">
                          Lead {row.lead_id?.slice(0, 8) ?? "-"}
                        </div>
                      </td>
                      <td className="py-2 px-4 text-xs">
                        <div>{row.plate_number ?? "N/A"}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {[row.make, row.model].filter(Boolean).join(" ")}
                        </div>
                      </td>
                      <td className="py-2 px-4 text-xs">{row.branch_name ?? "Unassigned"}</td>
                      <td className="py-2 px-4 text-xs capitalize">{row.status ?? "Pending"}</td>
                      <td className="py-2 px-4 text-xs text-muted-foreground">{formatDate(row.start_at)}</td>
                      <td className="py-2 px-4 text-xs text-muted-foreground">{formatDate(row.complete_at)}</td>
                      <td className="py-2 px-4 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={`/company/${companyId}/workshop/job-cards/${row.id}`}
                            className="rounded-md border px-2 py-1"
                          >
                            Open
                          </a>
                          {activeTab === "completed" && canVerifyCompletedJob(row) ? (
                            <button
                              type="button"
                              onClick={() => openJobVerifyModal(row)}
                              disabled={jobVerifyLoadingId === row.id}
                              className="rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-semibold uppercase text-white disabled:opacity-60"
                            >
                              {jobVerifyLoadingId === row.id ? "Verifying..." : "Verify"}
                            </button>
                          ) : null}
                          {activeTab === "completed" && row.workshop_quote_verified_at ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-400">
                              Verified
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : activeConfig.kind === "estimates" ? (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-xs text-muted-foreground">
                    {activeTab === "quotation-pending" ? (
                      <>
                        <th className="py-2 px-4 text-left">Car Details</th>
                        <th className="py-2 px-4 text-left">Job Details</th>
                        <th className="py-2 px-4 text-left">Date</th>
                      </>
                    ) : (
                      <>
                        <th className="py-2 pl-3 pr-4 text-left">Estimate</th>
                        <th className="py-2 px-4 text-left">Inspection</th>
                        <th className="py-2 px-4 text-left">Status</th>
                        <th className="py-2 px-4 text-left">Grand Total</th>
                        <th className="py-2 px-4 text-left">Updated</th>
                      </>
                    )}
                    <th className="py-2 px-4 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(filteredRows as Estimate[]).map((row) => {
                    const lead = row.leadId ? leadById.get(row.leadId) : null;
                    const jobCard = latestJobCardByEstimateId.get(row.id);
                    return (
                      <tr key={row.id}>
                        {activeTab === "quotation-pending" ? (
                          <>
                            <td className="py-2 px-4 text-xs">
                              <div>{lead?.carPlateNumber ?? "N/A"}</div>
                              <div className="text-[10px] text-muted-foreground">{lead?.carModel ?? "N/A"}</div>
                            </td>
                            <td className="py-2 px-4 text-xs">
                              <div>{jobCard?.id ? `JC-${jobCard.id.slice(0, 8)}...` : "-"}</div>
                              <div className="text-[10px] uppercase text-muted-foreground">{jobCard?.status ?? "-"}</div>
                            </td>
                            <td className="py-2 px-4 text-xs text-muted-foreground">{formatDate(row.updatedAt)}</td>
                          </>
                        ) : (
                          <>
                            <td className="py-2 px-4 text-xs">{row.inspectionId.slice(0, 8)}...</td>
                            <td className="py-2 px-4 text-xs capitalize">{row.status.replace("_", " ")}</td>
                            <td className="py-2 px-4 text-xs">{row.grandTotal.toFixed(2)}</td>
                            <td className="py-2 px-4 text-xs text-muted-foreground">{formatDate(row.updatedAt)}</td>
                          </>
                        )}
                        <td className="py-2 px-4 text-xs">
                          <a
                            href={`/company/${companyId}/estimates/${row.id}`}
                            className="rounded-md border px-2 py-1"
                          >
                            Open
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : activeConfig.kind === "quotes" ? (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-xs text-muted-foreground">
                    <th className="py-2 pl-3 pr-4 text-left">{activeTab === "quoted-job-cards" ? "Job Card" : "Quote"}</th>
                    <th className="py-2 px-4 text-left">Car Details</th>
                    <th className="py-2 px-4 text-left">Workshop</th>
                    <th className="py-2 px-4 text-left">{activeTab === "quoted-job-cards" ? "Quotes" : "Status"}</th>
                    <th className="py-2 px-4 text-left">{activeTab === "quoted-job-cards" ? "Latest Quote" : "Total"}</th>
                    <th className="py-2 px-4 text-left">Updated</th>
                    <th className="py-2 px-4 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(activeTab === "quoted-job-cards" ? quotedJobCardGroups : (filteredRows as Quote[])).map((entry: any) => {
                    if (activeTab === "quoted-job-cards") {
                      const group = entry as QuotedJobCardGroup;
                      const latest = group.quotes[0];
                      return (
                        <tr key={group.key}>
                          <td className="py-2 pl-3 pr-4">
                            <div className="font-medium">
                              {group.jobCardId ? `JC-${group.jobCardId.slice(0, 8)}...` : group.estimateId ? `EST-${group.estimateId.slice(0, 8)}...` : "-"}
                            </div>
                          </td>
                          <td className="py-2 px-4 text-xs">
                            <div>{group.carPlate}</div>
                            <div className="text-[10px] text-muted-foreground">{group.carModel}</div>
                          </td>
                          <td className="py-2 px-4 text-xs">{group.workshopName}</td>
                          <td className="py-2 px-4 text-xs">{group.quotes.length}</td>
                          <td className="py-2 px-4 text-xs">
                            {(latest?.currency ?? "AED")} {Number(latest?.totalAmount ?? 0).toFixed(2)}
                          </td>
                          <td className="py-2 px-4 text-xs text-muted-foreground">{formatDate(group.updatedAt)}</td>
                          <td className="py-2 px-4 text-xs">
                            <button
                              type="button"
                              onClick={() => setQuotesModalGroupKey(group.key)}
                              className="rounded-md border px-2 py-1"
                            >
                              View Quotes
                            </button>
                          </td>
                        </tr>
                      );
                    }
                    const row = entry as Quote;
                    const quoteHref =
                      row.quoteType === "branch_labor"
                        ? `/company/${companyId}/quotes/branch/${row.id}`
                        : `/company/${companyId}/quotes/vendor/${row.id}`;
                    const jobCard = row.estimateId ? latestJobCardByEstimateId.get(row.estimateId) : null;
                    const lead = jobCard?.lead_id ? leadById.get(jobCard.lead_id) : null;
                    const carPlate = jobCard?.plate_number ?? lead?.carPlateNumber ?? "N/A";
                    const carModel =
                      [jobCard?.make, jobCard?.model].filter(Boolean).join(" ") ||
                      lead?.carModel ||
                      "N/A";
                    const workshopName = jobCard?.branch_name ?? lead?.branchName ?? row.branchId ?? "Unassigned";
                    return (
                      <tr key={row.id}>
                        <td className="py-2 pl-3 pr-4">
                          <div className="font-medium">{row.id.slice(0, 8)}...</div>
                        </td>
                        <td className="py-2 px-4 text-xs">
                          <div>{carPlate}</div>
                          <div className="text-[10px] text-muted-foreground">{carModel}</div>
                        </td>
                        <td className="py-2 px-4 text-xs">{workshopName}</td>
                        <td className="py-2 px-4 text-xs capitalize">{row.status}</td>
                        <td className="py-2 px-4 text-xs">{row.totalAmount.toFixed(2)}</td>
                        <td className="py-2 px-4 text-xs text-muted-foreground">{formatDate(row.updatedAt)}</td>
                        <td className="py-2 px-4 text-xs">
                          <div className="flex flex-wrap items-center gap-2">
                            <a href={quoteHref} className="rounded-md border px-2 py-1">
                              Open
                            </a>
                            {activeTab === "quoted-job-cards" ? (
                              <>
                                {["pending", "quoted", "negotiation"].includes(String(row.status ?? "").toLowerCase()) ? (
                                  <>
                                    <button
                                      type="button"
                                      disabled={quoteWorkflowLoadingId === row.id}
                                      onClick={() => applyQuoteWorkflowAction(row.id, "accepted")}
                                      className="rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-semibold uppercase text-white disabled:opacity-60"
                                    >
                                      Accept
                                    </button>
                                    <button
                                      type="button"
                                      disabled={quoteWorkflowLoadingId === row.id}
                                      onClick={() => applyQuoteWorkflowAction(row.id, "negotiation")}
                                      className="rounded-md bg-amber-500 px-2 py-1 text-[10px] font-semibold uppercase text-slate-900 disabled:opacity-60"
                                    >
                                      Negotiate
                                    </button>
                                    <button
                                      type="button"
                                      disabled={quoteWorkflowLoadingId === row.id}
                                      onClick={() => applyQuoteWorkflowAction(row.id, "rejected")}
                                      className="rounded-md bg-rose-600 px-2 py-1 text-[10px] font-semibold uppercase text-white disabled:opacity-60"
                                    >
                                      Reject
                                    </button>
                                  </>
                                ) : null}
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-xs text-muted-foreground">
                    <th className="py-2 pl-3 pr-4 text-left">Inspection</th>
                    <th className="py-2 px-4 text-left">Car</th>
                    <th className="py-2 px-4 text-left">Customer</th>
                    <th className="py-2 px-4 text-left">Location</th>
                    <th className="py-2 px-4 text-left">Inspection Status</th>
                    <th className="py-2 px-4 text-left">Verification Status</th>
                    <th className="py-2 px-4 text-left">Updated</th>
                    <th className="py-2 px-4 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(filteredRows as PendingInspectionRow[]).map((row) => {
                    const hasInspection = row.hasInspection !== false;
                    const actionHref = hasInspection
                      ? `/company/${companyId}/inspections/${row.id}`
                      : row.leadId
                      ? `/company/${companyId}/leads/${row.leadId}`
                      : null;
                    return (
                      <tr key={row.id}>
                        <td className="py-2 pl-3 pr-4">
                          <div className="font-medium">{row.id.slice(0, 8)}...</div>
                        </td>
                        <td className="py-2 px-4 text-xs">
                          <div>{row.car?.plate_number ?? "N/A"}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {[row.car?.make, row.car?.model].filter(Boolean).join(" ")}
                          </div>
                        </td>
                        <td className="py-2 px-4 text-xs">
                          <div>{row.customer?.name ?? "N/A"}</div>
                          <div className="text-[10px] text-muted-foreground">{row.customer?.phone ?? ""}</div>
                        </td>
                        <td className="py-2 px-4 text-xs">
                          {row.branch?.display_name ?? row.branch?.name ?? row.branch?.code ?? "N/A"}
                        </td>
                        <td className="py-2 px-4 text-xs">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${inspectionStatusBadgeClass(
                              row.status
                            )}`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="py-2 px-4 text-xs">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${verificationStatusBadgeClass(
                              verificationStatus(row)
                            )}`}
                          >
                            {verificationStatus(row)}
                          </span>
                        </td>
                        <td className="py-2 px-4 text-xs text-muted-foreground">{formatDate(row.updatedAt)}</td>
                        <td className="py-2 px-4 text-xs">
                          <div className="flex flex-row flex-wrap items-center gap-2">
                            {!isInspectionVerified(row) ? (
                              <>
                                {actionHref && hasInspection ? (
                                  <a
                                    href={actionHref}
                                    className="rounded-md bg-blue-600 px-2 py-1 text-center text-white transition hover:bg-blue-500"
                                  >
                                    Open
                                  </a>
                                ) : null}
                                {actionHref && hasInspection ? (
                                  <button
                                    type="button"
                                    onClick={() => openVerifyModal(row)}
                                    className="rounded-md bg-emerald-600 px-2 py-1 text-white transition hover:bg-emerald-500"
                                  >
                                    Verify
                                  </button>
                                ) : null}
                                {row.leadId ? (
                                  <button
                                    type="button"
                                    onClick={() => openAssignModal(row.leadId)}
                                    className="rounded-md bg-indigo-600 px-2 py-1 text-white transition hover:bg-indigo-500"
                                  >
                                    {hasInspection ? "Reassign" : "Assign"}
                                  </button>
                                ) : null}
                                {!actionHref && !row.leadId ? <span>-</span> : null}
                              </>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
                </div>
              </>
            )}
        </Card>
      </>
      )}
      {jobVerifyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className={`w-full max-w-4xl rounded-xl shadow-xl ${theme.cardBg} ${theme.cardBorder}`}>
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <div className="text-sm font-semibold">Verify Job Card</div>
                <div className="text-xs text-muted-foreground">Review job details before final verification.</div>
              </div>
              <button
                type="button"
                onClick={closeJobVerifyModal}
                className={`rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-white/10`}
              >
                Close
              </button>
            </div>
            <div className="max-h-[70vh] space-y-3 overflow-auto p-4 text-sm">
              {jobVerifyError ? (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                  {jobVerifyError}
                </div>
              ) : null}
              {jobVerifyDetailsLoading ? (
                <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-muted-foreground">
                  Loading job details...
                </div>
              ) : null}
              {!jobVerifyDetailsLoading && jobVerifyRow ? (
                <>
                  {(() => {
                    const quoteAmount = Number((jobVerifyRow as any).workshop_quote_total_amount ?? 0);
                    const vatAmount = Number((quoteAmount * (jobVerifyVatRate / 100)).toFixed(2));
                    const netAmount = Number((quoteAmount + vatAmount).toFixed(2));
                    return (
                      <div className="grid gap-2 text-xs md:grid-cols-4">
                        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Quote Amount</div>
                          <div className="mt-1 font-semibold">
                            {jobVerifyCurrency} {quoteAmount.toFixed(2)}
                          </div>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">VAT Rate</div>
                          <div className="mt-1 font-semibold">{jobVerifyVatRate.toFixed(2)}%</div>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">VAT Amount</div>
                          <div className="mt-1 font-semibold">
                            {jobVerifyCurrency} {vatAmount.toFixed(2)}
                          </div>
                        </div>
                        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                          <div className="text-[10px] uppercase tracking-wide text-emerald-300/80">Net Payable</div>
                          <div className="mt-1 font-semibold text-emerald-300">
                            {jobVerifyCurrency} {netAmount.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="grid gap-2 text-xs md:grid-cols-4">
                    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Job Card</div>
                      <div className="mt-1 font-semibold">{jobVerifyRow.id.slice(0, 8)}...</div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Status</div>
                      <div className="mt-1 font-semibold uppercase">{jobVerifyRow.status ?? "-"}</div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Start</div>
                      <div className="mt-1">{formatDate(jobVerifyRow.start_at)}</div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Completed</div>
                      <div className="mt-1">{formatDate(jobVerifyRow.complete_at)}</div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 md:col-span-2">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Car</div>
                      <div className="mt-1 font-semibold">{jobVerifyRow.plate_number ?? "N/A"}</div>
                      <div className="text-[10px] text-muted-foreground">{[jobVerifyRow.make, jobVerifyRow.model].filter(Boolean).join(" ")}</div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Workshop</div>
                      <div className="mt-1">{jobVerifyRow.branch_name ?? "Unassigned"}</div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Quote Status</div>
                      <div className="mt-1 uppercase">{jobVerifyRow.workshop_quote_status ?? "-"}</div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Line Items</div>
                    {Array.isArray(jobVerifyDetails?.items) && jobVerifyDetails.items.length ? (
                      <div className="overflow-auto rounded-md border border-white/10">
                        <table className="min-w-full text-xs">
                          <thead>
                            <tr className="bg-white/[0.04] text-muted-foreground">
                              <th className="px-2 py-2 text-left">Part</th>
                              <th className="px-2 py-2 text-left">Qty</th>
                              <th className="px-2 py-2 text-left">Order Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {jobVerifyDetails.items.map((item: any) => (
                              <tr key={item.id} className="border-t border-white/10">
                                <td className="px-2 py-2">{item.product_name ?? item.productName ?? "-"}</td>
                                <td className="px-2 py-2">{item.quantity ?? "-"}</td>
                                <td className="px-2 py-2 uppercase">{item.po_status ?? item.order_status ?? "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">No line items found.</div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-white/10 px-4 py-3">
              <button
                type="button"
                onClick={closeJobVerifyModal}
                className={`rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-white/10`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitJobVerify}
                disabled={
                  !jobVerifyRow ||
                  !canVerifyCompletedJob(jobVerifyRow) ||
                  jobVerifyLoadingId === jobVerifyRow.id ||
                  jobVerifyDetailsLoading
                }
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white disabled:opacity-60"
              >
                {jobVerifyRow && jobVerifyLoadingId === jobVerifyRow.id ? "Verifying..." : "Verify Job Card"}
              </button>
            </div>
          </Card>
        </div>
      )}
      {activeQuotesModalGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className={`w-full max-w-4xl rounded-xl shadow-xl ${theme.cardBg} ${theme.cardBorder}`}>
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <div className="text-sm font-semibold">Quotes for {activeQuotesModalGroup.jobCardId ? `JC-${activeQuotesModalGroup.jobCardId.slice(0, 8)}...` : "Job"}</div>
                <div className="text-xs text-muted-foreground">
                  {activeQuotesModalGroup.carPlate} | {activeQuotesModalGroup.carModel} | {activeQuotesModalGroup.workshopName}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuotesModalGroupKey(null)}
                className={`rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-white/10`}
              >
                Close
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto p-4">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-xs text-muted-foreground">
                    <th className="py-2 px-3 text-left">Quote</th>
                    <th className="py-2 px-3 text-left">Status</th>
                    <th className="py-2 px-3 text-left">Total</th>
                    <th className="py-2 px-3 text-left">Updated</th>
                    <th className="py-2 px-3 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeQuotesModalGroup.quotes.map((row) => {
                    const quoteHref =
                      row.quoteType === "branch_labor"
                        ? `/company/${companyId}/quotes/branch/${row.id}`
                        : `/company/${companyId}/quotes/vendor/${row.id}`;
                    return (
                      <tr key={row.id}>
                        <td className="py-2 px-3 text-xs font-medium">{row.id.slice(0, 8)}...</td>
                        <td className="py-2 px-3 text-xs capitalize">{row.status}</td>
                        <td className="py-2 px-3 text-xs">
                          {(row.currency ?? "AED")} {Number(row.totalAmount ?? 0).toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-xs text-muted-foreground">{formatDate(row.updatedAt)}</td>
                        <td className="py-2 px-3 text-xs">
                          <div className="flex flex-wrap items-center gap-2">
                            <a href={quoteHref} className="rounded-md border px-2 py-1">
                              Open
                            </a>
                            {["pending", "quoted", "negotiation"].includes(String(row.status ?? "").toLowerCase()) ? (
                              <>
                                <button
                                  type="button"
                                  disabled={quoteWorkflowLoadingId === row.id}
                                  onClick={() => applyQuoteWorkflowAction(row.id, "accepted")}
                                  className="rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-semibold uppercase text-white disabled:opacity-60"
                                >
                                  Accept
                                </button>
                                <button
                                  type="button"
                                  disabled={quoteWorkflowLoadingId === row.id}
                                  onClick={() => applyQuoteWorkflowAction(row.id, "negotiation")}
                                  className="rounded-md bg-amber-500 px-2 py-1 text-[10px] font-semibold uppercase text-slate-900 disabled:opacity-60"
                                >
                                  Negotiate
                                </button>
                                <button
                                  type="button"
                                  disabled={quoteWorkflowLoadingId === row.id}
                                  onClick={() => applyQuoteWorkflowAction(row.id, "rejected")}
                                  className="rounded-md bg-rose-600 px-2 py-1 text-[10px] font-semibold uppercase text-white disabled:opacity-60"
                                >
                                  Reject
                                </button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
      {verifyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-[2px] p-3 sm:p-5">
          <Card className={`w-full max-w-4xl rounded-2xl shadow-2xl ${theme.cardBg} ${theme.cardBorder}`}>
            <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div>
                <div className="text-base font-semibold">Inspection Verification</div>
                <div className="mt-0.5 text-xs text-muted-foreground">Review inspection report and finalize verification.</div>
              </div>
              <button
                type="button"
                onClick={closeVerifyModal}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-white/10`}
              >
                Close
              </button>
            </div>
            <div className="max-h-[78vh] space-y-4 overflow-y-auto p-5 text-sm">
              {verifyError && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{verifyError}</div>}
              {verifyLoading ? <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-muted-foreground">Loading inspection report...</div> : null}
              {!verifyLoading && verifyInspection ? (
                <>
                  <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Inspection</div>
                      <div className="mt-1 font-semibold">{verifyInspection.id?.slice(0, 8)}...</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Status</div>
                      <div className="mt-1 font-semibold uppercase">{verifyInspection.status ?? "pending"}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Advisor Approval</div>
                      <div className={`mt-1 font-semibold ${verifyInspection?.draftPayload?.advisorApproved ? "text-emerald-300" : "text-amber-300"}`}>
                        {verifyInspection?.draftPayload?.advisorApproved ? "Approved" : "Pending"}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Customer Approval</div>
                      <div className={`mt-1 font-semibold ${verifyInspection?.draftPayload?.customerApproved ? "text-emerald-300" : "text-amber-300"}`}>
                        {verifyInspection?.draftPayload?.customerApproved ? "Approved" : "Pending"}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Line Items</div>
                    {verifyLineItems.length === 0 ? (
                      <div className="text-xs text-muted-foreground">No line items found.</div>
                    ) : (
                      <div className="max-h-52 overflow-auto rounded-lg border border-white/10">
                        <table className="min-w-full text-xs">
                          <thead>
                            <tr className="bg-white/[0.04] text-muted-foreground">
                              <th className="px-2 py-2 text-left">Part</th>
                              <th className="px-2 py-2 text-left">Qty</th>
                              <th className="px-2 py-2 text-left">Reason</th>
                              <th className="px-2 py-2 text-left">Media</th>
                            </tr>
                          </thead>
                          <tbody>
                            {verifyLineItems.map((item) => (
                              <tr key={item.id} className="border-t border-white/10">
                                <td className="px-2 py-2">{item.productName ?? item.product_name ?? "-"}</td>
                                <td className="px-2 py-2">{item.quantity ?? 1}</td>
                                <td className="px-2 py-2">{item.reason ?? "-"}</td>
                                <td className="px-2 py-2">
                                  {(item.mediaFileId ?? item.media_file_id) ? (
                                    <a
                                      href={`/api/files/${item.mediaFileId ?? item.media_file_id}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-primary hover:underline"
                                    >
                                      Open
                                    </a>
                                  ) : (
                                    "-"
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Videos</div>
                    {verifyVideos.length === 0 ? (
                      <div className="text-xs text-muted-foreground">No videos attached.</div>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2">
                        {verifyVideos.map((fileId) => (
                          <video key={fileId} className="h-32 w-full rounded-lg border border-white/10 bg-black/20" controls src={`/api/files/${fileId}`} />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Earnings Preview</div>
                    <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
                      <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                        <div className="text-muted-foreground">Fixed Fee</div>
                        <div className="font-semibold mt-0.5">
                          {costSettings.currency} {Number(costSettings.inspectionFixedAmount || 0).toFixed(2)}
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                        <div className="text-muted-foreground">Fine Total</div>
                        <div className="font-semibold text-rose-300 mt-0.5">
                          {costSettings.currency} {fineTotal.toFixed(2)}
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                        <div className="text-muted-foreground">Net Before VAT</div>
                        <div className="font-semibold mt-0.5">
                          {costSettings.currency} {netBeforeVat.toFixed(2)}
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                        <div className="text-muted-foreground">VAT ({Number(costSettings.vatRate || 0).toFixed(2)}%)</div>
                        <div className="font-semibold mt-0.5">
                          {costSettings.currency} {vatAmount.toFixed(2)}
                        </div>
                      </div>
                      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                        <div className="text-muted-foreground">Total Payable</div>
                        <div className="font-semibold text-emerald-300 mt-0.5">
                          {costSettings.currency} {totalPayable.toFixed(2)}
                        </div>
                      </div>
                      {verifyEarning ? (
                        <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2">
                          <div className="text-muted-foreground">Saved</div>
                          <div className="font-semibold text-cyan-300 mt-0.5">Yes</div>
                        </div>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Fines</div>
                      {verifyFines.length === 0 ? (
                        <div className="text-xs text-muted-foreground">No fines added.</div>
                      ) : null}
                      {verifyFines.map((fine) => (
                        <div key={fine.id} className="grid gap-2 md:grid-cols-12">
                          <input
                            className={`${theme.input} md:col-span-9`}
                            placeholder="Reason"
                            value={fine.reason}
                            readOnly={verifyLocked}
                            onChange={(e) =>
                              setVerifyFines((prev) => prev.map((row) => (row.id === fine.id ? { ...row, reason: e.target.value } : row)))
                            }
                          />
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className={`${theme.input} md:col-span-2`}
                            placeholder="Amount"
                            value={fine.amount}
                            readOnly={verifyLocked}
                            onChange={(e) =>
                              setVerifyFines((prev) => prev.map((row) => (row.id === fine.id ? { ...row, amount: e.target.value } : row)))
                            }
                          />
                          <button
                            type="button"
                            className="rounded-lg bg-rose-600/90 px-2 py-2 text-xs font-semibold text-white md:col-span-1"
                            disabled={verifyLocked}
                            onClick={() => setVerifyFines((prev) => prev.filter((row) => row.id !== fine.id))}
                          >
                            X
                          </button>
                        </div>
                      ))}
                      {!verifyLocked ? (
                        <button
                          type="button"
                          className="rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-cyan-200 hover:bg-cyan-500/20"
                          onClick={() =>
                            setVerifyFines((prev) => [
                              ...prev,
                              { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, reason: "", amount: "" },
                            ])
                          }
                        >
                          Add Fine
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <label className={`text-xs font-semibold ${theme.mutedText}`}>Cancel remarks (optional)</label>
                    <textarea
                      className={`${theme.input} min-h-24`}
                      placeholder="Reason for cancellation"
                      value={cancelRemarks}
                      readOnly={verifyLocked}
                      onChange={(e) => setCancelRemarks(e.target.value)}
                    />
                  </div>
                </>
              ) : null}
            </div>
            <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t border-white/10 bg-black/20 px-5 py-4 backdrop-blur">
                <button
                  type="button"
                  className={`rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-white/10`}
                  onClick={closeVerifyModal}
                >
                  Close
                </button>
                {!verifyLocked ? (
                  <>
                    <button
                      type="button"
                      className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-50"
                      disabled={verifySubmitting || verifyLoading || !verifyInspection || verifyInspection?.status === "cancelled"}
                      onClick={submitCancelInspection}
                    >
                      {verifySubmitting ? "Processing..." : "Cancel Inspection"}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-50"
                      disabled={
                        verifySubmitting ||
                        verifyLoading ||
                        !verifyInspection ||
                        String(verifyInspection?.status ?? "").toLowerCase() !== "completed" ||
                        !verifyInspection?.draftPayload?.advisorApproved ||
                        !verifyInspection?.draftPayload?.customerApproved
                      }
                      onClick={submitVerify}
                    >
                      {verifySubmitting ? "Processing..." : "Verify"}
                    </button>
                  </>
                ) : null}
            </div>
          </Card>
        </div>
      )}
      {assignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className={`w-full max-w-lg rounded-xl shadow-xl ${theme.cardBg} ${theme.cardBorder}`}>
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="text-sm font-semibold">Assign Workshop Branch</div>
              <button
                type="button"
                onClick={closeAssignModal}
                className={`rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-white/10`}
              >
                Close
              </button>
            </div>
            <div className="space-y-4 p-4 text-sm">
              {assignError && <div className="text-sm text-red-400">{assignError}</div>}
              <div className="space-y-2">
                <label className={`text-xs font-semibold ${theme.mutedText}`}>Workshop Branch</label>
                <select
                  className={theme.input}
                  value={assignBranchId ?? ""}
                  onChange={(e) => setAssignBranchId(e.target.value || null)}
                >
                  <option value="">Select branch</option>
                  {assignBranches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.display_name ?? branch.name ?? branch.code ?? branch.id}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className={`rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-white/10`}
                  onClick={closeAssignModal}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-md bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary-foreground"
                  disabled={assignLoading || !assignBranchId}
                  onClick={submitAssign}
                >
                  {assignLoading ? "Assigning..." : "Assign"}
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </MainPageShell>
  );
}
