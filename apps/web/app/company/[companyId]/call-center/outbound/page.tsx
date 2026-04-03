"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AppLayout } from "@repo/ui";

// ─── Types ────────────────────────────────────────────────────────────────────

type Dialer = { id: string; label: string; provider: string };

type CallStatus = "idle" | "initiated" | "ringing" | "in_progress" | "completed" | "failed" | "cancelled";

type ActiveCall = {
  sessionId: string;
  toNumber: string;
  customerName: string | null;
  status: CallStatus;
  startedAt: Date;
  providerCallId: string | null;
};

type HistoryRow = {
  id: string;
  to: string;
  from: string;
  status: string;
  startedAt: string | null;
  durationSeconds: number | null;
  customer: { name: string | null; phone: string | null } | null;
  agent: { name: string | null } | null;
  recording: { url: string; durationSeconds: number | null } | null;
};

type LookupResult = {
  id: string;
  type: "customer" | "car";
  name: string | null;
  phone: string | null;
  email?: string | null;
  car?: string | null;
  carId?: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(secs: number | null): string {
  if (!secs) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function fmtTime(val: string | Date | null): string {
  if (!val) return "—";
  const d = typeof val === "string" ? new Date(val) : val;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    initiated: "bg-blue-500/20 text-blue-300",
    ringing: "bg-yellow-500/20 text-yellow-300 animate-pulse",
    in_progress: "bg-green-500/20 text-green-300 animate-pulse",
    completed: "bg-slate-500/20 text-slate-400",
    failed: "bg-red-500/20 text-red-400",
    cancelled: "bg-orange-500/20 text-orange-400",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${map[status] ?? "bg-slate-700 text-slate-400"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

// ─── Live Call Timer ──────────────────────────────────────────────────────────

function CallTimer({ startedAt, status }: { startedAt: Date; status: CallStatus }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (status !== "in_progress" && status !== "ringing") return;
    const iv = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, [startedAt, status]);
  return <span className="font-mono text-sm text-green-300">{fmtDuration(elapsed)}</span>;
}

// ─── Dial Pad ─────────────────────────────────────────────────────────────────

function DialPad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];
  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(value + k)}
          className="rounded-xl bg-slate-700/60 border border-border py-3 text-base font-semibold text-slate-200 hover:bg-slate-600/80 active:scale-95 transition-all"
        >
          {k}
        </button>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OutboundDialerPage({
  params,
}: {
  params: { companyId: string } | Promise<{ companyId: string }>;
}) {
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve(params).then((p) => setCompanyId(p?.companyId ?? null));
  }, [params]);

  return (
    <AppLayout>
      {companyId ? <DialerContent companyId={companyId} /> : (
        <div className="py-4 text-sm text-slate-400">Loading…</div>
      )}
    </AppLayout>
  );
}

