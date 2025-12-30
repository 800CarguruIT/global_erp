"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppLayout, useI18n, useTheme, Card } from "@repo/ui";

interface CompanySummary {
  id: string;
  display_name?: string | null;
  legal_name?: string | null;
  trade_license_number?: string | null;
  owner_name?: string | null;
  company_email?: string | null;
  company_phone?: string | null;
  country?: string | null;
  subscription_type?: string | null;
  subscription_ends_at?: string | null;
  branches_count?: number;
  vendors_count?: number;
  customers_count?: number;
  cars_count?: number;
  users_count?: number;
}

export default function GlobalCompaniesPage() {
  return (
    <AppLayout>
      <GlobalCompaniesContent />
    </AppLayout>
  );
}

function GlobalCompaniesContent() {
  const [items, setItems] = useState<CompanySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { t } = useI18n();
  const { theme } = useTheme();
  const totals = useMemo(() => {
    const sum = (key: keyof CompanySummary) =>
      items.reduce((acc, item) => acc + (item[key] ? Number(item[key]) : 0), 0);
    const now = new Date();
    const inSeven = new Date();
    inSeven.setDate(now.getDate() + 7);
    const renewalDue = items.filter((i) => {
      if (!i.subscription_ends_at) return false;
      const d = new Date(i.subscription_ends_at);
      return d >= now && d <= inSeven;
    }).length;
    const active = items.filter((i) => i.subscription_type === "active" || i.subscription_type === "expiring" || i.subscription_type === "trial").length;
    const inactive = items.length - active;
    return {
      companies: items.length,
      branches: sum("branches_count"),
      vendors: sum("vendors_count"),
      customers: sum("customers_count"),
      cars: sum("cars_count"),
      users: sum("users_count"),
      active,
      inactive,
      renewalDue,
    };
  }, [items]);

  const kpiCards = [
    { label: t("companies.kpi.companies"), value: totals.companies },
    { label: t("companies.kpi.branches"), value: totals.branches },
    { label: t("companies.kpi.vendors"), value: totals.vendors },
    { label: t("companies.kpi.customers"), value: totals.customers },
    { label: t("companies.kpi.cars"), value: totals.cars },
    { label: t("companies.kpi.users"), value: totals.users },
    { label: t("companies.kpi.activeSubs"), value: totals.active },
    { label: t("companies.kpi.inactiveSubs"), value: totals.inactive },
    { label: t("companies.kpi.renewalDue"), value: totals.renewalDue },
  ];

  const aiActions = useMemo(() => {
    const list: string[] = [];
    if (totals.companies === 0) list.push(t("companies.ai.actions.noCompanies"));
    if (totals.branches === 0 && totals.companies > 0) list.push(t("companies.ai.actions.noBranches"));
    if (totals.vendors === 0 && totals.companies > 0) list.push(t("companies.ai.actions.noVendors"));
    if (totals.customers === 0 && totals.companies > 0) list.push(t("companies.ai.actions.noCustomers"));
    if (totals.cars === 0 && totals.companies > 0) list.push(t("companies.ai.actions.noCars"));
    if (totals.users === 0 && totals.companies > 0) list.push(t("companies.ai.actions.noUsers"));
    return list;
  }, [t, totals]);

  const aiAppreciation = useMemo(() => {
    if (totals.companies > 0 && totals.customers > 0) {
      return t("companies.ai.appreciation.customers")
        .replace("{companies}", String(totals.companies))
        .replace("{customers}", String(totals.customers));
    }
    if (totals.companies > 0 && totals.branches > 0) {
      return t("companies.ai.appreciation.branches")
        .replace("{companies}", String(totals.companies))
        .replace("{branches}", String(totals.branches));
    }
    if (totals.companies > 0) {
      return t("companies.ai.appreciation.companies").replace("{companies}", String(totals.companies));
    }
    return t("companies.ai.appreciation.empty");
  }, [t, totals]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/master/companies");
        if (!res.ok) throw new Error(t("companies.load.error"));
        const data = await res.json();
        setItems(data.data ?? data ?? []);
      } catch (err: any) {
        setError(err?.message ?? t("companies.load.error"));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleDelete(id: string) {
    const company = items.find((c) => c.id === id);
    const label = company?.display_name || company?.legal_name || t("companies.title");
    const confirmed = window.confirm(
      t("companies.delete.confirm").replace("{name}", label)
    );
    if (!confirmed) return;

    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/master/companies/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(t("companies.delete.error") + ` (${res.status})`);
      setItems((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      setError(err?.message ?? t("companies.delete.error"));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("companies.title")}</h1>
        <Link
          href="/global/companies/new"
          className={`px-3 py-1.5 rounded-lg bg-gradient-to-r text-white text-sm hover:opacity-90 transition ${theme.accent}`}
        >
          + {t("companies.create")}
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {kpiCards.map((card) => (
          <Card key={card.label} className={`${theme.cardBg} ${theme.cardBorder} border shadow-sm`}>
            <div className="text-xs text-muted-foreground">{card.label}</div>
            <div className="text-xl font-semibold">{loading ? "..." : card.value}</div>
          </Card>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card className={`${theme.cardBg} ${theme.cardBorder} border shadow-sm`}>
          <div className="space-y-2">
            <div className="text-sm font-semibold">{t("companies.ai.title")}</div>
            {loading ? (
              <div className="text-sm text-muted-foreground">{t("companies.ai.loading")}</div>
            ) : aiActions.length === 0 ? (
              <div className="text-sm text-muted-foreground">{t("companies.ai.actions.empty")}</div>
            ) : (
              <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                {aiActions.map((a, idx) => (
                  <li key={idx}>{a}</li>
                ))}
              </ul>
            )}
          </div>
        </Card>
        <Card className={`${theme.cardBg} ${theme.cardBorder} border shadow-sm`}>
          <div className="space-y-2">
            <div className="text-sm font-semibold">{t("companies.ai.appreciation.title")}</div>
            <div className="text-sm text-muted-foreground">{loading ? t("companies.ai.loading") : aiAppreciation}</div>
          </div>
        </Card>
      </div>
      {error && <div className="text-red-400 text-sm">{error}</div>}
      {loading ? (
        <div className="text-sm opacity-80">{t("companies.loading")}</div>
      ) : (
        <div className={`overflow-x-auto rounded-2xl ${theme.cardBorder} ${theme.cardBg}`}>
          <table className="min-w-full text-sm">
            <thead>
              <tr className={`${theme.surfaceSubtle} text-left`}>
                <th className="px-4 py-3 font-semibold">{t("companies.table.displayName")}</th>
                <th className="px-4 py-3 font-semibold">{t("companies.table.legalName")}</th>
                <th className="px-4 py-3 font-semibold">{t("companies.table.tradeLicense")}</th>
                <th className="px-4 py-3 font-semibold">{t("companies.table.owner")}</th>
                <th className="px-4 py-3 font-semibold">{t("companies.table.adminLogin")}</th>
                <th className="px-4 py-3 font-semibold">{t("companies.table.phone")}</th>
                <th className="px-4 py-3 font-semibold">{t("companies.table.subscription")}</th>
                <th className="px-4 py-3 font-semibold">{t("companies.table.branches")}</th>
                <th className="px-4 py-3 font-semibold">{t("companies.table.vendors")}</th>
                <th className="px-4 py-3 font-semibold">{t("companies.table.customers")}</th>
                <th className="px-4 py-3 font-semibold">{t("companies.table.cars")}</th>
                <th className="px-4 py-3 font-semibold">{t("companies.table.users")}</th>
                <th className="px-4 py-3 font-semibold">{t("companies.table.country")}</th>
                <th className="px-4 py-3 font-semibold">{t("companies.table.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-t border-border/60">
                  <td className="px-4 py-3">{c.display_name ?? "-"}</td>
                  <td className="px-4 py-3">{c.legal_name ?? "-"}</td>
                  <td className="px-4 py-3">{c.trade_license_number ?? "-"}</td>
                  <td className="px-4 py-3">{c.owner_name ?? "-"}</td>
                  <td className="px-4 py-3">{c.company_email ?? "-"}</td>
                  <td className="px-4 py-3">{c.company_phone ?? "-"}</td>
                  <td className="px-4 py-3">{c.subscription_type ?? "-"}</td>
                  <td className="px-4 py-3">{c.branches_count ?? 0}</td>
                  <td className="px-4 py-3">{c.vendors_count ?? 0}</td>
                  <td className="px-4 py-3">{c.customers_count ?? 0}</td>
                  <td className="px-4 py-3">{c.cars_count ?? 0}</td>
                  <td className="px-4 py-3">{c.users_count ?? 0}</td>
                  <td className="px-4 py-3">{c.country ?? "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        className="text-primary hover:underline"
                        onClick={() => (window.location.href = `/global/companies/${c.id}`)}
                      >
                        {t("companies.table.edit")}
                      </button>
                      <button
                        className="text-red-500 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={deletingId === c.id}
                        onClick={() => handleDelete(c.id)}
                      >
                        {deletingId === c.id ? t("companies.table.deleting") : t("companies.table.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-sm opacity-80" colSpan={14}>
                    {t("companies.table.empty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
