"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { AIPanel } from "../../../../(components)/intelligence/AIPanel";

interface Agent { id: string; fullName: string; email: string; }
interface Lead { id: string; customer_name: string; customer_phone: string; lead_status: string; lead_type: string; source: string; created_at: string; checkinAt?: string | null; carPlateNumber?: string | null; carModel?: string | null; branchName?: string | null; serviceType?: string | null; leadStage?: string | null; workflow?: any; }
interface Customer { id: string; name: string; phone: string; email: string; segment: string; assigned_at: string; }
interface Call { id: string; direction: string; from_number: string; to_number: string; status: string; duration_seconds: number | null; created_at: string; customer_name: string | null; }
interface PendingOffer { queueId: string; leadId: string; queueStatus: string; tier: number; offeredAt: string; lockedUntil: string | null; pipelineValue: number; customerName: string | null; customerPhone: string | null; carPlate: string | null; carModel: string | null; leadType: string; serviceType: string | null; leadStage: string | null; branchName: string | null; }

function formatDuration(s: number | null) {
  if (!s) return "—";
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

const STATUS_STYLES: Record<string, string> = {
  open: "bg-sky-500/15 text-sky-400", assigned: "bg-indigo-500/15 text-indigo-400",
  accepted: "bg-indigo-500/15 text-indigo-400", onboarding: "bg-amber-500/15 text-amber-400",
  inprocess: "bg-orange-500/15 text-orange-400", car_in: "bg-cyan-500/15 text-cyan-400",
  completed: "bg-emerald-500/15 text-emerald-400", closed_won: "bg-emerald-500/15 text-emerald-400",
  closed: "bg-slate-500/15 text-slate-400", lost: "bg-rose-500/15 text-rose-400",
};

const WORKFLOW_COLORS: Record<string, string> = {
  completed: "bg-emerald-500/15 text-emerald-400", done: "bg-emerald-500/15 text-emerald-400",
  Completed: "bg-emerald-500/15 text-emerald-400", passed: "bg-emerald-500/15 text-emerald-400",
  approved: "bg-emerald-500/15 text-emerald-400", paid: "bg-emerald-500/15 text-emerald-400",
  released: "bg-emerald-500/15 text-emerald-400", submitted: "bg-emerald-500/15 text-emerald-400",
  invoiced: "bg-blue-500/15 text-blue-400", issued: "bg-blue-500/15 text-blue-400",
  ready: "bg-blue-500/15 text-blue-400",
  Started: "bg-amber-500/15 text-amber-400", in_process: "bg-amber-500/15 text-amber-400",
  pending: "bg-slate-500/15 text-slate-400", Pending: "bg-slate-500/15 text-slate-400",
  draft: "bg-slate-500/15 text-slate-400", queue: "bg-slate-500/15 text-slate-400",
  pending_approval: "bg-amber-500/15 text-amber-400",
  failed: "bg-red-500/15 text-red-400", rejected: "bg-red-500/15 text-red-400",
  cancelled: "bg-red-500/15 text-red-400", Cancelled: "bg-red-500/15 text-red-400",
};

function WorkflowBadge({ status, labels }: { status?: string | null; labels: Record<string, string> }) {
  if (!status) return <span className="text-[10px] text-slate-600">—</span>;
  const label = labels[status] ?? status;
  const color = WORKFLOW_COLORS[status] ?? "bg-slate-500/15 text-slate-400";
  return <span className={`px-2 py-0.5 rounded text-[9px] font-bold whitespace-nowrap ${color}`}>{label}</span>;
}

function useCountdown(targetIso: string | null) {
  const [remaining, setRemaining] = useState<number>(0);
  useEffect(() => {
    if (!targetIso) { setRemaining(0); return; }
    const calc = () => Math.max(0, Math.floor((new Date(targetIso).getTime() - Date.now()) / 1000));
    setRemaining(calc());
    const interval = setInterval(() => setRemaining(calc()), 1000);
    return () => clearInterval(interval);
  }, [targetIso]);
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  return { remaining, display: `${mins}:${String(secs).padStart(2, "0")}`, expired: remaining <= 0 };
}

function PendingOfferCard({ offer, accepting, onAccept }: { offer: PendingOffer; accepting: boolean; onAccept: () => void }) {
  const countdown = useCountdown(offer.lockedUntil);
  const tierLabel = offer.tier === 1 ? "ELITE" : offer.tier === 2 ? "STANDARD" : "LOW";
  const tierColor = offer.tier === 1 ? "text-amber-400 bg-amber-500/15" : offer.tier === 2 ? "text-blue-400 bg-blue-500/15" : "text-slate-400 bg-slate-500/15";

  return (
    <div className={`rounded-xl border-2 ${countdown.expired ? "border-red-500/40 bg-red-500/5" : "border-amber-500/40 bg-amber-500/5"} p-4 animate-pulse-slow`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-500/30 px-3 py-1 text-xs font-bold text-amber-400">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              New Lead Offered
            </span>
            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${tierColor}`}>TIER {offer.tier} ({tierLabel})</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Customer</div>
              <div className="text-sm font-semibold text-foreground">{offer.customerName ?? "Unknown"}</div>
              <div className="text-[11px] text-slate-400 font-mono">{offer.customerPhone ?? "—"}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Vehicle</div>
              <div className="text-sm font-medium text-foreground">{offer.carPlate ?? "No plate"}</div>
              <div className="text-[11px] text-slate-400">{offer.carModel ?? "—"}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Service</div>
              <div className="text-sm font-medium text-foreground capitalize">{offer.serviceType ?? offer.leadType ?? "—"}</div>
              <div className="text-[11px] text-slate-400">{offer.branchName ?? "—"}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Pipeline Value</div>
              <div className="text-sm font-bold text-emerald-400">AED {offer.pipelineValue.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Accept Action + Timer */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          {/* Countdown */}
          <div className={`text-center rounded-lg px-3 py-2 border ${countdown.expired ? "border-red-500/30 bg-red-500/10" : "border-border bg-card/60"}`}>
            <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">
              {countdown.expired ? "Expired" : "Time Left"}
            </div>
            <div className={`text-xl font-bold tabular-nums ${countdown.expired ? "text-red-400" : countdown.remaining < 60 ? "text-red-400 animate-pulse" : "text-foreground"}`}>
              {countdown.display}
            </div>
          </div>

          {/* Accept Button */}
          <button
            onClick={onAccept}
            disabled={accepting || countdown.expired}
            className={`w-full rounded-lg px-6 py-2.5 text-sm font-bold uppercase tracking-wide transition-all ${
              countdown.expired
                ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                : accepting
                ? "bg-amber-500/20 text-amber-400 cursor-wait"
                : "bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40"
            }`}
          >
            {accepting ? "Accepting..." : countdown.expired ? "Expired" : "Accept Lead"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PisAdvisorPortalPage() {
  const { companyId } = useParams();
  const [currentUser, setCurrentUser] = useState<{ id: string; fullName: string } | null>(null);
  const [tab, setTab] = useState<"leads" | "customers" | "calls" | "car-in" | "car-out">("leads");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [pendingOffers, setPendingOffers] = useState<PendingOffer[]>([]);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [partsModal, setPartsModal] = useState<{ partName: string; items: any[] } | null>(null);
  const [topupModal, setTopupModal] = useState<{ customerId: string; customerName: string; currentBalance: number } | null>(null);
  const [payModal, setPayModal] = useState<{ invoiceId: string; invoiceNumber: string; grandTotal: number; customerName: string; walletBalance: number } | null>(null);
  const [paySaving, setPaySaving] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [releaseModal, setReleaseModal] = useState<{ gatepassId: string; customerName: string; carPlate: string } | null>(null);
  const [releaseSaving, setReleaseSaving] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [releaseNotes, setReleaseNotes] = useState("");
  const [topupForm, setTopupForm] = useState({ amount: "", method: "cash", paymentDate: "", proofFileId: "" });
  const [topupSaving, setTopupSaving] = useState(false);
  const [topupError, setTopupError] = useState<string | null>(null);
  const [qcModal, setQcModal] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [search, setSearch] = useState("");

  // KPIs
  const [kpis, setKpis] = useState<{ assigned: number; contacted: number; pending: number; totalCalls: number; answerRate: number; revenue: number; invoiceCount: number; carOutCount: number; todayCollection: number }>({ assigned: 0, contacted: 0, pending: 0, totalCalls: 0, answerRate: 0, revenue: 0, invoiceCount: 0, carOutCount: 0, todayCollection: 0 });

  // Resolve logged-in user
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then(r => r.json())
      .then(data => {
        if (data?.userId) {
          const u = data.user ?? {};
          setCurrentUser({
            id: data.userId,
            fullName: u.fullName ?? u.full_name ?? u.email ?? data.email ?? "Advisor",
          });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Load data for logged-in user from PIS advisor-portal API
  const loadAgentData = useCallback(async () => {
    if (!currentUser?.id) return;
    setDataLoading(true);
    try {
      const r = await fetch(`/api/company/${companyId}/pis/advisor-portal?advisorUserId=${currentUser.id}`);
      const data = await r.json();

      setLeads(data.leads ?? []);
      setCalls(data.calls ?? []);
      setPendingOffers(data.pendingOffers ?? []);
      setCustomers([]); // customers come from data-center, not needed here
      const k = data.kpis ?? {};
      setKpis({
        assigned: k.totalLeads ?? 0,
        contacted: k.convertedLeads ?? 0,
        pending: k.carInLeads ?? 0,
        totalCalls: k.totalCalls ?? 0,
        answerRate: k.answerRate ?? 0,
        revenue: k.revenue ?? 0,
        invoiceCount: k.invoiceCount ?? 0,
        carOutCount: k.carOutCount ?? 0,
        todayCollection: k.todayCollection ?? 0,
      });
    } catch (e) { console.error(e); }
    setDataLoading(false);
  }, [companyId, currentUser?.id]);

  useEffect(() => { loadAgentData(); }, [loadAgentData]);

  // Auto-refresh: 5s when offers are pending (fast), 30s otherwise (light)
  useEffect(() => {
    if (!currentUser?.id) return;
    const intervalMs = pendingOffers.length > 0 ? 5000 : 30000;
    const interval = setInterval(loadAgentData, intervalMs);
    return () => clearInterval(interval);
  }, [currentUser?.id, loadAgentData, pendingOffers.length]);

  if (loading) return <div className="text-slate-400 py-8">Loading...</div>;
  if (!currentUser) return <div className="text-red-400 py-8">Unable to identify logged-in user.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Advisor Portal</h2>
          <p className="text-xs text-slate-500">Welcome, <span className="text-foreground font-medium">{currentUser.fullName}</span></p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowAi(!showAi)} className={`rounded-lg px-3 py-1.5 text-[10px] font-semibold ${showAi ? "bg-purple-500/20 text-purple-400" : "bg-slate-800 text-slate-400 hover:text-foreground"}`}>
            {showAi ? "Hide AI" : "AI Coaching"}
          </button>
          <button onClick={loadAgentData} className="rounded-lg bg-slate-800 px-3 py-1.5 text-[10px] font-semibold text-slate-400 hover:text-foreground">Refresh</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { l: "Total Leads", v: kpis.assigned, c: "text-foreground" },
          { l: "Converted", v: kpis.contacted, c: "text-emerald-400" },
          { l: "Car-In", v: kpis.pending, c: "text-amber-400" },
          { l: "Car-Out", v: kpis.carOutCount, c: "text-cyan-400" },
          { l: "Today Collection", v: `${kpis.todayCollection.toLocaleString()} AED`, c: "text-emerald-400" },
          { l: "Total Revenue", v: `${kpis.revenue.toLocaleString()} AED`, c: "text-emerald-400" },
          { l: "Total Calls", v: kpis.totalCalls, c: "text-cyan-400" },
          { l: "Answer Rate", v: `${kpis.answerRate}%`, c: kpis.answerRate >= 80 ? "text-emerald-400" : "text-red-400" },
        ].map(k => (
          <div key={k.l} className="rounded-xl border border-border bg-gradient-to-br from-slate-900/80 to-black/90 p-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">{k.l}</div>
            <div className={`text-lg font-bold ${k.c}`}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Pending Offers Banner */}
      {pendingOffers.length > 0 && (
        <div className="space-y-3">
          {pendingOffers.map(offer => (
            <PendingOfferCard
              key={offer.queueId}
              offer={offer}
              accepting={acceptingId === offer.queueId}
              onAccept={async () => {
                setAcceptingId(offer.queueId);
                try {
                  const res = await fetch(`/api/company/${companyId}/pis/lead-distribution/accept`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ queueId: offer.queueId }),
                  });
                  if (!res.ok) throw new Error("Failed to accept");
                  await loadAgentData();
                } catch (err) {
                  console.error("Accept failed:", err);
                }
                setAcceptingId(null);
              }}
            />
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {([["leads", "Leads", leads.length], ["car-in", "Car-In", leads.filter(l => (l.lead_status === "car_in" || l.checkinAt) && !["closed_won", "closed", "completed"].includes(l.lead_status)).length], ["car-out", "Car Out", leads.filter(l => ["closed_won", "closed", "completed"].includes(l.lead_status) || (l as any).workflow?.gatepass?.status === "released").length], ["customers", "Customers", new Set(leads.map(l => (l as any).customerId).filter(Boolean)).size], ["calls", "Calls", calls.length]] as const).map(([key, label, count]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold ${tab === key ? "bg-amber-500/20 text-amber-400" : "bg-slate-800 text-slate-400 hover:text-foreground"}`}>
            {label} <span className="ml-1 text-[10px] opacity-70">{count}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search by name, phone, email..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full sm:w-72 rounded-lg bg-slate-800 border border-border px-3 py-2 text-xs text-foreground placeholder:text-slate-600 focus:border-amber-500/50 focus:outline-none"
      />

      <div className={`${showAi ? "grid grid-cols-1 lg:grid-cols-3 gap-6" : ""}`}>
        <div className={`${showAi ? "lg:col-span-2" : ""}`}>
          {dataLoading ? <div className="text-slate-400 py-4">Loading {tab}...</div> : (
            <div className="rounded-xl border border-border bg-gradient-to-br from-slate-900/80 to-black/90 overflow-hidden">
              {/* LEADS TAB */}
              {tab === "leads" && (
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-border text-left">
                    {["Customer", "Phone", "Status", "Type", "Source", "Created"].map(h => (
                      <th key={h} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {leads.filter(l => !search || [l.customer_name, l.customer_phone].some(v => v?.toLowerCase().includes(search.toLowerCase()))).map(l => (
                      <tr key={l.id} className="border-b border-border/40 hover:bg-muted/40">
                        <td className="px-3 py-2 text-foreground font-medium">{l.customer_name ?? "—"}</td>
                        <td className="px-3 py-2 text-slate-300 font-mono">{l.customer_phone ?? "—"}</td>
                        <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-[9px] font-bold ${STATUS_STYLES[l.lead_status] ?? "bg-slate-500/15 text-slate-400"}`}>{l.lead_status}</span></td>
                        <td className="px-3 py-2 text-slate-300">{l.lead_type}</td>
                        <td className="px-3 py-2 text-slate-400">{l.source ?? "—"}</td>
                        <td className="px-3 py-2 text-slate-500">{timeAgo(l.created_at)}</td>
                      </tr>
                    ))}
                    {leads.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">No leads for {currentUser.fullName}</td></tr>}
                  </tbody>
                </table>
              )}

              {/* CAR OUT TAB */}
              {tab === "car-out" && (() => {
                const carOutLeads = leads.filter(l => ["closed_won", "closed", "completed"].includes(l.lead_status) || (l as any).workflow?.gatepass?.status === "released");
                const filtered = carOutLeads.filter(l => !search || [l.customer_name, l.customer_phone, l.carPlateNumber, l.carModel].some(v => v?.toLowerCase().includes(search.toLowerCase())));
                return (
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-border text-left">
                      {["Customer", "Phone", "Plate", "Car", "Invoice", "Amount", "Status", "Delivered"].map(h => (
                        <th key={h} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {filtered.map(l => {
                        const w = (l as any).workflow;
                        return (
                          <tr key={l.id} className="border-b border-border/40 hover:bg-muted/40">
                            <td className="px-3 py-2.5 text-foreground font-medium">{l.customer_name ?? "—"}</td>
                            <td className="px-3 py-2.5 text-slate-300 font-mono">{l.customer_phone ?? "—"}</td>
                            <td className="px-3 py-2.5 text-amber-400 font-mono font-bold">{l.carPlateNumber ?? "—"}</td>
                            <td className="px-3 py-2.5 text-slate-300">{l.carModel ?? "—"}</td>
                            <td className="px-3 py-2.5">{w?.invoice?.invoiceNumber ? <span className="text-sky-300">#{w.invoice.invoiceNumber}</span> : "—"}</td>
                            <td className="px-3 py-2.5 text-emerald-400 font-semibold">{w?.invoice?.grandTotal ? `AED ${w.invoice.grandTotal.toLocaleString()}` : "—"}</td>
                            <td className="px-3 py-2.5">
                              <WorkflowBadge status={w?.invoice?.status ?? l.lead_status} labels={{ paid: "Paid", closed_won: "Closed Won", closed: "Closed", completed: "Completed" }} />
                            </td>
                            <td className="px-3 py-2.5 text-emerald-400">{w?.gatepass?.status === "released" ? "Yes" : "—"}</td>
                          </tr>
                        );
                      })}
                      {filtered.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-500">No delivered cars yet</td></tr>}
                    </tbody>
                  </table>
                );
              })()}

              {/* CUSTOMERS TAB */}
              {tab === "customers" && (() => {
                const seen = new Set<string>();
                const uniqueCustomers = leads.filter(l => {
                  const cid = (l as any).customerId;
                  if (!cid || seen.has(cid)) return false;
                  seen.add(cid);
                  return true;
                });
                const filtered = uniqueCustomers.filter(l => !search || [l.customer_name, l.customer_phone, (l as any).customer_email].some(v => v?.toLowerCase().includes(search.toLowerCase())));
                return (
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-border text-left">
                      {["Customer", "Phone", "Plate", "Car", "Lead Status", "Leads", "Wallet"].map(h => (
                        <th key={h} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {filtered.map(l => {
                        const custId = (l as any).customerId;
                        const custLeads = leads.filter(ll => (ll as any).customerId === custId);
                        return (
                          <tr key={custId} className="border-b border-border/40 hover:bg-muted/40">
                            <td className="px-3 py-2.5">
                              <a href={`/company/${companyId}/customers/${custId}`} className="text-foreground font-medium hover:underline">{l.customer_name ?? "—"}</a>
                            </td>
                            <td className="px-3 py-2.5 text-slate-300 font-mono">{l.customer_phone ?? "—"}</td>
                            <td className="px-3 py-2.5 text-amber-400 font-mono font-bold">{l.carPlateNumber ?? "—"}</td>
                            <td className="px-3 py-2.5 text-slate-300">{l.carModel ?? "—"}</td>
                            <td className="px-3 py-2.5">
                              <WorkflowBadge status={l.lead_status} labels={{ open: "Open", car_in: "Car In", closed_won: "Closed Won", closed: "Closed", completed: "Completed", processing: "Processing", lost: "Lost" }} />
                            </td>
                            <td className="px-3 py-2.5 text-slate-300">{custLeads.length}</td>
                            <td className="px-3 py-2.5">
                              <span className={`font-semibold ${Number((l as any).customerWalletAmount ?? 0) > 0 ? "text-emerald-400" : "text-red-400"}`}>
                                AED {Number((l as any).customerWalletAmount ?? 0).toFixed(2)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {filtered.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">No customers assigned to {currentUser.fullName}</td></tr>}
                    </tbody>
                  </table>
                );
              })()}

              {/* CALLS TAB */}
              {tab === "calls" && (
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-border text-left">
                    {["Time", "Direction", "From", "To", "Customer", "Status", "Duration"].map(h => (
                      <th key={h} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {calls.filter(c => !search || [c.customer_name, c.from_number, c.to_number].some(v => v?.toLowerCase().includes(search.toLowerCase()))).map(c => (
                      <tr key={c.id} className="border-b border-border/40 hover:bg-muted/40">
                        <td className="px-3 py-2 text-slate-500">{timeAgo(c.created_at)}</td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${c.direction === "inbound" ? "bg-cyan-500/20 text-cyan-400" : "bg-blue-500/20 text-blue-400"}`}>
                            {c.direction === "inbound" ? "IN" : "OUT"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-300 font-mono">{c.from_number}</td>
                        <td className="px-3 py-2 text-slate-300 font-mono">{c.to_number}</td>
                        <td className="px-3 py-2 text-slate-300">{c.customer_name ?? "—"}</td>
                        <td className={`px-3 py-2 font-medium ${c.status === "completed" ? "text-emerald-400" : c.status === "failed" ? "text-red-400" : "text-slate-400"}`}>{c.status}</td>
                        <td className="px-3 py-2 text-slate-300">{formatDuration(c.duration_seconds)}</td>
                      </tr>
                    ))}
                    {calls.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">No calls for {currentUser.fullName}</td></tr>}
                  </tbody>
                </table>
              )}

              {/* CAR-IN TAB - Full Workflow Dashboard */}
              {tab === "car-in" && (() => {
                const carInLeads = leads.filter(l => (l.lead_status === "car_in" || l.checkinAt) && !["closed_won", "closed", "completed", "lost"].includes(l.lead_status));
                const filtered = carInLeads.filter(l => !search || [l.customer_name, l.customer_phone, l.carPlateNumber, l.carModel].some(v => v?.toLowerCase().includes(search.toLowerCase())));
                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b border-border text-left">
                        {["Customer / Car", "Car In Time", "Pre-Inspection", "Inspection", "Estimate", "Parts Order", "Job Card", "Quality", "Invoice", "Wallet", "Delivery"].map(h => (
                          <th key={h} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {filtered.map(l => {
                          const w = l.workflow;
                          const cid = companyId as string;
                          return (
                            <tr key={l.id} className="border-b border-border/40 hover:bg-muted/40 align-top">
                              {/* Customer / Car */}
                              <td className="px-3 py-2.5">
                                <a href={`/company/${cid}/leads/${l.id}`} className="text-foreground font-medium hover:underline">{l.customer_name ?? "—"}</a>
                                <div className="text-[10px] text-slate-400 font-mono">{l.customer_phone ?? ""}</div>
                                <div className="text-[10px] text-amber-400 font-mono font-bold mt-0.5">{l.carPlateNumber ?? "No plate"}</div>
                                <div className="text-[10px] text-slate-500">{l.carModel ?? ""}</div>
                                <div className="text-[9px] text-slate-600 mt-0.5 capitalize">{l.serviceType ?? l.lead_type ?? "—"}</div>
                              </td>
                              {/* Car In Time */}
                              <td className="px-3 py-2.5">
                                {l.checkinAt ? (
                                  <>
                                    <div className="text-slate-300">{new Date(l.checkinAt).toLocaleString()}</div>
                                    <div className="text-[10px] text-emerald-400 mt-0.5">{timeAgo(l.checkinAt)}</div>
                                  </>
                                ) : <span className="text-slate-600">—</span>}
                              </td>
                              {/* Pre-Inspection Form */}
                              <td className="px-3 py-2.5">
                                <WorkflowBadge status={w?.preInspectionForm?.status} labels={{ submitted: "Submitted", pending: "Pending" }} />
                                {w?.preInspectionForm?.submittedAt && <div className="text-[9px] text-slate-500 mt-0.5">{new Date(w.preInspectionForm.submittedAt).toLocaleString()}</div>}
                              </td>
                              {/* Inspection */}
                              <td className="px-3 py-2.5">
                                {w?.inspection ? (
                                  <>
                                    <WorkflowBadge status={w.inspection.status} labels={{ completed: "Completed", pending: "Pending", in_progress: "In Progress", cancelled: "Cancelled" }} />
                                    <div className="mt-1">
                                      <a href={`/api/company/${cid}/workshop/inspections/${w.inspection.id}/print`} target="_blank" rel="noreferrer"
                                        className="inline-flex rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[8px] font-semibold uppercase text-slate-400 hover:bg-muted hover:text-foreground">PDF</a>
                                    </div>
                                  </>
                                ) : <span className="text-slate-600">Pending</span>}
                              </td>
                              {/* Estimate */}
                              <td className="px-3 py-2.5">
                                {w?.estimate ? (
                                  <>
                                    <a href={`/company/${cid}/estimates/${w.estimate.id}`}
                                      className="inline-flex rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[8px] font-semibold uppercase text-slate-400 hover:bg-muted hover:text-foreground">
                                      View Estimate
                                    </a>
                                    <div className="mt-1">
                                      <WorkflowBadge status={w.estimate.status} labels={{ approved: "Approved", draft: "Draft", pending_approval: "Pending", rejected: "Rejected", invoiced: "Invoiced" }} />
                                    </div>
                                    {w.estimate.grandTotal > 0 && <div className="text-[10px] text-emerald-400 mt-0.5">AED {w.estimate.grandTotal.toLocaleString()}</div>}
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    className="inline-flex rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[8px] font-semibold uppercase text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
                                    onClick={async () => {
                                      if (!w?.inspection?.id) { alert("Inspection is required to create an estimate."); return; }
                                      try {
                                        const res = await fetch(`/api/company/${cid}/workshop/estimates`, {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({ inspectionId: w.inspection.id }),
                                        });
                                        if (!res.ok) throw new Error("Failed");
                                        loadAgentData();
                                      } catch { alert("Failed to create estimate."); }
                                    }}
                                  >
                                    Create Estimate
                                  </button>
                                )}
                              </td>
                              {/* Parts Order */}
                              <td className="px-3 py-2.5">
                                {w?.parts && (w.parts.orderedCount > 0 || w.parts.receivedCount > 0 || w.parts.items?.length > 0) ? (
                                  <div>
                                    <WorkflowBadge status={w.parts.receivedCount >= w.parts.orderedCount && w.parts.orderedCount > 0 ? "completed" : "pending"} labels={{ completed: "Received", pending: "In Progress" }} />
                                    <div className="text-[10px] text-slate-300 mt-0.5">{w.parts.receivedCount}/{w.parts.orderedCount} received</div>
                                    <div className="h-1 w-full rounded-full bg-slate-800 mt-1 overflow-hidden">
                                      <div className={`h-full rounded-full ${w.parts.receivedCount >= w.parts.orderedCount ? "bg-emerald-500" : "bg-amber-500"}`}
                                        style={{ width: `${w.parts.orderedCount > 0 ? Math.min(100, (w.parts.receivedCount / w.parts.orderedCount) * 100) : 0}%` }} />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setPartsModal({ partName: l.customer_name ?? "Parts", items: w.parts.items ?? [] })}
                                      className="inline-flex mt-1 rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[8px] font-semibold uppercase text-slate-400 hover:bg-muted hover:text-foreground">
                                      View Parts
                                    </button>
                                  </div>
                                ) : <span className="text-slate-600">—</span>}
                              </td>
                              {/* Job Card */}
                              <td className="px-3 py-2.5">
                                {w?.jobCard ? (
                                  <>
                                    <WorkflowBadge status={w.jobCard.status} labels={{ Completed: "Completed", Started: "In Progress", Pending: "Pending" }} />
                                    {w.jobCard.startAt && <div className="text-[9px] text-slate-500 mt-0.5">Started: {timeAgo(w.jobCard.startAt)}</div>}
                                    {w.jobCard.completeAt && <div className="text-[9px] text-emerald-500 mt-0.5">Done: {timeAgo(w.jobCard.completeAt)}</div>}
                                    {w.jobCard.finalInspectionAt && <div className="text-[9px] text-emerald-400 mt-0.5">Final inspected</div>}
                                    {w.jobCard.carWash && <div className="text-[9px] text-cyan-400">Car washed</div>}
                                    <a href={`/company/${cid}/workshop/job-cards/${w.jobCard.id}`}
                                      className="inline-flex mt-1 rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[8px] font-semibold uppercase text-slate-400 hover:bg-muted hover:text-foreground">
                                      View Job Card
                                    </a>
                                  </>
                                ) : <span className="text-slate-600">—</span>}
                              </td>
                              {/* Quality Check */}
                              <td className="px-3 py-2.5">
                                {w?.jobCard?.finalInspectionAt ? (
                                  <div>
                                    <WorkflowBadge status="completed" labels={{ completed: "Passed" }} />
                                    <div className="text-[9px] text-emerald-400 mt-0.5">Inspected: {timeAgo(w.jobCard.finalInspectionAt)}</div>
                                    <div className="text-[9px] mt-0.5">{w.jobCard.carWash ? <span className="text-cyan-400">Car washed</span> : <span className="text-amber-400">Wash pending</span>}</div>
                                    <button
                                      type="button"
                                      onClick={() => setQcModal({ customerName: l.customer_name, carPlate: l.carPlateNumber, ...w.jobCard })}
                                      className="inline-flex mt-1 rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[8px] font-semibold uppercase text-slate-400 hover:bg-muted hover:text-foreground">
                                      View QC Report
                                    </button>
                                  </div>
                                ) : w?.qualityCheck?.status ? (
                                  <WorkflowBadge status={w.qualityCheck.status} labels={{ completed: "Passed", queue: "Queue", in_process: "In Process", failed: "Failed" }} />
                                ) : w?.jobCard?.status === "Completed" ? (
                                  <span className="text-[10px] text-amber-400">Pending inspection</span>
                                ) : <span className="text-slate-600">—</span>}
                              </td>
                              {/* Invoice */}
                              <td className="px-3 py-2.5">
                                {w?.invoice ? (
                                  <>
                                    <WorkflowBadge status={w.invoice.status} labels={{ paid: "Paid", draft: "Unpaid", issued: "Issued", cancelled: "Cancelled" }} />
                                    {w.invoice.invoiceNumber && <div className="text-[9px] text-slate-500 mt-0.5">#{w.invoice.invoiceNumber}</div>}
                                    {w.invoice.grandTotal > 0 && <div className="text-[10px] text-emerald-400 mt-0.5">AED {w.invoice.grandTotal.toLocaleString()}</div>}
                                    {w.invoice.status !== "paid" && w.invoice.status !== "cancelled" && (
                                      <button
                                        type="button"
                                        className="inline-flex mt-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase text-emerald-400 hover:bg-emerald-500/20"
                                        onClick={() => {
                                          setPayModal({
                                            invoiceId: w.invoice.id,
                                            invoiceNumber: w.invoice.invoiceNumber ?? "",
                                            grandTotal: w.invoice.grandTotal,
                                            customerName: l.customer_name ?? "Customer",
                                            walletBalance: Number((l as any).customerWalletAmount ?? 0),
                                          });
                                          setPayError(null);
                                        }}
                                      >
                                        Pay Now
                                      </button>
                                    )}
                                  </>
                                ) : w?.estimate?.id && w?.jobCard?.status === "Completed" ? (
                                  <button
                                    type="button"
                                    className="inline-flex rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[8px] font-semibold uppercase text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
                                    onClick={async () => {
                                      try {
                                        const res = await fetch(`/api/company/${cid}/workshop/estimates/${w.estimate.id}/invoice`, {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({}),
                                        });
                                        if (!res.ok) throw new Error("Failed");
                                        loadAgentData();
                                      } catch { alert("Failed to create invoice."); }
                                    }}
                                  >
                                    Create Invoice
                                  </button>
                                ) : <span className="text-[10px] text-slate-600">No Invoice</span>}
                              </td>
                              {/* Wallet */}
                              <td className="px-3 py-2.5">
                                {(l as any).customerId ? (
                                  <div>
                                    <div className={`text-[11px] font-semibold ${Number((l as any).customerWalletAmount ?? 0) > 0 ? "text-emerald-400" : "text-red-400"}`}>
                                      AED {Number((l as any).customerWalletAmount ?? 0).toFixed(2)}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setTopupModal({ customerId: (l as any).customerId, customerName: l.customer_name ?? "Customer", currentBalance: Number((l as any).customerWalletAmount ?? 0) });
                                        setTopupForm({ amount: "", method: "cash", paymentDate: "", proofFileId: "" });
                                        setTopupError(null);
                                      }}
                                      className="inline-flex mt-1 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase text-amber-400 hover:bg-amber-500/20">
                                      Top Up
                                    </button>
                                  </div>
                                ) : <span className="text-slate-600">—</span>}
                              </td>
                              {/* Delivery / Gatepass */}
                              <td className="px-3 py-2.5">
                                {w?.gatepass?.status === "released" ? (
                                  <div>
                                    <WorkflowBadge status="released" labels={{ released: "Delivered" }} />
                                    <div className="text-[9px] text-emerald-400 mt-0.5">Car released</div>
                                  </div>
                                ) : w?.gatepass?.status ? (
                                  <div>
                                    <WorkflowBadge status={w.gatepass.status} labels={{ ready: "Ready", pending: "Pending" }} />
                                    <button
                                      type="button"
                                      className="inline-flex mt-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase text-emerald-400 hover:bg-emerald-500/20"
                                      onClick={() => {
                                        setReleaseModal({ gatepassId: w.gatepass.id, customerName: l.customer_name ?? "Customer", carPlate: l.carPlateNumber ?? "N/A" });
                                        setReleaseNotes("");
                                        setReleaseError(null);
                                      }}
                                    >
                                      Release Car
                                    </button>
                                  </div>
                                ) : w?.invoice?.status === "paid" ? (
                                  <div>
                                    <span className="text-[10px] text-amber-400">Ready</span>
                                    <button
                                      type="button"
                                      className="inline-flex mt-1 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase text-amber-400 hover:bg-amber-500/20"
                                      onClick={async () => {
                                        try {
                                          const res = await fetch(`/api/company/${cid}/workshop/gatepass`, {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ invoiceId: w.invoice.id, handoverType: "branch" }),
                                          });
                                          if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error ?? "Failed"); }
                                          loadAgentData();
                                        } catch (err: any) { alert(err?.message ?? "Failed to create gatepass"); }
                                      }}
                                    >
                                      Create Gatepass
                                    </button>
                                  </div>
                                ) : w?.invoice ? (
                                  <span className="text-[10px] text-slate-500">Awaiting payment</span>
                                ) : w?.jobCard?.finalInspectionAt ? (
                                  <span className="text-[10px] text-slate-500">Create invoice first</span>
                                ) : <span className="text-slate-600">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                        {filtered.length === 0 && <tr><td colSpan={10} className="px-3 py-8 text-center text-slate-500">No car-in records for {currentUser.fullName}</td></tr>}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Release Car Modal */}
        {releaseModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-xl border border-border bg-backgroundshadow-xl">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-foreground">Release Car</div>
                  <div className="text-[11px] text-slate-400">Confirm car handover to customer</div>
                </div>
                <button onClick={() => setReleaseModal(null)} className="rounded-md border border-border bg-muted/40 px-3 py-1.5 text-[11px] font-semibold text-slate-400 hover:bg-muted">Close</button>
              </div>
              <div className="p-4 space-y-3">
                {releaseError && <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-300">{releaseError}</div>}

                <div className="rounded-lg border border-border/40 bg-card/30 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Customer</span>
                    <span className="text-foreground font-semibold">{releaseModal.customerName}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Vehicle</span>
                    <span className="text-amber-400 font-mono font-bold">{releaseModal.carPlate}</span>
                  </div>
                </div>

                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[10px] text-amber-200">
                  By releasing this car, you confirm: payment received, quality check passed, supervisor approved, and customer has signed the handover form.
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400">Handover Notes <span className="font-normal text-slate-600">(optional)</span></label>
                  <textarea
                    className="h-16 w-full rounded border border-border bg-muted px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground"
                    placeholder="Any notes about the handover..."
                    value={releaseNotes}
                    onChange={(e) => setReleaseNotes(e.target.value)} />
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => setReleaseModal(null)} className="rounded-md border border-border bg-muted/40 px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-muted">Cancel</button>
                  <button
                    disabled={releaseSaving}
                    className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                    onClick={async () => {
                      setReleaseSaving(true);
                      setReleaseError(null);
                      try {
                        const res = await fetch(`/api/company/${companyId}/workshop/gatepass/${releaseModal.gatepassId}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            status: "released",
                            customerSigned: true,
                            supervisorApprovedAt: new Date().toISOString(),
                            finalNote: releaseNotes.trim() || "",
                            release: true,
                          }),
                        });
                        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error ?? "Failed to release"); }
                        setReleaseModal(null);
                        loadAgentData();
                      } catch (err: any) {
                        setReleaseError(err?.message ?? "Failed to release car");
                      } finally {
                        setReleaseSaving(false);
                      }
                    }}
                  >
                    {releaseSaving ? "Releasing..." : "Confirm Release"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pay Invoice Modal */}
        {payModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-xl border border-border bg-backgroundshadow-xl">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-foreground">Pay Invoice</div>
                  <div className="text-[11px] text-slate-400">{payModal.customerName}</div>
                </div>
                <button onClick={() => setPayModal(null)} className="rounded-md border border-border bg-muted/40 px-3 py-1.5 text-[11px] font-semibold text-slate-400 hover:bg-muted">Close</button>
              </div>
              <div className="p-4 space-y-3">
                {payError && <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-300">{payError}</div>}

                <div className="rounded-lg border border-border/40 bg-card/30 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Invoice</span>
                    <span className="text-foreground font-semibold">#{payModal.invoiceNumber}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Amount Due</span>
                    <span className="text-lg font-bold text-foreground">AED {payModal.grandTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs border-t border-border/40 pt-2">
                    <span className="text-slate-400">Wallet Balance</span>
                    <span className={`font-semibold ${payModal.walletBalance >= payModal.grandTotal ? "text-emerald-400" : "text-red-400"}`}>
                      AED {payModal.walletBalance.toFixed(2)}
                    </span>
                  </div>
                  {payModal.walletBalance >= payModal.grandTotal ? (
                    <div className="flex items-center justify-between text-xs border-t border-border/40 pt-2">
                      <span className="text-slate-400">After Payment</span>
                      <span className="text-slate-300">AED {(payModal.walletBalance - payModal.grandTotal).toFixed(2)}</span>
                    </div>
                  ) : (
                    <div className="rounded bg-red-500/10 border border-red-500/20 px-2 py-1.5 text-[10px] text-red-300 mt-1">
                      Insufficient wallet balance. Top up AED {(payModal.grandTotal - payModal.walletBalance).toFixed(2)} more to pay.
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => setPayModal(null)} className="rounded-md border border-border bg-muted/40 px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-muted">Cancel</button>
                  <button
                    disabled={paySaving || payModal.walletBalance < payModal.grandTotal}
                    className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                    onClick={async () => {
                      setPaySaving(true);
                      setPayError(null);
                      try {
                        const res = await fetch(`/api/company/${companyId}/workshop/invoices/${payModal.invoiceId}/pay`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ paymentMethod: "wallet" }),
                        });
                        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error ?? "Payment failed"); }
                        setPayModal(null);
                        loadAgentData();
                      } catch (err: any) {
                        setPayError(err?.message ?? "Payment failed");
                      } finally {
                        setPaySaving(false);
                      }
                    }}
                  >
                    {paySaving ? "Processing..." : "Confirm Payment"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Topup Wallet Modal */}
        {topupModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-lg rounded-xl border border-border bg-backgroundshadow-xl">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-foreground">Topup Wallet</div>
                  <div className="text-[11px] text-slate-400">{topupModal.customerName} | Balance: <span className={topupModal.currentBalance > 0 ? "text-emerald-400" : "text-red-400"}>AED {topupModal.currentBalance.toFixed(2)}</span></div>
                </div>
                <button onClick={() => setTopupModal(null)} className="rounded-md border border-border bg-muted/40 px-3 py-1.5 text-[11px] font-semibold text-slate-400 hover:bg-muted">Close</button>
              </div>
              <div className="space-y-4 p-4">
                {topupError && <div className="text-sm text-red-400">{topupError}</div>}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400">Amount</label>
                  <input type="number" min="0" step="0.01" placeholder="Enter amount"
                    className="h-10 w-full rounded border border-border bg-muted px-3 text-sm text-foreground placeholder:text-muted-foreground"
                    value={topupForm.amount}
                    onChange={(e) => setTopupForm((p) => ({ ...p, amount: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400">Payment Method</label>
                  <select className="h-10 w-full rounded border border-border bg-muted px-3 text-sm text-foreground"
                    value={topupForm.method}
                    onChange={(e) => setTopupForm((p) => ({ ...p, method: e.target.value }))}>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="online">Online</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400">Payment Date</label>
                  <input type="date" className="h-10 w-full rounded border border-border bg-muted px-3 text-sm text-foreground"
                    value={topupForm.paymentDate}
                    onChange={(e) => setTopupForm((p) => ({ ...p, paymentDate: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400">Payment Proof</label>
                  {topupForm.proofFileId ? (
                    <div className="flex items-center justify-between rounded border border-emerald-700/50 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300">
                      <span>File uploaded</span>
                      <button type="button" onClick={() => setTopupForm((p) => ({ ...p, proofFileId: "" }))} className="text-slate-400 hover:text-rose-400">&times;</button>
                    </div>
                  ) : (
                    <input type="file" accept="image/*,.pdf"
                      className="w-full text-xs text-slate-400"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const fd = new FormData();
                          fd.append("file", file);
                          fd.append("kind", "image");
                          const res = await fetch("/api/files/upload", { method: "POST", body: fd });
                          const data = await res.json().catch(() => ({}));
                          if (res.ok && data?.fileId) setTopupForm((p) => ({ ...p, proofFileId: data.fileId }));
                        } catch {}
                      }} />
                  )}
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button type="button" onClick={() => setTopupModal(null)}
                    className="rounded-md border border-border bg-muted/40 px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-muted">Cancel</button>
                  <button type="button" disabled={topupSaving || !topupForm.amount || Number(topupForm.amount) <= 0}
                    className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    onClick={async () => {
                      const amount = Number(topupForm.amount);
                      if (!amount || amount <= 0) { setTopupError("Enter a valid amount."); return; }
                      setTopupSaving(true);
                      setTopupError(null);
                      try {
                        const res = await fetch(`/api/customers/${topupModal.customerId}/wallet/transactions`, {
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
                        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error ?? "Failed"); }
                        setTopupModal(null);
                        setTopupForm({ amount: "", method: "cash", paymentDate: "", proofFileId: "" });
                        loadAgentData();
                      } catch (err: any) {
                        setTopupError(err?.message ?? "Failed to create topup.");
                      } finally {
                        setTopupSaving(false);
                      }
                    }}>
                    {topupSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* QC Report Modal */}
        {qcModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-2xl rounded-xl border border-border bg-backgroundshadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div>
                  <div className="text-sm font-bold text-foreground">Quality Check Report</div>
                  <div className="text-[11px] text-slate-400">{qcModal.customerName} | {qcModal.carPlate}</div>
                </div>
                <button onClick={() => setQcModal(null)} className="text-slate-500 hover:text-foreground text-lg">&times;</button>
              </div>
              <div className="max-h-[65vh] overflow-y-auto p-4 space-y-4">
                {/* Final Inspection Checklist */}
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Final Inspection Checklist</div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Test Drive", value: qcModal.testDrive },
                      { label: "Cluster Warning", value: qcModal.clusterWarning },
                      { label: "Tyre Check", value: qcModal.tyreCheck },
                      { label: "Computer Reset", value: qcModal.computerReset },
                      { label: "Protective Shields", value: qcModal.protectiveShields },
                      { label: "Car Wash", value: qcModal.carWash },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between rounded border border-border/40 bg-card/30 px-3 py-2">
                        <span className="text-xs text-slate-300">{item.label}</span>
                        <span className={`text-xs font-bold ${item.value ? "text-emerald-400" : "text-red-400"}`}>
                          {item.value ? "PASS" : "FAIL"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Inspection Details */}
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Inspection Details</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded border border-border/40 bg-card/30 px-3 py-2">
                      <span className="text-slate-500">Inspected At</span>
                      <div className="text-foreground mt-0.5">{qcModal.finalInspectionAt ? new Date(qcModal.finalInspectionAt).toLocaleString() : "—"}</div>
                    </div>
                    <div className="rounded border border-border/40 bg-card/30 px-3 py-2">
                      <span className="text-slate-500">Inspected By</span>
                      <div className="text-foreground mt-0.5">{qcModal.finalInspectionBy ?? "—"}</div>
                    </div>
                  </div>
                </div>

                {/* Remarks */}
                {qcModal.finalRemarks && (
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Remarks</div>
                    <div className="rounded border border-border/40 bg-card/30 px-3 py-2 text-xs text-slate-300">{qcModal.finalRemarks}</div>
                  </div>
                )}

                {/* Final Inspection Photos */}
                {qcModal.finalPhotos && Object.values(qcModal.finalPhotos).some(Boolean) && (
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Final Inspection Photos</div>
                    <div className="grid grid-cols-4 gap-2">
                      {["front", "rear", "right", "left"].map((key) => {
                        const fileId = qcModal.finalPhotos?.[key];
                        return (
                          <div key={key} className="text-center">
                            {fileId ? (
                              <a href={`/api/files/${fileId}`} target="_blank" rel="noreferrer" className="block">
                                <img src={`/api/files/${fileId}`} alt={key} className="w-full h-20 object-cover rounded border border-border" />
                                <div className="text-[8px] text-slate-400 mt-1 uppercase">{key}</div>
                              </a>
                            ) : (
                              <div className="h-20 rounded border border-border/40 bg-card/30 flex items-center justify-center text-[9px] text-slate-600">{key}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Car Out Video */}
                {qcModal.carOutVideoId && (
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Car Out Video</div>
                    <a href={`/api/files/${qcModal.carOutVideoId}`} target="_blank" rel="noreferrer"
                      className="inline-flex rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-semibold text-emerald-400 hover:bg-emerald-500/20">
                      View Video
                    </a>
                  </div>
                )}

                {/* Car Wash Section */}
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Car Wash</div>
                  {qcModal.carWash ? (
                    <div className="space-y-2">
                      <WorkflowBadge status="completed" labels={{ completed: "Completed" }} />
                      {qcModal.carWashNotes && (
                        <div className="rounded border border-border/40 bg-card/30 px-3 py-2 text-xs text-slate-300">Notes: {qcModal.carWashNotes}</div>
                      )}
                      {qcModal.carWashMedia && Object.values(qcModal.carWashMedia).some(Boolean) && (
                        <div className="grid grid-cols-5 gap-2">
                          {["front", "rear", "right", "left", "video"].map((key) => {
                            const fileId = qcModal.carWashMedia?.[key];
                            return (
                              <div key={key} className="text-center">
                                {fileId ? (
                                  <a href={`/api/files/${fileId}`} target="_blank" rel="noreferrer" className="block">
                                    {key === "video" ? (
                                      <div className="h-16 rounded border border-cyan-500/20 bg-cyan-500/5 flex items-center justify-center text-cyan-400 text-lg">&#9654;</div>
                                    ) : (
                                      <img src={`/api/files/${fileId}`} alt={key} className="w-full h-16 object-cover rounded border border-border" />
                                    )}
                                    <div className="text-[8px] text-slate-400 mt-1 uppercase">{key}</div>
                                  </a>
                                ) : (
                                  <div className="h-16 rounded border border-border/40 bg-card/30 flex items-center justify-center text-[9px] text-slate-600">{key}</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-[10px] text-amber-400">Car wash not completed</span>
                  )}
                </div>
              </div>
              <div className="px-4 py-3 border-t border-border flex justify-end">
                <button onClick={() => setQcModal(null)} className="rounded border border-slate-700 bg-slate-800 px-4 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700">Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Parts Detail Modal */}
        {partsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-2xl rounded-xl border border-border bg-backgroundshadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div>
                  <div className="text-sm font-bold text-foreground">Parts & Order Status</div>
                  <div className="text-[11px] text-slate-400">{partsModal.partName} - {partsModal.items.length} part(s)</div>
                </div>
                <button onClick={() => setPartsModal(null)} className="text-slate-500 hover:text-foreground text-lg">&times;</button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                {partsModal.items.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-500">No parts data available.</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Part</th>
                        <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Vendor</th>
                        <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Type</th>
                        <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Price</th>
                        <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Status</th>
                        <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Delivery Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partsModal.items.map((item: any, idx: number) => (
                        <tr key={item.id ?? idx} className="border-b border-border/40 hover:bg-muted/40">
                          <td className="px-4 py-2.5">
                            <div className="text-foreground font-medium">{item.partName}</div>
                            {item.vendorPartNumber && <div className="text-[10px] text-slate-500 font-mono">#{item.vendorPartNumber}</div>}
                          </td>
                          <td className="px-4 py-2.5 text-slate-300">{item.vendorName ?? "—"}</td>
                          <td className="px-4 py-2.5">
                            <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[9px] font-bold text-blue-400">{item.type}</span>
                          </td>
                          <td className="px-4 py-2.5 text-emerald-400 font-semibold">{item.price > 0 ? `AED ${item.price}` : "—"}</td>
                          <td className="px-4 py-2.5">
                            <WorkflowBadge status={item.status?.toLowerCase()} labels={{
                              approved: "Approved", ordered: "Ordered", received: "Received",
                              completed: "Completed", pending: "Pending", quoted: "Quoted",
                              return: "Return", returned: "Returned"
                            }} />
                          </td>
                          <td className="px-4 py-2.5">
                            {item.deliveryNoteNo ? (
                              <div>
                                <div className="text-[10px] font-semibold text-sky-300">DN: {item.deliveryNoteNo}</div>
                                <div className="text-[10px] text-slate-400">{item.deliveryNoteStatus ?? "issued"}</div>
                              </div>
                            ) : <span className="text-slate-600">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="px-4 py-3 border-t border-border flex justify-end">
                <button onClick={() => setPartsModal(null)} className="rounded border border-slate-700 bg-slate-800 px-4 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700">Close</button>
              </div>
            </div>
          </div>
        )}

        {/* AI Panel */}
        {showAi && companyId && (
          <div className="lg:col-span-1">
            <AIPanel companyId={companyId as string} engines={["e2", "e7"]} />
          </div>
        )}
      </div>
    </div>
  );
}
