"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppLayout, useI18n, useTheme } from "@repo/ui";

type CallHistoryRow = {
  id: string;
  providerKey?: string;
  providerCallId?: string | null;
  direction: "inbound" | "outbound";
  from: string;
  to: string;
  status: string;
  startedAt: string | Date | null;
  durationSeconds: number | null;
  createdByUserId: string;
  agent: { name: string | null; email: string | null } | null;
  customer: { name: string | null; phone: string | null } | null;
  recording: { url: string; durationSeconds: number | null } | null;
};

const tabs: Array<{ key: "all" | "inbound" | "outbound"; label: string }> = [
  { key: "all", label: "call.history.tab.all" },
  { key: "inbound", label: "call.history.tab.inbound" },
  { key: "outbound", label: "call.history.tab.outbound" },
];

function isUsableRecordingUrl(url: string | null | undefined): boolean {
  const normalized = String(url ?? "").trim().toLowerCase();
  return normalized.length > 0 && normalized !== "unknown" && normalized !== "null" && normalized !== "undefined";
}

function formatDuration(totalSeconds: number | null | undefined) {
  if (!totalSeconds) return "—";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function CallHistoryPage({ params }: { params: { companyId: string } | Promise<{ companyId: string }> }) {
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve(params).then((p) => setCompanyId(p?.companyId ?? null));
  }, [params]);

  return <AppLayout>{companyId ? <CallHistoryContent companyId={companyId} /> : null}</AppLayout>;
}

function CallHistoryContent({ companyId }: { companyId: string }) {
  const { t } = useI18n();
  const { theme } = useTheme();
  const { cardBg, cardBorder } = theme;
  const [direction, setDirection] = useState<"all" | "inbound" | "outbound">("all");
  const [rows, setRows] = useState<CallHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resolvingById, setResolvingById] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(
    async (opts?: { background?: boolean }) => {
      const background = Boolean(opts?.background);
      if (background) setRefreshing(true);
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (direction !== "all") qs.set("direction", direction);
        const res = await fetch(`/api/company/${companyId}/call-center/history?${qs.toString()}`, { cache: "no-store" });
        if (!res.ok) throw new Error(t("call.history.error"));
        const data = await res.json();
        const list: CallHistoryRow[] = (data?.data ?? []).map((item: any) => ({
          ...item,
          startedAt: item.startedAt ?? null,
        }));
        setRows(list);
      } catch (err: any) {
        setError(err?.message ?? t("call.history.error"));
      } finally {
        setLoading(false);
        if (background) setRefreshing(false);
      }
    },
    [companyId, direction, t]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function resolveRecordingNow(row: CallHistoryRow) {
    const providerCallId = String(row.providerCallId ?? "").trim();
    if (!providerCallId) return;
    setResolvingById((prev) => ({ ...prev, [row.id]: true }));
    try {
      const res = await fetch(`/api/company/${companyId}/call-center/history/resolve-recording`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerCallId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error ?? "Recording not found yet");
      }
      await fetchData({ background: true });
    } catch (err: any) {
      setError(err?.message ?? "Failed to resolve recording");
    } finally {
      setResolvingById((prev) => ({ ...prev, [row.id]: false }));
    }
  }

  return (
    <div className="space-y-4 py-4">
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-semibold">{t("call.history.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("call.history.subtitle")}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => void fetchData({ background: true })}
          disabled={loading || refreshing}
          className={`rounded-full border px-3 py-1 text-sm font-medium transition disabled:opacity-60 ${cardBorder} ${cardBg}`}
        >
          {refreshing ? "Refreshing..." : "Refresh Log"}
        </button>
        {tabs.map((tab) => {
          const isActive = direction === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setDirection(tab.key)}
              className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
                isActive ? "bg-primary text-primary-foreground border-primary" : `${cardBorder} ${cardBg}`
              }`}
            >
              {t(tab.label)}
            </button>
          );
        })}
      </div>

      <div className={`rounded-2xl ${cardBg} ${cardBorder} p-4`}>
        {loading ? (
          <p className="text-sm text-muted-foreground">{t("call.history.loading")}</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("call.history.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b">
                  <th className="px-3 py-2 text-left">{t("call.history.table.customer")}</th>
                  <th className="px-3 py-2 text-left">{t("call.history.table.direction")}</th>
                  <th className="px-3 py-2 text-left">{t("call.history.table.from")}</th>
                  <th className="px-3 py-2 text-left">{t("call.history.table.to")}</th>
                  <th className="px-3 py-2 text-left">{t("call.history.table.status")}</th>
                  <th className="px-3 py-2 text-left">{t("call.history.table.started")}</th>
                  <th className="px-3 py-2 text-left">{t("call.history.table.remarks")}</th>
                  <th className="px-3 py-2 text-left">{t("call.history.table.recording")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => {
                  const started = row.startedAt ? new Date(row.startedAt) : null;
                  const agentLabel = row.agent?.name ?? row.agent?.email ?? row.createdByUserId ?? "—";
                  const customerLabel = row.customer?.name ?? row.customer?.phone ?? "—";
                  const recordingProxyUrl = isUsableRecordingUrl(row.recording?.url)
                    ? `/api/company/${companyId}/call-center/history/recording-proxy?recordingUrl=${encodeURIComponent(
                        String(row.recording?.url ?? "")
                      )}`
                    : "";
                  return (
                    <tr key={row.id} className="align-top">
                      <td className="px-3 py-2">
                        <div className="font-medium">{customerLabel}</div>
                        {row.customer?.phone && <div className="text-xs text-muted-foreground">{row.customer.phone}</div>}
                      </td>
                      <td className="px-3 py-2">
                        <span className="rounded-full border px-2 py-1 text-xs capitalize">{row.direction}</span>
                      </td>
                      <td className="px-3 py-2">{row.from}</td>
                      <td className="px-3 py-2">{row.to}</td>
                      <td className="px-3 py-2 capitalize">{row.status}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {started ? started.toLocaleString() : "—"}
                        <div className="text-xs text-muted-foreground">{formatDuration(row.durationSeconds)}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-sm">{agentLabel}</div>
                        {row.agent?.email && <div className="text-xs text-muted-foreground">{row.agent.email}</div>}
                      </td>
                      <td className="px-3 py-2">
                        {isUsableRecordingUrl(row.recording?.url) ? (
                          <div className="flex min-w-[220px] flex-col gap-2">
                            <audio controls preload="none" src={recordingProxyUrl} className="h-8 w-full" />
                            <Link href={recordingProxyUrl} className="text-primary hover:underline" target="_blank">
                              {t("call.history.table.recording.link")}
                            </Link>
                          </div>
                        ) : (
                          <div className="flex min-w-[220px] items-center gap-2">
                            <span className="text-xs text-muted-foreground">—</span>
                            <button
                              type="button"
                              onClick={() => void resolveRecordingNow(row)}
                              disabled={Boolean(resolvingById[row.id]) || !String(row.providerCallId ?? "").trim()}
                              className={`rounded-full border px-2 py-1 text-xs transition disabled:opacity-60 ${cardBorder} ${cardBg}`}
                            >
                              {resolvingById[row.id] ? "Resolving..." : "Resolve Recording Now"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
