"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { MainPageShell } from "./MainPageShell";
import { Card } from "../components/Card";

type LeadsBookingMainProps = {
  companyId: string;
};

type BookingRow = {
  id: string;
  leadId: string;
  bookingKind: "rsa" | "recovery" | "workshop_walkin" | "workshop_recovery";
  scheduledAt: string | null;
  pickupLocation: string | null;
  dropoffLocation: string | null;
  notes: string | null;
  priority: "low" | "medium" | "high";
  status: "active" | "completed" | "cancelled";
  createdAt: string | null;
  preServiceFormStatus: "pending" | "submitted" | null;
  preServiceFormSubmittedAt: string | null;
  preServiceFormToken: string | null;
  customerName: string | null;
  customerPhone: string | null;
  carPlateNumber: string | null;
  carMake: string | null;
  carModel: string | null;
};

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

function normalize(value: string | number | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function formatBookingKind(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export function LeadsBookingMain({ companyId }: LeadsBookingMainProps) {
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "completed" | "cancelled">("all");
  const [priority, setPriority] = useState<"all" | "low" | "medium" | "high">("all");
  const [bookingType, setBookingType] = useState<"all" | "rsa" | "recovery" | "workshop">("all");
  const [actionBusy, setActionBusy] = useState<Record<string, boolean>>({});
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      if (priority !== "all") params.set("priority", priority);
      if (bookingType !== "all") params.set("bookingType", bookingType);
      if (query.trim()) params.set("q", query.trim());
      const res = await fetch(`/api/company/${companyId}/sales/leads/bookings?${params.toString()}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(json?.error ?? "Failed to load lead bookings"));
      setRows(Array.isArray(json?.data) ? json.data : []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load lead bookings");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, status, priority, bookingType, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const base = { total: rows.length, active: 0, completed: 0, cancelled: 0, high: 0 };
    rows.forEach((r) => {
      if (r.status === "active") base.active += 1;
      if (r.status === "completed") base.completed += 1;
      if (r.status === "cancelled") base.cancelled += 1;
      if (r.priority === "high") base.high += 1;
    });
    return base;
  }, [rows]);

  const sortedRows = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      const left = new Date(a.createdAt ?? 0).getTime();
      const right = new Date(b.createdAt ?? 0).getTime();
      if (left !== right) return right - left;
      return collator.compare(normalize(a.id), normalize(b.id));
    });
    return list;
  }, [rows]);

  async function copyPreServiceFormUrl(bookingId: string) {
    setActionMessage(null);
    setActionBusy((prev) => ({ ...prev, [bookingId]: true }));
    try {
      const res = await fetch(`/api/company/${companyId}/sales/leads/bookings/${bookingId}/pre-service-form`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(json?.error ?? "Failed to load form URL"));
      const formUrl = String(json?.data?.formUrl ?? "").trim();
      if (!formUrl) throw new Error("Form URL not found");
      const absolute = formUrl.startsWith("http") ? formUrl : `${window.location.origin}${formUrl}`;
      await navigator.clipboard.writeText(absolute);
      setActionMessage("Pre-service form URL copied.");
    } catch (err: any) {
      setActionMessage(err?.message ?? "Failed to copy pre-service form URL.");
    } finally {
      setActionBusy((prev) => ({ ...prev, [bookingId]: false }));
    }
  }

  async function sharePreServiceForm(bookingId: string, channel: "sms" | "whatsapp" | "email") {
    setActionMessage(null);
    const busyKey = `${bookingId}:${channel}`;
    setActionBusy((prev) => ({ ...prev, [busyKey]: true }));
    try {
      const res = await fetch(`/api/company/${companyId}/sales/leads/bookings/${bookingId}/pre-service-form`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, reason: "direct", force: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(json?.error ?? "Failed to share pre-service form"));
      if (json?.data?.sent) {
        setActionMessage(`Pre-service form shared via ${channel}.`);
      } else {
        setActionMessage(`Share skipped: ${String(json?.data?.skippedReason ?? "unknown_reason")}`);
      }
    } catch (err: any) {
      setActionMessage(err?.message ?? `Failed to share via ${channel}.`);
    } finally {
      setActionBusy((prev) => ({ ...prev, [busyKey]: false }));
    }
  }

  async function viewPreServiceForm(bookingId: string) {
    setActionMessage(null);
    const busyKey = `${bookingId}:view`;
    setActionBusy((prev) => ({ ...prev, [busyKey]: true }));
    try {
      const res = await fetch(`/api/company/${companyId}/sales/leads/bookings/${bookingId}/pre-service-form`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(json?.error ?? "Failed to load form URL"));
      const formUrl = String(json?.data?.formUrl ?? "").trim();
      if (!formUrl) throw new Error("Form URL not found");
      const absolute = formUrl.startsWith("http") ? formUrl : `${window.location.origin}${formUrl}`;
      window.open(absolute, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      setActionMessage(err?.message ?? "Failed to open pre-service form.");
    } finally {
      setActionBusy((prev) => ({ ...prev, [busyKey]: false }));
    }
  }

  return (
    <MainPageShell
      title="Leads Booking"
      subtitle="Manage booked leads across RSA, Recovery, and Workshop scenarios."
      scopeLabel="Company workspace"
      contentClassName="p-0 bg-transparent"
    >
      <div className="space-y-3">
        {actionMessage ? <div className="text-sm text-muted-foreground">{actionMessage}</div> : null}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Card className="p-4"><div className="text-xs text-muted-foreground">Total</div><div className="text-2xl font-semibold">{stats.total}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Active</div><div className="text-2xl font-semibold">{stats.active}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Completed</div><div className="text-2xl font-semibold">{stats.completed}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Cancelled</div><div className="text-2xl font-semibold">{stats.cancelled}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">High Priority</div><div className="text-2xl font-semibold text-red-500">{stats.high}</div></Card>
        </div>

        <Card className="border-0 p-0 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b border-border/30 px-4 py-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search booking, customer, lead..."
              className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
            />
            <select
              value={status}
              onChange={(e) => setStatus((e.target.value as any) || "all")}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              value={priority}
              onChange={(e) => setPriority((e.target.value as any) || "all")}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="all">All Priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <select
              value={bookingType}
              onChange={(e) => setBookingType((e.target.value as any) || "all")}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="all">All Types</option>
              <option value="rsa">RSA</option>
              <option value="recovery">Recovery</option>
              <option value="workshop">Workshop</option>
            </select>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">Loading bookings...</div>
          ) : error ? (
            <div className="px-4 py-6 text-sm text-destructive">{error}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border-separate border-spacing-0">
                <thead>
                  <tr className="text-left bg-muted/20">
                    <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Booking</th>
                    <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Lead</th>
                    <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Type</th>
                    <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Customer</th>
                    <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Vehicle</th>
                    <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Schedule</th>
                    <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Locations</th>
                    <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Priority</th>
                    <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Status</th>
                    <th className="px-4 py-3 border-b border-border/30 text-xs font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-6 text-xs text-muted-foreground">No bookings found.</td>
                    </tr>
                  ) : (
                    sortedRows.map((row) => (
                      <tr key={row.id} className="hover:bg-muted/20">
                        <td className="px-4 py-3 border-b border-border/30">
                          <div className="font-mono text-xs">{row.id.slice(0, 8)}</div>
                          <div className="text-xs text-muted-foreground">{row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"}</div>
                        </td>
                        <td className="px-4 py-3 border-b border-border/30">
                          <a href={`/company/${companyId}/leads/${row.leadId}`} className="text-primary hover:underline font-mono text-xs">
                            {row.leadId.slice(0, 8)}
                          </a>
                        </td>
                        <td className="px-4 py-3 border-b border-border/30 text-xs">{formatBookingKind(row.bookingKind)}</td>
                        <td className="px-4 py-3 border-b border-border/30">
                          <div>{row.customerName || "-"}</div>
                          <div className="text-xs text-muted-foreground">{row.customerPhone || "-"}</div>
                        </td>
                        <td className="px-4 py-3 border-b border-border/30">
                          <div>{row.carPlateNumber || "-"}</div>
                          <div className="text-xs text-muted-foreground">{[row.carMake, row.carModel].filter(Boolean).join(" ") || "-"}</div>
                        </td>
                        <td className="px-4 py-3 border-b border-border/30 text-xs">{row.scheduledAt ? new Date(row.scheduledAt).toLocaleString() : "-"}</td>
                        <td className="px-4 py-3 border-b border-border/30 text-xs">
                          <div>Pickup: {row.pickupLocation || "-"}</div>
                          <div>Dropoff: {row.dropoffLocation || "-"}</div>
                        </td>
                        <td className="px-4 py-3 border-b border-border/30">
                          <span
                            className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase ${
                              row.priority === "high"
                                ? "bg-red-500/10 text-red-600"
                                : row.priority === "medium"
                                ? "bg-amber-500/10 text-amber-700"
                                : "bg-emerald-500/10 text-emerald-700"
                            }`}
                          >
                            {row.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3 border-b border-border/30 text-xs capitalize">{row.status}</td>
                        <td className="px-4 py-3 border-b border-border/30">
                          <div className="flex flex-wrap gap-1">
                            {row.preServiceFormStatus === "submitted" ? (
                              <button
                                type="button"
                                onClick={() => void viewPreServiceForm(row.id)}
                                disabled={Boolean(actionBusy[`${row.id}:view`])}
                                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                              >
                                {actionBusy[`${row.id}:view`] ? "Opening..." : "View Form"}
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void copyPreServiceFormUrl(row.id)}
                                  disabled={Boolean(actionBusy[row.id])}
                                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                                >
                                  {actionBusy[row.id] ? "Working..." : "Copy"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void sharePreServiceForm(row.id, "sms")}
                                  disabled={Boolean(actionBusy[`${row.id}:sms`])}
                                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                                >
                                  {actionBusy[`${row.id}:sms`] ? "..." : "SMS"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void sharePreServiceForm(row.id, "whatsapp")}
                                  disabled={Boolean(actionBusy[`${row.id}:whatsapp`])}
                                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                                >
                                  {actionBusy[`${row.id}:whatsapp`] ? "..." : "WhatsApp"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void sharePreServiceForm(row.id, "email")}
                                  disabled={Boolean(actionBusy[`${row.id}:email`])}
                                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                                >
                                  {actionBusy[`${row.id}:email`] ? "..." : "Email"}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </MainPageShell>
  );
}
