"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppLayout, Card, useTheme, useI18n } from "@repo/ui";

type CallRow = {
  id: string;
  from: string;
  to: string;
  customerName?: string | null;
  companyName?: string | null;
  direction: "inbound" | "outbound";
  status: string;
  type?: string | null;
  remarks?: string | null;
  startedAt: string;
  recordingUrl?: string | null;
};

async function fetchCalls(): Promise<CallRow[]> {
  const res = await fetch("/api/global/call-center/summary", { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.recentCalls ?? []) as CallRow[];
}

const tabs = [
  { id: "all", labelKey: "call.history.tab.all" },
  { id: "inbound", labelKey: "call.history.tab.inbound" },
  { id: "outbound", labelKey: "call.history.tab.outbound" },
] as const;

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

function formatDate(date: string) {
  return dateFormatter.format(new Date(date));
}

export default function CallHistoryPage() {
  return (
    <AppLayout>
      <CallHistoryContent />
    </AppLayout>
  );
}

function CallHistoryContent() {
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();
  const { t } = useI18n();

  useEffect(() => {
    fetchCalls()
      .then(setCalls)
      .catch(() => setError("Failed to load call history"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (tab === "all") return calls;
    return calls.filter((c) => c.direction === tab);
  }, [tab, calls]);

  return (
    <div className="space-y-6 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("call.history.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("call.history.subtitle")}</p>
        </div>
        <div className="flex gap-2 text-sm">
          {tabs.map((tabDef) => (
            <button
              key={tabDef.id}
              className={`rounded-full border px-3 py-1 ${
                tab === tabDef.id ? "bg-primary text-primary-foreground border-primary" : "border-border/60"
              }`}
              onClick={() => setTab(tabDef.id)}
            >
              {t(tabDef.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("call.history.loading")}</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error ?? t("call.history.error")}</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("call.history.empty")}</p>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b border-border/60 text-xs text-muted-foreground">
                  <th className="px-3 py-2">{t("call.history.table.customer")}</th>
                  <th className="px-3 py-2">{t("call.history.table.direction")}</th>
                  <th className="px-3 py-2">{t("call.history.table.from")}</th>
                  <th className="px-3 py-2">{t("call.history.table.to")}</th>
                  <th className="px-3 py-2">{t("call.history.table.type")}</th>
                  <th className="px-3 py-2">{t("call.history.table.status")}</th>
                  <th className="px-3 py-2">{t("call.history.table.remarks")}</th>
                  <th className="px-3 py-2">{t("call.history.table.started")}</th>
                  <th className="px-3 py-2">{t("call.history.table.recording")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-border/60">
                    <td className="px-3 py-2">
                      <div className="font-semibold">{c.customerName ?? c.companyName ?? "Unknown"}</div>
                      {c.companyName && <div className="text-xs text-muted-foreground">{c.companyName}</div>}
                    </td>
                    <td className="px-3 py-2 capitalize">{c.direction}</td>
                    <td className="px-3 py-2">{c.from}</td>
                    <td className="px-3 py-2">{c.to}</td>
                    <td className="px-3 py-2">{c.type ?? "-"}</td>
                    <td className="px-3 py-2">{c.status}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{c.remarks ?? "-"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {formatDate(c.startedAt)}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {c.recordingUrl ? (
                        <a href={c.recordingUrl} className="text-primary hover:underline" target="_blank" rel="noreferrer">
                          {t("call.history.table.recording.link")}
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
