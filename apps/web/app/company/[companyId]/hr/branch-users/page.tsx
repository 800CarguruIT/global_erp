"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AppLayout, Card, UserListTable } from "@repo/ui";

type Branch = { id: string; name?: string | null; code?: string | null; display_name?: string | null };
type UserRow = {
  id: string;
  email: string;
  name?: string | null;
  full_name?: string | null;
  roles?: any[];
  is_active?: boolean;
  last_login_at?: string | null;
};

type Params = { params: { companyId: string } | Promise<{ companyId: string }> };

export default function BranchUsersHub({ params }: Params) {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    Promise.resolve(params).then((p) => setCompanyId(p?.companyId ?? null));
  }, [params]);

  useEffect(() => {
    async function loadBranches() {
      if (!companyId) return;
      setLoadingBranches(true);
      setError(null);
      try {
        const res = await fetch(`/api/company/${companyId}/branches`);
        if (!res.ok) throw new Error("Failed to load branches");
        const data = await res.json();
        const list: Branch[] = data.data ?? data.branches ?? [];
        setBranches(list);
        setSelectedBranchId((prev) => prev ?? (list[0]?.id ?? null));
      } catch (err: any) {
        setError(err?.message ?? "Failed to load branches");
      } finally {
        setLoadingBranches(false);
      }
    }
    loadBranches();
  }, [companyId]);

  useEffect(() => {
    async function loadUsers() {
      if (!companyId || !selectedBranchId) return;
      setLoadingUsers(true);
      setError(null);
      try {
        const search = new URLSearchParams();
        search.set("branchId", selectedBranchId);
        if (query) search.set("q", query);
        const res = await fetch(`/api/company/${companyId}/admin/users?${search.toString()}`);
        if (!res.ok) throw new Error("Failed to load users");
        const data = await res.json();
        setUsers(data.data ?? data ?? []);
      } catch (err: any) {
        setError(err?.message ?? "Failed to load users");
      } finally {
        setLoadingUsers(false);
      }
    }
    loadUsers();
  }, [companyId, selectedBranchId, query]);

  const displayUsers = useMemo(
    () =>
      users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.full_name ?? u.name ?? "",
        roles: u.roles ?? [],
        companyName: "Branch",
        isActive: u.is_active ?? true,
        lastLoginAt: u.last_login_at ?? null,
      })),
    [users]
  );

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Branch Users</h1>
          <p className="text-sm text-muted-foreground">
            Company view of branch-scoped users. Create and manage users directly for each branch.
          </p>
        </div>

        {error && <div className="text-sm text-destructive">{error}</div>}

        <Card className="space-y-3 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="text-base font-semibold">Select branch</div>
              <div className="text-xs text-muted-foreground">
                Users stay in sync with branch settings.
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="rounded border px-3 py-2 text-sm"
                value={selectedBranchId ?? ""}
                onChange={(e) => setSelectedBranchId(e.target.value || null)}
                disabled={loadingBranches || !branches.length}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.display_name || b.name || b.code || b.id.slice(0, 8)}
                  </option>
                ))}
              </select>
              <input
                className="rounded border px-3 py-2 text-sm"
                placeholder="Search users..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <UserListTable
            users={displayUsers}
            loading={loadingUsers}
            emptyText={selectedBranchId ? "No users found for this branch." : "Select a branch to view users."}
            onCreate={() => {
              if (companyId && selectedBranchId) {
                window.location.href = `/company/${companyId}/branches/${selectedBranchId}/settings/security/users/new`;
              }
            }}
            onRowClick={(id) => {
              if (companyId && selectedBranchId) {
                window.location.href = `/company/${companyId}/branches/${selectedBranchId}/settings/security/users/${id}`;
              }
            }}
          />
        </Card>
      </div>
    </AppLayout>
  );
}
