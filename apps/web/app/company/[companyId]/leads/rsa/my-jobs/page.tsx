"use client";

import { useCallback, useEffect, useState } from "react";
import { AppLayout, useTheme } from "@repo/ui";
import Link from "next/link";

type Lead = {
  id: string;
  companyId: string;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  carPlateNumber: string | null;
  carModel: string | null;
  carMake: string | null;
  leadType: string;
  leadStatus: string;
  leadStage: string;
  serviceType: string | null;
  assignedUserId: string | null;
  assignedUserName: string | null;
  pickupFrom: string | null;
  pickupGoogleLocation: string | null;
  source: string | null;
  createdAt: string;
  bookingId?: string;
  scheduledAt?: string;
  bookingPriority?: string;
  bookingKind?: string;
  pickupLocation?: string;
};

type Params = { params: { companyId: string } | Promise<{ companyId: string }> };

export default function RsaTechMyJobsPage({ params }: Params) {
  const { theme } = useTheme();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"pending" | "in_progress" | "completed" | "all">("pending");

  useEffect(() => {
    Promise.resolve(params).then((p: any) => setCompanyId(String(p?.companyId ?? "").trim()));
  }, [params]);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setUserId(d?.userId ?? d?.user?.id ?? null);
        setUserName(d?.user?.fullName ?? d?.user?.email ?? "Technician");
      })
      .catch(() => {});
  }, []);

  const fetchLeads = useCallback(async () => {
    if (!companyId || !userId) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ leadType: "rsa", assignedUserId: userId });
      const res = await fetch(`/api/company/${companyId}/sales/leads?${qs}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load leads");
      const json = await res.json();
      setLeads(json.data ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [companyId, userId]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const isCompleted = (l: Lead) => {
    const status = String(l.leadStatus ?? "").toLowerCase();
    const stage = String(l.leadStage ?? "").toLowerCase();
    return ["closed", "closed_won", "done", "completed", "lost"].includes(status) || ["completed", "closed"].includes(stage);
  };
  const isPending = (l: Lead) => {
    if (isCompleted(l)) return false;
    const status = String(l.leadStatus ?? "").toLowerCase();
    const stage = String(l.leadStage ?? "").toLowerCase();
    return ["open", "new", "pending"].includes(status) || ["new", "assigned", "pending_type_selection"].includes(stage);
  };
  const isInProgress = (l: Lead) => {
    if (isCompleted(l)) return false;
    const status = String(l.leadStatus ?? "").toLowerCase();
    const stage = String(l.leadStage ?? "").toLowerCase();
    return ["processing", "enroute", "accepted", "car_in"].includes(status) || ["enroute", "processing"].includes(stage);
  };

  const filtered = leads.filter((l) => {
    if (tab === "pending") return isPending(l);
    if (tab === "in_progress") return isInProgress(l);
    if (tab === "completed") return isCompleted(l);
    return true;
  });

  const pendingCount = leads.filter(isPending).length;
  const inProgressCount = leads.filter(isInProgress).length;
  const completedCount = leads.filter(isCompleted).length;

  const priorityColor = (p: string | undefined) => {
    if (p === "high") return "bg-red-500/15 text-red-400 border-red-500/25";
    if (p === "medium") return "bg-amber-500/15 text-amber-400 border-amber-500/25";
    return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
  };

  const stageColor = (stage: string) => {
    const s = stage.toLowerCase();
    if (["new", "assigned", "pending_type_selection"].includes(s)) return "text-sky-400";
    if (["enroute"].includes(s)) return "text-amber-400";
    if (["processing"].includes(s)) return "text-purple-400";
    if (["completed", "closed"].includes(s)) return "text-emerald-400";
    return "text-muted-foreground";
  };

  const stageIcon = (stage: string) => {
    const s = stage.toLowerCase();
    if (["new", "assigned", "pending_type_selection"].includes(s)) return "🆕";
    if (["enroute"].includes(s)) return "🚗";
    if (["processing"].includes(s)) return "🔧";
    if (["completed", "closed"].includes(s)) return "✅";
    return "📋";
  };

  const timeSince = (date: string) => {
    const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <AppLayout>
      <div className="min-h-screen space-y-3 px-3 py-4 sm:px-6 sm:space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">My RSA Jobs</h1>
            <p className="text-xs text-muted-foreground sm:text-sm">{userName}</p>
          </div>
          <button
            onClick={() => fetchLeads()}
            disabled={loading}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card/40 text-muted-foreground active:bg-muted disabled:opacity-50 sm:h-auto sm:w-auto sm:rounded-full sm:px-4 sm:py-2"
          >
            <svg className="h-5 w-5 sm:hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
            </svg>
            <span className="hidden text-sm sm:inline">{loading ? "Loading..." : "Refresh"}</span>
          </button>
        </div>

        {/* KPI + Tabs combined */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {([
            { key: "pending" as const, value: pendingCount, label: "Pending", icon: "🆕", border: "border-sky-500/30", text: "text-sky-400", bg: "bg-sky-500/10", activeBg: "bg-sky-500/15" },
            { key: "in_progress" as const, value: inProgressCount, label: "In Progress", icon: "🚗", border: "border-amber-500/30", text: "text-amber-400", bg: "bg-amber-500/10", activeBg: "bg-amber-500/15" },
            { key: "completed" as const, value: completedCount, label: "Completed", icon: "✅", border: "border-emerald-500/30", text: "text-emerald-400", bg: "bg-emerald-500/10", activeBg: "bg-emerald-500/15" },
            { key: "all" as const, value: leads.length, label: "All Jobs", icon: "📋", border: "border-border", text: "text-foreground", bg: "bg-card/50", activeBg: "bg-card/60" },
          ]).map((kpi) => {
            const isActive = tab === kpi.key;
            return (
              <button
                key={kpi.key}
                onClick={() => setTab(kpi.key)}
                className={`relative flex items-center gap-3 rounded-2xl border px-4 py-4 text-left transition active:scale-[0.97] ${
                  isActive
                    ? `${kpi.border} ${kpi.activeBg} shadow-lg`
                    : "border-border/60 bg-card/30 opacity-50"
                }`}
              >
                <span className="text-2xl">{kpi.icon}</span>
                <div className="flex flex-col">
                  <span className={`text-2xl font-extrabold leading-none ${kpi.text}`}>{kpi.value}</span>
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${isActive ? `${kpi.text} opacity-80` : "text-muted-foreground"}`}>{kpi.label}</span>
                </div>
                {isActive && <span className={`absolute right-3 top-3 h-2 w-2 rounded-full ${kpi.text.replace("text-", "bg-")}`} />}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading your RSA jobs...</div>
        ) : error ? (
          <div className="py-12 text-center text-sm text-red-400">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-4xl mb-2">📋</div>
            <div className="text-sm text-muted-foreground">No {tab === "all" ? "" : tab.replace("_", " ")} jobs</div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((lead) => (
              <div
                key={lead.id}
                className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card/30 p-4 transition active:bg-card/50 sm:rounded-xl"
              >
                {/* Row 1: Customer + Priority + Time */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-foreground truncate sm:text-sm">
                        {lead.customerName ?? "Unknown"}
                      </span>
                      <span className="text-[10px] text-muted-foreground/30 shrink-0">{timeSince(lead.createdAt)}</span>
                    </div>
                    {lead.customerPhone && (
                      <div className="text-sm text-muted-foreground font-mono sm:text-xs">{lead.customerPhone}</div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {(lead as any).bookingPriority && (
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${priorityColor((lead as any).bookingPriority)}`}>
                        {(lead as any).bookingPriority}
                      </span>
                    )}
                  </div>
                </div>

                {/* Row 2: Service + Stage */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded-lg bg-blue-500/15 px-2.5 py-1 text-xs font-semibold text-blue-400 border border-blue-500/20">
                    {(lead.serviceType ?? "RSA").replace(/_/g, " ")}
                  </span>
                  <span className={`flex items-center gap-1 text-xs font-medium capitalize ${stageColor(lead.leadStage)}`}>
                    <span>{stageIcon(lead.leadStage)}</span>
                    {lead.leadStage.replace(/_/g, " ")}
                  </span>
                  {(lead as any).bookingId && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Booked
                    </span>
                  )}
                </div>

                {/* Row 3: Car */}
                {lead.carPlateNumber && (
                  <div className="text-xs text-muted-foreground">
                    🚘 {lead.carPlateNumber} {lead.carModel ? `· ${lead.carModel}` : ""}
                  </div>
                )}

                {/* Row 4: Pickup Location */}
                {lead.pickupFrom && (
                  <div className="flex items-center gap-1.5 rounded-lg bg-card/40 px-3 py-2 text-sm text-muted-foreground sm:text-xs">
                    <svg className="h-4 w-4 shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <span className="truncate flex-1">{lead.pickupFrom}</span>
                  </div>
                )}

                {/* Row 5: Action buttons — big touch targets */}
                <div className="flex gap-2 pt-1">
                  {/* Call customer */}
                  {lead.customerPhone && (
                    <a
                      href={`tel:${lead.customerPhone}`}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 py-3 text-sm font-semibold text-emerald-400 active:bg-emerald-500/20 sm:py-2"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                      </svg>
                      Call
                    </a>
                  )}

                  {/* Navigate (Google Maps) */}
                  {lead.pickupGoogleLocation && (
                    <a
                      href={lead.pickupGoogleLocation}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-sky-500/25 bg-sky-500/10 py-3 text-sm font-semibold text-sky-400 active:bg-sky-500/20 sm:py-2"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="3 11 22 2 13 21 11 13 3 11" />
                      </svg>
                      Navigate
                    </a>
                  )}

                  {/* View details */}
                  <Link
                    href={`/company/${companyId}/leads/${lead.id}`}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card/40 py-3 text-sm font-semibold text-foreground/70 active:bg-muted sm:py-2"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
