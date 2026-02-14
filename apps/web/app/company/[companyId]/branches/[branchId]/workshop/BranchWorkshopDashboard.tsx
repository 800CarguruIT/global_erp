"use client";

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "@repo/ui";
import { DateRange } from "react-date-range";

const WORKSHOP_TABS = [
  { id: "inquiries", label: "New Inquiries", description: "Track the latest customer inquiries." },
  { id: "quotes", label: "My Quotes", description: "Jobs that are awaiting quote approval." },
  { id: "inspections", label: "My Inspections", description: "Vehicles that need inspection or check-in." },
  { id: "completed-inspections", label: "Completed Insp.", description: "Completed inspections for this branch." },
  { id: "jobs", label: "My Jobs", description: "Cars that are active inside the workshop." },
  { id: "completed", label: "Completed Orders", description: "Jobs that have already been completed." },
  { id: "cancelled", label: "Cancelled Orders", description: "Jobs that were cancelled or dropped." },
] as const;

const ENTRY_OPTIONS = [5, 10, 25, 50];
type WorkshopTabId = (typeof WORKSHOP_TABS)[number]["id"];

type JobCardRow = {
  id: string;
  make?: string | null;
  model?: string | null;
  status?: string | null;
  createdAt?: string | null;
  estimateId?: string | null;
  branchId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  plateNumber?: string | null;
};

type InspectionRow = {
  id: string;
  leadId?: string | null;
  status?: string | null;
  startAt?: string | null;
  completeAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  branchId?: string | null;
  car?: { plate_number?: string | null; make?: string | null; model?: string | null } | null;
  customer?: { name?: string | null; phone?: string | null } | null;
};

type LeadRow = {
  id: string;
  branchId?: string | null;
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
};

const getCarLabel = (row: JobCardRow) => [row.make, row.model].filter(Boolean).join(" ");
const getInspectionDate = (row: InspectionRow, tabId: WorkshopTabId) =>
  tabId === "completed-inspections" ? row.completeAt ?? row.updatedAt ?? row.createdAt : row.updatedAt ?? row.createdAt;

const getStatusTone = (status?: string | null) => {
  const normalized = (status ?? "").toLowerCase();
  if (normalized.includes("complete") || normalized.includes("done")) {
    return "bg-emerald-500/15 text-emerald-600";
  }
  if (normalized.includes("cancel")) {
    return "bg-red-500/15 text-red-600";
  }
  if (normalized.includes("progress") || normalized.includes("start")) {
    return "bg-cyan-500/15 text-cyan-600";
  }
  return "bg-amber-500/15 text-amber-600";
};

