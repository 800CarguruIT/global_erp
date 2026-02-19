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
type QuoteRow = {
  id: string;
  quoteType?: string | null;
  status?: string | null;
  estimateId?: string | null;
  branchId?: string | null;
  totalAmount?: number | null;
  currency?: string | null;
  updatedAt?: string | null;
  etaPreset?: string | null;
  etaHours?: number | null;
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
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
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
  const [quoteModalRow, setQuoteModalRow] = useState<JobCardRow | null>(null);
  const [quoteAmount, setQuoteAmount] = useState("");
  const [quoteRemarks, setQuoteRemarks] = useState("");
  const [quoteEtaPreset, setQuoteEtaPreset] = useState("");
  const [quoteEtaHours, setQuoteEtaHours] = useState("");
  const [isSubmittingQuote, setIsSubmittingQuote] = useState(false);
  const [quoteModalError, setQuoteModalError] = useState<string | null>(null);
  const [loadedResources, setLoadedResources] = useState({
    jobCards: false,
    inspections: false,
    leads: false,
    quotes: false,
  });
  const [refreshing, setRefreshing] = useState(false);

  const normalizeJobCards = (jobCardRows: Array<Record<string, unknown>>): JobCardRow[] =>
    jobCardRows.map((row) => ({
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

  const normalizeInspections = (inspectionRows: Array<Record<string, unknown>>): InspectionRow[] =>
    inspectionRows.map((row) => ({
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

  const normalizeLeads = (leadRows: Array<Record<string, unknown>>): LeadRow[] =>
    leadRows.map((row) => ({
          id: typeof row.id === "string" ? row.id : "",
          branchId:
            typeof row.branchId === "string"
              ? row.branchId
              : typeof row.branch_id === "string"
              ? row.branch_id
              : null,
        }));

  const normalizeQuotes = (quoteRows: Array<Record<string, unknown>>): QuoteRow[] =>
    quoteRows.map((row) => {
      const meta = row.meta as Record<string, unknown> | null;
      return {
            id: typeof row.id === "string" ? row.id : "",
            quoteType:
              typeof row.quoteType === "string"
                ? row.quoteType
                : typeof row.quote_type === "string"
                ? row.quote_type
                : null,
            status: typeof row.status === "string" ? row.status : null,
            estimateId:
              typeof row.estimateId === "string"
                ? row.estimateId
                : typeof row.estimate_id === "string"
                ? row.estimate_id
                : null,
            branchId:
              typeof row.branchId === "string"
                ? row.branchId
                : typeof row.branch_id === "string"
                ? row.branch_id
                : null,
            totalAmount:
              typeof row.totalAmount === "number"
                ? row.totalAmount
                : typeof row.total_amount === "number"
                ? row.total_amount
                : null,
            currency:
              typeof row.currency === "string" ? row.currency : null,
            updatedAt:
              typeof row.updatedAt === "string"
                ? row.updatedAt
                : typeof row.updated_at === "string"
                ? row.updated_at
                : null,
            etaPreset: typeof meta?.estimatedTimePreset === "string" ? meta.estimatedTimePreset : null,
            etaHours:
              typeof meta?.estimatedHours === "number"
                ? meta.estimatedHours
                : typeof meta?.estimatedHours === "string"
                ? Number(meta.estimatedHours)
                : null,
          };
    });

  const fetchJobCards = async () => {
    const res = await fetch(`/api/company/${companyId}/workshop/job-cards`);
    if (!res.ok) throw new Error(`Job cards HTTP ${res.status}`);
    const json = await res.json();
    const rows = (json.data ?? []) as Array<Record<string, unknown>>;
    setJobCards(normalizeJobCards(rows).filter((row) => row.id));
  };

  const fetchInspections = async () => {
    const res = await fetch(`/api/company/${companyId}/workshop/inspections`);
    if (!res.ok) throw new Error(`Inspections HTTP ${res.status}`);
    const json = await res.json();
    const rows = (json.data ?? []) as Array<Record<string, unknown>>;
    setInspections(normalizeInspections(rows).filter((row) => row.id));
  };

  const fetchLeads = async () => {
    const res = await fetch(`/api/company/${companyId}/sales/leads`);
    if (!res.ok) throw new Error(`Leads HTTP ${res.status}`);
    const json = await res.json();
    const rows = (json.data ?? []) as Array<Record<string, unknown>>;
    setLeads(normalizeLeads(rows).filter((row) => row.id));
  };

  const fetchQuotes = async () => {
    const res = await fetch(`/api/company/${companyId}/workshop/quotes`);
    if (!res.ok) throw new Error(`Quotes HTTP ${res.status}`);
    const json = await res.json();
    const rows = (json.data ?? []) as Array<Record<string, unknown>>;
    setQuotes(normalizeQuotes(rows).filter((row) => row.id));
  };

  const getResourcesForTab = (tabId: WorkshopTabId) => {
    if (tabId === "inspections" || tabId === "completed-inspections") {
      return ["inspections", "leads"] as const;
    }
    return ["jobCards", "quotes"] as const;
  };

  const loadTabData = async (tabId: WorkshopTabId, force = false) => {
    const needed = getResourcesForTab(tabId);
    const tasks: Array<Promise<void>> = [];
    if (needed.includes("jobCards") && (force || !loadedResources.jobCards)) tasks.push(fetchJobCards());
    if (needed.includes("quotes") && (force || !loadedResources.quotes)) tasks.push(fetchQuotes());
    if (needed.includes("inspections") && (force || !loadedResources.inspections)) tasks.push(fetchInspections());
    if (needed.includes("leads") && (force || !loadedResources.leads)) tasks.push(fetchLeads());

    if (tasks.length === 0) return;
    setError(null);
    setLoading(!force);
    setRefreshing(force);
    try {
      await Promise.all(tasks);
      setLoadedResources((prev) => ({
        ...prev,
        ...(needed.includes("jobCards") ? { jobCards: true } : {}),
        ...(needed.includes("quotes") ? { quotes: true } : {}),
        ...(needed.includes("inspections") ? { inspections: true } : {}),
        ...(needed.includes("leads") ? { leads: true } : {}),
      }));
    } catch {
      setError("Failed to load workshop data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setJobCards([]);
    setInspections([]);
    setLeads([]);
    setQuotes([]);
    setLoadedResources({
      jobCards: false,
      inspections: false,
      leads: false,
      quotes: false,
    });
  }, [companyId]);

  useEffect(() => {
    void loadTabData(activeTab as WorkshopTabId, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, companyId]);

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

  const latestQuoteByEstimateId = useMemo(() => {
    const map = new Map<string, QuoteRow>();
    const scopedQuotes = quotes
      .filter((quote) => (quote.quoteType ?? "").toLowerCase() === "branch_labor")
      .filter((quote) => !branchId || quote.branchId === branchId)
      .sort((a, b) => {
        const ad = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bd = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bd - ad;
      });
    for (const quote of scopedQuotes) {
      const estimateId = String(quote.estimateId ?? "").trim();
      if (!estimateId || map.has(estimateId)) continue;
      map.set(estimateId, quote);
    }
    return map;
  }, [branchId, quotes]);

  const getInquiryQuoteState = (row: JobCardRow) => {
    const quote = row.estimateId ? latestQuoteByEstimateId.get(row.estimateId) : null;
    const status = (quote?.status ?? "").toLowerCase();
    const isLocked = !!quote && status !== "rejected";
    const label = !quote ? "Add Quote" : status === "rejected" ? "Resubmit Quote" : "Quote Submitted";
    return { quote, isLocked, label };
  };

  const getJobCardHref = (id: string) =>
    `/company/${companyId}/workshop/job-cards/${id}?view=workshop${branchId ? `&branchId=${branchId}` : ""}`;

  const activeRows = useMemo(() => {
    const scopedJobCards = !branchId ? jobCards : jobCards.filter((row) => row.branchId === branchId);
    const normalizedStatus = (value?: string | null) => (value ?? "").toLowerCase();
    const latestQuoteStatus = (row: JobCardRow) =>
      (row.estimateId ? latestQuoteByEstimateId.get(row.estimateId)?.status : null)?.toLowerCase() ?? "";

    switch (activeTab as WorkshopTabId) {
      case "inquiries":
        return scopedJobCards.filter((row) => ["pending", "re-assigned"].includes(normalizedStatus(row.status)));
      case "quotes":
        return scopedJobCards.filter((row) => {
          if (!row.estimateId) return false;
          const quote = latestQuoteByEstimateId.get(row.estimateId);
          if (!quote) return false;
          const qStatus = (quote.status ?? "").toLowerCase();
          return ["pending", "quoted", "negotiation"].includes(qStatus);
        });
      case "inspections":
        return scopedInspections;
      case "completed-inspections":
        return scopedCompletedInspections;
      case "jobs":
        return scopedJobCards.filter((row) => {
          const value = normalizedStatus(row.status);
          const completedByTime = Boolean(row.completeAt);
          const completedByStatus = value.includes("complete") || value.includes("done");
          if (completedByTime || completedByStatus) return false;
          return value.includes("progress") || value.includes("start") || latestQuoteStatus(row) === "accepted";
        });
      case "completed":
        return scopedJobCards.filter((row) => {
          const value = normalizedStatus(row.status);
          return value.includes("complete") || value.includes("done") || Boolean(row.completeAt);
        });
      case "cancelled":
        return scopedJobCards.filter((row) => normalizedStatus(row.status).includes("cancel"));
      default:
        return scopedJobCards;
    }
  }, [activeTab, branchId, jobCards, scopedCompletedInspections, scopedInspections, latestQuoteByEstimateId]);

  const tabCounts = useMemo(() => {
    const scopedJobCards = !branchId ? jobCards : jobCards.filter((row) => row.branchId === branchId);
    const normalizedStatus = (value?: string | null) => (value ?? "").toLowerCase();
    const latestQuoteStatus = (row: JobCardRow) =>
      (row.estimateId ? latestQuoteByEstimateId.get(row.estimateId)?.status : null)?.toLowerCase() ?? "";
    return {
      inquiries: scopedJobCards.filter((row) => ["pending", "re-assigned"].includes(normalizedStatus(row.status))).length,
      quotes: scopedJobCards.filter((row) => {
        if (!row.estimateId) return false;
        const quote = latestQuoteByEstimateId.get(row.estimateId);
        if (!quote) return false;
        const qStatus = (quote.status ?? "").toLowerCase();
        return ["pending", "quoted", "negotiation"].includes(qStatus);
      }).length,
      inspections: scopedInspections.length,
      "completed-inspections": scopedCompletedInspections.length,
      jobs: scopedJobCards.filter((row) => {
        const value = normalizedStatus(row.status);
        const completedByTime = Boolean(row.completeAt);
        const completedByStatus = value.includes("complete") || value.includes("done");
        if (completedByTime || completedByStatus) return false;
        return value.includes("progress") || value.includes("start") || latestQuoteStatus(row) === "accepted";
      }).length,
      completed: scopedJobCards.filter((row) => {
        const value = normalizedStatus(row.status);
        return value.includes("complete") || value.includes("done") || Boolean(row.completeAt);
      }).length,
      cancelled: scopedJobCards.filter((row) => normalizedStatus(row.status).includes("cancel")).length,
    } as Record<WorkshopTabId, number>;
  }, [branchId, jobCards, scopedCompletedInspections, scopedInspections, latestQuoteByEstimateId]);

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

  const openQuoteModal = (row: JobCardRow) => {
    setQuoteModalRow(row);
    setQuoteAmount("");
    setQuoteRemarks("");
    setQuoteEtaPreset("");
    setQuoteEtaHours("");
    setQuoteModalError(null);
  };

  const closeQuoteModal = () => {
    if (isSubmittingQuote) return;
    setQuoteModalRow(null);
    setQuoteAmount("");
    setQuoteRemarks("");
    setQuoteEtaPreset("");
    setQuoteEtaHours("");
    setQuoteModalError(null);
  };

  const submitQuote = async () => {
    if (!quoteModalRow?.id) return;
    const amount = Number(quoteAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setQuoteModalError("Enter a valid quoted amount.");
      return;
    }
    if (quoteEtaPreset === "same_day") {
      const hours = Number(quoteEtaHours);
      if (!Number.isFinite(hours) || hours <= 0) {
        setQuoteModalError("Enter estimated hours for same-day delivery.");
        return;
      }
    }
    if (!quoteEtaPreset) {
      setQuoteModalError("Select estimated time.");
      return;
    }
    setIsSubmittingQuote(true);
    setQuoteModalError(null);
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/job-cards/${quoteModalRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "quote",
          quotedAmount: amount,
          remarks: quoteRemarks.trim() || null,
          estimatedTimePreset: quoteEtaPreset,
          estimatedHours: quoteEtaPreset === "same_day" ? Number(quoteEtaHours) : null,
          branchId: branchId ?? null,
          currency: "AED",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setQuoteModalError(json?.error ?? "Failed to submit quote.");
        return;
      }
      if (quoteModalRow.estimateId) {
        setQuotes((prev) => {
          const next = [...prev];
          const currentIdx = next.findIndex(
            (item) =>
              item.estimateId === quoteModalRow.estimateId &&
              ((!branchId && !item.branchId) || item.branchId === branchId) &&
              (item.quoteType ?? "").toLowerCase() === "branch_labor"
          );
          const updatedQuote: QuoteRow = {
            id: currentIdx >= 0 ? next[currentIdx].id : `local-${quoteModalRow.id}`,
            quoteType: "branch_labor",
            status: "pending",
            estimateId: quoteModalRow.estimateId,
            branchId: branchId ?? null,
            totalAmount: amount,
            currency: "AED",
            updatedAt: new Date().toISOString(),
            etaPreset: quoteEtaPreset || null,
            etaHours: quoteEtaPreset === "same_day" ? Number(quoteEtaHours) : null,
          };
          if (currentIdx >= 0) next[currentIdx] = updatedQuote;
          else next.push(updatedQuote);
          return next;
        });
      }
      setJobCards((prev) =>
        prev.map((row) => (row.id === quoteModalRow.id ? { ...row, status: "Quoted" } : row))
      );
      closeQuoteModal();
    } catch {
      setQuoteModalError("Failed to submit quote.");
    } finally {
      setIsSubmittingQuote(false);
    }
  };

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
                <button
                  type="button"
                  onClick={() => {
                    void loadTabData(activeTab as WorkshopTabId, true);
                  }}
                  disabled={refreshing}
                  className="rounded-md bg-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {refreshing ? "Refreshing..." : "Refresh"}
                </button>
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
                    {(() => {
                      const quote = row.estimateId ? latestQuoteByEstimateId.get(row.estimateId) : null;
                      const inquiryQuoteState = getInquiryQuoteState(row);
                      return (
                        <>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-primary">{row.id}</div>
                        <div className="text-xs text-foreground/70">{getCarLabel(row) || "-"}</div>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${getStatusTone(
                          activeTab === "quotes" ? quote?.status : row.status
                        )}`}
                      >
                        {activeTab === "quotes" ? quote?.status ?? "Pending" : row.status ?? "Pending"}
                      </span>
                    </div>

                    <div className="mt-3 text-xs text-foreground/70">
                      {formatDate(activeTab === "quotes" ? quote?.updatedAt ?? row.createdAt : row.createdAt)}
                    </div>

                    {activeTab === "quotes" && quote ? (
                      <div className="mt-2 rounded-md border border-white/10 bg-white/5 p-2 text-xs text-foreground/80">
                        <div>Quote: {quote.id.slice(0, 8)}...</div>
                        <div>
                          Amount: {(quote.currency ?? "AED")} {Number(quote.totalAmount ?? 0).toFixed(2)}
                        </div>
                        <div>
                          ETA: {quote.etaPreset ? quote.etaPreset.replace(/_/g, " ") : "-"}
                          {quote.etaPreset === "same_day" && quote.etaHours ? ` (${quote.etaHours}h)` : ""}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <a
                        href={getJobCardHref(row.id)}
                        className="inline-flex items-center rounded-md border border-primary/45 bg-primary/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary shadow-sm transition hover:bg-primary/20"
                      >
                        Open Job Card
                      </a>
                      {activeTab === "inquiries" ? (
                        <button
                          type="button"
                          onClick={() => openQuoteModal(row)}
                          disabled={inquiryQuoteState.isLocked}
                          className="inline-flex items-center rounded-md border border-primary/50 bg-transparent px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary shadow-sm transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:border-white/20 disabled:text-white/55 disabled:hover:bg-transparent"
                        >
                          {inquiryQuoteState.label}
                        </button>
                      ) : activeTab === "quotes" ? null : (
                        activeTab === "jobs" ? null : (
                        <a
                          href={
                            row.estimateId
                              ? `/company/${companyId}/estimates/${row.estimateId}`
                              : getJobCardHref(row.id)
                          }
                          className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground shadow-sm transition hover:opacity-90 hover:shadow-md"
                        >
                          Add Quote
                        </a>
                        )
                      )}
                    </div>
                        </>
                      );
                    })()}
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
                        {activeTab === "quotes" ? "Quote" : "Make"}
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
                          {(() => {
                            const quote = row.estimateId ? latestQuoteByEstimateId.get(row.estimateId) : null;
                            const inquiryQuoteState = getInquiryQuoteState(row);
                            return (
                              <>
                          <td className="px-4 py-3  font-semibold">{row.id}</td>
                          <td className="px-4 py-3 ">
                            {activeTab === "quotes" && quote ? (
                              <div className="space-y-0.5 text-xs">
                                <div>{quote.id.slice(0, 8)}...</div>
                                <div>
                                  {(quote.currency ?? "AED")} {Number(quote.totalAmount ?? 0).toFixed(2)}
                                </div>
                                <div className="text-[10px] text-foreground/70">
                                  ETA: {quote.etaPreset ? quote.etaPreset.replace(/_/g, " ") : "-"}
                                  {quote.etaPreset === "same_day" && quote.etaHours ? ` (${quote.etaHours}h)` : ""}
                                </div>
                              </div>
                            ) : (
                              getCarLabel(row) || "-"
                            )}
                          </td>
                          <td className="px-4 py-3 ">
                            <a
                              href={getJobCardHref(row.id)}
                              className="inline-flex items-center rounded-md border border-primary/45 bg-primary/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary shadow-sm transition hover:bg-primary/20"
                            >
                              Open Job Card
                            </a>
                          </td>
                          <td className="px-4 py-3 ">
                            <span
                              className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${getStatusTone(
                                activeTab === "quotes" ? quote?.status : row.status
                              )}`}
                            >
                              {activeTab === "quotes" ? quote?.status ?? "Pending" : row.status ?? "Pending"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-foreground/70">
                            {formatDate(activeTab === "quotes" ? quote?.updatedAt ?? row.createdAt : row.createdAt)}
                          </td>
                          <td className="px-4 py-3  text-right">
                            {activeTab === "inquiries" ? (
                              <button
                                type="button"
                                onClick={() => openQuoteModal(row)}
                                disabled={inquiryQuoteState.isLocked}
                                className="inline-flex items-center rounded-md border border-primary/50 bg-transparent px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary shadow-sm transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:border-white/20 disabled:text-white/55 disabled:hover:bg-transparent"
                              >
                                {inquiryQuoteState.label}
                              </button>
                            ) : activeTab === "quotes" ? (
                              <span className="text-xs text-foreground/55">-</span>
                            ) : (
                              activeTab === "jobs" ? (
                                <span className="text-xs text-foreground/55">-</span>
                              ) : (
                                <a
                                  href={
                                    row.estimateId
                                      ? `/company/${companyId}/estimates/${row.estimateId}`
                                      : getJobCardHref(row.id)
                                  }
                                  className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground shadow-sm transition hover:opacity-90 hover:shadow-md"
                                >
                                  Add Quote
                                </a>
                              )
                            )}
                          </td>
                              </>
                            );
                          })()}
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
      {quoteModalRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className={`${theme.cardBg} w-full max-w-md rounded-xl p-4 shadow-2xl`}>
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold">Submit Quote</h3>
                <p className="text-xs text-muted-foreground">Job {quoteModalRow.id}</p>
              </div>
              <button
                type="button"
                onClick={closeQuoteModal}
                disabled={isSubmittingQuote}
                className="rounded-md border border-white/20 px-2 py-1 text-xs text-white/80 hover:bg-white/10"
              >
                Close
              </button>
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-white/80">
                  Quoted Amount
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={quoteAmount}
                  onChange={(event) => setQuoteAmount(event.target.value)}
                  className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-primary"
                  placeholder="Enter amount"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-white/80">
                  Remarks (optional)
                </span>
                <textarea
                  value={quoteRemarks}
                  onChange={(event) => setQuoteRemarks(event.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-primary"
                  placeholder="Any quote notes"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-white/80">
                  Estimated Time
                </span>
                <select
                  value={quoteEtaPreset}
                  onChange={(event) => setQuoteEtaPreset(event.target.value)}
                  className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-primary"
                >
                  <option className="bg-white text-slate-900" value="">
                    Select estimated time
                  </option>
                  <option className="bg-white text-slate-900" value="same_day">Same Day</option>
                  <option className="bg-white text-slate-900" value="1_day">1 Day</option>
                  <option className="bg-white text-slate-900" value="2_days">2 Days</option>
                  <option className="bg-white text-slate-900" value="3_days">3 Days</option>
                  <option className="bg-white text-slate-900" value="1_week">1 Week</option>
                  <option className="bg-white text-slate-900" value="2_weeks">2 Weeks</option>
                </select>
              </label>
              {quoteEtaPreset === "same_day" && (
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-white/80">
                    Estimated Hours
                  </span>
                  <select
                    value={quoteEtaHours}
                    onChange={(event) => setQuoteEtaHours(event.target.value)}
                    className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-primary"
                  >
                    <option className="bg-white text-slate-900" value="">
                      Select hours
                    </option>
                    <option className="bg-white text-slate-900" value="1">1 hour</option>
                    <option className="bg-white text-slate-900" value="2">2 hours</option>
                    <option className="bg-white text-slate-900" value="3">3 hours</option>
                    <option className="bg-white text-slate-900" value="4">4 hours</option>
                    <option className="bg-white text-slate-900" value="5">5 hours</option>
                    <option className="bg-white text-slate-900" value="6">6 hours</option>
                    <option className="bg-white text-slate-900" value="7">7 hours</option>
                    <option className="bg-white text-slate-900" value="8">8 hours</option>
                  </select>
                </label>
              )}
              {quoteModalError && <div className="text-xs text-rose-400">{quoteModalError}</div>}
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeQuoteModal}
                  disabled={isSubmittingQuote}
                  className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/85 hover:bg-white/10 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitQuote}
                  disabled={isSubmittingQuote}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {isSubmittingQuote ? "Submitting..." : "Submit Quote"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

