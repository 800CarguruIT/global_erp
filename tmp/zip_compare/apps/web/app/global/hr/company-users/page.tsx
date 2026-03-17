"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AppLayout, UserListTable, useI18n } from "@repo/ui";

type CompanyInfo = {
  id: string;
  display_name?: string | null;
  legal_name?: string | null;
  country?: string | null;
};

export default function HrCompanyUsersPage() {
  return (
    <AppLayout>
      <CompanyUsersContent />
    </AppLayout>
  );
}

function CompanyUsersContent() {
  const { t } = useI18n();
  const [companies, setCompanies] = useState<CompanyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [users, setUsers] = useState<any[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/master/companies");
        if (!res.ok) throw new Error(t("hr.companyUsers.error"));
        const data = await res.json();
        setCompanies(data.data ?? data ?? []);
      } catch (err: any) {
        setError(err?.message ?? t("hr.companyUsers.error"));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [t]);

  useEffect(() => {
    if (companies.length > 0 && !selectedCompanyId) {
      setSelectedCompanyId(companies[0].id);
    }
  }, [companies, selectedCompanyId]);

  const companyMap = useMemo(
    () =>
      companies.reduce<Record<string, CompanyInfo>>((acc, c) => {
        acc[c.id] = c;
        return acc;
      }, {}),
    [companies]
  );

  async function loadUsers(targetId?: string, search?: string) {
    const companyId = targetId ?? selectedCompanyId;
    if (!companyId) {
      setUsers([]);
      setUserError(t("hr.companyUsers.required"));
      return;
    }
    setUserLoading(true);
    setUserError(null);
    try {
      const params = new URLSearchParams();
      const searchValue = search ?? query;
      if (searchValue) params.set("q", searchValue);
      const res = await fetch(`/api/company/${companyId}/admin/users?${params.toString()}`);
      if (!res.ok) throw new Error(t("settings.users.error"));
      const data = await res.json();
      setUsers(data.data ?? data ?? []);
    } catch (err: any) {
      setUserError(err?.message ?? t("settings.users.error"));
    } finally {
      setUserLoading(false);
    }
  }

  useEffect(() => {
    if (selectedCompanyId) {
      loadUsers(selectedCompanyId);
    }
  }, [selectedCompanyId]);

  const displayUsers = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.full_name ?? u.name ?? "",
    roles: u.roles ?? [],
    companyName: companyMap[selectedCompanyId]?.display_name ?? companyMap[selectedCompanyId]?.legal_name ?? "",
    isActive: u.is_active ?? true,
    lastLoginAt: u.last_login_at ?? null,
  }));

  return (
    <div className="space-y-4 py-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("hr.companyUsers.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("hr.companyUsers.subtitle")}</p>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      {loading ? (
        <div className="text-sm text-muted-foreground">{t("hr.companyUsers.loading")}</div>
      ) : companies.length === 0 ? (
        <div className="text-sm text-muted-foreground">{t("hr.companyUsers.empty")}</div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <label className="text-sm font-medium" htmlFor="company-select">
              {t("hr.companyUsers.selectLabel")}
            </label>
            <select
              id="company-select"
              className="min-w-[240px] rounded-md border bg-background px-3 py-2 text-sm"
              value={selectedCompanyId}
              onChange={(e) => {
                const newId = e.target.value;
                setSelectedCompanyId(newId);
                setQuery("");
                setUserError(null);
                setUsers([]);
              }}
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_name || c.legal_name || c.id}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="rounded border bg-background px-3 py-2 text-sm"
                placeholder={t("hr.companyUsers.searchPlaceholder")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") loadUsers();
                }}
              />
              <button
                type="button"
                onClick={() => loadUsers()}
                className="rounded-md border px-3 py-1 text-sm font-medium"
              >
                {t("hr.companyUsers.search")}
              </button>
            </div>
          </div>

          {userError && <div className="text-sm text-destructive">{userError}</div>}
          {!selectedCompanyId ? (
            <div className="text-sm text-muted-foreground">{t("hr.companyUsers.required")}</div>
          ) : userLoading ? (
            <div className="text-sm text-muted-foreground">{t("settings.users.loading")}</div>
          ) : (
            <UserListTable
              users={displayUsers}
              onCreate={() =>
                window.location.href = `/company/${selectedCompanyId}/settings/security/users/new`
              }
              onRowClick={(id) =>
                window.location.href = `/company/${selectedCompanyId}/settings/security/users/${id}`
              }
            />
          )}
        </div>
      )}
    </div>
  );
}
