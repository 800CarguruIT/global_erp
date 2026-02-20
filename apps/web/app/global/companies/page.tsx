"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppLayout, useI18n, useTheme } from "@repo/ui";
import { toast } from "sonner";
import { useGlobalPermissions } from "@/lib/auth/global-permissions";
import { AccessDenied } from "@/components/AccessDenied";

interface CompanySummary {
  id: string;
  display_name?: string | null;
  legal_name?: string | null;
  trade_license_number?: string | null;
  owner_name?: string | null;
  company_email?: string | null;
  company_phone?: string | null;
  country?: string | null;
  is_active?: boolean;
  subscription_type?: string | null;
  subscription_ends_at?: string | null;
  branches_count?: number;
  vendors_count?: number;
  customers_count?: number;
  cars_count?: number;
  users_count?: number;
  allow_custom_coa?: boolean;
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
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");
  const { t } = useI18n();
  const { theme } = useTheme();
  const { hasPermission, loading: permLoading } = useGlobalPermissions();
  const canViewCompanies = hasPermission("global.companies.list");
  const baseCompanies = useMemo(() => {
    return items.filter((company) => {
      if (statusFilter === "inactive") return company.is_active === false;
      if (statusFilter === "all") return true;
      return company.is_active !== false;
    });
  }, [items, statusFilter]);

