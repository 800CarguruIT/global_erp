"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AppLayout, Card, UserListTable } from "@repo/ui";

type UserRow = {
  id: string;
  email: string;
  name?: string | null;
  full_name?: string | null;
  roles?: any[];
  is_active?: boolean;
  last_login_at?: string | null;
};

type Props =
  | { params: { companyId: string; branchId: string } }
  | { params: Promise<{ companyId: string; branchId: string }> };

export default function BranchUsersPage({ params }: Props) {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<Record<string, boolean>>({});
  const [statusError, setStatusError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    Promise.resolve(params).then((p) => {
      setCompanyId(p?.companyId ?? null);
      setBranchId(p?.branchId ?? null);
    });
  }, [params]);

  useEffect(() => {
    async function load() {
      if (!companyId || !branchId) return;
      setLoading(true);
      setError(null);
      try {
        const search = new URLSearchParams();
        search.set("branchId", branchId);
        if (query) search.set("q", query);
        const res = await fetch(`/api/company/${companyId}/admin/users?${search.toString()}`);
        if (!res.ok) throw new Error("Failed to load users");
        const data = await res.json();
        setUsers(data.data ?? data ?? []);
      } catch (err: any) {
        setError(err?.message ?? "Failed to load users");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [companyId, branchId, query]);

  async function toggleStatus(userId: string, next: boolean) {
    if (!companyId || !branchId) return;
    setStatusError(null);
    setStatusUpdating((prev) => ({ ...prev, [userId]: true }));
    try {
      const res = await fetch(
        `/api/company/${companyId}/admin/users/${userId}?branchId=${branchId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: next }),
        }
      );
      if (!res.ok) throw new Error("Failed to update status");
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_active: next } : u)));
    } catch (err: any) {
      setStatusError(err?.message ?? "Failed to update status");
    } finally {
      setStatusUpdating((prev) => ({ ...prev, [userId]: false }));
    }
  }

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
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Branch Users</h1>
          <p className="text-sm text-muted-foreground">
            Manage users scoped to this branch. New users are automatically linked to the branch.
          </p>
        </div>

        {error && <div className="text-sm text-destructive">{error}</div>}
        {!companyId || !branchId ? (
          <div className="text-sm text-muted-foreground">Branch is required.</div>
        ) : (
          <Card className="space-y-3 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="text-base font-semibold">Branch users</div>
                <div className="text-xs text-muted-foreground">
                  Search users or create a new branch user.
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
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
              loading={loading}
              emptyText="No users found for this branch."
              onToggleStatus={toggleStatus}
              statusUpdating={statusUpdating}
              statusError={statusError}
              onCreate={() => {
                if (companyId && branchId) {
                  window.location.href = `/company/${companyId}/branches/${branchId}/settings/security/users/new`;
                }
              }}
              onRowClick={(id) => {
                if (companyId && branchId) {
                  window.location.href = `/company/${companyId}/branches/${branchId}/settings/security/users/${id}`;
                }
              }}
            />
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
