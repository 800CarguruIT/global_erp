"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AppLayout,
  CallStatsOverview,
  RecentCallsTable,
  DialerListWithTestCall,
  Card,
  useI18n,
  useTheme,
} from "@repo/ui";
import { useRouter } from "next/navigation";

type Summary = {
  stats: {
    totalCallsToday: number;
    answeredToday: number;
    missedToday: number;
    outboundToday: number;
  };
  recentCalls: Array<{
    id: string;
    companyName?: string | null;
    from: string;
    to: string;
    direction: "inbound" | "outbound";
    status: string;
    startedAt: string;
    durationSeconds?: number | null;
  }>;
  activeDialers: Array<{
    id: string;
    label: string;
    provider: string;
    level: "global" | "company";
    companyName?: string | null;
  }>;
};

async function fetchSummary(): Promise<Summary> {
  const res = await fetch("/api/global/call-center/summary", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load call center summary");
  return res.json();
}

export default function GlobalCallCenterPage() {
  return (
    <AppLayout>
      <CallCenterContent />
    </AppLayout>
  );
}

function CallCenterContent() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lookupTerm, setLookupTerm] = useState("");
  const [lookupResults, setLookupResults] = useState<any[]>([]);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState<{ role: string; text: string }[]>([]);
  const [liveSuggestions, setLiveSuggestions] = useState<string[]>([]);
  const [liveAppreciation, setLiveAppreciation] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<"idle" | "connecting" | "live">("idle");
  const [liveCallId, setLiveCallId] = useState("");
  const [activeCalls, setActiveCalls] = useState<
    Array<{ id: string; provider_call_id?: string | null; from_number?: string | null; to_number?: string | null; direction?: string | null; status?: string | null }>
  >([]);
  const { theme, surfaceSubtle, cardBorder, card } = useTheme();
  const { t } = useI18n();
  const router = useRouter();

  useEffect(() => {
    fetchSummary()
      .then(setSummary)
      .catch(() => setError(t("call.main.error")));
  }, [t]);

  useEffect(() => {
    async function loadActive() {
      try {
        const res = await fetch("/api/global/call-center/active", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        setActiveCalls(Array.isArray(data) ? data : data.data ?? []);
      } catch {
        // ignore
      }
    }
    loadActive();
    const id = setInterval(loadActive, 5000);
    return () => clearInterval(id);
  }, []);

  function connectLive(callId: string) {
    if (!callId) return;
    setLiveTranscript([]);
    setLiveSuggestions([]);
    setLiveAppreciation(null);
    setLiveStatus("connecting");
    const es = new EventSource(`/api/global/call-center/live/${encodeURIComponent(callId)}`);
    es.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.type === "transcript") {
          setLiveTranscript((prev) => [...prev.slice(-30), { role: data.role, text: data.text }]);
        } else if (data.type === "suggestion") {
          setLiveSuggestions((prev) => [...prev.slice(-10), data.text]);
        } else if (data.type === "appreciation") {
          setLiveAppreciation(data.text);
        }
        setLiveStatus("live");
      } catch {
        // ignore parse errors
      }
    };
    es.onerror = () => {
      setLiveStatus("idle");
      es.close();
    };
    return es;
  }

  const dialers = summary?.activeDialers ?? [];
  const recentCalls = summary?.recentCalls ?? [];
  const stats = summary?.stats;
  const incomingCalls = useMemo(() => recentCalls.filter((c) => c.direction === "inbound"), [recentCalls]);

  async function onTestCall(args: { integrationId: string; to: string; from?: string }) {
    const res = await fetch("/api/global/call-center/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromNumber: args.from,
        toNumber: args.to,
        providerKey: dialers.find((d) => d.id === args.integrationId)?.provider ?? "",
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error ?? "Failed to place call");
    }
  }

  async function handleManualLookup() {
    if (!lookupTerm.trim()) return;
    setLookupLoading(true);
    setLookupError(null);
    setLookupResults([]);
    const query = lookupTerm.trim();
    try {
      const res = await fetch(`/api/global/call-center/dashboard?search=${encodeURIComponent(query)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(t("call.main.manual.error"));
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.data ?? data.result ?? [];
      setLookupResults(list);
    } catch (err: any) {
      setLookupError(err?.message ?? t("call.main.manual.error"));
    } finally {
      setLookupLoading(false);
    }
  }

  return (
    <div className={`space-y-6 py-4 ${surfaceSubtle}`}>
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-semibold">{t("call.main.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("call.main.subtitle")}</p>
      </div>

      {stats ? (
        <CallStatsOverview {...stats} />
      ) : (
        <p className="text-sm text-destructive">{error ?? t("call.main.error")}</p>
      )}

      <Card className={`${cardBorder} ${card}`}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">{t("call.main.manual.heading")}</div>
            <span className="text-xs text-primary">Phone or trade license</span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              className={`${theme.input} flex-1`}
              placeholder="Enter phone number or trade license"
              value={lookupTerm}
              onChange={(e) => setLookupTerm(e.target.value)}
            />
            <button
              className={`rounded-md px-4 py-2 text-sm text-white disabled:opacity-50 bg-gradient-to-r ${theme.accent}`}
              onClick={handleManualLookup}
              disabled={!lookupTerm.trim() || lookupLoading}
            >
              {lookupLoading ? t("call.main.manual.button.searching") : t("call.main.manual.button.search")}
            </button>
          </div>
          {lookupError && <div className="text-xs text-destructive">{lookupError}</div>}
          {lookupResults.length > 0 && (
            <div className={`space-y-2 rounded-lg ${theme.cardBorder} ${theme.surfaceSubtle} p-3`}>
              {lookupResults.map((row: any, idx) => (
                <div
                  key={row.id ?? idx}
                  className="flex flex-col gap-1 text-sm border-b border-border/60 last:border-0 pb-2 last:pb-0"
                >
                  <div className="font-semibold">{row.name ?? row.displayName ?? row.companyName ?? "Result"}</div>
                  <div className="text-xs text-muted-foreground">
                    {row.phone ?? row.number ?? row.tradeLicense ?? row.trade_license_number ?? ""}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Link
                      href={`/global/leads/new?companyId=${encodeURIComponent(
                        row.companyId ?? ""
                      )}&companyName=${encodeURIComponent(
                        row.name ?? ""
                      )}&phone=${encodeURIComponent(row.phone ?? "")}&email=${encodeURIComponent(row.email ?? "")}`}
                      className="rounded-full border px-3 py-1 hover:border-primary"
                    >
                      Create lead
                    </Link>
                    {row.leadId && (
                      <Link href={`/global/leads/${row.leadId}`} className="rounded-full border px-3 py-1 hover:border-primary">
                        Open lead
                      </Link>
                    )}
                    {row.companyId && (
                      <Link href={`/company/${row.companyId}`} className="rounded-full border px-3 py-1 hover:border-primary">
                        View company
                      </Link>
                    )}
                    {row.id && (
                      <Link href={`/global/companies/${row.id}`} className="rounded-full border px-3 py-1 hover:border-primary">
                        Details
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {!lookupLoading && lookupResults.length === 0 && lookupTerm.trim() && !lookupError && (
            <div className="text-xs text-muted-foreground">{t("call.main.manual.empty")}</div>
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-3">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold">AI intercept</div>
              <div className="text-xs text-muted-foreground">Connect to a live call to see transcript and suggestions.</div>
            </div>
            <span className="text-xs text-muted-foreground">
              Status: {liveStatus === "live" ? "Live" : liveStatus === "connecting" ? "Connecting..." : "Idle"}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <div className="text-sm font-semibold">Active calls</div>
              <div className="rounded-lg border p-2 max-h-48 overflow-auto space-y-1">
                {activeCalls.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No active calls.</div>
                ) : (
                  activeCalls.map((c) => {
                    const id = c.provider_call_id || c.id;
                    return (
                      <button
                        key={id}
                        className={`w-full text-left rounded-md px-2 py-1 text-sm transition ${
                          liveCallId === id ? "bg-primary/10 border border-primary" : "hover:bg-muted"
                        }`}
                        onClick={() => {
                          setLiveCallId(id ?? "");
                          connectLive(id ?? "");
                        }}
                      >
                        <div className="font-semibold">{id}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.direction ?? ""} {c.from_number ?? ""} → {c.to_number ?? ""} ({c.status ?? ""})
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
            <div className="md:col-span-2 flex flex-col gap-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  className={`${theme.input} flex-1`}
                  placeholder="Enter active call ID"
                  value={liveCallId}
                  onChange={(e) => setLiveCallId(e.target.value)}
                />
                <button
                  className={`rounded-md px-3 py-2 text-sm text-white bg-gradient-to-r ${theme.accent} disabled:opacity-50`}
                  onClick={() => connectLive(liveCallId.trim())}
                  disabled={!liveCallId.trim()}
                >
                  Connect
                </button>
              </div>
              <div className="text-xs text-muted-foreground">
                Select from active list or paste a call ID to monitor in real-time.
              </div>
            </div>
          </div>
            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-lg border p-3 space-y-2 col-span-2">
                <div className="text-sm font-semibold">Transcript</div>
                <div className="h-48 overflow-auto text-sm space-y-1">
                  {liveTranscript.length === 0 ? (
                    <div className="text-xs text-muted-foreground">Waiting for transcript…</div>
                  ) : (
                    liveTranscript.map((line, idx) => (
                      <div key={idx}>
                        <span className="text-muted-foreground text-[11px] uppercase mr-1">{line.role}:</span>
                        <span>{line.text}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="rounded-lg border p-3 space-y-2">
                <div className="text-sm font-semibold">Suggestions</div>
                <div className="text-sm space-y-1">
                  {liveSuggestions.length === 0 ? (
                    <div className="text-xs text-muted-foreground">AI will suggest replies here.</div>
                  ) : (
                    liveSuggestions.map((s, idx) => (
                      <div key={idx} className="rounded bg-muted/40 px-2 py-1 text-sm">
                        {s}
                      </div>
                    ))
                  )}
                </div>
                <div className="text-sm font-semibold pt-2">Appreciation</div>
                <div className="text-xs text-muted-foreground">
                  {liveAppreciation ?? "AI will note wins here."}
                </div>
              </div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">{t("call.main.incoming.title")}</div>
              <span className="text-xs text-primary">{t("call.main.incoming.helper")}</span>
            </div>
            <div className="space-y-2">
              {incomingCalls.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("call.main.incoming.empty")}</p>
              ) : (
                <div className="space-y-2">
                  {incomingCalls.map((call) => (
                    <div
                      key={call.id}
                      className={`rounded-lg ${theme.cardBorder} ${theme.surfaceSubtle} p-3 flex flex-col gap-2`}
                    >
                      <div className="flex items-center justify-between text-sm font-semibold">
                        <span>{call.from}</span>
                        <span className="text-xs text-muted-foreground">{call.status}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        To: {call.to} {call.companyName ? `• ${call.companyName}` : ""}
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <Link
                          href={`/global/leads/new?phone=${encodeURIComponent(call.from)}`}
                          className="rounded-full border px-3 py-1 hover:border-primary"
                        >
                          Create lead
                        </Link>
                        <Link
                          href={`/global/leads?phone=${encodeURIComponent(call.from)}`}
                          className="rounded-full border px-3 py-1 hover:border-primary"
                        >
                          Manage lead
                        </Link>
                        <Link
                          href={`/global/companies?search=${encodeURIComponent(call.from)}`}
                          className="rounded-full border px-3 py-1 hover:border-primary"
                        >
                          Link to company
                        </Link>
                        <Link href="/global/monitoring" className="rounded-full border px-3 py-1 hover:border-primary">
                          Pick up
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">{t("call.main.outgoing.title")}</div>
              <span className="text-xs text-primary">{t("call.main.outgoing.helper")}</span>
            </div>
            {dialers.length ? (
              <DialerListWithTestCall dialers={dialers} onTestCall={onTestCall} />
            ) : (
              <p className="text-sm text-muted-foreground">{t("call.main.outgoing.empty")}</p>
            )}
          </div>
        </Card>

        <Card>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">{t("call.main.leads.title")}</div>
              <span className="text-xs text-primary">{t("call.main.leads.helper")}</span>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <Link href="/global/leads/new" className="rounded-full border px-3 py-1 hover:border-primary">
                {t("call.main.leads.create")}
              </Link>
              <Link href="/global/leads" className="rounded-full border px-3 py-1 hover:border-primary">
                {t("call.main.leads.manage")}
              </Link>
            </div>
          </div>
        </Card>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">{t("call.main.recent.title")}</div>
          <Link href="/global/call-center/history" className="text-xs text-primary hover:underline">
            {t("call.main.recent.link")}
          </Link>
        </div>
        {recentCalls.length ? (
          <RecentCallsTable calls={recentCalls} showCompany />
        ) : (
          <p className="text-sm text-muted-foreground">{t("call.main.recent.empty")}</p>
        )}
      </div>
    </div>
  );
}
