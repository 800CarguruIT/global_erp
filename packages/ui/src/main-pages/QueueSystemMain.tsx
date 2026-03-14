"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { MainPageShell } from "./MainPageShell";
import { Card } from "../components/Card";
import { FileUploader } from "../components/FileUploader";

type QueueSystemMainProps = {
  companyId: string;
};

type AdditionalCheckinImage = {
  id: string;
  fileId: string;
  remark: string;
};

type ApiListResponse<T> = {
  data?: T[];
  error?: string;
};

type LeadRow = {
  id: string;
  leadType?: string | null;
  leadStatus?: string | null;
  leadStage?: string | null;
  workshopVisitMode?: string | null;
  source?: string | null;
  branchName?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  carPlateNumber?: string | null;
  carModel?: string | null;
  preInspectionStatus?: string | null;
  preInspectionSubmitted?: boolean | null;
  checkinAt?: string | null;
  createdAt?: string | null;
};

type BookingRow = {
  id: string;
  leadId: string;
  bookingKind: "rsa" | "recovery" | "workshop_walkin" | "workshop_recovery";
  scheduledAt: string | null;
  pickupLocation: string | null;
  dropoffLocation: string | null;
  priority: "low" | "medium" | "high";
  status: "active" | "completed" | "cancelled";
  preServiceFormStatus: "pending" | "submitted" | null;
  preServiceFormSubmittedAt: string | null;
  preServiceFormToken?: string | null;
  customerName: string | null;
  customerPhone: string | null;
  carPlateNumber: string | null;
  carMake: string | null;
  carModel: string | null;
  createdAt: string | null;
};

type InspectionRow = {
  id: string;
  leadId?: string | null;
  status?: string | null;
  startAt?: string | null;
  branch?: { display_name?: string | null; name?: string | null; code?: string | null } | null;
};

type JobCardRow = {
  id: string;
  lead_id?: string | null;
  status?: string | null;
  done_by?: string | null;
  start_at?: string | null;
  complete_at?: string | null;
  final_inspection_at?: string | null;
  final_inspection_car_wash?: boolean | null;
  created_at?: string | null;
  branch_name?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  plate_number?: string | null;
  make?: string | null;
  model?: string | null;
};

type QcRow = {
  id: string;
  workOrderId: string;
  status: "queue" | "in_process" | "completed" | "failed";
  testDriveDone: boolean;
  washDone: boolean;
  updatedAt: string;
};

type GatepassRow = {
  id: string;
  invoiceId: string;
  handoverType: string;
  status: "pending" | "ready" | "released" | "cancelled";
  amountDue: number;
  paymentOk: boolean;
  createdAt?: string | null;
};

type QueueTabId =
  | "checkin"
  | "inspection"
  | "work"
  | "quality"
  | "wash"
  | "delivery";

const TABS: { id: QueueTabId; label: string; description: string }[] = [
  {
    id: "checkin",
    label: "Check In Queue",
    description: "Workshop walk-in bookings and walk-in leads with submitted pre-inspection form.",
  },
  {
    id: "inspection",
    label: "Inspection Queue",
    description: "Checked-in leads waiting for inspection.",
  },
  {
    id: "work",
    label: "Work Queue (Job Cards)",
    description: "Job cards not assigned or not started yet.",
  },
  {
    id: "quality",
    label: "Quality Check",
    description: "Job cards completed and waiting final inspection.",
  },
  {
    id: "wash",
    label: "Car Wash",
    description: "Final inspection done and waiting for wash.",
  },
  {
    id: "delivery",
    label: "Delivery/GatePass",
    description: "Cars ready for delivery/recovery handover.",
  },
];

