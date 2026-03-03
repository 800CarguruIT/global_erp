"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppLayout, Card, FileUploader, useTheme } from "@repo/ui";
import { toast } from "sonner";
import type { Lead } from "@repo/ai-core/crm/leads/types";
import {
  serviceRequestTypeLabels,
  serviceRequestTypes,
  type ServiceRequestType,
} from "@repo/ai-core/crm/leads/service-request-types";
import type { Inspection } from "@repo/ai-core/workshop/inspections/types";
import type { Estimate } from "@repo/ai-core/workshop/estimates/types";

type Params = {
  params:
    | { companyId: string; customerId: string }
    | Promise<{ companyId: string; customerId: string }>;
};

type CustomerCarLink = {
  car: any;
  link: any;
};

type TabId =
  | "leads"
  | "inspections"
  | "estimates"
  | "invoices"
  | "contracts"
  | "followups"
  | "calls";

type WalletTransactionRow = {
  id: string;
  serial_no?: number | null;
  amount: number;
  payment_method?: string | null;
  payment_date?: string | null;
  payment_proof_file_id?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  approved_by_name?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

type CustomerInvoiceRow = {
  id: string;
  invoice_number?: string | null;
  invoice_date?: string | null;
  status?: string | null;
  payment_method?: string | null;
  grand_total?: number | null;
  paid_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  car_plate?: string | null;
  advisor_name?: string | null;
};

type AppointmentFormState = {
  appointmentAt: string;
  type: "walkin" | "recovery";
  recoveryType: "pickup" | "dropoff";
  pickupLocation: string;
  dropoffLocation: string;
  remarks: string;
  serviceType: ServiceRequestType;
};

type CustomerKpis = {
  totalLeads: number;
  openLeads: number;
  completedRate: number;
  totalEstimates: number;
  draftEstimates: number;
  finalizedEstimates: number;
  carsLinked: number;
  walletAmount: number;
  lastActivityAt: string | null;
};

type RsaLeadDivision =
  | "Battery"
  | "Battery_Replacement"
  | "Tyre_Service"
  | "New_Tyre_Installation"
  | "Fluid_Topup"
  | "Inspection"
  | "Fuel_Delivery";

type RsaLeadFormState = {
  carId: string;
  division: RsaLeadDivision | "";
  locationLinkRsa: string;
  remarks: string;
};

const getInitialAppointmentForm = (): AppointmentFormState => ({
  appointmentAt: "",
  type: "walkin",
  recoveryType: "pickup",
  pickupLocation: "",
  dropoffLocation: "",
  remarks: "",
  serviceType: serviceRequestTypes[0],
});

const RSA_LEAD_DIVISIONS: Array<{ value: RsaLeadDivision; label: string }> = [
  { value: "Battery", label: "New Battery" },
  { value: "Battery_Replacement", label: "Battery - Warranty Claim" },
  { value: "Tyre_Service", label: "Flat Tyre Service" },
  { value: "New_Tyre_Installation", label: "New Tyre Installation" },
  { value: "Fluid_Topup", label: "Fluid Topup" },
  { value: "Inspection", label: "Inspection" },
  { value: "Fuel_Delivery", label: "Fuel Delivery" },
];

const getInitialRsaLeadForm = (carId: string | null): RsaLeadFormState => ({
  carId: carId ?? "",
  division: "",
  locationLinkRsa: "",
  remarks: "",
});

export default function CustomerDetailPage({ params }: Params) {
  const { theme } = useTheme();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [linkedCars, setLinkedCars] = useState<CustomerCarLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("invoices");
  const [walletTransactions, setWalletTransactions] = useState<WalletTransactionRow[]>([]);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [customerInvoices, setCustomerInvoices] = useState<CustomerInvoiceRow[]>([]);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [customerLeads, setCustomerLeads] = useState<Lead[]>([]);
  const [customerLeadsLoading, setCustomerLeadsLoading] = useState(false);
  const [customerLeadsError, setCustomerLeadsError] = useState<string | null>(null);
  const [customerKpis, setCustomerKpis] = useState<CustomerKpis | null>(null);
  const [customerKpisLoading, setCustomerKpisLoading] = useState(false);
  const [leadSearch, setLeadSearch] = useState("");
  const [leadTypeFilter, setLeadTypeFilter] = useState("all");
  const [leadStatusFilter, setLeadStatusFilter] = useState("all");
  const [leadStageFilter, setLeadStageFilter] = useState("all");
  const [leadSortBy, setLeadSortBy] = useState<"id" | "leadType" | "leadStatus" | "leadStage" | "car" | "updatedAt">("updatedAt");
  const [leadSortDir, setLeadSortDir] = useState<"asc" | "desc">("desc");
  const [leadPageSize, setLeadPageSize] = useState<"10" | "25" | "50" | "100" | "all">("25");
  const [leadPage, setLeadPage] = useState(1);
  const [leadCarFilter, setLeadCarFilter] = useState<"selected" | "all" | string>("selected");
  const [customerInspections, setCustomerInspections] = useState<Inspection[]>([]);
  const [customerInspectionsLoading, setCustomerInspectionsLoading] = useState(false);
  const [customerInspectionsError, setCustomerInspectionsError] = useState<string | null>(null);
  const [inspectionSearch, setInspectionSearch] = useState("");
  const [inspectionStatusFilter, setInspectionStatusFilter] = useState("all");
  const [inspectionSortBy, setInspectionSortBy] = useState<"status" | "carId" | "startedAt" | "updatedAt">("updatedAt");
  const [inspectionSortDir, setInspectionSortDir] = useState<"asc" | "desc">("desc");
  const [inspectionPageSize, setInspectionPageSize] = useState<"10" | "25" | "50" | "100" | "all">("25");
  const [inspectionPage, setInspectionPage] = useState(1);
  const [inspectionCarFilter, setInspectionCarFilter] = useState<"selected" | "all" | string>("selected");
  const [customerEstimates, setCustomerEstimates] = useState<Estimate[]>([]);
  const [customerEstimatesLoading, setCustomerEstimatesLoading] = useState(false);
  const [customerEstimatesError, setCustomerEstimatesError] = useState<string | null>(null);
  const [estimateSearch, setEstimateSearch] = useState("");
  const [estimateStatusFilter, setEstimateStatusFilter] = useState("all");
  const [estimateSortBy, setEstimateSortBy] = useState<"status" | "carId" | "total" | "updatedAt">("updatedAt");
  const [estimateSortDir, setEstimateSortDir] = useState<"asc" | "desc">("desc");
  const [estimatePageSize, setEstimatePageSize] = useState<"10" | "25" | "50" | "100" | "all">("25");
  const [estimatePage, setEstimatePage] = useState(1);
  const [estimateCarFilter, setEstimateCarFilter] = useState<"selected" | "all" | string>("selected");
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupForm, setTopupForm] = useState({
    amount: "",
    method: "cash",
    paymentDate: "",
    proofFileId: "",
  });
  const [topupSaving, setTopupSaving] = useState(false);
  const [topupError, setTopupError] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [addCarOpen, setAddCarOpen] = useState(false);
  const [addCarForm, setAddCarForm] = useState({
    plateNumber: "",
    make: "",
    model: "",
    modelYear: "",
    bodyType: "Regular",
    isInsurance: false,
  });
  const [addCarSaving, setAddCarSaving] = useState(false);
  const [addCarError, setAddCarError] = useState<string | null>(null);
  const [viewCar, setViewCar] = useState<any | null>(null);
  const [selectedCarId, setSelectedCarId] = useState<string | null>(null);
  const [selectActionOpen, setSelectActionOpen] = useState(false);
  const [selectActionCar, setSelectActionCar] = useState<any | null>(null);
  const [selectActionMode, setSelectActionMode] = useState<"menu" | "appointment">("menu");
  const [selectActionSaving, setSelectActionSaving] = useState(false);
  const [selectActionError, setSelectActionError] = useState<string | null>(null);
  const [servicePickerOpen, setServicePickerOpen] = useState(false);
  const [servicePickerError, setServicePickerError] = useState<string | null>(null);
  const [rsaLeadOpen, setRsaLeadOpen] = useState(false);
  const [rsaLeadSaving, setRsaLeadSaving] = useState(false);
  const [rsaLeadError, setRsaLeadError] = useState<string | null>(null);
  const [rsaLeadForm, setRsaLeadForm] = useState<RsaLeadFormState>(getInitialRsaLeadForm(null));
  const [appointmentForm, setAppointmentForm] = useState<AppointmentFormState>(getInitialAppointmentForm());
  const [companyDropoffLocation, setCompanyDropoffLocation] = useState("");

  useEffect(() => {
    Promise.resolve(params).then((p) => {
      setCompanyId(p?.companyId ?? null);
      setCustomerId(p?.customerId ?? null);
    });
  }, [params]);

  useEffect(() => {
    if (!companyId || !customerId) return;
    const controller = new AbortController();
    loadCustomer(companyId, customerId, controller.signal);
    return () => {
      controller.abort();
    };
  }, [companyId, customerId]);

  useEffect(() => {
    if (!companyId || !customerId) return;
    loadCustomerKpis(companyId, customerId);
  }, [companyId, customerId]);

  useEffect(() => {
    if (!companyId || !customerId) return;
    if (activeTab !== "invoices") return;
    loadCustomerInvoices(companyId, customerId);
    loadWalletTransactions(companyId, customerId);
  }, [activeTab, companyId, customerId]);

  async function loadCustomerInvoices(cId: string, custId: string) {
    setInvoiceLoading(true);
    setInvoiceError(null);
    try {
      const res = await fetch(`/api/customers/${custId}/invoices?companyId=${cId}`);
      if (!res.ok) throw new Error("Failed to load customer invoices");
      const data = await res.json().catch(() => ({}));
      setCustomerInvoices(Array.isArray(data?.data) ? data.data : []);
    } catch (err: any) {
      setInvoiceError(err?.message ?? "Failed to load customer invoices");
      setCustomerInvoices([]);
    } finally {
      setInvoiceLoading(false);
    }
  }

  useEffect(() => {
    if (!companyId || !customerId) return;
    if (activeTab !== "leads") return;
    loadCustomerLeads(companyId, customerId);
  }, [activeTab, companyId, customerId]);

  useEffect(() => {
    if (!companyId || !customerId) return;
    if (activeTab !== "inspections") return;
    loadCustomerInspections(companyId, customerId);
  }, [activeTab, companyId, customerId]);

  useEffect(() => {
    if (!companyId || !customerId) return;
    if (activeTab !== "estimates") return;
    loadCustomerEstimates(companyId, customerId);
  }, [activeTab, companyId, customerId]);

  useEffect(() => {
    if (!companyId) return;
    let active = true;
    async function loadCompanyLocation() {
      try {
        const res = await fetch(`/api/company/${companyId}/profile`, { cache: "no-store" });
        if (!res.ok) return;
        const body = await res.json().catch(() => ({}));
        if (!active) return;
        const data = body?.data ?? {};
        const googleLocation = data.googleLocation ?? "";
        const address = data.address ?? {};
        const addressParts = [
          address.line1,
          address.line2,
          address.city,
          address.stateRegion,
          address.country,
        ].filter(Boolean);
        const fallbackAddress = addressParts.join(", ");
        const location = googleLocation || fallbackAddress;
        if (location) {
          setCompanyDropoffLocation(location);
        }
      } catch {
        // ignore
      }
    }
    loadCompanyLocation();
    return () => {
      active = false;
    };
  }, [companyId]);

  useEffect(() => {
    if (!companyDropoffLocation) return;
    if (appointmentForm.type !== "recovery") return;
    setAppointmentForm((prev) =>
      prev.dropoffLocation ? prev : { ...prev, dropoffLocation: companyDropoffLocation }
    );
  }, [companyDropoffLocation, appointmentForm.type]);

  useEffect(() => {
    setRsaLeadForm((prev) => (prev.carId ? prev : { ...prev, carId: selectedCarId ?? "" }));
  }, [selectedCarId]);

  async function loadCustomer(cId: string, custId: string, signal?: AbortSignal) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${custId}?companyId=${cId}`, {
        signal,
      });
      if (!res.ok) throw new Error("Failed to load customer");
      const data = await res.json();
      if (signal?.aborted) return;
      setCustomer(data);
      setWalletBalance(Number(data?.wallet_amount ?? 0));
      const cars: CustomerCarLink[] = data?.cars ?? [];
      setLinkedCars(cars);
      const primaryLink = cars.find((item) => item?.link?.is_primary);
      setSelectedCarId(primaryLink?.car?.id ?? null);
    } catch (err: any) {
      if (signal?.aborted) return;
      setError(err?.message ?? "Failed to load customer");
    } finally {
      if (signal?.aborted) return;
      setLoading(false);
    }
  }

  async function loadWalletTransactions(cId: string, custId: string) {
    setWalletLoading(true);
    setWalletError(null);
    try {
      const res = await fetch(
        `/api/customers/${custId}/wallet/transactions?companyId=${cId}&approvedOnly=false`
      );
      if (!res.ok) throw new Error("Failed to load wallet transactions");
      const data = await res.json().catch(() => ({}));
      const list: WalletTransactionRow[] = Array.isArray(data?.data) ? data.data : [];
      // Force customer transactions tab to show inward-only movements.
      // Legacy migration tags direction in notes (direction=Outward / direction=Inward).
      const inwardOnly = list.filter((tx) => {
        const note = String(tx?.notes ?? "").toLowerCase();
        return !note.includes("direction=outward");
      });
      setWalletTransactions(inwardOnly);
    } catch (err: any) {
      setWalletError(err?.message ?? "Failed to load wallet transactions");
    } finally {
      setWalletLoading(false);
    }
  }

  async function loadCustomerKpis(cId: string, custId: string) {
    setCustomerKpisLoading(true);
    try {
      const res = await fetch(`/api/customers/${custId}/kpis?companyId=${cId}`, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Failed to load KPIs");
      setCustomerKpis(body?.data ?? null);
    } catch {
      setCustomerKpis(null);
    } finally {
      setCustomerKpisLoading(false);
    }
  }

  async function loadCustomerList<T>(
    endpoint: string,
    setLoading: React.Dispatch<React.SetStateAction<boolean>>,
    setError: React.Dispatch<React.SetStateAction<string | null>>,
    setData: React.Dispatch<React.SetStateAction<T[]>>,
    errorMessage: string
  ) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error ?? errorMessage);
      }
      setData(Array.isArray(body?.data) ? body.data : []);
    } catch (err: any) {
      setError(err?.message ?? errorMessage);
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadCustomerLeads(cId: string, custId: string) {
    await loadCustomerList(
      `/api/customers/${custId}/leads?companyId=${cId}`,
      setCustomerLeadsLoading,
      setCustomerLeadsError,
      setCustomerLeads,
      "Failed to load leads"
    );
  }

  async function loadCustomerInspections(cId: string, custId: string) {
    await loadCustomerList(
      `/api/customers/${custId}/inspections?companyId=${cId}`,
      setCustomerInspectionsLoading,
      setCustomerInspectionsError,
      setCustomerInspections,
      "Failed to load inspections"
    );
  }

  async function loadCustomerEstimates(cId: string, custId: string) {
    await loadCustomerList(
      `/api/customers/${custId}/estimates?companyId=${cId}`,
      setCustomerEstimatesLoading,
      setCustomerEstimatesError,
      setCustomerEstimates,
      "Failed to load estimates"
    );
  }


  const cards = [
    { label: "Total Invoices", value: "AED 8,240" },
    { label: "Open Leads", value: "12" },
    { label: "Active Contracts", value: "2" },
  ];
  const actions = [
    { label: "Service Request", key: "service_request" },
    { label: "Follow-Up" },
    { label: "Create Contract" },
    { label: "Create Appointment" },
    { label: "Create Complaint" },
  ];
  const tabLabels = [
    { id: "leads", label: "Leads" },
    { id: "inspections", label: "Inspections" },
    { id: "estimates", label: "Estimates" },
    { id: "invoices", label: "Invoices & Transactions" },
    { id: "contracts", label: "Contracts" },
    { id: "followups", label: "Follow Ups" },
    { id: "calls", label: "Call Recordings" },
  ] as const;

  const formatDateTime = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };

  const isRecoveryAppointment = appointmentForm.type === "recovery";
  const recoveryMissing =
    isRecoveryAppointment &&
    (!appointmentForm.pickupLocation.trim() || !companyDropoffLocation.trim());
  const appointmentDisabled = selectActionSaving || !appointmentForm.appointmentAt || recoveryMissing;

  useEffect(() => {
    setLeadPage(1);
  }, [leadSearch, leadTypeFilter, leadStatusFilter, leadStageFilter, leadPageSize, leadCarFilter]);

  const leadTypeOptions = useMemo(
    () => Array.from(new Set(customerLeads.map((lead) => lead.leadType).filter(Boolean))).sort(),
    [customerLeads]
  );
  const leadStatusOptions = useMemo(
    () => Array.from(new Set(customerLeads.map((lead) => lead.leadStatus).filter(Boolean))).sort(),
    [customerLeads]
  );
  const leadStageOptions = useMemo(
    () => Array.from(new Set(customerLeads.map((lead) => lead.leadStage).filter(Boolean))).sort(),
    [customerLeads]
  );

  const filteredSortedLeads = useMemo(() => {
    const q = leadSearch.trim().toLowerCase();
    const carFilterId =
      leadCarFilter === "selected"
        ? selectedCarId ?? "__none__"
        : leadCarFilter === "all"
        ? null
        : leadCarFilter;

    const filtered = customerLeads.filter((lead) => {
      if (carFilterId && lead.carId !== carFilterId) return false;
      if (leadTypeFilter !== "all" && lead.leadType !== leadTypeFilter) return false;
      if (leadStatusFilter !== "all" && lead.leadStatus !== leadStatusFilter) return false;
      if (leadStageFilter !== "all" && lead.leadStage !== leadStageFilter) return false;
      if (!q) return true;

      const haystack = [
        lead.id,
        lead.leadType,
        lead.leadStatus,
        lead.leadStage,
        lead.carPlateNumber,
        lead.carModel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });

    filtered.sort((a, b) => {
      const aCar = [a.carPlateNumber, a.carModel].filter(Boolean).join(" ");
      const bCar = [b.carPlateNumber, b.carModel].filter(Boolean).join(" ");
      const aVal =
        leadSortBy === "car"
          ? aCar
          : leadSortBy === "updatedAt"
          ? new Date(a.updatedAt || 0).getTime()
          : String(a[leadSortBy] ?? "");
      const bVal =
        leadSortBy === "car"
          ? bCar
          : leadSortBy === "updatedAt"
          ? new Date(b.updatedAt || 0).getTime()
          : String(b[leadSortBy] ?? "");

      if (aVal < bVal) return leadSortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return leadSortDir === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [
    customerLeads,
    leadCarFilter,
    leadTypeFilter,
    leadStatusFilter,
    leadStageFilter,
    leadSearch,
    selectedCarId,
    leadSortBy,
    leadSortDir,
  ]);

  const totalLeadPages = useMemo(() => {
    if (leadPageSize === "all") return 1;
    const size = Number(leadPageSize);
    return Math.max(1, Math.ceil(filteredSortedLeads.length / size));
  }, [filteredSortedLeads.length, leadPageSize]);

  useEffect(() => {
    setLeadPage((prev) => Math.min(prev, totalLeadPages));
  }, [totalLeadPages]);

  const pagedLeads = useMemo(() => {
    if (leadPageSize === "all") return filteredSortedLeads;
    const size = Number(leadPageSize);
    const start = (leadPage - 1) * size;
    return filteredSortedLeads.slice(start, start + size);
  }, [filteredSortedLeads, leadPage, leadPageSize]);

  const inspectionCarLabels = useMemo(() => {
    const map = new Map<string, string>();
    linkedCars.forEach((item) => {
      const car = item.car ?? {};
      const id = car.id as string | undefined;
      if (!id) return;
      const label = [car.plate_number, car.make, car.model].filter(Boolean).join(" ");
      map.set(id, label || id);
    });
    return map;
  }, [linkedCars]);

  const inspectionStatusOptions = useMemo(
    () => Array.from(new Set(customerInspections.map((x) => x.status).filter(Boolean))).sort(),
    [customerInspections]
  );

  useEffect(() => {
    setInspectionPage(1);
  }, [inspectionSearch, inspectionStatusFilter, inspectionPageSize, inspectionCarFilter]);

  const filteredSortedInspections = useMemo(() => {
    const q = inspectionSearch.trim().toLowerCase();
    const carFilterId =
      inspectionCarFilter === "selected"
        ? selectedCarId ?? "__none__"
        : inspectionCarFilter === "all"
        ? null
        : inspectionCarFilter;

    const filtered = customerInspections.filter((inspection) => {
      if (carFilterId && inspection.carId !== carFilterId) return false;
      if (inspectionStatusFilter !== "all" && inspection.status !== inspectionStatusFilter) return false;
      if (!q) return true;

      const carLabel = inspectionCarLabels.get(inspection.carId ?? "") ?? inspection.carId ?? "";
      const haystack = [
        inspection.id,
        inspection.status,
        inspection.leadId,
        inspection.carId,
        carLabel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });

    filtered.sort((a, b) => {
      const aVal =
        inspectionSortBy === "startedAt"
          ? new Date((a.startAt ?? a.createdAt) || 0).getTime()
          : inspectionSortBy === "updatedAt"
          ? new Date(a.updatedAt || 0).getTime()
          : String(a[inspectionSortBy] ?? "");
      const bVal =
        inspectionSortBy === "startedAt"
          ? new Date((b.startAt ?? b.createdAt) || 0).getTime()
          : inspectionSortBy === "updatedAt"
          ? new Date(b.updatedAt || 0).getTime()
          : String(b[inspectionSortBy] ?? "");
      if (aVal < bVal) return inspectionSortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return inspectionSortDir === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [
    customerInspections,
    inspectionCarFilter,
    inspectionStatusFilter,
    inspectionSearch,
    selectedCarId,
    inspectionSortBy,
    inspectionSortDir,
    inspectionCarLabels,
  ]);

  const totalInspectionPages = useMemo(() => {
    if (inspectionPageSize === "all") return 1;
    const size = Number(inspectionPageSize);
    return Math.max(1, Math.ceil(filteredSortedInspections.length / size));
  }, [filteredSortedInspections.length, inspectionPageSize]);

  useEffect(() => {
    setInspectionPage((prev) => Math.min(prev, totalInspectionPages));
  }, [totalInspectionPages]);

  const pagedInspections = useMemo(() => {
    if (inspectionPageSize === "all") return filteredSortedInspections;
    const size = Number(inspectionPageSize);
    const start = (inspectionPage - 1) * size;
    return filteredSortedInspections.slice(start, start + size);
  }, [filteredSortedInspections, inspectionPage, inspectionPageSize]);

  const estimateStatusOptions = useMemo(
    () => Array.from(new Set(customerEstimates.map((x) => x.status).filter(Boolean))).sort(),
    [customerEstimates]
  );

  useEffect(() => {
    setEstimatePage(1);
  }, [estimateSearch, estimateStatusFilter, estimatePageSize, estimateCarFilter]);

  const filteredSortedEstimates = useMemo(() => {
    const q = estimateSearch.trim().toLowerCase();
    const carFilterId =
      estimateCarFilter === "selected"
        ? selectedCarId ?? "__none__"
        : estimateCarFilter === "all"
        ? null
        : estimateCarFilter;

    const filtered = customerEstimates.filter((estimate) => {
      if (carFilterId && estimate.carId !== carFilterId) return false;
      if (estimateStatusFilter !== "all" && estimate.status !== estimateStatusFilter) return false;
      if (!q) return true;

      const carLabel = inspectionCarLabels.get(estimate.carId ?? "") ?? estimate.carId ?? "";
      const haystack = [estimate.id, estimate.status, estimate.leadId, estimate.carId, carLabel]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });

    filtered.sort((a, b) => {
      const aTotal = Number(a.grandTotal ?? a.finalPrice ?? 0);
      const bTotal = Number(b.grandTotal ?? b.finalPrice ?? 0);
      const aVal =
        estimateSortBy === "updatedAt"
          ? new Date(a.updatedAt || 0).getTime()
          : estimateSortBy === "total"
          ? aTotal
          : String(a[estimateSortBy] ?? "");
      const bVal =
        estimateSortBy === "updatedAt"
          ? new Date(b.updatedAt || 0).getTime()
          : estimateSortBy === "total"
          ? bTotal
          : String(b[estimateSortBy] ?? "");
      if (aVal < bVal) return estimateSortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return estimateSortDir === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [
    customerEstimates,
    estimateCarFilter,
    estimateStatusFilter,
    estimateSearch,
    estimateSortBy,
    estimateSortDir,
    selectedCarId,
    inspectionCarLabels,
  ]);

  const totalEstimatePages = useMemo(() => {
    if (estimatePageSize === "all") return 1;
    const size = Number(estimatePageSize);
    return Math.max(1, Math.ceil(filteredSortedEstimates.length / size));
  }, [filteredSortedEstimates.length, estimatePageSize]);

  useEffect(() => {
    setEstimatePage((prev) => Math.min(prev, totalEstimatePages));
  }, [totalEstimatePages]);

  const pagedEstimates = useMemo(() => {
    if (estimatePageSize === "all") return filteredSortedEstimates;
    const size = Number(estimatePageSize);
    const start = (estimatePage - 1) * size;
    return filteredSortedEstimates.slice(start, start + size);
  }, [filteredSortedEstimates, estimatePage, estimatePageSize]);


  const openProforma = (txn: WalletTransactionRow) => {
    if (!companyId || !customerId) return;
    const url = `/api/customers/${customerId}/wallet/transactions/${txn.id}/proforma?companyId=${companyId}`;
    window.open(url, "_blank", "width=900,height=1000");
  };

  const runCarAction = async (action: "car_in" | "appointment") => {
    if (!companyId || !customerId || !selectActionCar) return;
    setSelectActionSaving(true);
    setSelectActionError(null);
    let walkinRemarks: string | null = null;
    if (action === "car_in") {
      walkinRemarks = appointmentForm.remarks.trim();
      if (!walkinRemarks) {
        setSelectActionError("Remarks are required for walk-in service requests.");
        setSelectActionSaving(false);
        return;
      }
      if (!appointmentForm.serviceType) {
        setSelectActionError("Select a service type to continue.");
        setSelectActionSaving(false);
        return;
      }
    }
    const selectedServiceType = appointmentForm.serviceType;
    try {
      const res = await fetch(`/api/customers/${customerId}/cars/select?companyId=${companyId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carId: selectActionCar.id,
          action,
          appointmentAt: action === "appointment" ? appointmentForm.appointmentAt || null : null,
          appointmentType: action === "appointment" ? appointmentForm.type : null,
          recoveryType: action === "appointment" ? appointmentForm.recoveryType : null,
          pickupLocation: action === "appointment" ? appointmentForm.pickupLocation : null,
          dropoffLocation: action === "appointment" ? companyDropoffLocation || null : null,
          remarks: action === "car_in" ? walkinRemarks : appointmentForm.remarks,
          serviceType: action === "car_in" ? appointmentForm.serviceType : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to create lead");
      }
      setSelectActionOpen(false);
      setSelectActionMode("menu");
      setAppointmentForm(getInitialAppointmentForm());
      if (action === "car_in" && selectedServiceType) {
        toast.success(
          `Service request (${serviceRequestTypeLabels[selectedServiceType]}) created for walk-in.`
        );
      } else if (action === "appointment") {
        toast.success("Appointment created.");
      }
    } catch (err: any) {
      setSelectActionError(err?.message ?? "Failed to create lead");
    } finally {
      setSelectActionSaving(false);
    }
  };

  const createRsaLead = async () => {
    if (!companyId || !customerId) return;
    const division = rsaLeadForm.division;
    const remarks = rsaLeadForm.remarks.trim();

    if (!division) {
      setRsaLeadError("Select lead division.");
      return;
    }
    if (!remarks) {
      setRsaLeadError("Lead remarks are required.");
      return;
    }

    const extraLines = [
      rsaLeadForm.locationLinkRsa.trim()
        ? `Location Link: ${rsaLeadForm.locationLinkRsa.trim()}`
        : null,
    ].filter(Boolean);

    const customerRemarks = [remarks, ...extraLines].join("\n");
    const leadStatus = "pending";

    setRsaLeadSaving(true);
    setRsaLeadError(null);
    try {
      const res = await fetch(`/api/company/${companyId}/sales/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          leadType: "rsa",
          source: "walk_in",
          serviceType: division,
          status: leadStatus,
          customerRemarks,
          car: rsaLeadForm.carId ? { id: rsaLeadForm.carId } : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to create RSA lead");
      }
      setRsaLeadOpen(false);
      setRsaLeadForm(getInitialRsaLeadForm(selectedCarId));
      toast.success("RSA lead created.");
      setActiveTab("leads");
      await loadCustomerLeads(companyId, customerId);
    } catch (err: any) {
      setRsaLeadError(err?.message ?? "Failed to create RSA lead");
    } finally {
      setRsaLeadSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-5 py-5">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold">Customer Dashboard</h1>
              <p className={`text-sm ${theme.mutedText}`}>
                Track leads, inspections, invoices, and service history in one place.
              </p>
            </div>
            <Link
              href={companyId ? `/company/${companyId}/customers` : "#"}
              className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-sm transition hover:bg-white/10"
            >
              Back to customers
            </Link>
          </div>
        </div>

        {error && <div className="text-sm text-destructive">{error}</div>}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {[
            { label: "Open Leads", value: customerKpisLoading ? "..." : String(customerKpis?.openLeads ?? 0) },
            { label: "Total Estimates", value: customerKpisLoading ? "..." : String(customerKpis?.totalEstimates ?? 0) },
            { label: "Finalized Estimates", value: customerKpisLoading ? "..." : String(customerKpis?.finalizedEstimates ?? 0) },
            { label: "Cars Linked", value: customerKpisLoading ? "..." : String(customerKpis?.carsLinked ?? linkedCars.length) },
            {
              label: "Wallet",
              value: customerKpisLoading ? "..." : `AED ${(customerKpis?.walletAmount ?? walletBalance).toFixed(2)}`,
            },
            {
              label: "Last Activity",
              value: customerKpisLoading ? "..." : formatDateTime(customerKpis?.lastActivityAt),
            },
          ].map((kpi) => (
            <Card key={kpi.label} className={`px-3 py-3 ${theme.cardBg} ${theme.cardBorder} ${kpi.className ?? ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className={`text-[11px] uppercase tracking-wide ${theme.mutedText}`}>{kpi.label}</div>
                  <div className="mt-1 text-base font-semibold">{kpi.value}</div>
                </div>
                {kpi.label === "Wallet" && (
                  <button
                    type="button"
                    className="rounded-md bg-amber-400 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-black shadow"
                    onClick={() => {
                      setTopupError(null);
                      setTopupOpen(true);
                    }}
                  >
                    Topup
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>

        <div className="overflow-x-auto border-b border-white/10 pb-3">
          <div className="flex gap-2 whitespace-nowrap">
            {actions.map((action) => {
              const isServiceRequest = action.key === "service_request";
              const isDisabled = isServiceRequest && !selectedCarId;
              return (
                <button
                  key={action.label}
                  type="button"
                  className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${
                    isDisabled ? "opacity-50 cursor-not-allowed" : `${theme.mutedText} hover:bg-white/10`
                  }`}
                  disabled={isDisabled}
                  onClick={() => {
                    if (!isServiceRequest) return;
                    if (!selectedCarId) return;
                    setServicePickerError(null);
                    setServicePickerOpen(true);
                  }}
                >
                  {action.label}
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[10px]">
                    v
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,9fr)]">
          <div className="space-y-4">
            <div className="grid gap-4">
              <Card className={`relative overflow-hidden w-full ${theme.cardBg} ${theme.cardBorder}`}>
                <div className="absolute right-0 top-0 h-16 w-16 translate-x-6 -translate-y-6 rounded-full bg-emerald-500/30" />
                <div className="absolute -left-8 top-20 h-20 w-20 rounded-full bg-amber-500/30" />
                <div className="space-y-4 p-5 sm:p-6">
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 rounded-full bg-white/10 text-2xl flex items-center justify-center">
                      C
                    </div>
                    <div>
                      <div className={`text-sm ${theme.mutedText}`}>Customer</div>
                      <div className="text-lg font-semibold">{customer?.name ?? "Mohammed Mahdy"}</div>
                      <div className="text-xs text-rose-400">Not App User</div>
                    </div>
                  </div>
                  <div className={`space-y-2 text-sm ${theme.mutedText}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Phone</span>
                      <span>{customer?.phone ?? "+971 54 228 7649"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Email</span>
                      <span>{customer?.email ?? "mohdmahdy94@gmail.com"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Location</span>
                      <span>{customer?.city ?? "Abu Hail"}, {customer?.country ?? "Dubai"}</span>
                    </div>
                  </div>
                </div>
              </Card>
              <div className="space-y-4">
                <Card className={`space-y-4 w-full ${theme.cardBg} ${theme.cardBorder}`}>
                  <div className="flex items-center justify-between px-3 pt-3">
                    <div className="text-sm font-semibold">Customer Cars</div>
                    <button
                      type="button"
                      onClick={() => {
                        setAddCarError(null);
                        setAddCarOpen(true);
                      }}
                      className={`rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-white/10`}
                    >
                      Add New Car
                    </button>
                  </div>
                  <div className="space-y-3 px-3 pb-3">
                    {linkedCars.length === 0 ? (
                      <div className={`rounded-md ${theme.cardBorder} ${theme.surfaceSubtle} px-3 py-2 text-sm ${theme.mutedText}`}>
                        No cars linked yet.
                      </div>
                    ) : (
                      linkedCars.map((c) => {
                        const car = c.car ?? {};
                        const plate = car.plate_number || car.plateNumber || "N/A";
                        const label = [car.make, car.model, car.model_year].filter(Boolean).join(" ") || "Car";
                        const type = car.body_type || "Regular";
                        const carId = car.id ?? c.link?.id ?? "";
                        const isSelected = carId && selectedCarId === carId;
                        return (
                          <div
                            key={carId || `${plate}-${label}`}
                            className={`rounded-md px-3 py-2 text-sm ${theme.cardBorder} ${theme.surfaceSubtle} ${
                              isSelected ? "ring-1 ring-blue-500/70" : ""
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="font-semibold">{plate}</div>
                              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/70">
                                {type}
                              </span>
                            </div>
                            <div className={`text-xs ${theme.mutedText}`}>{label}</div>
                            <div className="mt-2 flex items-center gap-2">
                              <button
                                type="button"
                                className="rounded-md bg-amber-400 px-2 py-1 text-[10px] font-semibold text-black"
                                onClick={() => setViewCar(car)}
                              >
                                View
                              </button>
                              <button
                                type="button"
                                className={`rounded-md px-2 py-1 text-[10px] font-semibold ${
                                  isSelected ? "bg-blue-600 text-white" : "bg-slate-700/80 text-white"
                                }`}
                                onClick={async () => {
                                  if (!carId || !companyId || !customerId) return;
                                  if (isSelected) {
                                    setSelectActionCar(car);
                                    setSelectActionMode("menu");
                                    setSelectActionError(null);
                                    setSelectActionOpen(true);
                                    return;
                                  }
                                  const linkId = c.link?.id;
                                  if (!linkId) return;
                                  setSelectedCarId(carId);
                                  try {
                                    const res = await fetch(
                                      `/api/customers/${customerId}/cars?companyId=${companyId}&linkId=${linkId}`,
                                      {
                                        method: "PATCH",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ isPrimary: true }),
                                      }
                                    );
                                    if (!res.ok) {
                                      throw new Error("Failed to update car selection");
                                    }
                                    await loadCustomer(companyId, customerId);
                                    setSelectActionCar(car);
                                    setSelectActionMode("menu");
                                    setSelectActionError(null);
                                    setSelectActionOpen(true);
                                  } catch (err) {
                                    setSelectedCarId(null);
                                  }
                                }}
                              >
                                {isSelected ? "Selected" : "Select"}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </Card>
                <Card className={`space-y-3 p-3 w-full ${theme.cardBg} ${theme.cardBorder}`}>
                  <div className="text-sm font-semibold">Customer Spending</div>
                  <div className="space-y-2">
                    {cards.map((card) => (
                      <div key={card.label} className={`rounded-md ${theme.cardBorder} ${theme.surfaceSubtle} px-3 py-2 text-sm`}>
                        <div className={`text-xs ${theme.mutedText}`}>{card.label}</div>
                        <div className="text-lg font-semibold">{card.value}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <Card className={`p-4 ${theme.cardBg} ${theme.cardBorder}`}>
              <div className="overflow-x-auto border-b border-white/10 pb-3">
                <div className="flex gap-2 whitespace-nowrap">
                  {tabLabels.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide ${
                        activeTab === tab.id
                          ? "bg-blue-600 text-white"
                          : "text-white/60 hover:bg-white/10"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {activeTab === "invoices" && (
                <div className="space-y-4 pt-4">
                  <SectionCard title="Customer Invoices">
                    <CustomerInvoicesTable
                      loading={invoiceLoading}
                      error={invoiceError}
                      invoices={customerInvoices}
                      companyId={companyId}
                      formatDateTime={formatDateTime}
                    />
                  </SectionCard>
                  <SectionCard title="Customer Transactions">
                    <CustomerTransactionsTable
                      loading={walletLoading}
                      error={walletError}
                      transactions={walletTransactions}
                      customerId={customerId}
                      companyId={companyId}
                      formatDateTime={formatDateTime}
                    />
                  </SectionCard>
                </div>
              )}

              {activeTab === "leads" && (
                <div className="space-y-4 pt-4">
                  <SectionCard title="Customer Leads">
                    <CustomerLeadsTable
                      loading={customerLeadsLoading}
                      error={customerLeadsError}
                      leads={pagedLeads}
                      total={filteredSortedLeads.length}
                      page={leadPage}
                      totalPages={totalLeadPages}
                      pageSize={leadPageSize}
                      search={leadSearch}
                      typeFilter={leadTypeFilter}
                      statusFilter={leadStatusFilter}
                      stageFilter={leadStageFilter}
                      carFilter={leadCarFilter}
                      selectedCarId={selectedCarId}
                      sortBy={leadSortBy}
                      sortDir={leadSortDir}
                      typeOptions={leadTypeOptions}
                      statusOptions={leadStatusOptions}
                      stageOptions={leadStageOptions}
                      cars={linkedCars}
                      companyId={companyId}
                      onSearchChange={setLeadSearch}
                      onTypeFilterChange={setLeadTypeFilter}
                      onStatusFilterChange={setLeadStatusFilter}
                      onStageFilterChange={setLeadStageFilter}
                      onCarFilterChange={setLeadCarFilter}
                      onPageSizeChange={setLeadPageSize}
                      onPageChange={setLeadPage}
                      onSortChange={(sortBy) => {
                        if (leadSortBy === sortBy) {
                          setLeadSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
                          return;
                        }
                        setLeadSortBy(sortBy);
                        setLeadSortDir("desc");
                      }}
                      formatDateTime={formatDateTime}
                    />
                  </SectionCard>
                </div>
              )}

              {activeTab === "inspections" && (
                <div className="space-y-4 pt-4">
                  <SectionCard title="Customer Inspections">
                    <CustomerInspectionsTable
                      loading={customerInspectionsLoading}
                      error={customerInspectionsError}
                      inspections={pagedInspections}
                      total={filteredSortedInspections.length}
                      page={inspectionPage}
                      totalPages={totalInspectionPages}
                      pageSize={inspectionPageSize}
                      search={inspectionSearch}
                      statusFilter={inspectionStatusFilter}
                      statusOptions={inspectionStatusOptions}
                      carFilter={inspectionCarFilter}
                      selectedCarId={selectedCarId}
                      sortBy={inspectionSortBy}
                      sortDir={inspectionSortDir}
                      cars={linkedCars}
                      companyId={companyId}
                      carLabels={inspectionCarLabels}
                      onSearchChange={setInspectionSearch}
                      onStatusFilterChange={setInspectionStatusFilter}
                      onCarFilterChange={setInspectionCarFilter}
                      onPageSizeChange={setInspectionPageSize}
                      onPageChange={setInspectionPage}
                      onSortChange={(sortBy) => {
                        if (inspectionSortBy === sortBy) {
                          setInspectionSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
                          return;
                        }
                        setInspectionSortBy(sortBy);
                        setInspectionSortDir("desc");
                      }}
                      formatDateTime={formatDateTime}
                    />
                  </SectionCard>
                </div>
              )}

              {activeTab === "estimates" && (
                <div className="space-y-4 pt-4">
                  <SectionCard title="Customer Estimates">
                    <CustomerEstimatesTable
                      loading={customerEstimatesLoading}
                      error={customerEstimatesError}
                      estimates={pagedEstimates}
                      total={filteredSortedEstimates.length}
                      page={estimatePage}
                      totalPages={totalEstimatePages}
                      pageSize={estimatePageSize}
                      search={estimateSearch}
                      statusFilter={estimateStatusFilter}
                      statusOptions={estimateStatusOptions}
                      carFilter={estimateCarFilter}
                      selectedCarId={selectedCarId}
                      sortBy={estimateSortBy}
                      sortDir={estimateSortDir}
                      cars={linkedCars}
                      companyId={companyId}
                      carLabels={inspectionCarLabels}
                      onSearchChange={setEstimateSearch}
                      onStatusFilterChange={setEstimateStatusFilter}
                      onCarFilterChange={setEstimateCarFilter}
                      onPageSizeChange={setEstimatePageSize}
                      onPageChange={setEstimatePage}
                      onSortChange={(sortBy) => {
                        if (estimateSortBy === sortBy) {
                          setEstimateSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
                          return;
                        }
                        setEstimateSortBy(sortBy);
                        setEstimateSortDir("desc");
                      }}
                      formatDateTime={formatDateTime}
                    />
                  </SectionCard>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
      {topupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className={`w-full max-w-lg rounded-xl shadow-xl ${theme.cardBg} ${theme.cardBorder}`}>
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="text-sm font-semibold">Topup Wallet</div>
              <button
                type="button"
                onClick={() => setTopupOpen(false)}
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
                  onClick={() => setTopupOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-md bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary-foreground"
                  disabled={topupSaving}
                  onClick={async () => {
                    if (!companyId || !customerId) return;
                    const amount = Number(topupForm.amount);
                    if (!amount || amount <= 0) {
                      setTopupError("Enter a valid amount.");
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
                      if (!res.ok) {
                        const data = await res.json().catch(() => ({}));
                        throw new Error(data?.error ?? "Failed to create topup");
                      }
                      const summaryRes = await fetch(
                        `/api/customers/${customerId}/wallet/summary?companyId=${companyId}`
                      );
                      if (summaryRes.ok) {
                        const summary = await summaryRes.json().catch(() => ({}));
                        setWalletBalance(Number(summary?.balance ?? 0));
                      } else {
                        setWalletBalance((prev) => prev + amount);
                      }
                       setTopupForm({
                        amount: "",
                        method: "cash",
                        paymentDate: "",
                        proofFileId: "",
                      });
                      setTopupOpen(false);
                      toast.success("Topup submitted; please wait for verification.");
                    } catch (err: any) {
                      setTopupError(err?.message ?? "Failed to create topup");
                    } finally {
                      setTopupSaving(false);
                    }
                  }}
                >
                  {topupSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {addCarOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className={`w-full max-w-2xl rounded-xl shadow-xl ${theme.cardBg} ${theme.cardBorder}`}>
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="text-sm font-semibold">Add New Car</div>
              <button
                type="button"
                onClick={() => setAddCarOpen(false)}
                className={`rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-white/10`}
              >
                Close
              </button>
            </div>
            <div className="space-y-4 p-4">
              {addCarError && <div className="text-sm text-red-400">{addCarError}</div>}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className={`text-xs font-semibold ${theme.mutedText}`}>Plate Number</label>
                  <input
                    type="text"
                    className={theme.input}
                    value={addCarForm.plateNumber}
                    onChange={(e) => setAddCarForm((prev) => ({ ...prev, plateNumber: e.target.value }))}
                    placeholder="DXB-A-1234"
                  />
                </div>
                <div className="space-y-2">
                  <label className={`text-xs font-semibold ${theme.mutedText}`}>Car Type</label>
                  <select
                    className={theme.input}
                    value={addCarForm.bodyType}
                    onChange={(e) => setAddCarForm((prev) => ({ ...prev, bodyType: e.target.value }))}
                  >
                    <option value="Regular">Regular</option>
                    <option value="Sedan">Sedan</option>
                    <option value="SUV">SUV</option>
                    <option value="Truck">Truck</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className={`text-xs font-semibold ${theme.mutedText}`}>Make</label>
                  <select
                    className={theme.input}
                    value={addCarForm.make}
                    onChange={(e) =>
                      setAddCarForm((prev) => ({
                        ...prev,
                        make: e.target.value,
                        model: carModelsByMake[e.target.value]?.includes(prev.model)
                          ? prev.model
                          : "",
                      }))
                    }
                  >
                    <option value="">Select Make</option>
                    {carMakes.map((make) => (
                      <option key={make} value={make}>
                        {make}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className={`text-xs font-semibold ${theme.mutedText}`}>Model</label>
                  <select
                    className={theme.input}
                    value={addCarForm.model}
                    onChange={(e) => setAddCarForm((prev) => ({ ...prev, model: e.target.value }))}
                    disabled={!addCarForm.make}
                  >
                    <option value="">Select Model</option>
                    {(carModelsByMake[addCarForm.make] ?? []).map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className={`text-xs font-semibold ${theme.mutedText}`}>Model Year</label>
                  <select
                    className={theme.input}
                    value={addCarForm.modelYear}
                    onChange={(e) => setAddCarForm((prev) => ({ ...prev, modelYear: e.target.value }))}
                  >
                    <option value="">Select Year</option>
                    {carYears.map((year) => (
                      <option key={year} value={String(year)}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-white/70">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={addCarForm.isInsurance}
                  onChange={(e) => setAddCarForm((prev) => ({ ...prev, isInsurance: e.target.checked }))}
                />
                Insurance Car
              </label>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className={`rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-white/10`}
                  onClick={() => setAddCarOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-md bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary-foreground"
                  disabled={addCarSaving}
                  onClick={async () => {
                    if (!companyId || !customerId) return;
                    const yearValue = addCarForm.modelYear ? Number(addCarForm.modelYear) : null;
                    if (addCarForm.modelYear && (Number.isNaN(yearValue) || yearValue <= 0)) {
                      setAddCarError("Enter a valid model year.");
                      return;
                    }
                    setAddCarSaving(true);
                    setAddCarError(null);
                    try {
                      const res = await fetch(`/api/customers/${customerId}/cars?companyId=${companyId}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          relationType: "owner",
                          newCar: {
                            plateNumber: addCarForm.plateNumber || null,
                            make: addCarForm.make || null,
                            model: addCarForm.model || null,
                            modelYear: yearValue || null,
                            bodyType: addCarForm.bodyType || null,
                            isInsurance: addCarForm.isInsurance,
                          },
                        }),
                      });
                      if (!res.ok) {
                        const data = await res.json().catch(() => ({}));
                        throw new Error(data?.error ?? "Failed to add car");
                      }
                      await loadCustomer(companyId, customerId);
                      setAddCarForm({
                        plateNumber: "",
                        make: "",
                        model: "",
                        modelYear: "",
                        bodyType: "Regular",
                        isInsurance: false,
                      });
                      setAddCarOpen(false);
                    } catch (err: any) {
                      setAddCarError(err?.message ?? "Failed to add car");
                    } finally {
                      setAddCarSaving(false);
                    }
                  }}
                >
                  {addCarSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {viewCar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className={`w-full max-w-lg rounded-xl shadow-xl ${theme.cardBg} ${theme.cardBorder}`}>
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="text-sm font-semibold">Car Details</div>
              <button
                type="button"
                onClick={() => setViewCar(null)}
                className={`rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-white/10`}
              >
                Close
              </button>
            </div>
            <div className="space-y-3 p-4 text-sm">
              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <span className={theme.mutedText}>Plate</span>
                  <span className="font-semibold">
                    {viewCar.plate_number || viewCar.plateNumber || "N/A"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={theme.mutedText}>Make</span>
                  <span className="font-semibold">{viewCar.make || "N/A"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={theme.mutedText}>Model</span>
                  <span className="font-semibold">{viewCar.model || "N/A"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={theme.mutedText}>Year</span>
                  <span className="font-semibold">{viewCar.model_year || viewCar.modelYear || "N/A"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={theme.mutedText}>Type</span>
                  <span className="font-semibold">{viewCar.body_type || viewCar.bodyType || "N/A"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={theme.mutedText}>Insurance</span>
                  <span className="font-semibold">
                    {viewCar.is_insurance || viewCar.isInsurance ? "Yes" : "No"}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {servicePickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className={`w-full max-w-2xl rounded-xl shadow-xl ${theme.cardBg} ${theme.cardBorder}`}>
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="text-sm font-semibold">Select Service</div>
              <button
                type="button"
                onClick={() => setServicePickerOpen(false)}
                className={`rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-white/10`}
              >
                Close
              </button>
            </div>
            <div className="space-y-3 p-4">
              {servicePickerError && <div className="text-sm text-red-400">{servicePickerError}</div>}
              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  className={`rounded-lg border px-4 py-3 text-left text-sm font-semibold ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-white/10`}
                  onClick={() => {
                    setRsaLeadError(null);
                    setRsaLeadForm(getInitialRsaLeadForm(selectedCarId));
                    setRsaLeadOpen(true);
                    setServicePickerOpen(false);
                  }}
                >
                  <div className="flex flex-col items-center gap-2 text-center">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-2xl">
                      ⚡
                    </span>
                    <span>RSA (Batteries / Jump Start)</span>
                  </div>
                </button>
                <button
                  type="button"
                  className={`rounded-lg border px-4 py-3 text-left text-sm font-semibold ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-white/10`}
                  onClick={() => {
                    const car = linkedCars.find((item) => item?.car?.id === selectedCarId)?.car ?? null;
                    if (!car) {
                      setServicePickerError("Select a car to continue.");
                      return;
                    }
                    setSelectActionCar(car);
                    setSelectActionMode("menu");
                    setSelectActionError(null);
                    setSelectActionOpen(true);
                    setServicePickerOpen(false);
                  }}
                >
                  <div className="flex flex-col items-center gap-2 text-center">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-2xl">
                      🚗
                    </span>
                    <span>Service Request (Car In / Walk In)</span>
                  </div>
                </button>
                <button
                  type="button"
                  className={`rounded-lg border px-4 py-3 text-left text-sm font-semibold ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-white/10`}
                  onClick={() => {
                    const car = linkedCars.find((item) => item?.car?.id === selectedCarId)?.car ?? null;
                    if (!car) {
                      setServicePickerError("Select a car to continue.");
                      return;
                    }
                    setSelectActionCar(car);
                    setSelectActionMode("appointment");
                    setSelectActionError(null);
                    setSelectActionOpen(true);
                    setServicePickerOpen(false);
                  }}
                >
                  <div className="flex flex-col items-center gap-2 text-center">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-2xl">
                      📅
                    </span>
                    <span>Create Appointment</span>
                  </div>
                </button>
                <button
                  type="button"
                  className={`rounded-lg border px-4 py-3 text-left text-sm font-semibold ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-white/10`}
                  onClick={() => setServicePickerError("Towing service will be added later.")}
                >
                  <div className="flex flex-col items-center gap-2 text-center">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-2xl">
                      🚚
                    </span>
                    <span>Towing Service</span>
                  </div>
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {rsaLeadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className={`w-full max-w-2xl rounded-xl shadow-xl ${theme.cardBg} ${theme.cardBorder}`}>
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="text-sm font-semibold">Create RSA Lead</div>
              <button
                type="button"
                onClick={() => setRsaLeadOpen(false)}
                className={`rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-white/10`}
              >
                Close
              </button>
            </div>
            <div className="space-y-4 p-4">
              {rsaLeadError && <div className="text-sm text-red-400">{rsaLeadError}</div>}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className={`text-xs font-semibold ${theme.mutedText}`}>
                    Select from Existing or Add New Car
                  </label>
                  <select
                    className={theme.input}
                    value={rsaLeadForm.carId}
                    onChange={(e) => setRsaLeadForm((prev) => ({ ...prev, carId: e.target.value }))}
                  >
                    <option value="">Select Car</option>
                    {linkedCars.map((item) => {
                      const car = item?.car ?? {};
                      const id = String(car.id ?? "");
                      if (!id) return null;
                      const plate = car.plate_number || car.plateNumber || "No Plate";
                      const details = [car.make, car.model, car.model_year || car.modelYear]
                        .filter(Boolean)
                        .join(" ");
                      return (
                        <option key={id} value={id}>
                          {details ? `${plate} - ${details}` : plate}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className={`text-xs font-semibold ${theme.mutedText}`}>Select Lead Division</label>
                  <select
                    className={theme.input}
                    value={rsaLeadForm.division}
                    onChange={(e) =>
                      setRsaLeadForm((prev) => ({
                        ...prev,
                        division: e.target.value as RsaLeadDivision | "",
                      }))
                    }
                  >
                    <option value="">Select Lead Division</option>
                    {RSA_LEAD_DIVISIONS.map((division) => (
                      <option key={division.value} value={division.value}>
                        {division.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className={`text-xs font-semibold ${theme.mutedText}`}>Location Link</label>
                <textarea
                  className={theme.input}
                  value={rsaLeadForm.locationLinkRsa}
                  onChange={(e) =>
                    setRsaLeadForm((prev) => ({ ...prev, locationLinkRsa: e.target.value }))
                  }
                  placeholder="Enter location link"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <label className={`text-xs font-semibold ${theme.mutedText}`}>Lead Remarks</label>
                <textarea
                  className={theme.input}
                  value={rsaLeadForm.remarks}
                  onChange={(e) => setRsaLeadForm((prev) => ({ ...prev, remarks: e.target.value }))}
                  placeholder="Enter lead remarks"
                  rows={4}
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className={`rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-white/10`}
                  onClick={() => setRsaLeadOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-md bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary-foreground"
                  disabled={rsaLeadSaving}
                  onClick={createRsaLead}
                >
                  {rsaLeadSaving ? "Creating..." : "Create RSA Lead"}
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {selectActionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className={`w-full max-w-lg rounded-xl shadow-xl ${theme.cardBg} ${theme.cardBorder}`}>
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="text-sm font-semibold">Customer Car Action</div>
              <button
                type="button"
                onClick={() => setSelectActionOpen(false)}
                className={`rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-white/10`}
              >
                Close
              </button>
            </div>
            <div className="space-y-4 p-4">
              {selectActionError && <div className="text-sm text-red-400">{selectActionError}</div>}
              <div className={`rounded-md ${theme.cardBorder} ${theme.surfaceSubtle} px-3 py-2 text-sm`}>
                <div className="font-semibold">
                  {selectActionCar?.plate_number || selectActionCar?.plateNumber || "N/A"}
                </div>
                <div className={`text-xs ${theme.mutedText}`}>
                  {[selectActionCar?.make, selectActionCar?.model, selectActionCar?.model_year]
                    .filter(Boolean)
                    .join(" ") || "Car"}
                </div>
              </div>

              {selectActionMode === "menu" && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className={`text-xs font-semibold ${theme.mutedText}`}>Remarks</label>
                      <span className="text-[10px] uppercase tracking-wide text-white/60">
                        Required for service requests
                      </span>
                    </div>
                    <textarea
                      className={theme.input}
                      value={appointmentForm.remarks}
                      onChange={(e) =>
                        setAppointmentForm((prev) => ({ ...prev, remarks: e.target.value }))
                      }
                      placeholder="Enter remarks"
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className={`text-xs font-semibold ${theme.mutedText}`}>Service Type</label>
                      <span className="text-[10px] uppercase tracking-wide text-white/60">
                        Required
                      </span>
                    </div>
                    <select
                      className={theme.input}
                      value={appointmentForm.serviceType}
                      onChange={(e) =>
                        setAppointmentForm((prev) => ({
                          ...prev,
                          serviceType: e.target.value as ServiceRequestType,
                        }))
                      }
                    >
                      {serviceRequestTypes.map((value) => (
                        <option key={value} value={value}>
                          {serviceRequestTypeLabels[value]}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-white/60">
                      You can update this later from the lead details screen.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      className="rounded-md bg-primary px-3 py-2 text-xs font-semibold uppercase tracking-wide text-primary-foreground"
                      disabled={selectActionSaving}
                      onClick={() => runCarAction("car_in")}
                    >
                      {selectActionSaving ? "Working..." : "Car In (Walkin)"}
                    </button>
                    <button
                      type="button"
                      className={`rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-white/10`}
                      onClick={() => setSelectActionMode("appointment")}
                    >
                      Create Appointment
                    </button>
                  </div>
                </div>
              )}

              {selectActionMode === "appointment" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className={`text-xs font-semibold ${theme.mutedText}`}>Appointment Date</label>
                    <input
                      type="datetime-local"
                      className={theme.input}
                      value={appointmentForm.appointmentAt}
                      onChange={(e) =>
                        setAppointmentForm((prev) => ({ ...prev, appointmentAt: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={`text-xs font-semibold ${theme.mutedText}`}>Appointment Type</label>
                    <select
                      className={theme.input}
                      value={appointmentForm.type}
                      onChange={(e) =>
                        setAppointmentForm((prev) => ({ ...prev, type: e.target.value }))
                      }
                    >
                      <option value="walkin">Walkin</option>
                      <option value="recovery">Recovery</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className={`text-xs font-semibold ${theme.mutedText}`}>Remarks</label>
                    <textarea
                      className={theme.input}
                      value={appointmentForm.remarks}
                      onChange={(e) =>
                        setAppointmentForm((prev) => ({ ...prev, remarks: e.target.value }))
                      }
                      placeholder="Enter remarks"
                      rows={3}
                    />
                  </div>
                  {isRecoveryAppointment && (
                    <>
                      <div className="space-y-2">
                        <label className={`text-xs font-semibold ${theme.mutedText}`}>Pickup Location</label>
                        <input
                          type="text"
                          className={theme.input}
                          value={appointmentForm.pickupLocation}
                          onChange={(e) =>
                            setAppointmentForm((prev) => ({ ...prev, pickupLocation: e.target.value }))
                          }
                          placeholder="Enter pickup location"
                        />
                      </div>
                    </>
                  )}
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      className={`rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-white/10`}
                      onClick={() => setSelectActionMode("menu")}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      className="rounded-md bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary-foreground"
                      disabled={appointmentDisabled}
                      onClick={() => runCarAction("appointment")}
                    >
                      {selectActionSaving ? "Working..." : "Create Appointment"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </AppLayout>
  );
}

const carMakes = ["Audi", "BMW", "Ford", "Honda", "Hyundai", "Kia", "Mazda", "Nissan", "Toyota"];

const carModelsByMake: Record<string, string[]> = {
  Audi: ["A3", "A4", "Q5"],
  BMW: ["3 Series", "5 Series", "X5"],
  Ford: ["Escape", "Explorer", "Focus"],
  Honda: ["Accord", "Civic", "CR-V"],
  Hyundai: ["Accent", "Elantra", "Sonata"],
  Kia: ["Cerato", "Optima", "Sportage"],
  Mazda: ["3", "6", "CX-5"],
  Nissan: ["Altima", "Patrol", "Sunny"],
  Toyota: ["Camry", "Corolla", "Land Cruiser"],
};

const carYears = Array.from({ length: 30 }, (_, index) => new Date().getFullYear() - index);

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <div className="overflow-hidden rounded-md border border-white/15">
      <div className={`flex items-center justify-between px-4 py-2 text-sm font-semibold ${theme.surfaceSubtle} ${theme.cardBorder}`}>
        <span>{title}</span>
        <span className="text-lg leading-none">-</span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

type LeadsSortBy = "id" | "leadType" | "leadStatus" | "leadStage" | "car" | "updatedAt";
type InspectionsSortBy = "status" | "carId" | "startedAt" | "updatedAt";
type EstimatesSortBy = "status" | "carId" | "total" | "updatedAt";

function titleize(value?: string | null) {
  if (!value) return "-";
  return value
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function leadBadgeClass(kind: "type" | "status", value?: string | null) {
  const normalized = (value ?? "").toLowerCase();
  if (kind === "type") {
    if (normalized === "recovery") return "bg-cyan-500/15 text-cyan-300 border-cyan-400/35";
    if (normalized === "workshop") return "bg-indigo-500/15 text-indigo-300 border-indigo-400/35";
    if (normalized === "rsa") return "bg-amber-500/15 text-amber-300 border-amber-400/35";
    return "bg-slate-500/15 text-slate-300 border-slate-400/35";
  }
  if (normalized === "completed" || normalized === "closed" || normalized === "closed_won") {
    return "bg-emerald-500/15 text-emerald-300 border-emerald-400/35";
  }
  if (normalized === "lost" || normalized === "cancelled") {
    return "bg-rose-500/15 text-rose-300 border-rose-400/35";
  }
  if (normalized === "car_in" || normalized === "accepted") {
    return "bg-sky-500/15 text-sky-300 border-sky-400/35";
  }
  return "bg-slate-500/15 text-slate-300 border-slate-400/35";
}

function inspectionStatusBadgeClass(value?: string | null) {
  const normalized = (value ?? "").toLowerCase();
  if (normalized === "completed" || normalized === "verified") {
    return "bg-emerald-500/15 text-emerald-300 border-emerald-400/35";
  }
  if (normalized === "cancelled" || normalized === "rejected") {
    return "bg-rose-500/15 text-rose-300 border-rose-400/35";
  }
  if (normalized === "in_progress" || normalized === "processing") {
    return "bg-sky-500/15 text-sky-300 border-sky-400/35";
  }
  return "bg-amber-500/15 text-amber-300 border-amber-400/35";
}

function estimateStatusBadgeClass(value?: string | null) {
  const normalized = (value ?? "").toLowerCase();
  if (normalized === "finalized" || normalized === "approved") {
    return "bg-emerald-500/15 text-emerald-300 border-emerald-400/35";
  }
  if (normalized === "cancelled" || normalized === "rejected") {
    return "bg-rose-500/15 text-rose-300 border-rose-400/35";
  }
  if (normalized === "draft") {
    return "bg-amber-500/15 text-amber-300 border-amber-400/35";
  }
  return "bg-slate-500/15 text-slate-300 border-slate-400/35";
}

function walletTransactionStatusBadgeClass(isApproved: boolean) {
  return isApproved
    ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/35"
    : "bg-amber-500/15 text-amber-300 border-amber-400/35";
}

function CustomerInvoicesTable({
  loading,
  error,
  invoices,
  companyId,
  formatDateTime,
}: {
  loading: boolean;
  error: string | null;
  invoices: CustomerInvoiceRow[];
  companyId: string | null;
  formatDateTime: (value?: string | null) => string;
}) {
  const { theme } = useTheme();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [rows, setRows] = useState<"10" | "25" | "50" | "100" | "all">("25");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, rows]);

  const statusOptions = useMemo(
    () => Array.from(new Set(invoices.map((row) => String(row.status ?? "")).filter(Boolean))).sort(),
    [invoices]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices
      .filter((row) => {
        if (statusFilter !== "all" && String(row.status ?? "").toLowerCase() !== statusFilter) return false;
        if (!q) return true;
        const haystack = [
          row.id,
          row.invoice_number,
          row.car_plate,
          row.advisor_name,
          row.payment_method,
          row.status,
          row.grand_total?.toString(),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort(
        (a, b) =>
          new Date(b.invoice_date ?? b.created_at ?? 0).getTime() -
          new Date(a.invoice_date ?? a.created_at ?? 0).getTime()
      );
  }, [invoices, search, statusFilter]);

  const totalPages = useMemo(() => {
    if (rows === "all") return 1;
    return Math.max(1, Math.ceil(filtered.length / Number(rows)));
  }, [filtered.length, rows]);

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const paged = useMemo(() => {
    if (rows === "all") return filtered;
    const size = Number(rows);
    const start = (page - 1) * size;
    return filtered.slice(start, start + size);
  }, [filtered, rows, page]);

  const pageItems = useMemo(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + 4);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [page, totalPages]);

  const formatAmount = (value: number | null | undefined) =>
    `AED ${new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value ?? 0))}`;

  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search invoice, plate, advisor, status"
          className={`${theme.input} md:col-span-3`}
        />
        <select className={theme.input} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          {statusOptions.map((status) => (
            <option key={status} value={status.toLowerCase()}>
              {titleize(status)}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/70">Rows</span>
          <select
            className={`${theme.input} h-8 w-[90px] py-0 text-xs`}
            value={rows}
            onChange={(e) => setRows(e.target.value as "10" | "25" | "50" | "100" | "all")}
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      <div className="text-xs text-white/70">Showing {loading ? 0 : paged.length} of {filtered.length} invoices</div>

      <div className={`hidden overflow-auto rounded-md border md:block ${theme.cardBorder} ${theme.surfaceSubtle} max-h-[560px]`}>
        <table className="min-w-full table-fixed text-xs">
          <thead className="sticky top-0 z-20 bg-slate-900 text-white/80">
            <tr className="border-b border-slate-500/40">
              <th className="w-[180px] px-3 py-2 text-left">Invoice ID</th>
              <th className="w-[170px] px-3 py-2 text-left">Invoice Date</th>
              <th className="w-[120px] px-3 py-2 text-left">Plate#</th>
              <th className="w-[140px] px-3 py-2 text-left">Sales Agent</th>
              <th className="w-[140px] px-3 py-2 text-left">Total Amount</th>
              <th className="w-[120px] px-3 py-2 text-left">Status</th>
              <th className="w-[120px] px-3 py-2 text-left">Mode</th>
              <th className="w-[180px] px-3 py-2 text-left">Payment Date</th>
              <th className="w-[140px] px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-white/70">Loading invoices...</td>
              </tr>
            ) : paged.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-white/70">{error ?? "No invoices found for this filter."}</td>
              </tr>
            ) : (
              paged.map((row) => (
                <tr key={row.id} className="border-b border-slate-500/30 text-white/85 hover:bg-white/[0.03]">
                  <td className="px-3 py-2">{row.invoice_number ?? row.id}</td>
                  <td className="px-3 py-2">{formatDateTime(row.invoice_date ?? row.created_at)}</td>
                  <td className="px-3 py-2">{row.car_plate ?? "-"}</td>
                  <td className="px-3 py-2">{row.advisor_name ?? "-"}</td>
                  <td className="px-3 py-2">{formatAmount(row.grand_total)}</td>
                  <td className="px-3 py-2">{titleize(row.status)}</td>
                  <td className="px-3 py-2">{titleize(row.payment_method)}</td>
                  <td className="px-3 py-2">{formatDateTime(row.paid_at ?? row.invoice_date)}</td>
                  <td className="px-3 py-2">
                    {companyId ? (
                      <Link
                        href={`/api/company/${companyId}/workshop/invoices/${row.id}/print`}
                        target="_blank"
                        className="rounded-md border border-white/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/70 hover:bg-white/10"
                      >
                        Print
                      </Link>
                    ) : (
                      <span className="text-white/60">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-end gap-1">
          <button
            type="button"
            className="rounded-md border border-white/20 px-2 py-1 text-[11px] text-white/70 disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => setPage(Math.max(1, page - 1))}
          >
            Prev
          </button>
          {pageItems.map((item) => (
            <button
              key={item}
              type="button"
              className={`rounded-md px-2 py-1 text-[11px] ${item === page ? "bg-blue-600 text-white" : "border border-white/20 text-white/70"}`}
              onClick={() => setPage(item)}
            >
              {item}
            </button>
          ))}
          <button
            type="button"
            className="rounded-md border border-white/20 px-2 py-1 text-[11px] text-white/70 disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={() => setPage(Math.min(totalPages, page + 1))}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function CustomerTransactionsTable({
  loading,
  error,
  transactions,
  customerId,
  companyId,
  formatDateTime,
}: {
  loading: boolean;
  error: string | null;
  transactions: WalletTransactionRow[];
  customerId: string | null;
  companyId: string | null;
  formatDateTime: (value?: string | null) => string;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "approved" | "pending">("all");
  const [rows, setRows] = useState<"10" | "25" | "50" | "100" | "all">("25");
  const [page, setPage] = useState(1);
  const { theme } = useTheme();

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions
      .filter((tx) => {
        const approved = Boolean(tx.approved_at);
        if (statusFilter === "approved" && !approved) return false;
        if (statusFilter === "pending" && approved) return false;
        if (!q) return true;
        const haystack = [
          tx.id,
          tx.payment_method,
          tx.approved_by,
          tx.amount?.toString(),
          tx.payment_date,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
  }, [transactions, search, statusFilter]);

  const totalPages = useMemo(() => {
    if (rows === "all") return 1;
    return Math.max(1, Math.ceil(filtered.length / Number(rows)));
  }, [filtered.length, rows]);

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const paged = useMemo(() => {
    if (rows === "all") return filtered;
    const size = Number(rows);
    const start = (page - 1) * size;
    return filtered.slice(start, start + size);
  }, [filtered, rows, page]);

  const pageItems = useMemo(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + 4);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [page, totalPages]);

  const formatAmount = (value: number) =>
    `AED ${new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value ?? 0))}`;

  const formatTxnId = (tx: WalletTransactionRow) => {
    const serial = Number(tx.serial_no ?? 0);
    if (Number.isFinite(serial) && serial > 0) {
      return `TXN-${String(Math.trunc(serial)).padStart(6, "0")}`;
    }
    return tx.id;
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search txn, method, amount, collector"
          className={`${theme.input} md:col-span-3`}
        />
        <select
          className={theme.input}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | "approved" | "pending")}
        >
          <option value="all">All Statuses</option>
          <option value="approved">Approved</option>
          <option value="pending">Pending Verification</option>
        </select>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/70">Rows</span>
          <select
            className={`${theme.input} h-8 w-[90px] py-0 text-xs`}
            value={rows}
            onChange={(e) => setRows(e.target.value as "10" | "25" | "50" | "100" | "all")}
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      <div className="text-xs text-white/70">
        Showing {loading ? 0 : paged.length} of {filtered.length} transactions
      </div>

      <div className={`hidden overflow-auto rounded-md border md:block ${theme.cardBorder} ${theme.surfaceSubtle} max-h-[560px]`}>
        <table className="min-w-full table-fixed text-xs">
          <thead className="sticky top-0 z-20 bg-slate-900 text-white/80">
            <tr className="border-b border-slate-500/40">
              <th className="w-[200px] px-3 py-2 text-left">Txn ID</th>
              <th className="w-[140px] px-3 py-2 text-left">Payment Mode</th>
              <th className="w-[130px] px-3 py-2 text-left">Payment Proof</th>
              <th className="w-[150px] px-3 py-2 text-left">Payment Amount</th>
              <th className="w-[170px] px-3 py-2 text-left">Collect By</th>
              <th className="w-[170px] px-3 py-2 text-left">Status</th>
              <th className="w-[130px] px-3 py-2 text-left">Proforma</th>
              <th className="w-[190px] px-3 py-2 text-left">Payment Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-white/70">
                  Loading transactions...
                </td>
              </tr>
            ) : paged.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-white/70">
                  {error ?? "No transactions found for this filter."}
                </td>
              </tr>
            ) : (
              paged.map((tx) => {
                const approved = Boolean(tx.approved_at);
                return (
                  <tr key={tx.id} className="border-b border-slate-500/30 text-white/85 hover:bg-white/[0.03]">
                    <td className="px-3 py-2">{formatTxnId(tx)}</td>
                    <td className="px-3 py-2">{titleize(tx.payment_method) ?? "-"}</td>
                    <td className="px-3 py-2">
                      {tx.payment_proof_file_id ? (
                        <a
                          href={`/api/files/${tx.payment_proof_file_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md border border-white/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/70 hover:bg-white/10"
                        >
                          View
                        </a>
                      ) : (
                        <span className="text-white/60">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{formatAmount(tx.amount)}</td>
                    <td className="px-3 py-2">{tx.approved_by_name ?? tx.approved_by ?? "-"}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${walletTransactionStatusBadgeClass(
                          approved
                        )}`}
                      >
                        {approved ? "Approved" : "Pending Verification"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {customerId ? (
                        <Link
                          href={`/api/customers/${customerId}/wallet/transactions/${tx.id}/proforma?companyId=${companyId ?? ""}`}
                          target="_blank"
                          className="rounded-md border border-white/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/70 hover:bg-white/10"
                        >
                          Print
                        </Link>
                      ) : (
                        <span className="text-white/60">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{formatDateTime(tx.payment_date ?? tx.created_at)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 md:hidden">
        {loading ? (
          <div className="rounded-md border border-slate-500/30 bg-slate-900/40 px-3 py-4 text-sm text-white/70">Loading transactions...</div>
        ) : paged.length === 0 ? (
          <div className="rounded-md border border-slate-500/30 bg-slate-900/40 px-3 py-4 text-sm text-white/70">
            {error ?? "No transactions found for this filter."}
          </div>
        ) : (
          paged.map((tx) => {
            const approved = Boolean(tx.approved_at);
            return (
              <div key={tx.id} className="space-y-2 rounded-md border border-slate-500/35 bg-slate-900/45 px-3 py-3 text-xs">
                <div className="font-semibold text-white/90">{formatTxnId(tx)}</div>
                <div className="text-white/70">Mode: {titleize(tx.payment_method)}</div>
                <div className="text-white/70">Amount: {formatAmount(tx.amount)}</div>
                <div className="text-white/60">Payment Date: {formatDateTime(tx.payment_date ?? tx.created_at)}</div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${walletTransactionStatusBadgeClass(
                      approved
                    )}`}
                  >
                    {approved ? "Approved" : "Pending Verification"}
                  </span>
                  {customerId ? (
                    <Link
                      href={`/api/customers/${customerId}/wallet/transactions/${tx.id}/proforma?companyId=${companyId ?? ""}`}
                      target="_blank"
                      className="rounded-md border border-white/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/70 hover:bg-white/10"
                    >
                      Print
                    </Link>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-end gap-1">
          <button
            type="button"
            className="rounded-md border border-white/20 px-2 py-1 text-[11px] text-white/70 disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => setPage(Math.max(1, page - 1))}
          >
            Prev
          </button>
          {pageItems.map((item) => (
            <button
              key={item}
              type="button"
              className={`rounded-md px-2 py-1 text-[11px] ${item === page ? "bg-blue-600 text-white" : "border border-white/20 text-white/70"}`}
              onClick={() => setPage(item)}
            >
              {item}
            </button>
          ))}
          <button
            type="button"
            className="rounded-md border border-white/20 px-2 py-1 text-[11px] text-white/70 disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={() => setPage(Math.min(totalPages, page + 1))}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function CustomerLeadsTable({
  loading,
  error,
  leads,
  total,
  page,
  totalPages,
  pageSize,
  search,
  typeFilter,
  statusFilter,
  stageFilter,
  carFilter,
  selectedCarId,
  sortBy,
  sortDir,
  typeOptions,
  statusOptions,
  stageOptions,
  cars,
  companyId,
  onSearchChange,
  onTypeFilterChange,
  onStatusFilterChange,
  onStageFilterChange,
  onCarFilterChange,
  onPageSizeChange,
  onPageChange,
  onSortChange,
  formatDateTime,
}: {
  loading: boolean;
  error: string | null;
  leads: Lead[];
  total: number;
  page: number;
  totalPages: number;
  pageSize: "10" | "25" | "50" | "100" | "all";
  search: string;
  typeFilter: string;
  statusFilter: string;
  stageFilter: string;
  carFilter: string;
  selectedCarId: string | null;
  sortBy: LeadsSortBy;
  sortDir: "asc" | "desc";
  typeOptions: string[];
  statusOptions: string[];
  stageOptions: string[];
  cars: CustomerCarLink[];
  companyId: string | null;
  onSearchChange: (v: string) => void;
  onTypeFilterChange: (v: string) => void;
  onStatusFilterChange: (v: string) => void;
  onStageFilterChange: (v: string) => void;
  onCarFilterChange: (v: string) => void;
  onPageSizeChange: (v: "10" | "25" | "50" | "100" | "all") => void;
  onPageChange: (v: number) => void;
  onSortChange: (v: LeadsSortBy) => void;
  formatDateTime: (value?: string | null) => string;
}) {
  const { theme } = useTheme();
  const pageItems = useMemo(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + 4);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [page, totalPages]);

  const renderSortLabel = (label: string, value: LeadsSortBy) => (
    <button
      type="button"
      className="inline-flex items-center gap-1 font-semibold hover:text-white"
      onClick={() => onSortChange(value)}
    >
      {label}
      <span className={sortBy === value ? "text-blue-300" : "text-white/40"}>
        {sortBy === value ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-6">
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search lead id, type, status, stage, car"
          className={`${theme.input} md:col-span-2`}
        />
        <select className={theme.input} value={carFilter} onChange={(e) => onCarFilterChange(e.target.value)}>
          <option value="selected">Selected Car</option>
          <option value="all">All Cars</option>
          {cars.map((item) => {
            const car = item.car ?? {};
            const carId = car.id as string | undefined;
            if (!carId) return null;
            const label = [car.plate_number, car.make, car.model].filter(Boolean).join(" ");
            return (
              <option key={carId} value={carId}>
                {label || carId}
              </option>
            );
          })}
        </select>
        <select className={theme.input} value={typeFilter} onChange={(e) => onTypeFilterChange(e.target.value)}>
          <option value="all">All Types</option>
          {typeOptions.map((value) => (
            <option key={value} value={value}>
              {titleize(value)}
            </option>
          ))}
        </select>
        <select className={theme.input} value={statusFilter} onChange={(e) => onStatusFilterChange(e.target.value)}>
          <option value="all">All Statuses</option>
          {statusOptions.map((value) => (
            <option key={value} value={value}>
              {titleize(value)}
            </option>
          ))}
        </select>
        <select className={theme.input} value={stageFilter} onChange={(e) => onStageFilterChange(e.target.value)}>
          <option value="all">All Stages</option>
          {stageOptions.map((value) => (
            <option key={value} value={value}>
              {titleize(value)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/70">
        <div>
          Showing {loading ? 0 : leads.length} of {total} leads
          {carFilter === "selected" ? (
            <span className="ml-2 text-blue-300">{selectedCarId ? "(selected car)" : "(no selected car)"}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span>Rows</span>
          <select
            className={`${theme.input} h-8 w-[90px] py-0 text-xs`}
            value={pageSize}
            onChange={(e) => onPageSizeChange(e.target.value as "10" | "25" | "50" | "100" | "all")}
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      <div className={`hidden overflow-auto rounded-md border md:block ${theme.cardBorder} ${theme.surfaceSubtle} max-h-[560px]`}>
        <table className="min-w-full table-fixed text-xs">
          <thead className="sticky top-0 z-20 bg-slate-900 text-white/80">
            <tr className="border-b border-slate-500/40">
              <th className="w-[220px] px-3 py-2 text-left">{renderSortLabel("Car", "car")}</th>
              <th className="w-[100px] px-3 py-2 text-left">{renderSortLabel("Type", "leadType")}</th>
              <th className="w-[120px] px-3 py-2 text-left">{renderSortLabel("Status", "leadStatus")}</th>
              <th className="w-[160px] px-3 py-2 text-left">{renderSortLabel("Stage", "leadStage")}</th>
              <th className="w-[190px] px-3 py-2 text-left">{renderSortLabel("Updated", "updatedAt")}</th>
              <th className="w-[90px] px-3 py-2 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-white/70">
                  Loading leads...
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-white/70">
                  {error ?? "No leads found for this filter."}
                </td>
              </tr>
            ) : (
              leads.map((lead) => {
                const carLabel = [lead.carPlateNumber, lead.carModel].filter(Boolean).join(" ") || "-";
                return (
                  <tr key={lead.id} className="border-b border-slate-500/30 text-white/85 hover:bg-white/[0.03]">
                    <td className="px-3 py-2">{carLabel}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${leadBadgeClass("type", lead.leadType)}`}>
                        {titleize(lead.leadType)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${leadBadgeClass("status", lead.leadStatus)}`}>
                        {titleize(lead.leadStatus)}
                      </span>
                    </td>
                    <td className="px-3 py-2">{titleize(lead.leadStage)}</td>
                    <td className="px-3 py-2">{formatDateTime(lead.updatedAt)}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={companyId ? `/company/${companyId}/leads/${lead.id}` : "#"}
                        className="rounded-md border border-white/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/70 hover:bg-white/10"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 md:hidden">
        {loading ? (
          <div className="rounded-md border border-slate-500/30 bg-slate-900/40 px-3 py-4 text-sm text-white/70">Loading leads...</div>
        ) : leads.length === 0 ? (
          <div className="rounded-md border border-slate-500/30 bg-slate-900/40 px-3 py-4 text-sm text-white/70">
            {error ?? "No leads found for this filter."}
          </div>
        ) : (
          leads.map((lead) => {
            const carLabel = [lead.carPlateNumber, lead.carModel].filter(Boolean).join(" ") || "-";
            return (
              <div key={lead.id} className="space-y-2 rounded-md border border-slate-500/35 bg-slate-900/45 px-3 py-3 text-xs">
                <div className="flex flex-wrap gap-1">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${leadBadgeClass("type", lead.leadType)}`}>
                    {titleize(lead.leadType)}
                  </span>
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${leadBadgeClass("status", lead.leadStatus)}`}>
                    {titleize(lead.leadStatus)}
                  </span>
                  <span className="inline-flex rounded-full border border-slate-500/40 bg-slate-700/35 px-2 py-0.5 text-[10px] text-white/80">
                    {titleize(lead.leadStage)}
                  </span>
                </div>
                <div className="text-white/75">Car: {carLabel}</div>
                <div className="text-white/60">Updated: {formatDateTime(lead.updatedAt)}</div>
                <div>
                  <Link
                    href={companyId ? `/company/${companyId}/leads/${lead.id}` : "#"}
                    className="rounded-md border border-white/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/70 hover:bg-white/10"
                  >
                    View
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-end gap-1">
          <button
            type="button"
            className="rounded-md border border-white/20 px-2 py-1 text-[11px] text-white/70 disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => onPageChange(Math.max(1, page - 1))}
          >
            Prev
          </button>
          {pageItems.map((item) => (
            <button
              key={item}
              type="button"
              className={`rounded-md px-2 py-1 text-[11px] ${item === page ? "bg-blue-600 text-white" : "border border-white/20 text-white/70"}`}
              onClick={() => onPageChange(item)}
            >
              {item}
            </button>
          ))}
          <button
            type="button"
            className="rounded-md border border-white/20 px-2 py-1 text-[11px] text-white/70 disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function CustomerInspectionsTable({
  loading,
  error,
  inspections,
  total,
  page,
  totalPages,
  pageSize,
  search,
  statusFilter,
  statusOptions,
  carFilter,
  selectedCarId,
  sortBy,
  sortDir,
  cars,
  companyId,
  carLabels,
  onSearchChange,
  onStatusFilterChange,
  onCarFilterChange,
  onPageSizeChange,
  onPageChange,
  onSortChange,
  formatDateTime,
}: {
  loading: boolean;
  error: string | null;
  inspections: Inspection[];
  total: number;
  page: number;
  totalPages: number;
  pageSize: "10" | "25" | "50" | "100" | "all";
  search: string;
  statusFilter: string;
  statusOptions: string[];
  carFilter: string;
  selectedCarId: string | null;
  sortBy: InspectionsSortBy;
  sortDir: "asc" | "desc";
  cars: CustomerCarLink[];
  companyId: string | null;
  carLabels: Map<string, string>;
  onSearchChange: (v: string) => void;
  onStatusFilterChange: (v: string) => void;
  onCarFilterChange: (v: string) => void;
  onPageSizeChange: (v: "10" | "25" | "50" | "100" | "all") => void;
  onPageChange: (v: number) => void;
  onSortChange: (v: InspectionsSortBy) => void;
  formatDateTime: (value?: string | null) => string;
}) {
  const { theme } = useTheme();
  const pageItems = useMemo(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + 4);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [page, totalPages]);

  const renderSortLabel = (label: string, value: InspectionsSortBy) => (
    <button
      type="button"
      className="inline-flex items-center gap-1 font-semibold hover:text-white"
      onClick={() => onSortChange(value)}
    >
      {label}
      <span className={sortBy === value ? "text-blue-300" : "text-white/40"}>
        {sortBy === value ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-5">
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search inspection, lead, car, status"
          className={`${theme.input} md:col-span-2`}
        />
        <select className={theme.input} value={carFilter} onChange={(e) => onCarFilterChange(e.target.value)}>
          <option value="selected">Selected Car</option>
          <option value="all">All Cars</option>
          {cars.map((item) => {
            const car = item.car ?? {};
            const carId = car.id as string | undefined;
            if (!carId) return null;
            const label = [car.plate_number, car.make, car.model].filter(Boolean).join(" ");
            return (
              <option key={carId} value={carId}>
                {label || carId}
              </option>
            );
          })}
        </select>
        <select className={theme.input} value={statusFilter} onChange={(e) => onStatusFilterChange(e.target.value)}>
          <option value="all">All Statuses</option>
          {statusOptions.map((value) => (
            <option key={value} value={value}>
              {titleize(value)}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/70">Rows</span>
          <select
            className={`${theme.input} h-8 w-[90px] py-0 text-xs`}
            value={pageSize}
            onChange={(e) => onPageSizeChange(e.target.value as "10" | "25" | "50" | "100" | "all")}
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      <div className="text-xs text-white/70">
        Showing {loading ? 0 : inspections.length} of {total} inspections
        {carFilter === "selected" ? (
          <span className="ml-2 text-blue-300">{selectedCarId ? "(selected car)" : "(no selected car)"}</span>
        ) : null}
      </div>

      <div className={`hidden overflow-auto rounded-md border md:block ${theme.cardBorder} ${theme.surfaceSubtle} max-h-[560px]`}>
        <table className="min-w-full table-fixed text-xs">
          <thead className="sticky top-0 z-20 bg-slate-900 text-white/80">
            <tr className="border-b border-slate-500/40">
              <th className="w-[210px] px-3 py-2 text-left">{renderSortLabel("Car", "carId")}</th>
              <th className="w-[120px] px-3 py-2 text-left">{renderSortLabel("Status", "status")}</th>
              <th className="w-[170px] px-3 py-2 text-left">Lead</th>
              <th className="w-[190px] px-3 py-2 text-left">{renderSortLabel("Started", "startedAt")}</th>
              <th className="w-[190px] px-3 py-2 text-left">{renderSortLabel("Updated", "updatedAt")}</th>
              <th className="w-[90px] px-3 py-2 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-white/70">
                  Loading inspections...
                </td>
              </tr>
            ) : inspections.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-white/70">
                  {error ?? "No inspections found for this filter."}
                </td>
              </tr>
            ) : (
              inspections.map((inspection) => (
                <tr key={inspection.id} className="border-b border-slate-500/30 text-white/85 hover:bg-white/[0.03]">
                  <td className="px-3 py-2">{carLabels.get(inspection.carId ?? "") ?? inspection.carId ?? "-"}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${inspectionStatusBadgeClass(inspection.status)}`}>
                      {titleize(inspection.status)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {inspection.leadId ? (
                      <Link
                        href={companyId ? `/company/${companyId}/leads/${inspection.leadId}` : "#"}
                        className="rounded-md border border-white/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/70 hover:bg-white/10"
                      >
                        View Lead
                      </Link>
                    ) : (
                      <span className="text-white/60">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{formatDateTime(inspection.startAt ?? inspection.createdAt)}</td>
                  <td className="px-3 py-2">{formatDateTime(inspection.updatedAt)}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={companyId ? `/company/${companyId}/inspections/${inspection.id}` : "#"}
                      className="rounded-md border border-white/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/70 hover:bg-white/10"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 md:hidden">
        {loading ? (
          <div className="rounded-md border border-slate-500/30 bg-slate-900/40 px-3 py-4 text-sm text-white/70">Loading inspections...</div>
        ) : inspections.length === 0 ? (
          <div className="rounded-md border border-slate-500/30 bg-slate-900/40 px-3 py-4 text-sm text-white/70">
            {error ?? "No inspections found for this filter."}
          </div>
        ) : (
          inspections.map((inspection) => (
            <div key={inspection.id} className="space-y-2 rounded-md border border-slate-500/35 bg-slate-900/45 px-3 py-3 text-xs">
              <div className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${inspectionStatusBadgeClass(inspection.status)}`}>
                {titleize(inspection.status)}
              </div>
              <div className="text-white/75">Car: {carLabels.get(inspection.carId ?? "") ?? inspection.carId ?? "-"}</div>
              <div className="text-white/65">
                Lead:{" "}
                {inspection.leadId ? (
                  <Link
                    href={companyId ? `/company/${companyId}/leads/${inspection.leadId}` : "#"}
                    className="underline underline-offset-2"
                  >
                    View Lead
                  </Link>
                ) : (
                  "-"
                )}
              </div>
              <div className="text-white/60">Started: {formatDateTime(inspection.startAt ?? inspection.createdAt)}</div>
              <div className="text-white/60">Updated: {formatDateTime(inspection.updatedAt)}</div>
              <div>
                <Link
                  href={companyId ? `/company/${companyId}/inspections/${inspection.id}` : "#"}
                  className="rounded-md border border-white/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/70 hover:bg-white/10"
                >
                  View
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-end gap-1">
          <button
            type="button"
            className="rounded-md border border-white/20 px-2 py-1 text-[11px] text-white/70 disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => onPageChange(Math.max(1, page - 1))}
          >
            Prev
          </button>
          {pageItems.map((item) => (
            <button
              key={item}
              type="button"
              className={`rounded-md px-2 py-1 text-[11px] ${item === page ? "bg-blue-600 text-white" : "border border-white/20 text-white/70"}`}
              onClick={() => onPageChange(item)}
            >
              {item}
            </button>
          ))}
          <button
            type="button"
            className="rounded-md border border-white/20 px-2 py-1 text-[11px] text-white/70 disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function CustomerEstimatesTable({
  loading,
  error,
  estimates,
  total,
  page,
  totalPages,
  pageSize,
  search,
  statusFilter,
  statusOptions,
  carFilter,
  selectedCarId,
  sortBy,
  sortDir,
  cars,
  companyId,
  carLabels,
  onSearchChange,
  onStatusFilterChange,
  onCarFilterChange,
  onPageSizeChange,
  onPageChange,
  onSortChange,
  formatDateTime,
}: {
  loading: boolean;
  error: string | null;
  estimates: Estimate[];
  total: number;
  page: number;
  totalPages: number;
  pageSize: "10" | "25" | "50" | "100" | "all";
  search: string;
  statusFilter: string;
  statusOptions: string[];
  carFilter: string;
  selectedCarId: string | null;
  sortBy: EstimatesSortBy;
  sortDir: "asc" | "desc";
  cars: CustomerCarLink[];
  companyId: string | null;
  carLabels: Map<string, string>;
  onSearchChange: (v: string) => void;
  onStatusFilterChange: (v: string) => void;
  onCarFilterChange: (v: string) => void;
  onPageSizeChange: (v: "10" | "25" | "50" | "100" | "all") => void;
  onPageChange: (v: number) => void;
  onSortChange: (v: EstimatesSortBy) => void;
  formatDateTime: (value?: string | null) => string;
}) {
  const { theme } = useTheme();
  const pageItems = useMemo(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + 4);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [page, totalPages]);

  const renderSortLabel = (label: string, value: EstimatesSortBy) => (
    <button
      type="button"
      className="inline-flex items-center gap-1 font-semibold hover:text-white"
      onClick={() => onSortChange(value)}
    >
      {label}
      <span className={sortBy === value ? "text-blue-300" : "text-white/40"}>
        {sortBy === value ? (sortDir === "asc" ? "^" : "v") : "<>"}
      </span>
    </button>
  );

  const formatMoney = (estimate: Estimate) => {
    const currency = estimate.currency ?? "AED";
    const total = Number(estimate.grandTotal ?? estimate.finalPrice ?? 0);
    return `${currency} ${Number.isFinite(total) ? total.toFixed(2) : "0.00"}`;
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-5">
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search estimate, lead, car, status"
          className={`${theme.input} md:col-span-2`}
        />
        <select className={theme.input} value={carFilter} onChange={(e) => onCarFilterChange(e.target.value)}>
          <option value="selected">Selected Car</option>
          <option value="all">All Cars</option>
          {cars.map((item) => {
            const car = item.car ?? {};
            const carId = car.id as string | undefined;
            if (!carId) return null;
            const label = [car.plate_number, car.make, car.model].filter(Boolean).join(" ");
            return (
              <option key={carId} value={carId}>
                {label || carId}
              </option>
            );
          })}
        </select>
        <select className={theme.input} value={statusFilter} onChange={(e) => onStatusFilterChange(e.target.value)}>
          <option value="all">All Statuses</option>
          {statusOptions.map((value) => (
            <option key={value} value={value}>
              {titleize(value)}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/70">Rows</span>
          <select
            className={`${theme.input} h-8 w-[90px] py-0 text-xs`}
            value={pageSize}
            onChange={(e) => onPageSizeChange(e.target.value as "10" | "25" | "50" | "100" | "all")}
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      <div className="text-xs text-white/70">
        Showing {loading ? 0 : estimates.length} of {total} estimates
        {carFilter === "selected" ? (
          <span className="ml-2 text-blue-300">{selectedCarId ? "(selected car)" : "(no selected car)"}</span>
        ) : null}
      </div>

      <div className={`hidden overflow-auto rounded-md border md:block ${theme.cardBorder} ${theme.surfaceSubtle} max-h-[560px]`}>
        <table className="min-w-full table-fixed text-xs">
          <thead className="sticky top-0 z-20 bg-slate-900 text-white/80">
            <tr className="border-b border-slate-500/40">
              <th className="w-[220px] px-3 py-2 text-left">{renderSortLabel("Car", "carId")}</th>
              <th className="w-[120px] px-3 py-2 text-left">{renderSortLabel("Status", "status")}</th>
              <th className="w-[170px] px-3 py-2 text-left">Lead</th>
              <th className="w-[160px] px-3 py-2 text-left">{renderSortLabel("Total", "total")}</th>
              <th className="w-[190px] px-3 py-2 text-left">{renderSortLabel("Updated", "updatedAt")}</th>
              <th className="w-[90px] px-3 py-2 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-white/70">
                  Loading estimates...
                </td>
              </tr>
            ) : estimates.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-white/70">
                  {error ?? "No estimates found for this filter."}
                </td>
              </tr>
            ) : (
              estimates.map((estimate) => (
                <tr key={estimate.id} className="border-b border-slate-500/30 text-white/85 hover:bg-white/[0.03]">
                  <td className="px-3 py-2">{carLabels.get(estimate.carId ?? "") ?? estimate.carId ?? "-"}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${estimateStatusBadgeClass(estimate.status)}`}>
                      {titleize(estimate.status)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {estimate.leadId ? (
                      <Link
                        href={companyId ? `/company/${companyId}/leads/${estimate.leadId}` : "#"}
                        className="rounded-md border border-white/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/70 hover:bg-white/10"
                      >
                        View Lead
                      </Link>
                    ) : (
                      <span className="text-white/60">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{formatMoney(estimate)}</td>
                  <td className="px-3 py-2">{formatDateTime(estimate.updatedAt)}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={companyId ? `/company/${companyId}/estimates/${estimate.id}` : "#"}
                      className="rounded-md border border-white/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/70 hover:bg-white/10"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 md:hidden">
        {loading ? (
          <div className="rounded-md border border-slate-500/30 bg-slate-900/40 px-3 py-4 text-sm text-white/70">Loading estimates...</div>
        ) : estimates.length === 0 ? (
          <div className="rounded-md border border-slate-500/30 bg-slate-900/40 px-3 py-4 text-sm text-white/70">
            {error ?? "No estimates found for this filter."}
          </div>
        ) : (
          estimates.map((estimate) => (
            <div key={estimate.id} className="space-y-2 rounded-md border border-slate-500/35 bg-slate-900/45 px-3 py-3 text-xs">
              <div className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${estimateStatusBadgeClass(estimate.status)}`}>
                {titleize(estimate.status)}
              </div>
              <div className="text-white/75">Car: {carLabels.get(estimate.carId ?? "") ?? estimate.carId ?? "-"}</div>
              <div className="text-white/65">
                Lead:{" "}
                {estimate.leadId ? (
                  <Link
                    href={companyId ? `/company/${companyId}/leads/${estimate.leadId}` : "#"}
                    className="underline underline-offset-2"
                  >
                    View Lead
                  </Link>
                ) : (
                  "-"
                )}
              </div>
              <div className="text-white/60">Total: {formatMoney(estimate)}</div>
              <div className="text-white/60">Updated: {formatDateTime(estimate.updatedAt)}</div>
              <div>
                <Link
                  href={companyId ? `/company/${companyId}/estimates/${estimate.id}` : "#"}
                  className="rounded-md border border-white/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/70 hover:bg-white/10"
                >
                  View
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-end gap-1">
          <button
            type="button"
            className="rounded-md border border-white/20 px-2 py-1 text-[11px] text-white/70 disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => onPageChange(Math.max(1, page - 1))}
          >
            Prev
          </button>
          {pageItems.map((item) => (
            <button
              key={item}
              type="button"
              className={`rounded-md px-2 py-1 text-[11px] ${item === page ? "bg-blue-600 text-white" : "border border-white/20 text-white/70"}`}
              onClick={() => onPageChange(item)}
            >
              {item}
            </button>
          ))}
          <button
            type="button"
            className="rounded-md border border-white/20 px-2 py-1 text-[11px] text-white/70 disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
