"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, UserListTable, useI18n } from "@repo/ui";

type UserRow = {
  id: string;
  email: string;
  full_name?: string | null;
  name?: string | null;
  roles?: { id: string; name: string }[];
  is_active?: boolean;
  last_login_at?: string | null;
  company_id?: string | null;
};

export default function GlobalUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [roleFilter, setRoleFilter] = useState("");
  const { t } = useI18n();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      params.set("scope", "global");
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) throw new Error(t("settings.users.error"));
      const data = await res.json();
      setUsers(data.data ?? []);
    } catch (err: any) {
      setError(err?.message ?? t("settings.users.error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id: string) {
    const target = users.find((u) => u.id === id);
    const label = target?.email || target?.full_name || target?.name || "this user";
    const confirmed = window.confirm(`Delete ${label}?`);
    if (!confirmed) return;

    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Failed to delete user (${res.status})`);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err: any) {
      setError(err?.message ?? t("settings.users.error"));
    } finally {
      setDeletingId(null);
    }
  }

  const displayUsers = useMemo(
    () =>
      users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.full_name ?? u.name ?? "",
        roles: u.roles ?? [],
        companyName: u.company_id ?? null,
        isActive: u.is_active ?? true,
        lastLoginAt: u.last_login_at ?? null,
      })),
    [users]
  );

  const roleOptions = useMemo(() => {
    const seen = new Map<string, { id: string; name: string }>();
    users.forEach((u) => {
      u.roles?.forEach((role) => {
        const roleId = role.id || role.name || "";
        if (!roleId || seen.has(roleId)) return;
        seen.set(roleId, { id: role.id || roleId, name: role.name || roleId });
      });
    });
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

  const filteredUsers = useMemo(
    () =>
      displayUsers.filter((user) => {
        if (statusFilter === "active" && user.isActive === false) return false;
        if (statusFilter === "inactive" && user.isActive !== false) return false;
        if (
          roleFilter &&
          !user.roles.some(
            (role) => (role.id || role.name || "").toLowerCase() === roleFilter.toLowerCase()
          )
        ) {
          return false;
        }
        return true;
      }),
    [displayUsers, roleFilter, statusFilter]
  );

  return (
    <div className="space-y-4 py-4">
      <Card className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold">{t("settings.users.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("settings.users.subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={() => (window.location.href = "/global/settings/security/users/new")}
            className="inline-flex items-center gap-2 rounded-md border border-white/20 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:border-white/50"
          >
            <span className="text-base font-bold">+</span>
            Add user
          </button>
        </div>

        {error && <div className="text-sm text-destructive">{error}</div>}
        <div className="rounded-2xl bg-muted/40 p-6 shadow-inner">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex w-full max-w-md items-center gap-2">
              <input
                className="w-full rounded-md bg-slate-50 px-4 py-2 text-sm  text-slate-500 shadow-inner outline-none focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder={t("settings.users.search")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") load();
                }}
              />
              <button
                type="button"
                onClick={load}
                className="rounded-md border border-white/20 px-4 py-2 text-xs  uppercase tracking-wide text-white transition hover:border-white/40"
              >
                {t("settings.users.searchBtn")}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-col text-xs  uppercase tracking-[0.2em] text-muted-foreground">
                <span className="text-[10px] text-muted-foreground mb-1">Status</span>
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as "all" | "active" | "inactive")
                  }
                className="rounded-md border border-white/20 bg-slate-50 px-3 py-1.5 text-sm  text-slate-500 shadow-inner focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="all">{t("settings.users.status.all")}</option>
                  <option value="active">{t("settings.users.status.active")}</option>
                  <option value="inactive">{t("settings.users.status.inactive")}</option>
                </select>
              </div>
              <div className="flex flex-col text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                <span className="text-[10px] text-muted-foreground mb-1">Roles</span>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                className="rounded-md border border-white/20 bg-slate-50 px-3 py-1.5 text-sm  text-slate-500 shadow-inner focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">{t("settings.users.roles.all")}</option>
                  {roleOptions.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="mt-6">
            {loading ? (
              <div className="text-sm text-muted-foreground">{t("settings.users.loading")}</div>
            ) : (
              <UserListTable
                users={filteredUsers}
                onCreate={() => (window.location.href = "/global/settings/security/users/new")}
                onRowClick={(id) => (window.location.href = `/global/settings/security/users/${id}`)}
                onDelete={handleDelete}
                deletingId={deletingId}
                hideCreateButton
              />
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
