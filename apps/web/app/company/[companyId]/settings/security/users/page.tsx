"use client";

import React, { useEffect, useState } from "react";
import { AppLayout, UserListTable, useTheme } from "@repo/ui";

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

export default function CompanyUsersPage({ params }: { params: { companyId: string } | Promise<{ companyId: string }> }) {
  const { theme } = useTheme();
  const [companyId, setCompanyId] = useState<string | null>(null);
  useEffect(() => {
    Promise.resolve(params).then((p: any) => {
      const id = p?.companyId?.toString?.().trim?.() || null;
      setCompanyId(id);
      if (!id) {
        setLoading(false);
        setError("Company is required");
      }
    });
  }, [params]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  async function load() {
    if (!companyId) {
      setError("Company is required");
      setUsers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      const res = await fetch(`/api/company/${companyId}/admin/users?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load users");
      const data = await res.json();
      setUsers(data.data ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (companyId) {
      load();
    }
  }, [companyId]);

  const displayUsers = users
    // Hide branch- or vendor-scoped users from the company list
    .filter(
      (u) => !(u.roles ?? []).some((r) => /branch|vendor/i.test(r?.name ?? ""))
    )
    .map((u) => ({
      id: u.id,
      email: u.email,
      name: u.full_name ?? u.name ?? "",
      roles: u.roles ?? [],
      companyName: u.company_id ?? null,
      isActive: u.is_active ?? true,
      lastLoginAt: u.last_login_at ?? null,
    }));

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold">Company Users</h1>
            <p className="text-sm text-muted-foreground">Manage users for this company.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md shadow-sm border border-input bg-background">
              <input
                className={`${theme.input} rounded-l-md rounded-r-none w-64`}
                placeholder="Search users..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") load();
                }}
              />
              <button
                type="button"
                onClick={load}
                className="rounded-r-md px-3 py-2 text-sm font-medium bg-primary text-primary-foreground hover:opacity-90"
              >
                Search
              </button>
            </div>
          </div>
        </div>

        {error && <div className="text-sm text-destructive">{error}</div>}
        {!companyId ? (
          <div className="text-sm text-muted-foreground">Company is required.</div>
        ) : loading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (
          <div className={`${theme.cardBg} ${theme.cardBorder} rounded-2xl p-3`}>
            <UserListTable
              users={displayUsers}
              onCreate={() => (window.location.href = `/company/${companyId}/settings/security/users/new`)}
              onRowClick={(id) => (window.location.href = `/company/${companyId}/settings/security/users/${id}`)}
            />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