function DialerContent({ companyId }: { companyId: string }) {
  // ── Dialers ──
  const [dialers, setDialers] = useState<Dialer[]>([]);
  const [selectedDialerId, setSelectedDialerId] = useState<string>("");

  // ── Dial input ──
  const [dialNumber, setDialNumber] = useState("");
  const [showPad, setShowPad] = useState(false);
  const [calling, setCalling] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);

  // ── Active call ──
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Customer lookup ──
  const [lookupTerm, setLookupTerm] = useState("");
  const [lookupResults, setLookupResults] = useState<LookupResult[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);

  // ── History ──
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── Load dialers ──
  useEffect(() => {
    fetch(`/api/company/${companyId}/call-center/summary`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const list: Dialer[] = d.activeDialers ?? [];
        setDialers(list);
        if (list.length > 0) setSelectedDialerId(list[0].id);
      })
      .catch(() => {});
  }, [companyId]);

  // ── Load outbound history ──
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/company/${companyId}/call-center/history?direction=outbound&limit=30`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setHistory(json.data ?? []);
      }
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  // ── Poll active call status via history endpoint ──
  const startPolling = useCallback((sessionId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/company/${companyId}/call-center/history?direction=outbound&limit=10`, { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        const rows: HistoryRow[] = json.data ?? [];
        const match = rows.find((r) => r.id === sessionId);
        if (match) {
          const status: CallStatus = match.status as CallStatus;
          setActiveCall((prev) => prev ? { ...prev, status } : null);
          if (status === "completed" || status === "failed" || status === "cancelled") {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            setHistory(rows);
            setTimeout(() => setActiveCall(null), 5000);
          }
        }
      } catch {
        // ignore
      }
    }, 3000);
  }, [companyId]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // ── Customer lookup ──
  async function handleLookup() {
    if (!lookupTerm.trim()) return;
    setLookupLoading(true);
    setLookupResults([]);
    try {
      const res = await fetch(
        `/api/company/${companyId}/call-center/dashboard?search=${encodeURIComponent(lookupTerm.trim())}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        const list = (Array.isArray(data) ? data : data.data ?? data.result ?? []).filter(
          (row: any) => row?.isActive !== false
        );
        setLookupResults(list);
      }
    } catch {
      // ignore
    } finally {
      setLookupLoading(false);
    }
  }

  // ── Place call ──
  async function placeCall(toNumber: string, customerName: string | null = null, entityId: string | null = null) {
    const dialer = dialers.find((d) => d.id === selectedDialerId);
    if (!dialer) {
      setCallError("No dialer selected. Please configure a Yeastar integration first.");
      return;
    }
    if (!toNumber.trim()) {
      setCallError("Please enter a phone number.");
      return;
    }
    setCalling(true);
    setCallError(null);
    try {
      const res = await fetch(`/api/company/${companyId}/call-center/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toNumber: toNumber.trim(),
          providerKey: dialer.provider,
          toEntityType: entityId ? "customer" : null,
          toEntityId: entityId ?? null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Failed to place call");

      const session: ActiveCall = {
        sessionId: body.id,
        toNumber: toNumber.trim(),
        customerName,
        status: body.status ?? "initiated",
        startedAt: new Date(),
        providerCallId: body.providerCallId ?? null,
      };
      setActiveCall(session);
      setDialNumber("");
      setLookupResults([]);
      setLookupTerm("");
      startPolling(body.id);
    } catch (e: any) {
      setCallError(e.message ?? "Failed to place call");
    } finally {
      setCalling(false);
    }
  }

  const selectedDialer = dialers.find((d) => d.id === selectedDialerId);

  return (
    <div className="space-y-5 py-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <span>📤</span> Outbound Dialer
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">Make outbound calls via Yeastar PBX</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">Platform:</span>
          <span className="rounded-full bg-blue-500/20 border border-blue-500/30 px-2 py-0.5 text-blue-300 font-medium">Yeastar</span>
          {dialers.length === 0 && (
            <span className="rounded-full bg-red-500/20 border border-red-500/30 px-2 py-0.5 text-red-400">No active dialer</span>
          )}
        </div>
      </div>

      {/* ── Active Call Banner ── */}
      {activeCall && (
        <div className={`rounded-xl border p-4 flex items-center justify-between gap-4 ${
          activeCall.status === "in_progress"
            ? "border-green-500/40 bg-green-500/10"
            : activeCall.status === "completed"
            ? "border-slate-500/30 bg-slate-500/10"
            : activeCall.status === "failed"
            ? "border-red-500/40 bg-red-500/10"
            : "border-yellow-500/40 bg-yellow-500/10"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${
              activeCall.status === "in_progress" ? "bg-green-400 animate-pulse" :
              activeCall.status === "ringing" ? "bg-yellow-400 animate-pulse" :
              activeCall.status === "completed" ? "bg-slate-400" :
              activeCall.status === "failed" ? "bg-red-400" : "bg-blue-400"
            }`} />
            <div>
              <div className="text-sm font-semibold text-foreground">
                {activeCall.customerName ?? activeCall.toNumber}
              </div>
              {activeCall.customerName && (
                <div className="text-[11px] text-slate-400">{activeCall.toNumber}</div>
              )}
            </div>
            <StatusPill status={activeCall.status} />
          </div>
          <div className="flex items-center gap-4">
            {(activeCall.status === "in_progress" || activeCall.status === "ringing") && (
              <CallTimer startedAt={activeCall.startedAt} status={activeCall.status} />
            )}
            {activeCall.status === "completed" && (
              <span className="text-xs text-green-400">✓ Call ended</span>
            )}
            {activeCall.status === "failed" && (
              <span className="text-xs text-red-400">✕ Call failed</span>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Left: Dialer Panel ── */}
        <div className="space-y-4">

          {/* Dialer selector */}
          {dialers.length > 0 && (
            <div className="rounded-xl border border-border bg-popover/60 p-4">
              <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">Active Dialer</div>
              <select
                value={selectedDialerId}
                onChange={(e) => setSelectedDialerId(e.target.value)}
                className="w-full rounded-lg border border-border bg-slate-800 text-sm text-slate-200 px-3 py-2 focus:outline-none focus:border-blue-500"
              >
                {dialers.map((d) => (
                  <option key={d.id} value={d.id}>{d.label} ({d.provider})</option>
                ))}
              </select>
            </div>
          )}

          {dialers.length === 0 && (
            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-xs text-yellow-300">
              <div className="font-semibold mb-1">⚠ No dialer configured</div>
              <p>Configure a Yeastar integration to enable outbound calling.</p>
              <Link
                href={`/company/${companyId}/integrations/dialer`}
                className="mt-2 inline-block text-blue-400 hover:underline"
              >
                → Configure Dialer Integration
              </Link>
            </div>
          )}

          {/* Manual dial */}
          <div className="rounded-xl border border-border bg-popover/60 p-4 space-y-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-400">Manual Dial</div>
            <div className="relative">
              <input
                type="tel"
                value={dialNumber}
                onChange={(e) => setDialNumber(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && placeCall(dialNumber)}
                placeholder="+971XXXXXXXXX"
                className="w-full rounded-xl border border-border bg-slate-800 text-center text-xl font-mono tracking-widest text-white px-4 py-3 focus:outline-none focus:border-blue-500 placeholder:text-slate-600"
              />
              {dialNumber && (
                <button
                  type="button"
                  onClick={() => setDialNumber(dialNumber.slice(0, -1))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-lg"
                  title="Backspace"
                >
                  ⌫
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowPad((v) => !v)}
              className="w-full text-xs text-slate-500 hover:text-slate-300 flex items-center justify-center gap-1"
            >
              {showPad ? "▲ Hide pad" : "▼ Show dial pad"}
            </button>

            {showPad && <DialPad value={dialNumber} onChange={setDialNumber} />}

            {callError && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-400">
                {callError}
              </div>
            )}

            <button
              type="button"
              onClick={() => placeCall(dialNumber)}
              disabled={calling || !dialNumber.trim() || dialers.length === 0 || !!activeCall}
              className="w-full rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed py-3 text-sm font-semibold text-white flex items-center justify-center gap-2 transition-colors"
            >
              {calling ? (
                <>
                  <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Dialing…
                </>
              ) : (
                <>📞 Call {dialNumber || "—"}</>
              )}
            </button>
          </div>
        </div>

        {/* ── Right: Customer Search + History ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Customer search */}
          <div className="rounded-xl border border-border bg-popover/60 p-4">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-3">Search Customer</div>
            <div className="flex gap-2">
              <input
                type="text"
                value={lookupTerm}
                onChange={(e) => setLookupTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                placeholder="Name, phone, or plate number…"
                className="flex-1 rounded-lg border border-border bg-slate-800 text-sm text-slate-200 px-3 py-2 focus:outline-none focus:border-blue-500 placeholder:text-slate-600"
              />
              <button
                type="button"
                onClick={handleLookup}
                disabled={lookupLoading}
                className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition-colors"
              >
                {lookupLoading ? "…" : "Search"}
              </button>
            </div>

            {lookupResults.length > 0 && (
              <div className="mt-3 space-y-2">
                {lookupResults.map((r) => {
                  const phone = r.phone ?? "";
                  return (
                    <div
                      key={r.id}
                      className="rounded-lg border border-border/40 bg-slate-800/60 px-3 py-2 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-sm font-medium text-slate-200">{r.name ?? phone}</div>
                        <div className="text-[11px] text-slate-500">{[phone, r.email, r.car].filter(Boolean).join(" · ")}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {r.type === "customer" && (
                          <Link
                            href={`/company/${companyId}/customers/${r.id}`}
                            className="text-[11px] text-blue-400 hover:underline"
                          >
                            Profile
                          </Link>
                        )}
                        {phone && (
                          <button
                            type="button"
                            onClick={() => {
                              setDialNumber(phone);
                              placeCall(phone, r.name, r.type === "customer" ? r.id : null);
                            }}
                            disabled={calling || dialers.length === 0 || !!activeCall}
                            className="rounded-lg bg-green-600/90 hover:bg-green-500 disabled:opacity-40 px-3 py-1 text-xs font-semibold text-white flex items-center gap-1 transition-colors"
                          >
                            📞 Call
                          </button>
                        )}
                        {!phone && (
                          <span className="text-[11px] text-slate-600 italic">No phone</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {lookupResults.length === 0 && lookupTerm && !lookupLoading && (
              <p className="mt-2 text-xs text-slate-600">No customers found.</p>
            )}
          </div>

          {/* Outbound History */}
          <div className="rounded-xl border border-border bg-popover/60 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] uppercase tracking-widest text-slate-400">Recent Outbound Calls</div>
              <button
                type="button"
                onClick={loadHistory}
                disabled={historyLoading}
                className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
              >
                {historyLoading ? "Loading…" : "↻ Refresh"}
              </button>
            </div>

            {history.length === 0 && !historyLoading && (
              <p className="text-xs text-slate-600 py-4 text-center">No outbound calls recorded yet.</p>
            )}

            {history.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] text-slate-500 border-b border-border/40 uppercase">
                      <th className="text-left py-2">Customer / Number</th>
                      <th className="text-left py-2">To</th>
                      <th className="text-right py-2">Status</th>
                      <th className="text-right py-2">Time</th>
                      <th className="text-right py-2">Duration</th>
                      <th className="text-right py-2">Agent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row) => (
                      <tr key={row.id} className="border-b border-border/40 hover:bg-muted/40 transition-colors">
                        <td className="py-2 pr-2">
                          <div className="font-medium text-slate-200">
                            {row.customer?.name ?? row.to}
                          </div>
                          {row.customer?.name && (
                            <div className="text-[10px] text-slate-500">{row.customer.phone ?? row.to}</div>
                          )}
                        </td>
                        <td className="py-2 pr-2 text-slate-400 font-mono">{row.to}</td>
                        <td className="py-2 text-right">
                          <StatusPill status={row.status} />
                        </td>
                        <td className="py-2 text-right text-slate-400">{fmtTime(row.startedAt)}</td>
                        <td className="py-2 text-right text-slate-400">{fmtDuration(row.durationSeconds)}</td>
                        <td className="py-2 text-right text-slate-500">{row.agent?.name ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
