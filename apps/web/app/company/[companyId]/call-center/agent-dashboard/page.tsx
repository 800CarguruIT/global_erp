"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@repo/ui";
import { AIPanel } from "@/app/(components)/intelligence/AIPanel";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AgentOption { id: string; name: string; email: string }
interface Kpis {
  activeCustomers?: number;
  assignedCustomers?: number;
  contactedCustomers?: number;
  pendingCustomers?: number;
  totalCalls?: number;
  answeredCalls?: number;
  failedCalls?: number;
  answeredRate?: number;
  avgCallDurationSeconds?: number | null;
  [key: string]: unknown;
}
interface CallRow {
  id: string; direction: string; from_number: string; to_number: string;
  status: string; duration_seconds: number | null; created_at: string;
  customer_name: string | null; customer_phone: string | null;
}
interface CustomerRow {
  customer_id: string; customer_code: string; customer_name: string; customer_phone: string | null;
  customer_email: string | null; customer_type: string | null; segment: string;
  assigned_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(sec: number | null): string {
  if (!sec || sec <= 0) return "-";
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
function timeAgo(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}
function statusColor(s: string): string {
  if (s === "completed") return "text-emerald-400";
  if (s === "failed" || s === "cancelled") return "text-red-400";
  if (s === "in_progress" || s === "ringing") return "text-amber-400";
  return "text-zinc-500";
}
function statusBg(s: string): string {
  if (s === "completed") return "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
  if (s === "failed" || s === "cancelled") return "bg-red-500/10 border-red-500/20 text-red-400";
  if (s === "in_progress" || s === "ringing") return "bg-amber-500/10 border-amber-500/20 text-amber-400";
  return "bg-zinc-800 border-zinc-700 text-zinc-400";
}
function segmentBadge(s: string): string {
  if (s === "chsc") return "bg-purple-500/10 border-purple-500/20 text-purple-400";
  if (s === "insurance") return "bg-blue-500/10 border-blue-500/20 text-blue-400";
  if (s === "warranty") return "bg-amber-500/10 border-amber-500/20 text-amber-400";
  return "bg-zinc-800 border-zinc-700 text-zinc-400";
}

// ─── Page ────────────────────────────────────────────────────────────────────

type Tab = "calls" | "customers";

export default function AgentDashboardPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [userResolved, setUserResolved] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [customerTotal, setCustomerTotal] = useState(0);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerSegment, setCustomerSegment] = useState("all");
  const [activeTab, setActiveTab] = useState<Tab>("calls");
  const [loading, setLoading] = useState(true);
  const [showAI, setShowAI] = useState(true);
  const [callingNumber, setCallingNumber] = useState<string | null>(null);

