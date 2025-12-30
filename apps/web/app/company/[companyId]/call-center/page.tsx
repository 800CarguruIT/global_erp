"use client";

import { useEffect, useState, useMemo } from "react";
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

type Summary = {
  stats: {
    totalCallsToday: number;
    answeredToday: number;
    missedToday: number;
    outboundToday: number;
  };
  recentCalls: Array<{
    id: string;
    customerName?: string | null;
    car?: string | null;
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
  }>;
};

async function fetchSummary(companyId: string): Promise<Summary> {
  const res = await fetch(`/api/company/${companyId}/call-center/summary`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load call center summary");
  return res.json();
}

function TestCallClient({ companyId, dialers }: { companyId: string; dialers: Summary["activeDialers"] }) {
  const { t } = useI18n();
  const { theme } = useTheme();
  const { cardBg, cardBorder } = theme;

  async function onTestCall(args: { integrationId: string; to: string; from?: string }) {
    const res = await fetch(`/api/company/${companyId}/call-center/call`, {
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

  return (
    <div className={`rounded-2xl p-4 ${cardBg} ${cardBorder}`}>
      <DialerListWithTestCall dialers={dialers} onTestCall={onTestCall} />
      <p className="mt-2 text-xs text-muted-foreground">{t("call.main.outgoing.empty")}</p>
    </div>
  );
}

export default function CompanyCallCenterPage({
  params,
}: {
  params: { companyId: string } | Promise<{ companyId: string }>;
}) {
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve(params).then((p) => setCompanyId(p?.companyId ?? null));
  }, [params]);

  return <AppLayout>{companyId ? <CallCenterContent companyId={companyId} /> : <LoadingCompany />}</AppLayout>;
}

function LoadingCompany() {
  const { t } = useI18n();
  return <div className="py-4 text-sm text-muted-foreground">{t("call.company.loading")}</div>;
}

function CallCenterContent({ companyId }: { companyId: string }) {
  const { t } = useI18n();
  const { theme } = useTheme();
  const { cardBg, cardBorder } = theme;
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lookupTerm, setLookupTerm] = useState("");
  const [lookupResults, setLookupResults] = useState<any[]>([]);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const dialers = summary?.activeDialers ?? [];
  const incoming = summary?.recentCalls?.filter((c) => c.direction === "inbound") ?? [];
  const [activeCalls, setActiveCalls] = useState<
    Array<{ id: string; provider_call_id?: string | null; from_number?: string | null; to_number?: string | null; direction?: string | null; status?: string | null }>
  >([]);
  const [liveCallId, setLiveCallId] = useState("");
  const [liveTranscript, setLiveTranscript] = useState<{ role: string; text: string }[]>([]);
  const [liveSuggestions, setLiveSuggestions] = useState<string[]>([]);
  const [liveAppreciation, setLiveAppreciation] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<"idle" | "connecting" | "live">("idle");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await fetchSummary(companyId);
        if (!cancelled) setSummary(data);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? t("call.main.manual.error"));
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [companyId, t]);

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

  return (
    <div className="space-y-6 py-4">
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-semibold">{t("call.company.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("call.company.subtitle")}</p>
      </div>
      {summary ? (
        <>
          <CallStatsOverview {...summary.stats} />

          <div className={`space-y-3 rounded-2xl ${cardBg} ${cardBorder} p-4`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-lg font-semibold">{t("call.main.manual.heading")}</div>
                <div className="text-sm text-muted-foreground">{t("call.main.manual.helper")}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  className={`${theme.input} w-64`}
                  placeholder={t("call.main.manual.placeholder")}
                  value={lookupTerm}
                  onChange={(e) => setLookupTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleLookup();
                  }}
                />
                <button
                  type="button"
                  onClick={handleLookup}
                  className="rounded-md border px-3 py-2 text-sm font-medium"
                  disabled={lookupLoading}
                >
                  {lookupLoading ? t("call.main.manual.button.searching") : t("call.main.manual.button.search")}
                </button>
              </div>
            </div>
            {lookupError && <div className="text-sm text-destructive">{lookupError}</div>}
            {lookupResults.length > 0 && (
              <div className="space-y-3">
                {lookupResults.map((row: any) => {
                  const phone = row.phone ?? "";
                  const email = row.email ?? "";
                  const plate = row.car ?? "";
                  const carId = row.carId ?? null;
                  const customerId = row.type === "customer" ? row.id ?? null : null;
                  const params = new URLSearchParams({
                    ...(phone ? { phone } : {}),
                    ...(plate ? { plate } : {}),
                    ...(carId ? { carId } : {}),
                    ...(customerId ? { customerId } : {}),
                  });
                  const createLeadHref = `/company/${companyId}/leads/new?${params.toString()}`;
                  const manageLeadsHref = `/company/${companyId}/leads${phone ? `?phone=${encodeURIComponent(phone)}` : ""}`;
                  return (
                    <div
                      key={`${row.type ?? "result"}-${row.id ?? row.car ?? Math.random()}`}
                      className={`rounded-lg p-3 ${cardBg} ${cardBorder}`}
                    >
                      <div className="flex flex-col gap-1">
                        <div className="text-sm font-semibold">{row.name ?? row.phone ?? t("call.main.manual.helper")}</div>
                        <div className="text-xs text-muted-foreground">
                          {[phone || email, plate].filter(Boolean).join(" • ")}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        {customerId ? (
                          <Link
                            href={`/company/${companyId}/customers/${customerId}`}
                            className="rounded-full border px-3 py-1 hover:border-primary"
                          >
                            {t("call.results.viewCustomer")}
                          </Link>
                        ) : (
                          <Link
                            href={`/company/${companyId}/customers/new?phone=${encodeURIComponent(phone)}`}
                            className="rounded-full border px-3 py-1 hover:border-primary"
                          >
                            {t("call.results.createCustomer")}
                          </Link>
                        )}
                        {carId ? (
                          <Link href={`/company/${companyId}/cars/${carId}`} className="rounded-full border px-3 py-1 hover:border-primary">
                            {t("call.results.viewCar")}
                          </Link>
                        ) : (
                          <Link
                            href={`/company/${companyId}/cars/new${customerId ? `?owner=${customerId}` : ""}`}
                            className="rounded-full border px-3 py-1 hover:border-primary"
                          >
                            {t("call.results.addCar")}
                          </Link>
                        )}
                        <Link href={createLeadHref} className="rounded-full border px-3 py-1 hover:border-primary">
                          {t("call.main.leads.create")}
                        </Link>
                        <Link href={manageLeadsHref} className="rounded-full border px-3 py-1 hover:border-primary">
                          {t("call.main.leads.manage")}
                        </Link>
                        {row.type === "car" && (
                          <Link
                            href={`/company/${companyId}/customers?search=${encodeURIComponent(plate || phone)}`}
                            className="rounded-full border px-3 py-1 hover:border-primary"
                          >
                            {t("call.results.linkCustomer")}
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {!lookupLoading && lookupResults.length === 0 && lookupTerm.trim() && !lookupError && (
              <div className="text-xs text-muted-foreground">{t("call.main.manual.empty")}</div>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-lg font-semibold">{t("call.main.incoming.title")}</div>
                  <span className="text-xs text-primary">{t("call.main.incoming.helper")}</span>
                </div>
                <div className="space-y-2">
                  {incoming.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("call.main.incoming.empty")}</p>
                  ) : (
                    <div className="space-y-2">
                      {incoming.map((call) => (
                        <div key={call.id} className={`rounded-lg p-3 flex flex-col gap-2 ${cardBg} ${cardBorder}`}>
                          <div className="flex items-center justify-between text-sm font-semibold">
                            <span>{call.from}</span>
                            <span className="text-xs text-muted-foreground">{call.status}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t("call.main.incoming.toLabel")} {call.to} {call.customerName ? ` • ${call.customerName}` : ""}
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <Link
                              href={`/company/${companyId}/leads/new?phone=${encodeURIComponent(call.from)}`}
                              className="rounded-full border px-3 py-1 hover:border-primary"
                            >
                              {t("call.main.leads.create")}
                            </Link>
                            <Link
                              href={`/company/${companyId}/leads?phone=${encodeURIComponent(call.from)}`}
                              className="rounded-full border px-3 py-1 hover:border-primary"
                            >
                              {t("call.main.leads.manage")}
                            </Link>
                            <Link
                              href={`/company/${companyId}/customers?search=${encodeURIComponent(call.from)}`}
                              className="rounded-full border px-3 py-1 hover:border-primary"
                            >
                              {t("call.results.linkCustomer")}
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
                  <TestCallClient companyId={companyId} dialers={dialers} />
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
                  <Link href={`/company/${companyId}/leads/new`} className="rounded-full border px-3 py-1 hover:border-primary">
                    {t("call.main.leads.create")}
                  </Link>
                  <Link href={`/company/${companyId}/leads`} className="rounded-full border px-3 py-1 hover:border-primary">
                    {t("call.main.leads.manage")}
                  </Link>
                </div>
              </div>
            </Card>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">{t("call.main.recent.title")}</div>
              <Link href={`/company/${companyId}/call-center/history`} className="text-xs text-primary hover:underline">
                {t("call.main.recent.link")}
              </Link>
            </div>
            {summary.recentCalls.length ? (
              <RecentCallsTable calls={summary.recentCalls} showCompany={false} />
            ) : (
              <p className="text-sm text-muted-foreground">{t("call.main.recent.empty")}</p>
            )}
          </div>

          <Card className="lg:col-span-3">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold">{t("call.ai.title")}</div>
                  <div className="text-xs text-muted-foreground">{t("call.ai.subtitle")}</div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {t("call.ai.status")} {" "}
                  {liveStatus === "live"
                    ? t("call.ai.status.live")
                    : liveStatus === "connecting"
                    ? t("call.ai.status.connecting")
                    : t("call.ai.status.idle")}
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-2">
                  <div className="text-sm font-semibold">{t("call.ai.active")}</div>
                  <div className="rounded-lg border p-2 max-h-48 overflow-auto space-y-1">
                    {activeCalls.length === 0 ? (
                      <div className="text-xs text-muted-foreground">{t("call.ai.noActive")}</div>
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
                      placeholder={t("call.ai.callIdPlaceholder")}
                      value={liveCallId}
                      onChange={(e) => setLiveCallId(e.target.value)}
                    />
                    <button
                      className={`rounded-md px-3 py-2 text-sm text-white bg-gradient-to-r ${theme.accent} disabled:opacity-50`}
                      onClick={() => connectLive(liveCallId.trim())}
                      disabled={!liveCallId.trim()}
                    >
                      {t("call.ai.connect")}
                    </button>
                  </div>
                  <div className="text-xs text-muted-foreground">{t("call.ai.connectHelper")}</div>
                </div>
              </div>
              <div className="grid gap-3 lg:grid-cols-3">
                <div className="rounded-lg border p-3 space-y-2 col-span-2">
                  <div className="text-sm font-semibold">{t("call.ai.transcript")}</div>
                  <div className="h-48 overflow-auto text-sm space-y-1">
                    {liveTranscript.length === 0 ? (
                      <div className="text-xs text-muted-foreground">{t("call.ai.waiting")}</div>
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
                  <div className="text-sm font-semibold">{t("call.ai.suggestions")}</div>
                  <div className="text-sm space-y-1">
                    {liveSuggestions.length === 0 ? (
                      <div className="text-xs text-muted-foreground">{t("call.ai.suggestions.empty")}</div>
                    ) : (
                      liveSuggestions.map((s, idx) => (
                        <div key={idx} className="rounded bg-muted/40 px-2 py-1 text-sm">
                          {s}
                        </div>
                      ))
                    )}
                  </div>
                  <div className="text-sm font-semibold pt-2">{t("call.ai.appreciation")}</div>
                  <div className="text-xs text-muted-foreground">
                    {liveAppreciation ?? t("call.ai.appreciation.empty")}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <p className="text-sm text-muted-foreground">{t("call.main.manual.loading") ?? "Loading..."}</p>
      )}
    </div>
  );

  async function handleLookup() {
    if (!lookupTerm.trim()) return;
    setLookupLoading(true);
    setLookupError(null);
    setLookupResults([]);
    const query = lookupTerm.trim();
    try {
      const res = await fetch(
        `/api/company/${companyId}/call-center/dashboard?search=${encodeURIComponent(query)}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error(t("call.main.manual.error"));
      const data = await res.json();
      const list = (Array.isArray(data) ? data : data.data ?? data.result ?? []).filter(
        (row: any) => row?.isActive !== false
      );
      setLookupResults(list);
    } catch (err: any) {
      setLookupError(err?.message ?? t("call.main.manual.error"));
    } finally {
      setLookupLoading(false);
    }
  }
}