export function BranchWorkshopDashboard({
  companyId,
  branchId,
}: {
  companyId: string;
  branchId?: string;
}) {
  const { theme } = useTheme();
  const [jobCards, setJobCards] = useState<JobCardRow[]>([]);
  const [inspections, setInspections] = useState<InspectionRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(WORKSHOP_TABS[0].id);
  const [search, setSearch] = useState("");
  const [showCompletedDatePicker, setShowCompletedDatePicker] = useState(false);
  const [completedDateFilterEnabled, setCompletedDateFilterEnabled] = useState(false);
  const [completedDateRange, setCompletedDateRange] = useState<{
    startDate: Date;
    endDate: Date;
    key: "selection";
  }>({
    startDate: new Date(),
    endDate: new Date(),
    key: "selection",
  });
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [jobCardsRes, inspectionsRes, leadsRes] = await Promise.all([
          fetch(`/api/company/${companyId}/workshop/job-cards`, { signal: controller.signal }),
          fetch(`/api/company/${companyId}/workshop/inspections`, { signal: controller.signal }),
          fetch(`/api/company/${companyId}/sales/leads`, { signal: controller.signal }),
        ]);
        if (!jobCardsRes.ok) throw new Error(`Job cards HTTP ${jobCardsRes.status}`);
        if (!inspectionsRes.ok) throw new Error(`Inspections HTTP ${inspectionsRes.status}`);
        if (!leadsRes.ok) throw new Error(`Leads HTTP ${leadsRes.status}`);

        const [jobCardsJson, inspectionsJson, leadsJson] = await Promise.all([
          jobCardsRes.json(),
          inspectionsRes.json(),
          leadsRes.json(),
        ]);

        const jobCardRows = (jobCardsJson.data ?? []) as Array<Record<string, unknown>>;
        const inspectionRows = (inspectionsJson.data ?? []) as Array<Record<string, unknown>>;
        const leadRows = (leadsJson.data ?? []) as Array<Record<string, unknown>>;

        const normalizedJobCards: JobCardRow[] = jobCardRows.map((row) => ({
          id: typeof row.id === "string" ? row.id : "",
          make: typeof row.make === "string" ? row.make : null,
          model: typeof row.model === "string" ? row.model : null,
          status: typeof row.status === "string" ? row.status : null,
          createdAt:
            typeof row.created_at === "string"
              ? row.created_at
              : typeof row.createdAt === "string"
              ? row.createdAt
              : null,
          estimateId:
            typeof row.estimate_id === "string"
              ? row.estimate_id
              : typeof row.estimateId === "string"
              ? row.estimateId
              : null,
          branchId:
            typeof row.branch_id === "string"
              ? row.branch_id
              : typeof row.branchId === "string"
              ? row.branchId
              : null,
          customerName:
            typeof row.customer_name === "string"
              ? row.customer_name
              : typeof row.customerName === "string"
              ? row.customerName
              : null,
          customerPhone:
            typeof row.customer_phone === "string"
              ? row.customer_phone
              : typeof row.customerPhone === "string"
              ? row.customerPhone
              : null,
          plateNumber:
            typeof row.plate_number === "string"
              ? row.plate_number
              : typeof row.plateNumber === "string"
              ? row.plateNumber
              : null,
        }));

        const normalizedInspections: InspectionRow[] = inspectionRows.map((row) => ({
          id: typeof row.id === "string" ? row.id : "",
          leadId:
            typeof row.leadId === "string"
              ? row.leadId
              : typeof row.lead_id === "string"
              ? row.lead_id
              : null,
          status: typeof row.status === "string" ? row.status : null,
          startAt:
            typeof row.start_at === "string"
              ? row.start_at
              : typeof row.startAt === "string"
              ? row.startAt
              : null,
          completeAt:
            typeof row.complete_at === "string"
              ? row.complete_at
              : typeof row.completeAt === "string"
              ? row.completeAt
              : null,
          createdAt:
            typeof row.created_at === "string"
              ? row.created_at
              : typeof row.createdAt === "string"
              ? row.createdAt
              : null,
          updatedAt:
            typeof row.updated_at === "string"
              ? row.updated_at
              : typeof row.updatedAt === "string"
              ? row.updatedAt
              : null,
          branchId:
            typeof row.branchId === "string"
              ? row.branchId
              : typeof row.branch_id === "string"
              ? row.branch_id
              : null,
          car: (row.car as InspectionRow["car"]) ?? null,
          customer: (row.customer as InspectionRow["customer"]) ?? null,
        }));

        const normalizedLeads: LeadRow[] = leadRows.map((row) => ({
          id: typeof row.id === "string" ? row.id : "",
          branchId:
            typeof row.branchId === "string"
              ? row.branchId
              : typeof row.branch_id === "string"
              ? row.branch_id
              : null,
        }));

        if (!cancelled) {
          setJobCards(normalizedJobCards.filter((row) => row.id));
          setInspections(normalizedInspections.filter((row) => row.id));
          setLeads(normalizedLeads.filter((row) => row.id));
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load workshop data.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [companyId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [entriesPerPage, search, activeTab, jobCards.length, inspections.length]);

  const leadBranchByLeadId = useMemo(() => {
    const map = new Map<string, string | null>();
    leads.forEach((lead) => map.set(lead.id, lead.branchId ?? null));
    return map;
  }, [leads]);

  const scopedInspections = useMemo(() => {
    return inspections.filter((row) => {
      const leadBranchId = row.leadId ? leadBranchByLeadId.get(row.leadId) ?? null : null;
      const effectiveBranchId = row.branchId ?? leadBranchId ?? null;
      const branchMatches = !branchId || effectiveBranchId === branchId;
      return branchMatches && (row.status ?? "").toLowerCase() === "pending";
    });
  }, [inspections, leadBranchByLeadId, branchId]);

  const scopedCompletedInspections = useMemo(() => {
    return inspections.filter((row) => {
      const leadBranchId = row.leadId ? leadBranchByLeadId.get(row.leadId) ?? null : null;
      const effectiveBranchId = row.branchId ?? leadBranchId ?? null;
      const branchMatches = !branchId || effectiveBranchId === branchId;
      return branchMatches && (row.status ?? "").toLowerCase() === "completed";
    });
  }, [inspections, leadBranchByLeadId, branchId]);

  const activeRows = useMemo(() => {
    const scopedJobCards = !branchId ? jobCards : jobCards.filter((row) => row.branchId === branchId);
    const normalizedStatus = (value?: string | null) => (value ?? "").toLowerCase();

    switch (activeTab as WorkshopTabId) {
      case "inquiries":
        return scopedJobCards.filter((row) => ["pending", "re-assigned"].includes(normalizedStatus(row.status)));
      case "quotes":
        return scopedJobCards.filter((row) => normalizedStatus(row.status).includes("quote"));
      case "inspections":
        return scopedInspections;
      case "completed-inspections":
        return scopedCompletedInspections;
      case "jobs":
        return scopedJobCards.filter((row) => {
          const value = normalizedStatus(row.status);
          return value.includes("progress") || value.includes("start");
        });
      case "completed":
        return scopedJobCards.filter((row) => {
          const value = normalizedStatus(row.status);
          return value.includes("complete") || value.includes("done");
        });
      case "cancelled":
        return scopedJobCards.filter((row) => normalizedStatus(row.status).includes("cancel"));
      default:
        return scopedJobCards;
    }
  }, [activeTab, branchId, jobCards, scopedCompletedInspections, scopedInspections]);

  const tabCounts = useMemo(() => {
    const scopedJobCards = !branchId ? jobCards : jobCards.filter((row) => row.branchId === branchId);
    const normalizedStatus = (value?: string | null) => (value ?? "").toLowerCase();
    return {
      inquiries: scopedJobCards.filter((row) => ["pending", "re-assigned"].includes(normalizedStatus(row.status))).length,
      quotes: scopedJobCards.filter((row) => normalizedStatus(row.status).includes("quote")).length,
      inspections: scopedInspections.length,
      "completed-inspections": scopedCompletedInspections.length,
      jobs: scopedJobCards.filter((row) => {
        const value = normalizedStatus(row.status);
        return value.includes("progress") || value.includes("start");
      }).length,
      completed: scopedJobCards.filter((row) => {
        const value = normalizedStatus(row.status);
        return value.includes("complete") || value.includes("done");
      }).length,
      cancelled: scopedJobCards.filter((row) => normalizedStatus(row.status).includes("cancel")).length,
    } as Record<WorkshopTabId, number>;
  }, [branchId, jobCards, scopedCompletedInspections, scopedInspections]);

  const isInspectionTab = activeTab === "inspections" || activeTab === "completed-inspections";

  const rangeFilteredRows = useMemo(() => {
    if (activeTab !== "completed-inspections") return activeRows;
    if (!completedDateFilterEnabled) return activeRows;
    const from = new Date(completedDateRange.startDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(completedDateRange.endDate);
    to.setHours(23, 59, 59, 999);
    return (activeRows as InspectionRow[]).filter((row) => {
      const raw = getInspectionDate(row, activeTab as WorkshopTabId);
      if (!raw) return false;
      const value = new Date(raw);
      if (Number.isNaN(value.getTime())) return false;
      if (from && value < from) return false;
      if (to && value > to) return false;
      return true;
    });
  }, [activeRows, activeTab, completedDateFilterEnabled, completedDateRange.endDate, completedDateRange.startDate]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rangeFilteredRows;

    if (isInspectionTab) {
      return (rangeFilteredRows as InspectionRow[]).filter((row) => {
        const haystack = [
          row.id,
          row.status,
          row.car?.plate_number,
          row.car?.make,
          row.car?.model,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      });
    }

    return (rangeFilteredRows as JobCardRow[]).filter((row) => {
      const haystack = [
        row.id,
        row.make,
        row.model,
        row.status,
        row.estimateId,
        row.customerName,
        row.customerPhone,
        row.plateNumber,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [isInspectionTab, rangeFilteredRows, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / entriesPerPage));
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const startIndex = (currentPage - 1) * entriesPerPage;
  const displayRows = filteredRows.slice(startIndex, startIndex + entriesPerPage);
  const startEntry = filteredRows.length === 0 ? 0 : startIndex + 1;
  const endEntry = Math.min(filteredRows.length, startIndex + displayRows.length);
  const canPrevious = currentPage > 1;
  const canNext = currentPage < totalPages;
  const searchPlaceholder = isInspectionTab ? "Search inspections" : "Search job cards";

  return (
    <div className="space-y-4 py-4">
      <div className={`${theme.cardBg} rounded-2xl p-4 sm:p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.18em] text-primary/80">Workshop Command Center</p>
            <h1 className="text-xl sm:text-2xl font-semibold">Workshop</h1>
            <p className="text-sm text-muted-foreground">Track branch workshop inquiries, inspections, and job cards.</p>
          </div>
          {branchId && (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
              Branch {branchId}
            </span>
          )}
        </div>
      </div>

      <div className={`${theme.cardBg} rounded-2xl p-3`}>
        <div className="space-y-3">
          <div className="rounded-2xl bg-background/70 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="w-full overflow-x-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20">
                <div className="inline-flex min-w-max flex-nowrap gap-2 text-xs">
                {WORKSHOP_TABS.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`min-w-[96px] shrink-0 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-medium transition ${
                        isActive
                          ? "bg-gradient-to-b from-emerald-500/30 to-emerald-500/10 text-emerald-100 shadow-[0_0_8px_rgba(16,185,129,0.35)] border border-emerald-400/40"
                          : "bg-white/5 text-white/70 border border-white/10 hover:text-white hover:border-white/30"
                      }`}
                    >
                      {tab.label}
                      <span
                        className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                          isActive ? "bg-emerald-200/20 text-emerald-100" : "bg-white/15 text-white/90"
                        }`}
                      >
                        {tabCounts[tab.id]}
                      </span>
                    </button>
                  );
                })}
                </div>
              </div>
              <div className="text-xs text-foreground/80">{filteredRows.length} entries</div>
            </div>

            <div className="px-4 pt-3 text-xs text-foreground/80">
              {WORKSHOP_TABS.find((tab) => tab.id === activeTab)?.description}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3  px-4 py-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-foreground/80">Show</span>
                <select
                  value={entriesPerPage}
                  onChange={(event) => setEntriesPerPage(Number(event.target.value))}
                  className="rounded-md bg-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {ENTRY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <span className="text-foreground/80">entries</span>
              </div>
              {activeTab === "completed-inspections" && (
                <div className="relative flex items-center gap-2 text-xs text-foreground/80">
                  <button
                    type="button"
                    onClick={() => setShowCompletedDatePicker((prev) => !prev)}
                    className="rounded-md bg-white/10 px-2 py-1 text-white transition hover:bg-white/15"
                  >
                    {completedDateFilterEnabled
                      ? `${completedDateRange.startDate.toLocaleDateString()} - ${completedDateRange.endDate.toLocaleDateString()}`
                      : "Filter Date Range"}
                  </button>
                  {completedDateFilterEnabled && (
                    <button
                      type="button"
                      onClick={() => {
                        setCompletedDateFilterEnabled(false);
                        setShowCompletedDatePicker(false);
                      }}
                      className="rounded-md bg-white/10 px-2 py-1 text-white transition hover:bg-white/15"
                    >
                      Clear
                    </button>
                  )}
                  {showCompletedDatePicker && (
                    <div className="absolute left-0 top-8 z-30 overflow-hidden rounded-lg border border-white/10 bg-slate-950 shadow-xl">
                      <DateRange
                        onChange={(ranges: any) => {
                          const selection = ranges?.selection;
                          if (!selection?.startDate || !selection?.endDate) return;
                          setCompletedDateRange({
                            key: "selection",
                            startDate: selection.startDate,
                            endDate: selection.endDate,
                          });
                          setCompletedDateFilterEnabled(true);
                        }}
                        moveRangeOnFirstSelection={false}
                        ranges={[completedDateRange]}
                        rangeColors={["#10b981"]}
                        months={1}
                        direction="horizontal"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="relative w-full max-w-xs">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-lg bg-white/10 px-3 py-2 pr-9 text-sm text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/60">
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

            {error && <div className="px-4 pt-3 text-xs text-red-500">{error}</div>}

            <div className="space-y-3 px-3 pb-3 pt-2 md:hidden">
              {loading ? (
                <div className="rounded-xl bg-white/5 px-3 py-4 text-center text-sm text-foreground/80">
                  Loading workshop data...
                </div>
              ) : displayRows.length === 0 ? (
                <div className="rounded-xl bg-white/5 px-3 py-4 text-center text-sm text-foreground/80">
                  {isInspectionTab ? "No inspections found." : "No job cards found."}
                </div>
              ) : isInspectionTab ? (
                (displayRows as InspectionRow[]).map((row) => (
                  <div key={row.id} className="rounded-xl bg-card/50 p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-primary">{row.id}</div>
                        <div className="text-xs text-foreground/70">
                          {[row.car?.make, row.car?.model, row.car?.plate_number].filter(Boolean).join(" ") || "-"}
                        </div>
                      </div>
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${getStatusTone(row.status)}`}>
                        {row.status ?? "Pending"}
                      </span>
                    </div>
                    <div className="mt-3 text-xs text-foreground/70">{formatDate(getInspectionDate(row, activeTab as WorkshopTabId))}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <a
                        href={
                          branchId
                            ? `/company/${companyId}/branches/${branchId}/workshop/inspections/${row.id}`
                            : `/company/${companyId}/inspections/${row.id}?view=workshop`
                        }
                        className="inline-flex items-center rounded-md border border-white/25 bg-transparent px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm transition hover:bg-white/10"
                      >
                        Open Inspection
                      </a>
                    </div>
                  </div>
                ))
              ) : (
                (displayRows as JobCardRow[]).map((row) => (
                  <div key={row.id} className="rounded-xl bg-card/50 p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-primary">{row.id}</div>
                        <div className="text-xs text-foreground/70">{getCarLabel(row) || "-"}</div>
                      </div>
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${getStatusTone(row.status)}`}>
                        {row.status ?? "Pending"}
                      </span>
                    </div>

                    <div className="mt-3 text-xs text-foreground/70">{formatDate(row.createdAt)}</div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <a
                        href={`/company/${companyId}/workshop/job-cards/${row.id}`}
                        className="inline-flex items-center rounded-md bg-background px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground shadow-sm transition hover:bg-muted/30"
                      >
                        View Jobcard
                      </a>
                      <button
                        type="button"
                        className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground shadow-sm transition hover:opacity-90 hover:shadow-md"
                      >
                        Add Quote
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="hidden overflow-x-auto md:block">
              {isInspectionTab ? (
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left bg-white/5">
                      <th className="px-4 py-3 sticky top-0 bg-white/5 backdrop-blur text-xs font-semibold text-foreground/85">
                        Inspection ID
                      </th>
                      <th className="px-4 py-3 sticky top-0 bg-white/5 backdrop-blur text-xs font-semibold text-foreground/85">
                        Vehicle
                      </th>
                      <th className="px-4 py-3 sticky top-0 bg-white/5 backdrop-blur text-xs font-semibold text-foreground/85">
                        Status
                      </th>
                      <th className="px-4 py-3 sticky top-0 bg-white/5 backdrop-blur text-xs font-semibold text-foreground/85">
                        Updated
                      </th>
                      <th className="px-4 py-3 sticky top-0 bg-white/5 backdrop-blur text-xs font-semibold text-foreground/85 text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td className="px-3 py-6 text-foreground/70 text-center" colSpan={5}>
                          Loading workshop data...
                        </td>
                      </tr>
                    ) : displayRows.length === 0 ? (
                      <tr>
                        <td className="px-3 py-6 text-foreground/70 text-center" colSpan={5}>
                          No inspections found.
                        </td>
                      </tr>
                    ) : (
                      (displayRows as InspectionRow[]).map((row) => (
                        <tr key={row.id} className="hover:bg-muted/20">
                          <td className="px-4 py-3  font-semibold">{row.id}</td>
                          <td className="px-4 py-3 ">
                            {[row.car?.make, row.car?.model, row.car?.plate_number].filter(Boolean).join(" ") || "-"}
                          </td>
                          <td className="px-4 py-3 ">
                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${getStatusTone(row.status)}`}>
                              {row.status ?? "Pending"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-foreground/70">{formatDate(getInspectionDate(row, activeTab as WorkshopTabId))}</td>
                          <td className="px-4 py-3  text-right">
                            <a
                              href={
                                branchId
                                  ? `/company/${companyId}/branches/${branchId}/workshop/inspections/${row.id}`
                                  : `/company/${companyId}/inspections/${row.id}?view=workshop`
                              }
                              className="inline-flex items-center rounded-md border border-white/25 bg-transparent px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm transition hover:bg-white/10"
                            >
                              Open
                            </a>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left bg-white/5">
                      <th className="px-4 py-3 sticky top-0 bg-white/5 backdrop-blur text-xs font-semibold text-foreground/85">
                        Job ID
                      </th>
                      <th className="px-4 py-3 sticky top-0 bg-white/5 backdrop-blur text-xs font-semibold text-foreground/85">
                        Make
                      </th>
                      <th className="px-4 py-3 sticky top-0 bg-white/5 backdrop-blur text-xs font-semibold text-foreground/85">
                        Job Card
                      </th>
                      <th className="px-4 py-3 sticky top-0 bg-white/5 backdrop-blur text-xs font-semibold text-foreground/85">
                        Status
                      </th>
                      <th className="px-4 py-3 sticky top-0 bg-white/5 backdrop-blur text-xs font-semibold text-foreground/85">
                        Date
                      </th>
                      <th className="px-4 py-3 sticky top-0 bg-white/5 backdrop-blur text-xs font-semibold text-foreground/85 text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td className="px-3 py-6 text-foreground/70 text-center" colSpan={6}>
                          Loading workshop data...
                        </td>
                      </tr>
                    ) : displayRows.length === 0 ? (
                      <tr>
                        <td className="px-3 py-6 text-foreground/70 text-center" colSpan={6}>
                          No job cards found.
                        </td>
                      </tr>
                    ) : (
                      (displayRows as JobCardRow[]).map((row) => (
                        <tr key={row.id} className="hover:bg-muted/20">
                          <td className="px-4 py-3  font-semibold">{row.id}</td>
                          <td className="px-4 py-3 ">{getCarLabel(row) || "-"}</td>
                          <td className="px-4 py-3 ">
                            <a
                              href={`/company/${companyId}/workshop/job-cards/${row.id}`}
                              className="inline-flex items-center rounded-md bg-background px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground shadow-sm transition hover:bg-muted/30"
                            >
                              View Jobcard
                            </a>
                          </td>
                          <td className="px-4 py-3 ">
                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${getStatusTone(row.status)}`}>
                              {row.status ?? "Pending"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-foreground/70">{formatDate(row.createdAt)}</td>
                          <td className="px-4 py-3  text-right">
                            <button
                              type="button"
                              className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground shadow-sm transition hover:opacity-90 hover:shadow-md"
                            >
                              Add Quote
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {!loading && !error && (
              <div className="flex items-center justify-between px-4 py-3 text-xs text-foreground/75">
                <span>
                  Showing {startEntry} to {endEntry} of {filteredRows.length}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={!canPrevious}
                    className="rounded-md bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-70 disabled:text-white/55 disabled:shadow-none"
                  >
                    Previous
                  </button>
                  <span className="inline-flex items-center px-2 text-sm font-semibold text-foreground">{currentPage}</span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={!canNext}
                    className="rounded-md bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-70 disabled:text-white/55 disabled:shadow-none"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