  // Auth
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          setUserId(json?.userId ?? null);
          setUserName(json?.user?.fullName ?? json?.user?.email ?? "");
          setSelectedAgentId(json?.userId ?? null);
        }
      } catch { /* ignore */ }
      setUserResolved(true);
    })();
  }, []);

  // Load agent list
  useEffect(() => {
    if (!userResolved || !userId) return;
    (async () => {
      try {
        const res = await fetch(`/api/company/${companyId}/data-center/users`, {
          headers: { "x-user-id": userId },
        });
        if (res.ok) {
          const json = await res.json();
          const list = (json?.data?.agents as AgentOption[]) ?? [];
          setAgents(list);
          // If user is in the list, they're an agent; if not in list or many agents, probably admin
          setIsAdmin(list.length > 1 || !list.find((a) => a.id === userId));
        }
      } catch { /* ignore */ }
    })();
  }, [companyId, userId, userResolved]);

  // Load data for selected agent
  const fetchAgentData = useCallback(async () => {
    if (!selectedAgentId || !userId) return;
    setLoading(true);
    const h: HeadersInit = { "x-user-id": userId };
    try {
      const [kpiRes, callRes, custRes] = await Promise.all([
        fetch(`/api/company/${companyId}/data-center/kpis?agentUserId=${selectedAgentId}`, { headers: h }),
        fetch(`/api/company/${companyId}/call-center/agent-dashboard/calls?agentUserId=${selectedAgentId}&limit=50`),
        fetch(`/api/company/${companyId}/call-center/agent-dashboard/customers?agentUserId=${selectedAgentId}&pageSize=50${customerSearch ? `&search=${encodeURIComponent(customerSearch)}` : ""}${customerSegment !== "all" ? `&segment=${customerSegment}` : ""}`),
      ]);
      if (kpiRes.ok) { const j = await kpiRes.json(); setKpis(j.data ?? j); }
      if (callRes.ok) { const j = await callRes.json(); setCalls(j.calls ?? []); }
      if (custRes.ok) {
        const j = await custRes.json();
        setCustomers(j.data ?? []);
        setCustomerTotal(j.meta?.total ?? 0);
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [companyId, selectedAgentId, userId, customerSearch, customerSegment]);

  useEffect(() => { if (userResolved) fetchAgentData(); }, [fetchAgentData, userResolved]);

  async function placeCall(toNumber: string, customerId?: string) {
    if (!toNumber || callingNumber) return;
    setCallingNumber(toNumber);
    try {
      const res = await fetch(`/api/company/${companyId}/call-center/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toNumber: toNumber.trim(),
          toEntityType: customerId ? "customer" : null,
          toEntityId: customerId ?? null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body?.error ?? "Failed to place call");
      }
    } catch {
      alert("Failed to place call");
    } finally {
      setCallingNumber(null);
    }
  }

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);
  const agentDisplayName = selectedAgent?.name || userName || "Agent";

  return (
    <AppLayout>
      <div className={`p-4 md:p-6 transition-all duration-300 ${showAI ? "xl:pr-[440px]" : ""}`}>
        {/* ── Header ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-5">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-sm font-bold text-white">
                {agentDisplayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">{agentDisplayName}</h1>
                <p className="text-xs text-zinc-500">Agent Dashboard</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && agents.length > 0 && (
              <select
                value={selectedAgentId ?? ""}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="rounded-lg border border-zinc-700/50 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-300 focus:border-blue-500/50 focus:outline-none max-w-[200px]"
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name || a.email}</option>
                ))}
              </select>
            )}
            <button onClick={fetchAgentData} className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition">
              Refresh
            </button>
            <button
              onClick={() => setShowAI(!showAI)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition flex items-center gap-1.5 ${
                showAI ? "border-purple-500/50 bg-purple-500/10 text-purple-400" : "border-zinc-700/50 bg-zinc-900/80 text-zinc-400 hover:text-purple-400"
              }`}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
              AI
            </button>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        {kpis && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6 mb-5">
            <KpiCard label="Assigned" value={String(kpis.activeCustomers ?? kpis.assignedCustomers ?? 0)} color="text-blue-400" />
            <KpiCard label="Contacted" value={String(kpis.contactedCustomers ?? 0)} color="text-emerald-400" />
            <KpiCard label="Pending" value={String(kpis.pendingCustomers ?? 0)} color="text-amber-400" />
            <KpiCard label="Total Calls" value={String(kpis.totalCalls ?? 0)} color="text-white" />
            <KpiCard label="Answer Rate" value={`${kpis.answeredRate ?? 0}%`} color={(kpis.answeredRate ?? 0) >= 80 ? "text-emerald-400" : (kpis.answeredRate ?? 0) >= 50 ? "text-amber-400" : "text-red-400"} />
            <KpiCard label="Avg Duration" value={formatDuration(kpis.avgCallDurationSeconds ?? 0)} color="text-zinc-300" />
          </div>
        )}

        {/* ── Tab Bar ── */}
        <div className="flex gap-1 border-b border-zinc-800/60 mb-4">
          {(["calls", "customers"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
                activeTab === tab ? "border-blue-500 text-blue-400" : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab === "calls" ? `Call History (${calls.length})` : `Customers (${customerTotal})`}
            </button>
          ))}
        </div>

        {/* ── Call History Tab ── */}
        {activeTab === "calls" && (
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800/40 text-[11px] uppercase tracking-wider text-zinc-600">
                    <th className="px-3 py-2.5 text-left">Time</th>
                    <th className="px-3 py-2.5 text-left">Direction</th>
                    <th className="px-3 py-2.5 text-left">From</th>
                    <th className="px-3 py-2.5 text-left">To</th>
                    <th className="px-3 py-2.5 text-left">Customer</th>
                    <th className="px-3 py-2.5 text-left">Status</th>
                    <th className="px-3 py-2.5 text-right">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/30">
                  {loading && <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-600"><div className="inline-flex items-center gap-2"><div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500" />Loading...</div></td></tr>}
                  {!loading && calls.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-600">No calls found</td></tr>}
                  {calls.map((c) => (
                    <tr key={c.id} className="hover:bg-zinc-800/20 transition-colors">
                      <td className="px-3 py-2 text-zinc-400 text-xs whitespace-nowrap" title={new Date(c.created_at).toLocaleString()}>
                        {timeAgo(c.created_at)}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 text-xs ${c.direction === "inbound" ? "text-green-400" : "text-blue-400"}`}>
                          {c.direction === "inbound" ? (
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                          ) : (
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                          )}
                          {c.direction}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-zinc-300 font-mono text-xs">{c.from_number}</td>
                      <td className="px-3 py-2 text-zinc-300 font-mono text-xs">{c.to_number}</td>
                      <td className="px-3 py-2 text-zinc-200 text-xs">{c.customer_name || <span className="text-zinc-600">-</span>}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusBg(c.status)}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-400 font-mono text-xs">{formatDuration(c.duration_seconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Customers Tab ── */}
        {activeTab === "customers" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Search customers..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="w-full max-w-sm rounded-lg border border-zinc-700/50 bg-zinc-900/80 px-3 py-1.5 text-sm text-zinc-300 placeholder:text-zinc-600 focus:border-blue-500/50 focus:outline-none"
              />
              {["all", "chsc", "non_chsc", "insurance"].map((seg) => (
                <button
                  key={seg}
                  onClick={() => setCustomerSegment(seg)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    customerSegment === seg
                      ? "border-blue-500/50 bg-blue-500/10 text-blue-400"
                      : "border-zinc-700/50 bg-zinc-900/80 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {seg === "all" ? "All" : seg === "chsc" ? "CHSC" : seg === "non_chsc" ? "Non-CHSC" : "Insurance"}
                </button>
              ))}
            </div>
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800/40 text-[11px] uppercase tracking-wider text-zinc-600">
                      <th className="px-3 py-2.5 text-left">Customer</th>
                      <th className="px-3 py-2.5 text-left">Phone</th>
                      <th className="px-3 py-2.5 text-left">Email</th>
                      <th className="px-3 py-2.5 text-left">Segment</th>
                      <th className="px-3 py-2.5 text-left">Assigned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/30">
                    {loading && <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-600"><div className="inline-flex items-center gap-2"><div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500" />Loading...</div></td></tr>}
                    {!loading && customers.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-600">No assigned customers</td></tr>}
                    {customers.map((c, i) => (
                      <tr key={i} className="hover:bg-zinc-800/20 transition-colors">
                        <td className="px-3 py-2">
                          <button
                            onClick={() => router.push(`/company/${companyId}/customers/${c.customer_id}`)}
                            className="text-left hover:underline"
                          >
                            <div className="font-medium text-blue-400 hover:text-blue-300 text-xs">{c.customer_name}</div>
                            <div className="text-[10px] text-zinc-600">{c.customer_code}</div>
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          {c.customer_phone ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-zinc-400 font-mono text-xs">{c.customer_phone}</span>
                              <button
                                onClick={() => placeCall(c.customer_phone!)}
                                disabled={callingNumber === c.customer_phone}
                                className="rounded p-1 text-zinc-600 hover:text-emerald-400 hover:bg-emerald-500/10 transition disabled:opacity-50"
                                title={`Call ${c.customer_phone}`}
                              >
                                {callingNumber === c.customer_phone ? (
                                  <div className="h-3 w-3 animate-spin rounded-full border border-zinc-600 border-t-emerald-400" />
                                ) : (
                                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                )}
                              </button>
                            </div>
                          ) : <span className="text-zinc-600 text-xs">-</span>}
                        </td>
                        <td className="px-3 py-2 text-zinc-400 text-xs truncate max-w-[160px]">{c.customer_email || "-"}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase ${segmentBadge(c.segment)}`}>
                            {c.segment}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-zinc-500 text-xs">{new Date(c.assigned_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── AI Sidebar (fixed right) ── */}
      {showAI && (
        <div className="hidden xl:block fixed top-[100px] right-0 h-[calc(100vh-100px)] w-[420px] z-30 border-l border-purple-500/10 bg-zinc-950/98 backdrop-blur-xl shadow-2xl shadow-purple-950/20 rounded-tl-xl">
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-500/5 to-transparent border-b border-zinc-800/40">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/15">
                <svg className="h-3.5 w-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
              </div>
              <div>
                <div className="text-sm font-semibold text-zinc-100">AI Coaching</div>
                <div className="text-[10px] text-zinc-500">Performance + Coaching Signals</div>
              </div>
            </div>
            <button onClick={() => setShowAI(false)} className="rounded-lg p-1.5 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/50 transition">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="overflow-y-auto h-[calc(100vh-100px-57px)] px-3 py-3 [&_.grid]:!grid-cols-1 [&_.sm\:grid-cols-2]:!grid-cols-1">
            <AIPanel companyId={companyId} engines={["e2", "e7"] as any} />
          </div>
        </div>
      )}
    </AppLayout>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-zinc-800/50 bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 p-3 hover:border-zinc-700/50 transition-colors">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-1">{label}</div>
      <div className={`text-lg font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