  const tableItems = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    const country = countryFilter.trim().toLowerCase();
    const base = baseCompanies;
    return base.filter((company) => {
      const matchesSearch =
        !search ||
        [company.display_name, company.legal_name, company.owner_name, company.company_email]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(search));
      const matchesCountry =
        !country || (company.country?.toLowerCase() ?? "").includes(country);
      return matchesSearch && matchesCountry;
    });
  }, [baseCompanies, searchTerm, countryFilter]);

  const countryOptions = useMemo(
    () => Array.from(new Set(items.map((company) => company.country).filter(Boolean))).sort(),
    [items]
  );

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const includeInactive = statusFilter !== "active";
      const url = `/api/master/companies${includeInactive ? "?includeInactive=true" : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(t("companies.load.error"));
      const data = await res.json();
      setItems(data.data ?? data ?? []);
    } catch (err: any) {
      setError(err?.message ?? t("companies.load.error"));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, t]);

  useEffect(() => {
    if (permLoading) {
      return;
    }
    if (!canViewCompanies) {
      setLoading(false);
      return;
    }
    loadCompanies();
  }, [canViewCompanies, loadCompanies, permLoading]);

  if (permLoading) {
    return <div className="py-4 text-sm text-muted-foreground">Loading access rights...</div>;
  }

  if (!canViewCompanies) {
    return (
      <div className="py-4">
        <AccessDenied
          title="Companies access locked"
          description="You need the global.companies.list permission to view companies."
        />
      </div>
    );
  }

  async function handleToggleCoa(id: string, enabled: boolean) {
    setUpdatingId(id);
    setError(null);
    try {
      const res = await fetch("/api/global/accounting/coa-company-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: id, enabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to update");
      setItems((prev) =>
        prev.map((c) => (c.id === id ? { ...c, allow_custom_coa: data?.data?.allow_custom_coa ?? enabled } : c))
      );
    } catch (err: any) {
      setError(err?.message ?? "Failed to update");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleToggleStatus(id: string, nextActive: boolean) {
    setStatusUpdatingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/master/companies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextActive }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      setItems((prev) => prev.map((c) => (c.id === id ? { ...c, is_active: nextActive } : c)));
      toast.success(`Company ${nextActive ? "activated" : "deactivated"}.`);
    } catch (err: any) {
      setError(err?.message ?? "Failed to update status");
      toast.error(err?.message ?? "Failed to update status");
    } finally {
      setStatusUpdatingId(null);
    }
  }

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("companies.title")}</h1>
        <Link
          href="/global/companies/new"
          className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${theme.surfaceSubtle} ${theme.cardBorder} ${theme.appText}`}
        >
          + {t("companies.create")}
        </Link>
      </div>
      {error && <div className="text-red-400 text-sm">{error}</div>}
      <div className={`grid gap-3 rounded-2xl border ${theme.cardBorder} ${theme.surfaceSubtle} p-3 text-sm text-muted-foreground sm:grid-cols-[1fr_1fr] lg:grid-cols-[1fr_1fr_auto]`}>
        <label className="flex flex-col gap-1 text-xs font-semibold">
          Search
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Name, legal name, owner or email"
            className={`w-full rounded-md border px-3 py-2 text-sm transition ${theme.inputBg} ${theme.inputBorder} ${theme.inputText}`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold">
          Country
          <select
            value={countryFilter}
            onChange={(event) => setCountryFilter(event.target.value)}
            className={`w-full rounded-md border px-3 py-2 text-sm transition ${theme.inputBg} ${theme.inputBorder} ${theme.inputText}`}
          >
            <option value="">All countries</option>
            {countryOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide">
          <label className="text-[10px] font-semibold text-muted-foreground">Status</label>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "active" | "inactive" | "all")}
            className={`rounded-md border px-3 py-2 text-sm transition ${theme.inputBg} ${theme.inputBorder} ${theme.inputText}`}
          >
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
            <option value="all">All companies</option>
          </select>
          <span className="text-muted-foreground/70">
            {tableItems.length} / {baseCompanies.length} companies
          </span>
          <span className="text-muted-foreground/60">Results</span>
        </div>
      </div>
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
                <th className="px-4 py-3 font-semibold">{t("companies.table.country")}</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">COA Custom</th>
                <th className="px-4 py-3 font-semibold">{t("companies.table.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {tableItems.map((c) => {
                const isActive = c.is_active ?? true;
                return (
                  <tr key={c.id} className="border-t border-border/60">
                    <td className="px-4 py-3">{c.display_name ?? "-"}</td>
                    <td className="px-4 py-3">{c.legal_name ?? "-"}</td>
                    <td className="px-4 py-3">{c.trade_license_number ?? "-"}</td>
                    <td className="px-4 py-3">{c.owner_name ?? "-"}</td>
                    <td className="px-4 py-3">{c.company_email ?? "-"}</td>
                    <td className="px-4 py-3">{c.company_phone ?? "-"}</td>
                    <td className="px-4 py-3">{c.country ?? "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-pressed={isActive}
                          disabled={statusUpdatingId === c.id}
                          onClick={() => handleToggleStatus(c.id, !isActive)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full border transition ${
                            isActive ? "border-emerald-400/70 bg-emerald-500/30" : "border-white/15 bg-white/5"
                          } ${statusUpdatingId === c.id ? "opacity-60 cursor-not-allowed" : "hover:border-white/40"}`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                              isActive ? "translate-x-5" : "translate-x-1"
                            }`}
                          />
                        </button>
                        <span className="text-xs uppercase tracking-wide text-muted-foreground/80">
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        aria-pressed={Boolean(c.allow_custom_coa)}
                        disabled={updatingId === c.id}
                        onClick={() => handleToggleCoa(c.id, !c.allow_custom_coa)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full border transition ${
                          c.allow_custom_coa ? "border-emerald-400/70 bg-emerald-500/30" : "border-white/15 bg-white/5"
                        } ${updatingId === c.id ? "opacity-60 cursor-not-allowed" : "hover:border-white/40"}`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                            c.allow_custom_coa ? "translate-x-5" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          className="text-primary hover:underline"
                          onClick={() => (window.location.href = `/global/companies/${c.id}`)}
                        >
                          {t("companies.table.edit")}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
      {tableItems.length === 0 && (
        <tr>
          <td className="px-4 py-4 text-sm opacity-80" colSpan={10}>
            {items.length === 0 ? t("companies.table.empty") : "No companies match the applied filters."}
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
