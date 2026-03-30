"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { AIPanel } from "../../../../(components)/intelligence/AIPanel";

interface Agent { id: string; fullName: string; email: string; }
interface Lead { id: string; customer_name: string; customer_phone: string; lead_status: string; lead_type: string; source: string; created_at: string; checkinAt?: string | null; carPlateNumber?: string | null; carModel?: string | null; branchName?: string | null; serviceType?: string | null; leadStage?: string | null; }
interface Customer { id: string; name: string; phone: string; email: string; segment: string; assigned_at: string; }
interface Call { id: string; direction: string; from_number: string; to_number: string; status: string; duration_seconds: number | null; created_at: string; customer_name: string | null; }

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

export default function PisAdvisorPortalPage() {
  const { companyId } = useParams();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [tab, setTab] = useState<"leads" | "customers" | "calls" | "car-in">("leads");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [search, setSearch] = useState("");

  // KPIs
  const [kpis, setKpis] = useState<{ assigned: number; contacted: number; pending: number; totalCalls: number; answerRate: number }>({ assigned: 0, contacted: 0, pending: 0, totalCalls: 0, answerRate: 0 });

  // Load agents list
  useEffect(() => {
    fetch(`/api/company/${companyId}/admin/users?status=active&pageSize=500&department=${encodeURIComponent("Service Center Sales Department")}`)
      .then(r => r.json())
      .then(data => {
        const users = (data.data ?? data.users ?? []).map((u: any) => ({ id: u.id, fullName: u.fullName ?? u.full_name ?? u.email ?? "", email: u.email }));
        setAgents(users);
        if (users.length > 0) setSelectedAgent(users[0].id);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [companyId]);

  // Load data for selected agent from PIS advisor-portal API
  const loadAgentData = useCallback(async () => {
    if (!selectedAgent) return;
    setDataLoading(true);
    try {
      const r = await fetch(`/api/company/${companyId}/pis/advisor-portal?advisorUserId=${selectedAgent}`);
      const data = await r.json();

      setLeads(data.leads ?? []);
      setCalls(data.calls ?? []);
      setCustomers([]); // customers come from data-center, not needed here
      const k = data.kpis ?? {};
      setKpis({
        assigned: k.totalLeads ?? 0,
        contacted: k.convertedLeads ?? 0,
        pending: k.carInLeads ?? 0,
        totalCalls: k.totalCalls ?? 0,
        answerRate: k.answerRate ?? 0,
      });
    } catch (e) { console.error(e); }
    setDataLoading(false);
  }, [companyId, selectedAgent]);

  useEffect(() => { loadAgentData(); }, [loadAgentData]);

  if (loading) return <div className="text-slate-400 py-8">Loading advisors...</div>;

  const selectedName = agents.find(a => a.id === selectedAgent)?.fullName ?? "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Advisor Portal</h2>
          <p className="text-xs text-slate-500">Manage leads, customers, and follow-up calls per advisor</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Agent Selector */}
          <select
            value={selectedAgent ?? ""}
            onChange={e => setSelectedAgent(e.target.value)}
            className="rounded-lg bg-slate-800 border border-white/20 px-3 py-2 text-xs text-white focus:border-amber-500/50 focus:outline-none"
          >
            {agents.map(a => (
              <option key={a.id} value={a.id}>{a.fullName}</option>
            ))}
          </select>
          <button onClick={() => setShowAi(!showAi)} className={`rounded-lg px-3 py-1.5 text-[10px] font-semibold ${showAi ? "bg-purple-500/20 text-purple-400" : "bg-slate-800 text-slate-400 hover:text-white"}`}>
            {showAi ? "Hide AI" : "AI Coaching"}
          </button>
          <button onClick={loadAgentData} className="rounded-lg bg-slate-800 px-3 py-1.5 text-[10px] font-semibold text-slate-400 hover:text-white">Refresh</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { l: "Total Leads", v: kpis.assigned, c: "text-white" },
          { l: "Converted", v: kpis.contacted, c: "text-emerald-400" },
          { l: "Car-In", v: kpis.pending, c: "text-amber-400" },
          { l: "Total Calls", v: kpis.totalCalls, c: "text-cyan-400" },
          { l: "Answer Rate", v: `${kpis.answerRate}%`, c: kpis.answerRate >= 80 ? "text-emerald-400" : "text-red-400" },
        ].map(k => (
          <div key={k.l} className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-black/90 p-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">{k.l}</div>
            <div className={`text-lg font-bold ${k.c}`}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {([["leads", "Leads", leads.length], ["car-in", "Car-In", leads.filter(l => l.lead_status === "car_in" || l.checkinAt).length], ["customers", "Customers", customers.length], ["calls", "Calls", calls.length]] as const).map(([key, label, count]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold ${tab === key ? "bg-amber-500/20 text-amber-400" : "bg-slate-800 text-slate-400 hover:text-white"}`}>
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
        className="w-full sm:w-72 rounded-lg bg-slate-800 border border-white/20 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-amber-500/50 focus:outline-none"
      />

      <div className={`${showAi ? "grid grid-cols-1 lg:grid-cols-3 gap-6" : ""}`}>
        <div className={`${showAi ? "lg:col-span-2" : ""}`}>
          {dataLoading ? <div className="text-slate-400 py-4">Loading {tab}...</div> : (
            <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-black/90 overflow-hidden">
              {/* LEADS TAB */}
              {tab === "leads" && (
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-white/10 text-left">
                    {["Customer", "Phone", "Status", "Type", "Source", "Created"].map(h => (
                      <th key={h} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {leads.filter(l => !search || [l.customer_name, l.customer_phone].some(v => v?.toLowerCase().includes(search.toLowerCase()))).map(l => (
                      <tr key={l.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="px-3 py-2 text-white font-medium">{l.customer_name ?? "—"}</td>
                        <td className="px-3 py-2 text-slate-300 font-mono">{l.customer_phone ?? "—"}</td>
                        <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-[9px] font-bold ${STATUS_STYLES[l.lead_status] ?? "bg-slate-500/15 text-slate-400"}`}>{l.lead_status}</span></td>
                        <td className="px-3 py-2 text-slate-300">{l.lead_type}</td>
                        <td className="px-3 py-2 text-slate-400">{l.source ?? "—"}</td>
                        <td className="px-3 py-2 text-slate-500">{timeAgo(l.created_at)}</td>
                      </tr>
                    ))}
                    {leads.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">No leads for {selectedName}</td></tr>}
                  </tbody>
                </table>
              )}

              {/* CUSTOMERS TAB */}
              {tab === "customers" && (
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-white/10 text-left">
                    {["Customer", "Phone", "Email", "Segment", "Assigned"].map(h => (
                      <th key={h} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {customers.filter(c => !search || [c.name, c.phone, c.email].some(v => v?.toLowerCase().includes(search.toLowerCase()))).map(c => (
                      <tr key={c.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="px-3 py-2 text-white font-medium">{c.name ?? "—"}</td>
                        <td className="px-3 py-2 text-slate-300 font-mono">{c.phone ?? "—"}</td>
                        <td className="px-3 py-2 text-slate-400">{c.email ?? "—"}</td>
                        <td className="px-3 py-2"><span className="px-2 py-0.5 rounded text-[9px] font-bold bg-slate-700 text-slate-300">{c.segment ?? "—"}</span></td>
                        <td className="px-3 py-2 text-slate-500">{c.assigned_at ? timeAgo(c.assigned_at) : "—"}</td>
                      </tr>
                    ))}
                    {customers.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">No customers assigned to {selectedName}</td></tr>}
                  </tbody>
                </table>
              )}

              {/* CALLS TAB */}
              {tab === "calls" && (
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-white/10 text-left">
                    {["Time", "Direction", "From", "To", "Customer", "Status", "Duration"].map(h => (
                      <th key={h} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {calls.filter(c => !search || [c.customer_name, c.from_number, c.to_number].some(v => v?.toLowerCase().includes(search.toLowerCase()))).map(c => (
                      <tr key={c.id} className="border-b border-white/5 hover:bg-white/5">
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
                    {calls.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">No calls for {selectedName}</td></tr>}
                  </tbody>
                </table>
              )}

              {/* CAR-IN TAB */}
              {tab === "car-in" && (() => {
                const carInLeads = leads.filter(l => l.lead_status === "car_in" || l.checkinAt);
                const filtered = carInLeads.filter(l => !search || [l.customer_name, l.customer_phone, l.carPlateNumber, l.carModel].some(v => v?.toLowerCase().includes(search.toLowerCase())));
                return (
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-white/10 text-left">
                      {["Customer", "Phone", "Plate", "Car Model", "Status", "Stage", "Branch", "Checked In", "Service"].map(h => (
                        <th key={h} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {filtered.map(l => (
                        <tr key={l.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-3 py-2 text-white font-medium">{l.customer_name ?? "—"}</td>
                          <td className="px-3 py-2 text-slate-300 font-mono">{l.customer_phone ?? "—"}</td>
                          <td className="px-3 py-2 text-amber-400 font-mono font-bold">{l.carPlateNumber ?? "—"}</td>
                          <td className="px-3 py-2 text-slate-300">{l.carModel ?? "—"}</td>
                          <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-[9px] font-bold ${STATUS_STYLES[l.lead_status] ?? "bg-slate-500/15 text-slate-400"}`}>{l.lead_status}</span></td>
                          <td className="px-3 py-2 text-slate-400">{l.leadStage ?? "—"}</td>
                          <td className="px-3 py-2 text-slate-400">{l.branchName ?? "—"}</td>
                          <td className="px-3 py-2 text-emerald-400">{l.checkinAt ? timeAgo(l.checkinAt) : "—"}</td>
                          <td className="px-3 py-2 text-slate-400">{l.serviceType ?? l.lead_type ?? "—"}</td>
                        </tr>
                      ))}
                      {filtered.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-500">No car-in records for {selectedName}</td></tr>}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          )}
        </div>

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
