"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { Lead } from "@repo/ai-core/crm/leads/types";
import { formatStageLabel } from "@repo/ai-core/crm/leads/jobFlows";
import { MainPageShell } from "./MainPageShell";
import { Card } from "../components/Card";
import { LeadStatusBadge } from "../components/leads/LeadBadges";
import { FileUploader } from "../components/FileUploader";
import { useTheme } from "../theme";

type CarInDashboardMainProps = {
  companyId: string;
  companyName?: string;
};

type LoadState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "loaded"; data: T; error: null }
  | { status: "error"; data: null; error: string };

export function CarInDashboardMain({ companyId, companyName }: CarInDashboardMainProps) {
  const { theme } = useTheme();
  const [state, setState] = useState<LoadState<Lead[]>>({
    status: "loading",
    data: null,
    error: null,
  });
  const [query, setQuery] = useState("");
  const [inspectionByLead, setInspectionByLead] = useState<
    Record<string, { id: string; startedAt?: string | null; completedAt?: string | null }>
  >({});
  const [estimateByLead, setEstimateByLead] = useState<
    Record<string, { id: string; status?: string | null; inspectionId?: string | null }>
  >({});
  const [jobCardByLead, setJobCardByLead] = useState<
    Record<string, { id: string; status?: string | null; startAt?: string | null; completeAt?: string | null }>
  >({});
  const [partsByLead, setPartsByLead] = useState<
    Record<string, { orderedCount: number; receivedCount: number; approvedSparePendingCount: number }>
  >({});
  const [invoiceByLead, setInvoiceByLead] = useState<
    Record<
      string,
      {
        id: string;
        status?: string | null;
        invoiceNumber?: string | null;
        grandTotal?: number | null;
      }
    >
  >({});
  const [partsModal, setPartsModal] = useState<{ leadId: string; parts: any[] } | null>(null);
  const [partsLoading, setPartsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupCustomerId, setTopupCustomerId] = useState<string | null>(null);
  const [topupForm, setTopupForm] = useState({
    amount: "",
    method: "cash",
    paymentDate: "",
    proofFileId: "",
  });
  const [topupSaving, setTopupSaving] = useState(false);
  const [topupError, setTopupError] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payInvoice, setPayInvoice] = useState<{ invoiceId: string; leadId: string; amount: number } | null>(null);
  const [paySaving, setPaySaving] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignLeadId, setAssignLeadId] = useState<string | null>(null);
  const [assignBranchId, setAssignBranchId] = useState<string | null>(null);
  const [assignBranches, setAssignBranches] = useState<any[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ status: "loading", data: null, error: null });
    try {
      const res = await fetch(`/api/company/${companyId}/sales/leads`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const leads: Lead[] = json.data ?? [];
      setState({ status: "loaded", data: leads, error: null });
      try {
        const inspectionsRes = await fetch(`/api/company/${companyId}/workshop/inspections`);
        if (!inspectionsRes.ok) throw new Error("Failed to load inspections");
        const inspectionsJson = await inspectionsRes.json();
        const inspections = inspectionsJson.data ?? [];
        const map: Record<string, { id: string; startedAt?: string | null; completedAt?: string | null }> = {};
        inspections.forEach((insp: any) => {
          if (insp.leadId && insp.id) {
            map[insp.leadId] = {
              id: insp.id,
              startedAt: insp.startAt ?? insp.start_at ?? null,
              completedAt: insp.completeAt ?? insp.complete_at ?? null,
              branchName: insp.branch?.display_name ?? insp.branch?.name ?? insp.branch?.code ?? null,
            };
          }
        });
        setInspectionByLead(map);
      } catch (err) {
        setInspectionByLead({});
      }
      try {
        const estimatesRes = await fetch(`/api/company/${companyId}/workshop/estimates`);
        if (!estimatesRes.ok) throw new Error("Failed to load estimates");
        const estimatesJson = await estimatesRes.json();
        const estimates = estimatesJson.data ?? [];
        const map: Record<string, { id: string; status?: string | null; inspectionId?: string | null; grandTotal?: number | null }> = {};
        estimates.forEach((estimate: any) => {
          if (estimate.leadId && estimate.id) {
            map[estimate.leadId] = {
              id: estimate.id,
              status: estimate.status ?? null,
              inspectionId: estimate.inspectionId ?? null,
              grandTotal: estimate.grandTotal ?? estimate.grand_total ?? null,
            };
          }
        });
        setEstimateByLead(map);
      } catch (err) {
        setEstimateByLead({});
      }
      try {
        const jobCardsRes = await fetch(`/api/company/${companyId}/workshop/job-cards`);
        if (!jobCardsRes.ok) throw new Error("Failed to load job cards");
        const jobCardsJson = await jobCardsRes.json();
        const jobCards = jobCardsJson.data ?? [];
        const map: Record<string, { id: string; status?: string | null; startAt?: string | null; completeAt?: string | null }> = {};
        jobCards.forEach((jobCard: any) => {
          if (jobCard.lead_id && jobCard.id) {
            map[jobCard.lead_id] = {
              id: jobCard.id,
              status: jobCard.status ?? null,
              startAt: jobCard.start_at ?? null,
              completeAt: jobCard.complete_at ?? null,
            };
          }
        });
        setJobCardByLead(map);
      } catch (err) {
        setJobCardByLead({});
      }
      try {
        const partsRes = await fetch(`/api/company/${companyId}/workshop/parts-status`);
        if (!partsRes.ok) throw new Error("Failed to load parts status");
        const partsJson = await partsRes.json();
        const rows = partsJson.data ?? [];
        const map: Record<string, { orderedCount: number; receivedCount: number; approvedSparePendingCount: number }> = {};
        rows.forEach((row: any) => {
          if (row.lead_id) {
            map[row.lead_id] = {
              orderedCount: Number(row.ordered_count ?? 0),
              receivedCount: Number(row.received_count ?? 0),
              approvedSparePendingCount: Number(row.approved_spare_pending_count ?? 0),
            };
          }
        });
        setPartsByLead(map);
      } catch (err) {
        setPartsByLead({});
      }
      try {
        const invoicesRes = await fetch(`/api/company/${companyId}/workshop/invoices`);
        if (!invoicesRes.ok) throw new Error("Failed to load invoices");
        const invoicesJson = await invoicesRes.json();
        const invoices = invoicesJson.data ?? [];
        const map: Record<
          string,
          { id: string; status?: string | null; invoiceNumber?: string | null; grandTotal?: number | null }
        > = {};
        invoices.forEach((invoice: any) => {
          const leadId = invoice.leadId ?? invoice.lead_id ?? null;
          if (leadId && invoice.id) {
            map[leadId] = {
              id: invoice.id,
              status: invoice.status ?? null,
              invoiceNumber: invoice.invoiceNumber ?? invoice.invoice_number ?? null,
              grandTotal: invoice.grandTotal ?? invoice.grand_total ?? null,
            };
          }
        });
        setInvoiceByLead(map);
      } catch (err) {
        setInvoiceByLead({});
      }
    } catch (err) {
      setState({ status: "error", data: null, error: "Failed to load car-in dashboard." });
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

  const scopeLabel = companyName ? `Company: ${companyName}` : "Company workspace";
  const isLoading = state.status === "loading";
  const loadError = state.status === "error" ? state.error : null;
  const allLeads = state.status === "loaded" ? state.data : [];

  const carInLeads = useMemo(
    () => allLeads.filter((lead) => lead.leadStatus === "car_in"),
    [allLeads]
  );

  const filtered = useMemo(() => {
    if (!query) return carInLeads;
    const q = query.toLowerCase();
    return carInLeads.filter((lead) => {
      const hay = [
        lead.id,
        lead.customerName,
        lead.customerPhone,
        lead.carPlateNumber,
        lead.carModel,
        lead.agentRemark,
        lead.customerRemark,
        lead.customerFeedback,
        lead.leadStage,
        lead.branchName,
        lead.agentName,
        lead.source,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [carInLeads, query]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => {
      const left = new Date(a.checkinAt ?? a.updatedAt ?? 0).getTime();
      const right = new Date(b.checkinAt ?? b.updatedAt ?? 0).getTime();
      return right - left;
    });
    return rows;
  }, [filtered]);

  const phaseConfig = useMemo(
    () => [
      { key: "inspection", stages: ["checkin", "inspection_queue", "inspection_started", "inspection_completed", "inspection"] },
      { key: "estimate", stages: ["estimate_pending", "estimate_approved", "rfq_pending", "estimate_approval_pending"] },
      { key: "parts", stages: ["parts_pending"] },
      { key: "job", stages: ["assigned_for_work", "workorder_queue", "work_started", "work_completed", "qc_queue", "qc_started", "qc_completed"] },
      { key: "invoice", stages: ["invoice_issued"] },
      { key: "delivery", stages: ["handover_pending", "completed", "closed"] },
    ],
    []
  );

  function getPhaseIndex(stage: string | null | undefined) {
    if (!stage) return -1;
    return phaseConfig.findIndex((phase) => phase.stages.includes(stage));
  }

  function getPhaseStatus(stage: string | null | undefined, phaseIndex: number) {
    const stageIndex = getPhaseIndex(stage);
    if (stageIndex === -1) return "Pending";
    if (stageIndex < phaseIndex) return "Completed";
    if (stageIndex === phaseIndex) return "In Progress";
    return "Pending";
  }

  function statusClass(status: string) {
    switch (status) {
      case "Completed":
        return "bg-emerald-500/15 text-emerald-400";
      case "In Progress":
        return "bg-amber-500/15 text-amber-400";
      default:
        return "bg-slate-500/15 text-slate-300";
    }
  }

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 2500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  async function createEstimateFromInspection(inspectionId: string | null | undefined) {
    if (!inspectionId) {
      window.alert("Inspection is required to create an estimate.");
      return;
    }
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/estimates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inspectionId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const id: string = json.data?.estimate?.id ?? json.data?.id ?? json.data?.estimateId;
      if (id) {
        window.location.href = `/company/${companyId}/estimates/${id}`;
      } else {
        window.alert("Estimate created, but no id returned.");
      }
    } catch (err) {
      console.error("Failed to create estimate", err);
      window.alert("Failed to create estimate.");
    }
  }

  async function createInvoiceFromEstimate(
    estimateId: string | null | undefined,
    checks: { inspectionReady: boolean; jobReady: boolean; partsReady: boolean; estimateReady: boolean }
  ) {
    if (!estimateId || !checks.estimateReady) {
      setToastMessage({ type: "error", text: "Estimate must be created before invoicing." });
      return;
    }
    if (!checks.inspectionReady) {
      setToastMessage({ type: "error", text: "Inspection is still pending." });
      return;
    }
    if (!checks.jobReady) {
      setToastMessage({ type: "error", text: "Job is still pending." });
      return;
    }
    if (!checks.partsReady) {
      setToastMessage({ type: "error", text: "Spare parts are still pending." });
      return;
    }
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimateId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setToastMessage({ type: "success", text: "Invoice created successfully." });
    } catch (err) {
      console.error("Failed to create invoice", err);
      setToastMessage({ type: "error", text: "Failed to create invoice." });
    }
  }

  async function openPartsModal(leadId: string) {
    setPartsLoading(true);
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/parts-by-lead?leadId=${leadId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setPartsModal({ leadId, parts: json.data ?? [] });
    } catch (err) {
      setPartsModal({ leadId, parts: [] });
    } finally {
      setPartsLoading(false);
    }
  }

  function openTopupModal(customerId: string | null | undefined) {
    if (!customerId) {
      setToastMessage({ type: "error", text: "Customer is required for topup." });
      return;
    }
    setTopupCustomerId(customerId);
    setTopupForm({ amount: "", method: "cash", paymentDate: "", proofFileId: "" });
    setTopupError(null);
    setTopupOpen(true);
  }

  function closeTopupModal() {
    setTopupOpen(false);
    setTopupCustomerId(null);
  }

  function openPayModal(invoiceId: string, leadId: string, amount: number) {
    setPayInvoice({ invoiceId, leadId, amount });
    setPayError(null);
    setPayOpen(true);
  }

  function closePayModal() {
    setPayOpen(false);
    setPayInvoice(null);
  }

  async function openAssignModal(lead: Lead) {
    setAssignLeadId(lead.id);
    setAssignBranchId(lead.branchId ?? null);
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
        body: JSON.stringify({ branchId: assignBranchId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to assign branch.");
      }
      await load();
      closeAssignModal();
      setToastMessage({ type: "success", text: "Assigned to workshop branch." });
    } catch (err: any) {
      setAssignError(err?.message ?? "Failed to assign branch.");
      setToastMessage({ type: "error", text: "Failed to assign branch." });
    } finally {
      setAssignLoading(false);
    }
  }

  async function submitPayment() {
    if (!payInvoice) return;
    const lead = state.status === "loaded" ? state.data.find((row) => row.id === payInvoice.leadId) : null;
    const walletAmount = Number((lead as any)?.customerWalletAmount ?? 0);
    if (walletAmount < payInvoice.amount) {
      setToastMessage({ type: "error", text: "Insufficient wallet balance. Please topup." });
      if (lead?.customerId) {
        openTopupModal(lead.customerId);
      }
      return;
    }
    setPaySaving(true);
    setPayError(null);
    try {
      const res = await fetch(
        `/api/company/${companyId}/workshop/invoices/${payInvoice.invoiceId}/pay`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      setInvoiceByLead((prev) => {
        const current = prev[payInvoice.leadId];
        if (!current) return prev;
        return {
          ...prev,
          [payInvoice.leadId]: { ...current, status: "paid" },
        };
      });
      closePayModal();
      setToastMessage({ type: "success", text: "Payment recorded." });
    } catch (err) {
      console.error("Failed to record payment", err);
      setPayError(err instanceof Error ? err.message : "Failed to record payment.");
      setToastMessage({ type: "error", text: "Failed to record payment." });
    } finally {
      setPaySaving(false);
    }
  }

  async function submitTopup() {
    if (!topupCustomerId) return;
    const amount = Number(topupForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setTopupError("Enter a valid amount.");
      return;
    }
    setTopupSaving(true);
    setTopupError(null);
    try {
      const res = await fetch(`/api/customers/${topupCustomerId}/wallet/transactions`, {
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
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      let balance: number | null = null;
      const summaryRes = await fetch(
        `/api/customers/${topupCustomerId}/wallet/summary?companyId=${companyId}`
      );
      if (summaryRes.ok) {
        const summary = await summaryRes.json().catch(() => ({}));
        balance = Number(summary?.balance ?? 0);
      }
      setState((prev) => {
        if (prev.status !== "loaded") return prev;
        return {
          ...prev,
          data: prev.data.map((lead) =>
            lead.customerId === topupCustomerId
              ? {
                  ...lead,
                  customerWalletAmount: balance ?? Number(lead.customerWalletAmount ?? 0) + amount,
                }
              : lead
          ),
        };
      });
      closeTopupModal();
      setToastMessage({ type: "success", text: "Wallet topup created." });
    } catch (err) {
      console.error("Failed to topup wallet", err);
      setTopupError(err instanceof Error ? err.message : "Failed to create topup.");
      setToastMessage({ type: "error", text: "Failed to topup wallet." });
    } finally {
      setTopupSaving(false);
    }
  }

  return (
    <MainPageShell
      title="Car In Dashboard"
      subtitle="Vehicles checked in and awaiting service."
      scopeLabel={scopeLabel}
      contentClassName="p-0 bg-transparent"
    >
      {toastMessage && (
        <div className="fixed right-6 top-6 z-50">
          <div
            className={`rounded-md px-4 py-2 text-xs font-semibold text-white shadow-lg ${
              toastMessage.type === "success" ? "bg-emerald-500" : "bg-rose-500"
            }`}
          >
            {toastMessage.text}
          </div>
        </div>
      )}
      {isLoading && <p className="text-sm text-muted-foreground">Loading car-in leads...</p>}
      {loadError && <p className="text-sm text-destructive">{loadError}</p>}
        {!isLoading && !loadError && (
          <Card className="border-0 p-0 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/30 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                type="button"
                className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
                onClick={() => load()}
              >
                Refresh
              </button>
              <span className="text-xs text-muted-foreground">{carInLeads.length} car-in leads</span>
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
          {sorted.length === 0 ? (
            <div className="px-4 py-6 text-xs text-muted-foreground">No car-in leads found.</div>
          ) : (
            <div className="overflow-x-auto border-0">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                    <th className="py-2 pl-3 pr-4 text-left">Customer Details</th>
                    <th className="py-2 px-4 text-left">Car Details</th>
                    <th className="py-2 px-4 text-left">Lead Remarks</th>
                    <th className="py-2 px-4 text-left">Car In Time</th>
                    <th className="py-2 px-4 text-left">Inspection</th>
                    <th className="py-2 px-4 text-left">Estimate</th>
                    <th className="py-2 px-4 text-left">Parts Order</th>
                    <th className="py-2 px-4 text-left">Job Cards</th>
                    <th className="py-2 px-4 text-left">Invoice</th>
                    <th className="py-2 px-4 text-left">Wallet</th>
                    <th className="py-2 px-4 text-left">Delivery</th>
                    <th className="py-2 px-4 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((lead) => {
                    const leadHref = `/company/${companyId}/leads/${lead.id}`;
                    const customerHref = lead.customerId
                      ? `/company/${companyId}/customers/${lead.customerId}`
                      : null;
                    const carHref = lead.carId ? `/company/${companyId}/cars/${lead.carId}` : null;
                    const inspectionMeta = inspectionByLead[lead.id];
                    const inspectionCompleted = Boolean(inspectionMeta?.completedAt);
                    const inspectionStatus = inspectionCompleted
                      ? "Completed"
                      : getPhaseStatus(lead.leadStage, 0);
                    const estimateStatus = getPhaseStatus(lead.leadStage, 1);
                    const partsStatus = getPhaseStatus(lead.leadStage, 2);
                    const jobStatus = getPhaseStatus(lead.leadStage, 3);
                    const invoiceStatus = getPhaseStatus(lead.leadStage, 4);
                    const deliveryStatus = getPhaseStatus(lead.leadStage, 5);
                    const estimateMatch = estimateByLead[lead.id];
                    const estimateId =
                      estimateMatch?.id ??
                      (lead as any).estimateId ??
                      (lead as any).estimate_id ??
                      (lead as any).meta?.estimateId ??
                      (lead as any).meta?.estimate_id ??
                      (lead as any).metadata?.estimateId ??
                      (lead as any).metadata?.estimate_id ??
                      null;
                    const inspectionHref = inspectionMeta?.id
                      ? `/company/${companyId}/inspections/${inspectionMeta.id}`
                      : null;
                    const estimateHref = estimateId
                      ? `/company/${companyId}/estimates/${estimateId}`
                      : null;
                    const jobCardMeta = jobCardByLead[lead.id];
                    const partsMeta = partsByLead[lead.id];
                    const invoiceMeta = invoiceByLead[lead.id];
                    const invoiceDisplayStatus = invoiceMeta?.status ?? "no_invoice";
                    const invoiceStatusLabel =
                      invoiceDisplayStatus === "paid"
                        ? "Paid"
                        : invoiceDisplayStatus === "issued"
                        ? "Issued"
                        : invoiceDisplayStatus === "cancelled"
                        ? "Cancelled"
                        : invoiceDisplayStatus === "draft"
                        ? "Unpaid"
                        : "No Invoice";
                    const invoiceAmount = Number(invoiceMeta?.grandTotal ?? 0);
                    const jobCardHref = jobCardMeta?.id
                      ? `/company/${companyId}/workshop/job-cards/${jobCardMeta.id}`
                      : null;
                    const jobCardStatus = jobCardMeta?.status
                      ? jobCardMeta.status === "Completed"
                        ? "Completed"
                        : "In Progress"
                      : jobStatus;
                    const inspectionReady = inspectionStatus === "Completed";
                    const jobReady = jobCardMeta?.status === "Completed";
                    const partsReady = (partsMeta?.approvedSparePendingCount ?? 0) === 0;
                    const estimateReady = Boolean(estimateId);
                    const canCreateInvoice = inspectionReady && jobReady && partsReady && estimateReady;
                    return (
                      <tr key={lead.id} className="border-b last:border-0">
                        <td className="py-2 px-4">
                          {lead.customerName ? (
                            customerHref ? (
                              <a href={customerHref} className="text-sm hover:underline">
                                {lead.customerName}
                              </a>
                            ) : (
                              <span className="text-sm">{lead.customerName}</span>
                            )
                          ) : (
                            <span className="text-xs text-muted-foreground">No customer</span>
                          )}
                          {lead.customerPhone && (
                            <div className="text-xs text-muted-foreground">{lead.customerPhone}</div>
                          )}
                          <div className="text-[10px] uppercase text-muted-foreground">
                            Lead {lead.id.slice(0, 8)}
                          </div>
                        </td>
                        <td className="py-2 px-4">
                          {lead.carPlateNumber ? (
                            carHref ? (
                              <a href={carHref} className="hover:underline">
                                <div className="text-sm">{lead.carPlateNumber}</div>
                                {lead.carModel && (
                                  <div className="text-xs text-muted-foreground">{lead.carModel}</div>
                                )}
                              </a>
                            ) : (
                              <>
                                <div className="text-sm">{lead.carPlateNumber}</div>
                                {lead.carModel && (
                                  <div className="text-xs text-muted-foreground">{lead.carModel}</div>
                                )}
                              </>
                            )
                          ) : (
                            <span className="text-xs text-muted-foreground">No car</span>
                          )}
                          <div className="text-[10px] uppercase text-muted-foreground">
                            {lead.branchName || "Unassigned"} / {lead.agentName || "Unassigned"}
                          </div>
                        </td>
                        <td className="py-2 px-4 text-xs text-muted-foreground">
                          <div className="max-w-xs whitespace-pre-wrap">
                            {lead.customerRemark || lead.customerFeedback || lead.agentRemark ? (
                              <>
                                {(lead.customerRemark || lead.customerFeedback) && (
                                  <div>Customer: {lead.customerRemark || lead.customerFeedback}</div>
                                )}
                                {lead.agentRemark && <div>Agent: {lead.agentRemark}</div>}
                              </>
                            ) : (
                              "-"
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-4 text-xs text-muted-foreground">
                          {lead.checkinAt ? new Date(lead.checkinAt).toLocaleString() : "N/A"}
                        </td>
                        <td className="py-2 px-4 text-xs">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusClass(inspectionStatus)}`}>
                            {inspectionStatus}
                          </span>
                          {inspectionMeta?.branchName && (
                            <div className="mt-1 text-[10px] text-muted-foreground">
                              {inspectionMeta.branchName}
                            </div>
                          )}
                          {inspectionMeta?.startedAt && (
                            <div className="mt-1 text-[10px] text-muted-foreground">
                              Start: {new Date(inspectionMeta.startedAt).toLocaleString()}
                            </div>
                          )}
                          {inspectionMeta?.completedAt && (
                            <div className="mt-0.5 text-[10px] text-muted-foreground">
                              Complete: {new Date(inspectionMeta.completedAt).toLocaleString()}
                            </div>
                          )}
                          {inspectionHref && (
                            <div className="mt-1">
                              <a
                                href={inspectionHref}
                                className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
                              >
                                View
                              </a>
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-4 text-xs">
                          <div className="mt-1">
                            {estimateHref ? (
                              <a
                                href={estimateHref}
                                className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
                              >
                                View Estimate
                              </a>
                            ) : (
                              <button
                                type="button"
                                className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
                                onClick={() => createEstimateFromInspection(inspectionMeta?.id)}
                              >
                                Create Estimate
                              </button>
                            )}
                          </div>
                          {estimateMatch?.status && (
                            <div className="mt-1 text-[10px] text-muted-foreground uppercase">
                              {estimateMatch.status.replace(/_/g, " ")}
                            </div>
                          )}
                          {estimateMatch?.grandTotal != null && (
                            <div className="mt-1 text-[10px] text-muted-foreground">
                             Total Amount: {Number(estimateMatch.grandTotal).toFixed(2)}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-4 text-xs">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusClass(partsStatus)}`}>
                            {partsStatus}
                          </span>
                          {partsMeta && (
                            <div className="mt-1 text-[10px] text-muted-foreground">
                              Pending: {partsMeta.orderedCount} · Received: {partsMeta.receivedCount}
                            </div>
                          )}
                          <div className="mt-1">
                            <button
                              type="button"
                              className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
                              onClick={() => openPartsModal(lead.id)}
                            >
                              View Parts
                            </button>
                          </div>
                        </td>
                        <td className="py-2 px-4 text-xs">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusClass(jobCardStatus)}`}>
                            {jobCardStatus}
                          </span>
                          {jobCardHref && (
                            <div className="mt-1">
                              <a
                                href={jobCardHref}
                                className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
                              >
                                View
                              </a>
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-4 text-xs">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusClass(invoiceDisplayStatus)}`}>
                              {invoiceStatusLabel}
                            </span>
                            {invoiceMeta?.invoiceNumber && (
                              <div className="mt-1 text-[10px] text-muted-foreground">
                                {invoiceMeta.invoiceNumber}
                              </div>
                            )}
                            {invoiceMeta?.id && (
                              <div className="mt-0.5 text-[10px] text-muted-foreground">
                                AED {invoiceAmount.toFixed(2)}
                              </div>
                            )}
                            {invoiceMeta?.id && (
                              <div className="mt-1">
                                <a
                                  href={`/api/company/${companyId}/workshop/invoices/${invoiceMeta.id}/print`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
                                >
                                  Print Invoice
                                </a>
                              </div>
                            )}
                            {invoiceMeta?.id && invoiceDisplayStatus !== "paid" && (
                              <div className="mt-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    openPayModal(invoiceMeta.id, lead.id, invoiceAmount)
                                  }
                                  className="inline-flex items-center rounded-md bg-emerald-500 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-white shadow-sm transition hover:bg-emerald-400"
                                >
                                  Pay Now
                                </button>
                              </div>
                            )}
                          {jobCardMeta?.completeAt && !invoiceMeta?.id && (
                            <div className="mt-1">
                              <button
                                type="button"
                                className={`inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 hover:shadow-md ${
                                  canCreateInvoice ? "" : "cursor-not-allowed opacity-60"
                                }`}
                                onClick={() =>
                                  createInvoiceFromEstimate(estimateId, {
                                    inspectionReady,
                                    jobReady,
                                    partsReady,
                                    estimateReady,
                                  })
                                }
                                aria-disabled={!canCreateInvoice}
                              >
                                Create Invoice
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-4 text-xs">
                          <div className="text-sm">
                            {Number((lead as any).customerWalletAmount ?? 0).toFixed(2)}
                          </div>
                          <div className="mt-1">
                            <button
                              type="button"
                              className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
                              onClick={() => openTopupModal(lead.customerId)}
                            >
                              Topup
                            </button>
                          </div>
                        </td>
                        <td className="py-2 px-4 text-xs">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusClass(deliveryStatus)}`}>
                            {deliveryStatus}
                          </span>
                        </td>
                        <td className="py-2 px-4 text-xs">
                          <a
                            href={leadHref}
                            className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
                          >
                            View
                          </a>
                          <button
                            type="button"
                            onClick={() => openAssignModal(lead)}
                            className="mt-1 inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
                          >
                            Assign
                          </button>
                          <div className="mt-1 text-[10px] text-muted-foreground">
                            {formatStageLabel(lead.leadType, lead.leadStage)}
                          </div>
                          <div className="mt-0.5">
                            <LeadStatusBadge status={lead.leadStatus as any} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          </Card>
        )}
        {topupOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <Card className={`w-full max-w-lg rounded-xl shadow-xl ${theme.cardBg} ${theme.cardBorder}`}>
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="text-sm font-semibold">Topup Wallet</div>
                <button
                  type="button"
                  onClick={closeTopupModal}
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
                    onClick={closeTopupModal}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded-md bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary-foreground"
                    disabled={topupSaving}
                    onClick={submitTopup}
                  >
                    {topupSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </Card>
          </div>
        )}
        {payOpen && payInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <Card className={`w-full max-w-lg rounded-xl shadow-xl ${theme.cardBg} ${theme.cardBorder}`}>
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="text-sm font-semibold">Record Payment</div>
                <button
                  type="button"
                  onClick={closePayModal}
                  className={`rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-white/10`}
                >
                  Close
                </button>
              </div>
              <div className="space-y-4 p-4">
                {payError && <div className="text-sm text-red-400">{payError}</div>}
                <div className="text-sm text-white/80">
                  Proceed to pay AED {payInvoice.amount.toFixed(2)} from wallet?
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className={`rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-white/10`}
                    onClick={closePayModal}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white"
                    disabled={paySaving}
                    onClick={submitPayment}
                  >
                    {paySaving ? "Saving..." : "Confirm Payment"}
                  </button>
                </div>
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
              <div className="space-y-4 p-4">
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
        {partsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-3xl rounded-lg bg-slate-950 text-white shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-sm font-semibold">
              <span>Parts</span>
              <button
                type="button"
                onClick={() => setPartsModal(null)}
                className="text-xs text-white/70 hover:text-white"
              >
                Close
              </button>
            </div>
            <div className="p-4">
              {partsLoading ? (
                <div className="text-xs text-white/70">Loading parts…</div>
              ) : partsModal.parts.length === 0 ? (
                <div className="text-xs text-white/70">No parts found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-[11px] text-white/70">
                        <th className="px-2 py-2 text-left">Name</th>
                        <th className="px-2 py-2 text-left">Type</th>
                        <th className="px-2 py-2 text-left">Order Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partsModal.parts.map((part: any) => (
                        <tr key={part.id} className="border-b border-white/5 last:border-0">
                          <td className="px-2 py-2 font-semibold">{part.product_name ?? "-"}</td>
                          <td className="px-2 py-2">{part.product_type ?? "-"}</td>
                          <td className="px-2 py-2 uppercase">{part.order_status ?? "Ordered"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </MainPageShell>
  );
}
