"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppLayout, Card, useI18n, useTheme } from "@repo/ui";

type LeadStatus = "open" | "assigned" | "onboarding" | "inprocess" | "completed" | "closed" | "lost";
type LeadType = "sales" | "support" | "complaint";

type LeadListItem = {
  id: string;
  title: string;
  status: LeadStatus;
  type: LeadType;
  customerName: string;
  customerPhone: string;
  lastUpdated: string;
};

type LeadsResponse = {
  data: LeadListItem[];
};

const TABS: { id: LeadStatus | "all"; labelKey: string }[] = [
  { id: "all", labelKey: "leads.tab.all" },
  { id: "open", labelKey: "leads.tab.open" },
  { id: "assigned", labelKey: "leads.tab.assigned" },
  { id: "onboarding", labelKey: "leads.tab.onboarding" },
  { id: "inprocess", labelKey: "leads.tab.inprocess" },
  { id: "completed", labelKey: "leads.tab.completed" },
  { id: "closed", labelKey: "leads.tab.closed" },
  { id: "lost", labelKey: "leads.tab.lost" },
];

function StatusBadge({ status }: { status: LeadStatus }) {
  const color =
    status === "completed" || status === "closed"
      ? "bg-emerald-500/20 text-emerald-300"
      : status === "inprocess"
      ? "bg-amber-500/20 text-amber-200"
      : status === "onboarding"
      ? "bg-sky-500/20 text-sky-200"
      : status === "lost"
      ? "bg-red-500/20 text-red-200"
      : "bg-purple-500/20 text-purple-200";
  return <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${color}`}>{status}</span>;
}

function TypeBadge({ type }: { type: string }) {
  return <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs capitalize">{type}</span>;
}

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

export default function GlobalLeadsPage() {
  return (
    <AppLayout>
      <LeadsContent />
    </AppLayout>
  );
}

function LeadsContent() {
  const [tab, setTab] = useState<LeadStatus | "all">("all");
  const [leads, setLeads] = useState<LeadListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiAppreciation, setAiAppreciation] = useState<string | null>(null);
  const { t } = useI18n();
  const { theme } = useTheme();

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/global/leads", { cache: "no-store" });
        if (!res.ok) throw new Error(t("leads.error"));
        const data: LeadsResponse = await res.json();
        if (active) setLeads(data.data ?? []);
      } catch (err: any) {
        if (active) setError(err?.message ?? t("leads.error"));
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (tab === "all") return leads;
    return leads.filter((l) => l.status === tab);
  }, [tab, leads]);

  const counts = useMemo(() => {
    const map: Record<LeadStatus, number> = {
      open: 0,
      assigned: 0,
      onboarding: 0,
      inprocess: 0,
      completed: 0,
      closed: 0,
      lost: 0,
    };
    leads.forEach((l) => (map[l.status] = (map[l.status] ?? 0) + 1));
    return map;
  }, [leads]);

  useEffect(() => {
    const suggestions: string[] = [];
    if (counts.open > 5 || counts.assigned > 5) suggestions.push(t("leads.ai.actions.backlog"));
    if (counts.assigned > 0 && counts.open === 0) suggestions.push(t("leads.ai.actions.assigned"));
    if (counts.onboarding + counts.inprocess > 0) suggestions.push(t("leads.ai.actions.stalled"));
    if (counts.lost > 0) suggestions.push(t("leads.ai.actions.lost"));
    setAiSuggestions(suggestions);

    if (counts.completed + counts.closed > 0) {
      setAiAppreciation(
        t("leads.ai.appreciation.closed").replace("{count}", String(counts.completed + counts.closed))
      );
    } else if (counts.assigned > 0) {
      setAiAppreciation(t("leads.ai.appreciation.assigned").replace("{count}", String(counts.assigned)));
    } else {
      setAiAppreciation(t("leads.ai.appreciation.empty"));
    }
  }, [counts, t]);

  return (
    <div className="space-y-6 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("leads.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("leads.subtitle")}</p>
        </div>
        <div className="flex gap-2 text-sm">
          {TABS.map((tabDef) => (
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

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <div className="space-y-2">
            <div className="text-sm font-semibold">{t("leads.ai.title")}</div>
            {loading ? (
              <div className="text-sm text-muted-foreground">{t("leads.ai.loading")}</div>
            ) : aiSuggestions.length === 0 ? (
              <div className="text-sm text-muted-foreground">{t("leads.ai.actions.empty")}</div>
            ) : (
              <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                {aiSuggestions.map((a, idx) => (
                  <li key={idx}>{a}</li>
                ))}
              </ul>
            )}
          </div>
        </Card>
        <Card>
          <div className="space-y-2">
            <div className="text-sm font-semibold">{t("leads.ai.appreciation.title")}</div>
            <div className="text-sm text-muted-foreground">
              {loading ? t("leads.ai.loading") : aiAppreciation}
            </div>
          </div>
        </Card>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}
      {loading ? (
        <p className="text-sm text-muted-foreground">{t("leads.loading")}</p>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b border-border/60 text-xs text-muted-foreground">
                  <th className="px-3 py-2">{t("leads.table.lead")}</th>
                  <th className="px-3 py-2">{t("leads.table.customer")}</th>
                  <th className="px-3 py-2">Contact</th>
                  <th className="px-3 py-2">{t("leads.table.type")}</th>
                  <th className="px-3 py-2">{t("leads.table.status")}</th>
                  <th className="px-3 py-2">{t("leads.table.updated")}</th>
                  <th className="px-3 py-2">{t("leads.table.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead) => (
                  <tr key={lead.id} className="border-b border-border/60">
                    <td className="px-3 py-2">
                      <div className="font-semibold">{lead.title || t("leads.table.untitled")}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div>{lead.customerName || t("leads.table.noCustomer")}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{lead.customerPhone || "-"}</td>
                    <td className="px-3 py-2">
                      <TypeBadge type={lead.type} />
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={lead.status} />
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(lead.lastUpdated)}</td>
                    <td className="px-3 py-2 text-xs">
                      <Link href={`/global/leads/${lead.id}`} className="text-primary hover:underline">
                        {t("leads.table.view")}
                      </Link>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td className="px-3 py-3 text-sm text-muted-foreground" colSpan={6}>
                      {t("leads.empty")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
