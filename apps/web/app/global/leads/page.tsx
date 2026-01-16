"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppLayout, Card, useI18n } from "@repo/ui";

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

const STATUS_STYLES: Record<LeadStatus, string> = {
  open: "bg-sky-500/15 text-sky-600",
  assigned: "bg-indigo-500/15 text-indigo-600",
  onboarding: "bg-amber-500/15 text-amber-600",
  inprocess: "bg-orange-500/15 text-orange-600",
  completed: "bg-emerald-500/15 text-emerald-600",
  closed: "bg-emerald-500/15 text-emerald-600",
  lost: "bg-rose-500/15 text-rose-600",
};

function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold capitalize ${
      STATUS_STYLES[status]
    }`}>
      {status}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-muted/40 px-3 py-1 text-[11px] font-semibold text-muted-foreground capitalize">
      {type}
    </span>
  );
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

function normalize(value: string | null | undefined) {
  return (value ?? "").toString().trim().toLowerCase();
}

function safeText(value: string | null | undefined) {
  return value && value !== "null" ? value : "-";
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
  const [query, setQuery] = useState("");
  const { t } = useI18n();

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
  }, [t]);

  const filtered = useMemo(() => {
    const term = normalize(query);
    const rows = tab === "all" ? leads : leads.filter((l) => l.status === tab);
    if (!term) return rows;
    return rows.filter((l) => {
      const haystack = [l.title, l.customerName, l.customerPhone, l.type, l.status]
        .map(normalize)
        .join(" ");
      return haystack.includes(term);
    });
  }, [tab, leads, query]);

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

  function resetFilters() {
    setTab("all");
    setQuery("");
  }

  return (
    <div className="w-full -mx-4 px-4 lg:-mx-8 lg:px-8 py-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold">{t("leads.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("leads.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center rounded-md border border-slate-200 bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-md transition hover:bg-slate-50 hover:shadow-lg"
          >
            <svg viewBox="0 0 24 24" className="-ml-1 mr-2 h-4 w-4" aria-hidden="true">
              <path
                d="M4 6h16M7 12h10M10 18h4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            View All
          </button>
          <Link
            href="/global/leads/new"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground shadow-md transition hover:opacity-90 hover:shadow-lg"
          >
            <svg viewBox="0 0 24 24" className="-ml-1 mr-2 h-4 w-4" aria-hidden="true">
              <path
                d="M12 5v14M5 12h14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            Add Lead
          </Link>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="rounded-2xl border border-border/30 bg-card shadow-sm">
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
        <Card className="rounded-2xl border border-border/30 bg-card shadow-sm">
          <div className="space-y-2">
            <div className="text-sm font-semibold">{t("leads.ai.appreciation.title")}</div>
            <div className="text-sm text-muted-foreground">
              {loading ? t("leads.ai.loading") : aiAppreciation}
            </div>
          </div>
        </Card>
      </div>

      <Card className="rounded-2xl border-x border-border/30 bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/30 px-4 py-3">
          <div className="inline-flex rounded-lg bg-muted/40 p-1 text-xs">
            {TABS.map((tabDef) => (
              <button
                key={tabDef.id}
                type="button"
                onClick={() => setTab(tabDef.id)}
                className={`rounded-md px-3 py-1.5 font-medium transition ${
                  tab === tabDef.id
                    ? "bg-background text-foreground shadow-sm border border-border/40"
                    : "border border-transparent text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {t(tabDef.labelKey)}
              </button>
            ))}
          </div>
          <div className="relative w-full max-w-xs">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path
                  d="M15.5 15.5L21 21M10.5 18a7.5 7.5 0 1 1 0-15a7.5 7.5 0 0 1 0 15Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </div>
        </div>
        {error && <div className="px-4 pt-3 text-xs text-red-500">{error}</div>}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr className="text-left bg-muted/20">
                <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
                  {t("leads.table.lead")}
                </th>
                <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
                  {t("leads.table.customer")}
                </th>
                <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
                  Contact
                </th>
                <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
                  {t("leads.table.type")}
                </th>
                <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
                  {t("leads.table.status")}
                </th>
                <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
                  {t("leads.table.updated")}
                </th>
                <th className="px-4 py-3 text-right sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
                  {t("leads.table.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td className="px-3 py-6 text-muted-foreground text-center" colSpan={7}>
                    {t("leads.loading")}
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td className="px-3 py-6 text-red-500 text-center" colSpan={7}>
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && filtered.length === 0 && (
                <tr>
                  <td className="px-3 py-6 text-muted-foreground text-center" colSpan={7}>
                    {t("leads.empty")}
                  </td>
                </tr>
              )}
              {!loading &&
                !error &&
                filtered.map((lead) => (
                  <tr key={lead.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 border-b border-border/30">
                      <div className="font-medium text-foreground">{lead.title || t("leads.table.untitled")}</div>
                    </td>
                    <td className="px-4 py-3 border-b border-border/30">
                      {lead.customerName || t("leads.table.noCustomer")}
                    </td>
                    <td className="px-4 py-3 border-b border-border/30 text-xs text-muted-foreground">
                      {safeText(lead.customerPhone)}
                    </td>
                    <td className="px-4 py-3 border-b border-border/30">
                      <TypeBadge type={lead.type} />
                    </td>
                    <td className="px-4 py-3 border-b border-border/30">
                      <StatusBadge status={lead.status} />
                    </td>
                    <td className="px-4 py-3 border-b border-border/30 text-xs text-muted-foreground">
                      {formatDate(lead.lastUpdated)}
                    </td>
                    <td className="px-4 py-3 text-right border-b border-border/30">
                      <Link
                        href={`/global/leads/${lead.id}`}
                        className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground shadow-sm transition hover:opacity-90 hover:shadow-md"
                      >
                        <svg viewBox="0 0 24 24" className="-ml-1 mr-2 h-4 w-4" aria-hidden="true">
                          <path
                            d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                        {t("leads.table.view")}
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