function fmtDate(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function titleCase(value?: string | null) {
  return String(value ?? "-")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function badgeClass(kind?: string | null) {
  const v = String(kind ?? "").toLowerCase();
  if (v === "high" || v === "pending") return "bg-amber-500/15 text-amber-400";
  if (v === "completed" || v === "ready" || v === "submitted") return "bg-emerald-500/15 text-emerald-400";
  if (v === "cancelled" || v === "failed") return "bg-rose-500/15 text-rose-400";
  return "bg-slate-500/15 text-slate-300";
}

export function QueueSystemMain({ companyId }: QueueSystemMainProps) {
  const [activeTab, setActiveTab] = useState<QueueTabId>("checkin");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [inspections, setInspections] = useState<InspectionRow[]>([]);
  const [jobCards, setJobCards] = useState<JobCardRow[]>([]);
  const [qcRows, setQcRows] = useState<QcRow[]>([]);
  const [gatepasses, setGatepasses] = useState<GatepassRow[]>([]);
  const [actionBusy, setActionBusy] = useState<Record<string, boolean>>({});
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [checkinModal, setCheckinModal] = useState<{
    leadId: string;
    bookingId?: string | null;
    customerName?: string | null;
    carPlateNumber?: string | null;
  } | null>(null);
  const [checkinForm, setCheckinForm] = useState({
    photoFront: "",
    photoLeft: "",
    photoRight: "",
    photoRear: "",
    clusterImage: "",
    video360: "",
  });
  const [additionalCheckinImages, setAdditionalCheckinImages] = useState<AdditionalCheckinImage[]>([]);
  const [checkinError, setCheckinError] = useState<string | null>(null);
  const [checkinSaving, setCheckinSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [leadsRes, bookingsRes, inspectionsRes, jobCardsRes, qcRes, gatepassRes] = await Promise.all([
        fetch(`/api/company/${companyId}/sales/leads`, { cache: "no-store" }),
        fetch(`/api/company/${companyId}/sales/leads/bookings`, { cache: "no-store" }),
        fetch(`/api/company/${companyId}/workshop/inspections`, { cache: "no-store" }),
        fetch(`/api/company/${companyId}/workshop/job-cards`, { cache: "no-store" }),
        fetch(`/api/company/${companyId}/workshop/qc`, { cache: "no-store" }),
        fetch(`/api/company/${companyId}/workshop/gatepass`, { cache: "no-store" }),
      ]);

      const parse = async (res: Response) => {
        const json: ApiListResponse<unknown> = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(String(json?.error ?? `HTTP ${res.status}`));
        return Array.isArray(json?.data) ? json.data : [];
      };

      const [leadsData, bookingsData, inspectionsData, jobCardsData, qcData, gatepassData] = await Promise.all([
        parse(leadsRes),
        parse(bookingsRes),
        parse(inspectionsRes),
        parse(jobCardsRes),
        parse(qcRes),
        parse(gatepassRes),
      ]);

      setLeads(leadsData);
      setBookings(bookingsData);
      setInspections(inspectionsData);
      setJobCards(jobCardsData);
      setQcRows(qcData);
      setGatepasses(gatepassData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load queue data.");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const inspectionByLead = useMemo(() => {
    const map: Record<string, InspectionRow> = {};
    inspections.forEach((row) => {
      const leadId = String(row?.leadId ?? "");
      if (!leadId || map[leadId]) return;
      map[leadId] = row;
    });
    return map;
  }, [inspections]);

  const leadById = useMemo(() => {
    const map: Record<string, LeadRow> = {};
    leads.forEach((lead) => {
      if (!lead?.id) return;
      map[lead.id] = lead;
    });
    return map;
  }, [leads]);

  const bookingByLead = useMemo(() => {
    const map: Record<string, BookingRow> = {};
    bookings.forEach((row) => {
      if (!row?.leadId || map[row.leadId]) return;
      map[row.leadId] = row;
    });
    return map;
  }, [bookings]);

  const checkInQueue = useMemo(() => {
    const workshopWalkinBookings = bookings.filter(
      (row) => {
        const lead = leadById[row.leadId];
        const alreadyCheckedIn = String(lead?.leadStatus ?? "").toLowerCase() === "car_in";
        return (
        row.bookingKind === "workshop_walkin" &&
        row.status === "active" &&
        row.preServiceFormStatus === "submitted" &&
          !alreadyCheckedIn
        );
      }
    );
    const bookedLeadIds = new Set(workshopWalkinBookings.map((row) => row.leadId));
    const walkinLeads = leads.filter((lead) => {
      const isWorkshopWalkin =
        String(lead.leadType ?? "").toLowerCase() === "workshop" &&
        String(lead.workshopVisitMode ?? "").toLowerCase() === "walkin";
      const alreadyCheckedIn = String(lead.leadStatus ?? "").toLowerCase() === "car_in";
      const formSubmitted =
        Boolean(lead.preInspectionSubmitted) || String(lead.preInspectionStatus ?? "").toLowerCase() === "submitted";
      return isWorkshopWalkin && formSubmitted && !alreadyCheckedIn && !bookedLeadIds.has(lead.id);
    });
    return { workshopWalkinBookings, walkinLeads };
  }, [bookings, leads, leadById]);

  const inspectionQueue = useMemo(() => {
    return leads.filter((lead) => {
      const isCheckedIn = String(lead.leadStatus ?? "").toLowerCase() === "car_in";
      if (!isCheckedIn) return false;
      const stage = String(lead.leadStage ?? "").toLowerCase();
      const isInspectionPendingStage = stage === "checkin" || stage === "inspection_queue" || !stage;
      if (!isInspectionPendingStage) return false;
      const insp = inspectionByLead[lead.id];
      if (!insp) return true;
      const status = String(insp.status ?? "").toLowerCase();
      return status === "pending";
    });
  }, [leads, inspectionByLead]);

  const workQueue = useMemo(() => {
    return jobCards.filter((row) => {
      const status = String(row.status ?? "").toLowerCase();
      const isPendingStatus = status === "pending" || status === "re-assigned" || status === "";
      if (!isPendingStatus) return false;
      const notStarted = !row.start_at;
      return notStarted;
    });
  }, [jobCards]);

  const qualityQueue = useMemo(() => {
    return jobCards.filter((row) => Boolean(row.complete_at) && !row.final_inspection_at);
  }, [jobCards]);

  const carWashQueue = useMemo(() => {
    return jobCards.filter(
      (row) => Boolean(row.final_inspection_at) && row.final_inspection_car_wash !== true
    );
  }, [jobCards]);

  const deliveryQueue = useMemo(() => {
    return gatepasses.filter((row) => row.status === "pending");
  }, [gatepasses]);

  function openCheckinModal(args: {
    leadId: string;
    bookingId?: string | null;
    customerName?: string | null;
    carPlateNumber?: string | null;
  }) {
    setActionMessage(null);
    setCheckinError(null);
    setCheckinForm({
      photoFront: "",
      photoLeft: "",
      photoRight: "",
      photoRear: "",
      clusterImage: "",
      video360: "",
    });
    setAdditionalCheckinImages([]);
    setCheckinModal(args);
  }

  function closeCheckinModal() {
    if (checkinSaving) return;
    setCheckinModal(null);
    setCheckinError(null);
  }

  async function viewFormByBooking(bookingId: string, fallbackToken?: string | null) {
    const busyKey = `view:${bookingId}`;
    setActionMessage(null);
    setActionBusy((prev) => ({ ...prev, [busyKey]: true }));
    try {
      const res = await fetch(`/api/company/${companyId}/sales/leads/bookings/${bookingId}/pre-service-form`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(json?.error ?? "Failed to load pre-service form URL"));
      const formUrl = String(json?.data?.formUrl ?? "").trim();
      if (formUrl) {
        const absolute = formUrl.startsWith("http") ? formUrl : `${window.location.origin}${formUrl}`;
        window.open(absolute, "_blank", "noopener,noreferrer");
        return;
      }
      if (fallbackToken) {
        window.open(`/pre-inspection/${encodeURIComponent(String(fallbackToken))}`, "_blank", "noopener,noreferrer");
        return;
      }
      throw new Error("Pre-service form URL not found.");
    } catch (err: unknown) {
      setActionMessage(err instanceof Error ? err.message : "Failed to open form.");
    } finally {
      setActionBusy((prev) => ({ ...prev, [busyKey]: false }));
    }
  }

  async function submitCheckin() {
    if (!checkinModal) return;
    setCheckinError(null);
    const missing = Object.entries(checkinForm).find(([, v]) => !String(v ?? "").trim());
    if (missing) {
      setCheckinError("Upload all required images and video before check-in.");
      return;
    }

    const normalizedAdditionalImages = additionalCheckinImages
      .map((item) => ({
        id: item.id,
        fileId: String(item.fileId ?? "").trim(),
        remark: String(item.remark ?? "").trim(),
      }))
      .filter((item) => item.fileId);

    setCheckinSaving(true);
    try {
      const leadRes = await fetch(`/api/company/${companyId}/sales/leads/${checkinModal.leadId}`, {
        cache: "no-store",
      });
      const leadJson = await leadRes.json().catch(() => ({}));
      if (!leadRes.ok) throw new Error(String(leadJson?.error ?? "Failed to load lead details."));
      const leadData = leadJson?.data ?? {};
      const existingWorkflowRequired =
        leadData?.workflowRequired && typeof leadData.workflowRequired === "object"
          ? leadData.workflowRequired
          : {};

      const workflowRequired = {
        ...existingWorkflowRequired,
        checkinPhotoFront: checkinForm.photoFront,
        checkinPhotoLeft: checkinForm.photoLeft,
        checkinPhotoRight: checkinForm.photoRight,
        checkinPhotoRear: checkinForm.photoRear,
        checkinClusterImage: checkinForm.clusterImage,
        checkinVideo360: checkinForm.video360,
        checkinAdditionalImages: normalizedAdditionalImages,
        checkinMediaSubmittedAt: new Date().toISOString(),
      };

      const salesRes = await fetch(`/api/company/${companyId}/sales/leads/${checkinModal.leadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "car_in",
          leadStage: "checkin",
          workflowRequired,
        }),
      });
      const salesJson = await salesRes.json().catch(() => ({}));
      if (!salesRes.ok) throw new Error(String(salesJson?.error ?? "Failed to save check-in media."));

      const crmRes = await fetch(`/api/company/${companyId}/crm/leads/${checkinModal.leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadStatus: "car_in",
          leadStage: "checkin",
          checkinAt: new Date().toISOString(),
          carInVideo: checkinForm.video360,
        }),
      });
      const crmJson = await crmRes.json().catch(() => ({}));
      if (!crmRes.ok) throw new Error(String(crmJson?.error ?? "Failed to check in lead."));

      setCheckinModal(null);
      setActionMessage("Check-in completed successfully.");
      await load();
    } catch (err: unknown) {
      setCheckinError(err instanceof Error ? err.message : "Failed to complete check-in.");
    } finally {
      setCheckinSaving(false);
    }
  }

  function addAdditionalCheckinImage() {
    const item: AdditionalCheckinImage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fileId: "",
      remark: "",
    };
    setAdditionalCheckinImages((prev) => [...prev, item]);
  }

  function removeAdditionalCheckinImage(id: string) {
    setAdditionalCheckinImages((prev) => prev.filter((item) => item.id !== id));
  }

  function updateAdditionalCheckinImage(id: string, patch: Partial<AdditionalCheckinImage>) {
    setAdditionalCheckinImages((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  return (
    <MainPageShell
      title="Queue System"
      subtitle="Operational queues from check-in to delivery/gatepass."
      scopeLabel="Company workspace"
      contentClassName="p-0 bg-transparent"
    >
      <div className="space-y-3">
        {actionMessage ? <div className="text-sm text-muted-foreground">{actionMessage}</div> : null}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Card className="p-3"><div className="text-[11px] text-muted-foreground">Check In</div><div className="text-xl font-semibold">{checkInQueue.workshopWalkinBookings.length + checkInQueue.walkinLeads.length}</div></Card>
          <Card className="p-3"><div className="text-[11px] text-muted-foreground">Inspection</div><div className="text-xl font-semibold">{inspectionQueue.length}</div></Card>
          <Card className="p-3"><div className="text-[11px] text-muted-foreground">Work</div><div className="text-xl font-semibold">{workQueue.length}</div></Card>
          <Card className="p-3"><div className="text-[11px] text-muted-foreground">Quality</div><div className="text-xl font-semibold">{qualityQueue.length}</div></Card>
          <Card className="p-3"><div className="text-[11px] text-muted-foreground">Car Wash</div><div className="text-xl font-semibold">{carWashQueue.length}</div></Card>
          <Card className="p-3"><div className="text-[11px] text-muted-foreground">Delivery</div><div className="text-xl font-semibold">{deliveryQueue.length}</div></Card>
        </div>

        <Card className="border-0 p-0 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/30 px-4 py-3">
            <div className="flex flex-wrap gap-2">
              {TABS.map((tab) => {
                const active = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={[
                      "rounded-full border px-3 py-1 text-xs font-medium",
                      active ? "bg-primary text-primary-foreground" : "bg-background text-foreground",
                    ].join(" ")}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
            >
              Refresh
            </button>
          </div>
          <div className="px-4 py-2 text-xs text-muted-foreground">
            {TABS.find((tab) => tab.id === activeTab)?.description}
          </div>
          {loading ? <div className="px-4 py-6 text-sm text-muted-foreground">Loading queue...</div> : null}
          {error ? <div className="px-4 py-6 text-sm text-destructive">{error}</div> : null}
          {!loading && !error && (
            <div className="overflow-x-auto">
              {activeTab === "checkin" && (
                <table className="min-w-full text-sm border-separate border-spacing-0">
                  <thead>
                    <tr className="text-left bg-muted/20">
                      <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Lead</th>
                      <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Source</th>
                      <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Customer</th>
                      <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Vehicle</th>
                      <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Schedule</th>
                      <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Pre-Inspection</th>
                      <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checkInQueue.workshopWalkinBookings.length === 0 && checkInQueue.walkinLeads.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-6 text-xs text-muted-foreground">No records in check-in queue.</td></tr>
                    ) : (
                      <>
                        {checkInQueue.workshopWalkinBookings.map((row) => (
                          <tr key={row.id} className="hover:bg-muted/20">
                            <td className="px-4 py-3 border-b border-border/30">
                              <a href={`/company/${companyId}/leads/${row.leadId}`} className="font-mono text-xs text-primary hover:underline">
                                {row.leadId.slice(0, 8)}
                              </a>
                            </td>
                            <td className="px-4 py-3 border-b border-border/30 text-xs">{titleCase(row.bookingKind)}</td>
                            <td className="px-4 py-3 border-b border-border/30">
                              <div>{row.customerName ?? "-"}</div>
                              <div className="text-xs text-muted-foreground">{row.customerPhone ?? "-"}</div>
                            </td>
                            <td className="px-4 py-3 border-b border-border/30">
                              <div>{row.carPlateNumber ?? "-"}</div>
                              <div className="text-xs text-muted-foreground">{[row.carMake, row.carModel].filter(Boolean).join(" ") || "-"}</div>
                            </td>
                            <td className="px-4 py-3 border-b border-border/30 text-xs">{fmtDate(row.scheduledAt ?? row.createdAt)}</td>
                            <td className="px-4 py-3 border-b border-border/30">
                              <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold uppercase ${badgeClass(row.preServiceFormStatus)}`}>
                                {row.preServiceFormStatus ?? "pending"}
                              </span>
                            </td>
                            <td className="px-4 py-3 border-b border-border/30">
                              <div className="flex flex-wrap gap-1">
                                <button
                                  type="button"
                                  onClick={() => void viewFormByBooking(row.id, row.preServiceFormToken)}
                                  disabled={Boolean(actionBusy[`view:${row.id}`])}
                                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                                >
                                  {actionBusy[`view:${row.id}`] ? "Opening..." : "View Form"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    openCheckinModal({
                                      leadId: row.leadId,
                                      bookingId: row.id,
                                      customerName: row.customerName,
                                      carPlateNumber: row.carPlateNumber,
                                    })
                                  }
                                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50"
                                >
                                  Check In
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {checkInQueue.walkinLeads.map((lead) => (
                          <tr key={lead.id} className="hover:bg-muted/20">
                            <td className="px-4 py-3 border-b border-border/30">
                              <a href={`/company/${companyId}/leads/${lead.id}`} className="font-mono text-xs text-primary hover:underline">
                                {lead.id.slice(0, 8)}
                              </a>
                            </td>
                            <td className="px-4 py-3 border-b border-border/30 text-xs">Walk-in Lead</td>
                            <td className="px-4 py-3 border-b border-border/30">
                              <div>{lead.customerName ?? "-"}</div>
                              <div className="text-xs text-muted-foreground">{lead.customerPhone ?? "-"}</div>
                            </td>
                            <td className="px-4 py-3 border-b border-border/30">
                              <div>{lead.carPlateNumber ?? "-"}</div>
                              <div className="text-xs text-muted-foreground">{lead.carModel ?? "-"}</div>
                            </td>
                            <td className="px-4 py-3 border-b border-border/30 text-xs">{fmtDate(lead.createdAt)}</td>
                            <td className="px-4 py-3 border-b border-border/30">
                              <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold uppercase ${badgeClass(lead.preInspectionStatus)}`}>
                                {lead.preInspectionStatus ?? "pending"}
                              </span>
                            </td>
                            <td className="px-4 py-3 border-b border-border/30">
                              <div className="flex flex-wrap gap-1">
                                {bookingByLead[lead.id]?.id ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void viewFormByBooking(
                                        String(bookingByLead[lead.id].id),
                                        bookingByLead[lead.id].preServiceFormToken
                                      )
                                    }
                                    disabled={Boolean(actionBusy[`view:${String(bookingByLead[lead.id].id)}`])}
                                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                                  >
                                    {actionBusy[`view:${String(bookingByLead[lead.id].id)}`] ? "Opening..." : "View Form"}
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground">No form link</span>
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    openCheckinModal({
                                      leadId: lead.id,
                                      bookingId: bookingByLead[lead.id]?.id ?? null,
                                      customerName: lead.customerName,
                                      carPlateNumber: lead.carPlateNumber,
                                    })
                                  }
                                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50"
                                >
                                  Check In
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </>
                    )}
                  </tbody>
                </table>
              )}

              {activeTab === "inspection" && (
                <table className="min-w-full text-sm border-separate border-spacing-0">
                  <thead>
                    <tr className="text-left bg-muted/20">
                      <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Lead</th>
                      <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Customer</th>
                      <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Vehicle</th>
                      <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Check-in At</th>
                      <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Inspection</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inspectionQueue.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-6 text-xs text-muted-foreground">No leads waiting for inspection.</td></tr>
                    ) : (
                      inspectionQueue.map((lead) => {
                        const insp = inspectionByLead[lead.id];
                        return (
                          <tr key={lead.id} className="hover:bg-muted/20">
                            <td className="px-4 py-3 border-b border-border/30">
                              <a href={`/company/${companyId}/leads/${lead.id}`} className="font-mono text-xs text-primary hover:underline">
                                {lead.id.slice(0, 8)}
                              </a>
                            </td>
                            <td className="px-4 py-3 border-b border-border/30">
                              <div>{lead.customerName ?? "-"}</div>
                              <div className="text-xs text-muted-foreground">{lead.customerPhone ?? "-"}</div>
                            </td>
                            <td className="px-4 py-3 border-b border-border/30">
                              <div>{lead.carPlateNumber ?? "-"}</div>
                              <div className="text-xs text-muted-foreground">{lead.carModel ?? "-"}</div>
                            </td>
                            <td className="px-4 py-3 border-b border-border/30 text-xs">{fmtDate(lead.checkinAt ?? lead.createdAt)}</td>
                            <td className="px-4 py-3 border-b border-border/30">
                              {insp ? (
                                <a href={`/company/${companyId}/workshop/inspections/${insp.id}`} className="inline-flex rounded-md border px-2 py-1 text-[11px] hover:bg-muted/30">
                                  Open Inspection
                                </a>
                              ) : (
                                <span className="text-xs text-muted-foreground">Pending create</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}

              {activeTab === "work" && (
                <table className="min-w-full text-sm border-separate border-spacing-0">
                  <thead>
                    <tr className="text-left bg-muted/20">
                      <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Job Card</th>
                      <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Customer</th>
                      <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Car</th>
                      <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Assigned</th>
                      <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Started</th>
                      <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workQueue.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-6 text-xs text-muted-foreground">No job cards in work queue.</td></tr>
                    ) : (
                      workQueue.map((row) => (
                        <tr key={row.id} className="hover:bg-muted/20">
                          <td className="px-4 py-3 border-b border-border/30">
                            <a href={`/company/${companyId}/workshop/job-cards/${row.id}`} className="font-mono text-xs text-primary hover:underline">
                              {row.id.slice(0, 8)}
                            </a>
                          </td>
                          <td className="px-4 py-3 border-b border-border/30">
                            <div>{row.customer_name ?? "-"}</div>
                            <div className="text-xs text-muted-foreground">{row.customer_phone ?? "-"}</div>
                          </td>
                          <td className="px-4 py-3 border-b border-border/30">
                            <div>{row.plate_number ?? "-"}</div>
                            <div className="text-xs text-muted-foreground">{[row.make, row.model].filter(Boolean).join(" ") || "-"}</div>
                          </td>
                          <td className="px-4 py-3 border-b border-border/30 text-xs">{row.done_by ? "Assigned" : "Unassigned"}</td>
                          <td className="px-4 py-3 border-b border-border/30 text-xs">{row.start_at ? fmtDate(row.start_at) : "Not started"}</td>
                          <td className="px-4 py-3 border-b border-border/30">
                            <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold uppercase ${badgeClass(row.status)}`}>
                              {row.status ?? "pending"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {activeTab === "quality" && (
                <table className="min-w-full text-sm border-separate border-spacing-0">
                  <thead>
                    <tr className="text-left bg-muted/20">
                      <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Job Card</th>
                      <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Customer</th>
                      <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Completed At</th>
                      <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qualityQueue.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-6 text-xs text-muted-foreground">No job cards waiting final inspection.</td></tr>
                    ) : (
                      qualityQueue.map((row) => (
                        <tr key={row.id} className="hover:bg-muted/20">
                          <td className="px-4 py-3 border-b border-border/30 font-mono text-xs">{row.id.slice(0, 8)}</td>
                          <td className="px-4 py-3 border-b border-border/30">{row.customer_name ?? "-"}</td>
                          <td className="px-4 py-3 border-b border-border/30 text-xs">{fmtDate(row.complete_at)}</td>
                          <td className="px-4 py-3 border-b border-border/30">
                            <a href={`/company/${companyId}/workshop/job-cards/${row.id}`} className="inline-flex rounded-md border px-2 py-1 text-[11px] hover:bg-muted/30">
                              Open Job Card
                            </a>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {activeTab === "wash" && (
                <table className="min-w-full text-sm border-separate border-spacing-0">
                  <thead>
                    <tr className="text-left bg-muted/20">
                      <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Job Card</th>
                      <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Customer</th>
                      <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Final Inspection At</th>
                      <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Wash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {carWashQueue.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-6 text-xs text-muted-foreground">No cars waiting for wash.</td></tr>
                    ) : (
                      carWashQueue.map((row) => (
                        <tr key={row.id} className="hover:bg-muted/20">
                          <td className="px-4 py-3 border-b border-border/30 font-mono text-xs">{row.id.slice(0, 8)}</td>
                          <td className="px-4 py-3 border-b border-border/30">{row.customer_name ?? "-"}</td>
                          <td className="px-4 py-3 border-b border-border/30 text-xs">{fmtDate(row.final_inspection_at)}</td>
                          <td className="px-4 py-3 border-b border-border/30">
                            <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold uppercase ${badgeClass(row.final_inspection_car_wash ? "completed" : "pending")}`}>
                              {row.final_inspection_car_wash ? "Done" : "Pending"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {activeTab === "delivery" && (
                <table className="min-w-full text-sm border-separate border-spacing-0">
                  <thead>
                    <tr className="text-left bg-muted/20">
                      <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Gatepass</th>
                      <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Invoice</th>
                      <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Handover</th>
                      <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Status</th>
                      <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Amount Due</th>
                      <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Payment OK</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveryQueue.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-6 text-xs text-muted-foreground">No records waiting for delivery/gatepass.</td></tr>
                    ) : (
                      deliveryQueue.map((row) => (
                        <tr key={row.id} className="hover:bg-muted/20">
                          <td className="px-4 py-3 border-b border-border/30">
                            <a href={`/company/${companyId}/workshop/gatepass/${row.id}`} className="font-mono text-xs text-primary hover:underline">
                              {row.id.slice(0, 8)}
                            </a>
                          </td>
                          <td className="px-4 py-3 border-b border-border/30 font-mono text-xs">{row.invoiceId.slice(0, 8)}</td>
                          <td className="px-4 py-3 border-b border-border/30 text-xs">{titleCase(row.handoverType)}</td>
                          <td className="px-4 py-3 border-b border-border/30">
                            <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold uppercase ${badgeClass(row.status)}`}>
                              {row.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 border-b border-border/30 text-xs">{Number(row.amountDue ?? 0).toFixed(2)}</td>
                          <td className="px-4 py-3 border-b border-border/30 text-xs">{row.paymentOk ? "Yes" : "No"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </Card>

        {!loading && !error && qcRows.length > 0 && activeTab === "wash" && (
          <div className="text-xs text-muted-foreground px-1">
            QC records loaded: {qcRows.length}. Car wash queue currently follows final inspection flags from job cards.
          </div>
        )}
      </div>
      {checkinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-3xl rounded-xl shadow-xl">
            <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
              <div className="text-sm font-semibold">Check In - Upload Media</div>
              <button
                type="button"
                onClick={closeCheckinModal}
                disabled={checkinSaving}
                className="rounded-md border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              >
                Close
              </button>
            </div>
            <div className="space-y-4 p-4">
              <div className="text-xs text-muted-foreground">
                Lead: <span className="font-mono">{checkinModal.leadId.slice(0, 8)}</span>
                {checkinModal.customerName ? ` | ${checkinModal.customerName}` : ""}
                {checkinModal.carPlateNumber ? ` | ${checkinModal.carPlateNumber}` : ""}
              </div>
              {checkinError ? <div className="text-sm text-destructive">{checkinError}</div> : null}
              <div className="grid gap-4 md:grid-cols-2">
                <FileUploader
                  label="Front Image"
                  kind="image"
                  value={checkinForm.photoFront}
                  onChange={(id) => setCheckinForm((prev) => ({ ...prev, photoFront: id ?? "" }))}
                  showPreview
                />
                <FileUploader
                  label="Left Image"
                  kind="image"
                  value={checkinForm.photoLeft}
                  onChange={(id) => setCheckinForm((prev) => ({ ...prev, photoLeft: id ?? "" }))}
                  showPreview
                />
                <FileUploader
                  label="Right Image"
                  kind="image"
                  value={checkinForm.photoRight}
                  onChange={(id) => setCheckinForm((prev) => ({ ...prev, photoRight: id ?? "" }))}
                  showPreview
                />
                <FileUploader
                  label="Rear Image"
                  kind="image"
                  value={checkinForm.photoRear}
                  onChange={(id) => setCheckinForm((prev) => ({ ...prev, photoRear: id ?? "" }))}
                  showPreview
                />
                <FileUploader
                  label="Cluster Image"
                  kind="image"
                  value={checkinForm.clusterImage}
                  onChange={(id) => setCheckinForm((prev) => ({ ...prev, clusterImage: id ?? "" }))}
                  showPreview
                />
                <FileUploader
                  label="360 Video"
                  kind="video"
                  value={checkinForm.video360}
                  onChange={(id) => setCheckinForm((prev) => ({ ...prev, video360: id ?? "" }))}
                  showPreview
                />
              </div>
              <div className="space-y-3 rounded-md border border-border/40 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Additional Images With Remarks
                  </div>
                  <button
                    type="button"
                    onClick={addAdditionalCheckinImage}
                    disabled={checkinSaving}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Add Image
                  </button>
                </div>
                {additionalCheckinImages.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No additional images added.</div>
                ) : (
                  <div className="space-y-3">
                    {additionalCheckinImages.map((item, idx) => (
                      <div key={item.id} className="rounded-md border border-border/40 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="text-xs font-medium">Image #{idx + 1}</div>
                          <button
                            type="button"
                            onClick={() => removeAdditionalCheckinImage(item.id)}
                            disabled={checkinSaving}
                            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <FileUploader
                            label="Additional Image"
                            kind="image"
                            value={item.fileId}
                            onChange={(id) =>
                              updateAdditionalCheckinImage(item.id, { fileId: id ?? "" })
                            }
                            showPreview
                          />
                          <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground">Remark</label>
                            <textarea
                              value={item.remark}
                              onChange={(e) =>
                                updateAdditionalCheckinImage(item.id, { remark: e.target.value })
                              }
                              placeholder="Add remark for this image"
                              className="min-h-[116px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeCheckinModal}
                  disabled={checkinSaving}
                  className="rounded-md border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void submitCheckin()}
                  disabled={checkinSaving}
                  className="rounded-md bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary-foreground disabled:opacity-50"
                >
                  {checkinSaving ? "Saving..." : "Submit Check In"}
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </MainPageShell>
  );
}
