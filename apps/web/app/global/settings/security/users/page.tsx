"use client";

import React, { useEffect, useState } from "react";
import { UserListTable, useI18n } from "@repo/ui";

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

  const displayUsers = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.full_name ?? u.name ?? "",
    roles: u.roles ?? [],
    companyName: u.company_id ?? null,
    isActive: u.is_active ?? true,
    lastLoginAt: u.last_login_at ?? null,
  }));

  return (
    <div className="space-y-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">{t("settings.users.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("settings.users.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="rounded border bg-background px-3 py-2 text-sm"
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
            className="rounded-md border px-3 py-1 text-sm font-medium"
          >
            {t("settings.users.searchBtn")}
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}
      {loading ? (
        <div className="text-sm text-muted-foreground">{t("settings.users.loading")}</div>
      ) : (
        <UserListTable
          users={displayUsers}
          onCreate={() => (window.location.href = "/global/settings/security/users/new")}
          onRowClick={(id) => (window.location.href = `/global/settings/security/users/${id}`)}
          onDelete={handleDelete}
          deletingId={deletingId}
        />
      )}
    </div>
  );
}
