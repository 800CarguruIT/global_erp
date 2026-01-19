"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { MainPageShell } from "./MainPageShell";
import { Card } from "../components/Card";
import type { Estimate } from "@repo/ai-core/workshop/estimates/types";
import type { Quote } from "@repo/ai-core/workshop/quotes/types";
import type { Inspection } from "@repo/ai-core/workshop/inspections/types";
import type { Lead } from "@repo/ai-core/crm/leads/types";
import { useTheme } from "../theme";

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
  filter: (data: EstimateQuotesData) => any[];
};

export function EstimateQuotesMain({ companyId }: { companyId: string }) {
  const { theme } = useTheme();
  const [state, setState] = useState<LoadState<EstimateQuotesData>>({
    status: "loading",
    data: null,
    error: null,
  });
  const [activeTab, setActiveTab] = useState("work-jc");
  const [query, setQuery] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignLeadId, setAssignLeadId] = useState<string | null>(null);
  const [assignBranchId, setAssignBranchId] = useState<string | null>(null);
  const [assignBranches, setAssignBranches] = useState<any[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

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

  const pendingInspectionRows = useMemo(() => {
    const pendingInspections = data.inspections.filter((row) => row.status === "pending");
    const inspectionByLead = new Map<string, InspectionRow>();
    pendingInspections.forEach((row) => {
      if (row.leadId) inspectionByLead.set(row.leadId, row);
    });
    const carInLeads = data.leads.filter((lead) => lead.leadStatus === "car_in");
    const rows: PendingInspectionRow[] = [];
    carInLeads.forEach((lead) => {
      const match = inspectionByLead.get(lead.id);
      if (match) {
        rows.push({ ...match, hasInspection: true });
        return;
      }
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
  }, [data.inspections, data.leads]);

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
        body: JSON.stringify({ branchId: assignBranchId }),
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

  const tabs: TabConfig[] = useMemo(
    () => [
      {
        id: "work-jc",
        label: "Work Job Cards",
        kind: "jobCards",
        filter: (d) =>
          d.jobCards.filter((row) => ["pending", "re-assigned"].includes((row.status ?? "Pending").toLowerCase())),
      },
      {
        id: "quotation-pending",
        label: "Quotation Pending",
        kind: "estimates",
        filter: (d) =>
          d.estimates.filter((row) => ["pending_approval", "draft"].includes(row.status ?? "")),
      },
      {
        id: "quoted-job-cards",
        label: "Quoted Job Cards",
        kind: "quotes",
        filter: (d) => d.quotes.filter((row) => ["quoted", "approved"].includes(row.status)),
      },
      {
        id: "in-house",
        label: "In House JC",
        kind: "jobCards",
        filter: (d) =>
          d.jobCards.filter(
            (row) =>
              (row.status ?? "Pending").toLowerCase() === "pending" && !row.start_at && !row.complete_at
          ),
      },
      {
        id: "in-process",
        label: "In Process",
        kind: "jobCards",
        filter: (d) => d.jobCards.filter((row) => row.start_at && !row.complete_at),
      },
      {
        id: "completed",
        label: "Completed",
        kind: "jobCards",
        filter: (d) => d.jobCards.filter((row) => (row.status ?? "").toLowerCase() === "completed"),
      },
      {
        id: "verified",
        label: "Verified",
        kind: "quotes",
        filter: (d) => d.quotes.filter((row) => row.status === "verified"),
      },
      {
        id: "cancelled",
        label: "Cancelled",
        kind: "jobCards",
        filter: (d) => d.jobCards.filter((row) => (row.status ?? "").toLowerCase() === "cancelled"),
      },
      {
        id: "pickups",
        label: "Upcoming Pickup",
        kind: "estimates",
        filter: (d) => d.estimates.filter((row) => row.status === "invoiced"),
      },
      {
        id: "pending-insp",
        label: "Pending Insp.",
        kind: "inspections",
        filter: () => pendingInspectionRows,
      },
      {
        id: "completed-insp",
        label: "Completed Insp.",
        kind: "inspections",
        filter: (d) => d.inspections.filter((row) => row.status === "completed"),
      },
      {
        id: "pending-minor",
        label: "Pending Minor",
        kind: "estimates",
        filter: (d) => d.estimates.filter((row) => row.status === "pending_approval"),
      },
      {
        id: "completed-minor",
        label: "Completed Minor",
        kind: "estimates",
        filter: (d) => d.estimates.filter((row) => row.status === "approved"),
      },
    ],
    [pendingInspectionRows]
  );

  const activeConfig = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const activeRows = activeConfig ? activeConfig.filter(data) : [];

  const filteredRows = useMemo(() => {
    if (!query) return activeRows;
    const q = query.toLowerCase();
    switch (activeConfig.kind) {
      case "jobCards":
        return (activeRows as JobCardRow[]).filter((row) =>
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
        return (activeRows as Estimate[]).filter((row) =>
          [row.id, row.inspectionId, row.status].filter(Boolean).join(" ").toLowerCase().includes(q)
        );
      case "quotes":
        return (activeRows as Quote[]).filter((row) =>
          [row.id, row.estimateId, row.workOrderId, row.status, row.quoteType]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(q)
        );
      case "inspections":
        return (activeRows as InspectionRow[]).filter((row) =>
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
        return activeRows;
    }
  }, [activeRows, activeConfig.kind, query]);

  function formatDate(value?: string | null) {
    if (!value) return "N/A";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "N/A";
    return date.toLocaleString();
  }

  return (
    <MainPageShell title="Estimate Quotes" subtitle="Estimate quotation pipeline overview." scopeLabel="">
      {state.status === "loading" && <p className="text-sm text-muted-foreground">Loading estimate quotes...</p>}
      {state.status === "error" && <p className="text-sm text-destructive">{state.error}</p>}
      {state.status === "loaded" && (
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
              <span className="text-xs text-muted-foreground">{filteredRows.length} records</span>
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
          <div className="flex flex-wrap gap-2 border-b border-border/30 px-4 py-3 text-xs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                  activeTab === tab.id ? "border-primary text-primary" : "text-muted-foreground hover:border-primary"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            {filteredRows.length === 0 ? (
              <div className="px-4 py-6 text-xs text-muted-foreground">No records found.</div>
            ) : activeConfig.kind === "jobCards" ? (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
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
                    <tr key={row.id} className="border-b last:border-0">
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
                        <a
                          href={`/company/${companyId}/workshop/job-cards/${row.id}`}
                          className="rounded-md border px-2 py-1"
                        >
                          Open
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : activeConfig.kind === "estimates" ? (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                    <th className="py-2 pl-3 pr-4 text-left">Estimate</th>
                    <th className="py-2 px-4 text-left">Inspection</th>
                    <th className="py-2 px-4 text-left">Status</th>
                    <th className="py-2 px-4 text-left">Grand Total</th>
                    <th className="py-2 px-4 text-left">Updated</th>
                    <th className="py-2 px-4 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(filteredRows as Estimate[]).map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="py-2 pl-3 pr-4">
                        <div className="font-medium">{row.id.slice(0, 8)}...</div>
                      </td>
                      <td className="py-2 px-4 text-xs">{row.inspectionId.slice(0, 8)}...</td>
                      <td className="py-2 px-4 text-xs capitalize">{row.status.replace("_", " ")}</td>
                      <td className="py-2 px-4 text-xs">{row.grandTotal.toFixed(2)}</td>
                      <td className="py-2 px-4 text-xs text-muted-foreground">{formatDate(row.updatedAt)}</td>
                      <td className="py-2 px-4 text-xs">
                        <a
                          href={`/company/${companyId}/estimates/${row.id}`}
                          className="rounded-md border px-2 py-1"
                        >
                          Open
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : activeConfig.kind === "quotes" ? (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                    <th className="py-2 pl-3 pr-4 text-left">Quote</th>
                    <th className="py-2 px-4 text-left">Type</th>
                    <th className="py-2 px-4 text-left">Status</th>
                    <th className="py-2 px-4 text-left">Estimate</th>
                    <th className="py-2 px-4 text-left">Total</th>
                    <th className="py-2 px-4 text-left">Updated</th>
                    <th className="py-2 px-4 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(filteredRows as Quote[]).map((row) => {
                    const quoteHref =
                      row.quoteType === "branch_labor"
                        ? `/company/${companyId}/quotes/branch/${row.id}`
                        : `/company/${companyId}/quotes/vendor/${row.id}`;
                    return (
                      <tr key={row.id} className="border-b last:border-0">
                        <td className="py-2 pl-3 pr-4">
                          <div className="font-medium">{row.id.slice(0, 8)}...</div>
                        </td>
                        <td className="py-2 px-4 text-xs capitalize">{row.quoteType.replace("_", " ")}</td>
                        <td className="py-2 px-4 text-xs capitalize">{row.status}</td>
                        <td className="py-2 px-4 text-xs">
                          {row.estimateId ? `EST-${row.estimateId.slice(0, 8)}...` : "-"}
                        </td>
                        <td className="py-2 px-4 text-xs">{row.totalAmount.toFixed(2)}</td>
                        <td className="py-2 px-4 text-xs text-muted-foreground">{formatDate(row.updatedAt)}</td>
                        <td className="py-2 px-4 text-xs">
                          <a href={quoteHref} className="rounded-md border px-2 py-1">
                            Open
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                    <th className="py-2 pl-3 pr-4 text-left">Inspection</th>
                    <th className="py-2 px-4 text-left">Car</th>
                    <th className="py-2 px-4 text-left">Customer</th>
                    <th className="py-2 px-4 text-left">Branch</th>
                    <th className="py-2 px-4 text-left">Status</th>
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
                    <tr key={row.id} className="border-b last:border-0">
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
                      <td className="py-2 px-4 text-xs capitalize">{row.status}</td>
                      <td className="py-2 px-4 text-xs text-muted-foreground">{formatDate(row.updatedAt)}</td>
                      <td className="py-2 px-4 text-xs">
                        {actionHref ? (
                          <div className="flex flex-col gap-1">
                            <a href={actionHref} className="rounded-md border px-2 py-1 text-center">
                              {hasInspection ? "Open" : "View Lead"}
                            </a>
                            {row.leadId ? (
                              <button
                                type="button"
                                onClick={() => openAssignModal(row.leadId)}
                                className="rounded-md border px-2 py-1"
                              >
                                Assign
                              </button>
                            ) : null}
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  );
                })}
                </tbody>
              </table>
            )}
          </div>
        </Card>
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
