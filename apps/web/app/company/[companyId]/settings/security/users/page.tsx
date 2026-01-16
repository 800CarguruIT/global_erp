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
  branch_id?: string | null;
  branch_name?: string | null;
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
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [branchFilter, setBranchFilter] = useState<string>("");
  const [statusUpdating, setStatusUpdating] = useState<Record<string, boolean>>({});
  const [statusError, setStatusError] = useState<string | null>(null);

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

  async function toggleStatus(userId: string, next: boolean) {
    if (!companyId) return;
    setStatusError(null);
    setStatusUpdating((prev) => ({ ...prev, [userId]: true }));
    try {
      const res = await fetch(`/api/company/${companyId}/admin/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_active: next } : u)));
    } catch (err: any) {
      setStatusError(err?.message ?? "Failed to update status");
    } finally {
      setStatusUpdating((prev) => ({ ...prev, [userId]: false }));
    }
  }

  useEffect(() => {
    if (companyId) {
      load();
    }
  }, [companyId]);

  const displayUsers = users
    .filter((u) => {
      if (!roleFilter) return true;
      return (u.roles ?? []).some((r) => r.id === roleFilter);
    })
    .filter((u) => {
      if (!branchFilter) return true;
      return u.branch_id === branchFilter;
    })
    .filter((u) => {
      if (statusFilter === "all") return true;
      const isActive = u.is_active ?? true;
      return statusFilter === "active" ? isActive : !isActive;
    })
    .map((u) => ({
      id: u.id,
      email: u.email,
      name: u.full_name ?? u.name ?? "",
      roles: u.roles ?? [],
      companyName: u.company_id ?? null,
      branchId: u.branch_id ?? null,
      branchName: u.branch_name ?? null,
      isActive: u.is_active ?? true,
      lastLoginAt: u.last_login_at ?? null,
    }));

  const roleOptions = users
    .flatMap((u) => u.roles ?? [])
    .reduce<{ id: string; name: string }[]>((acc, role) => {
      if (acc.some((r) => r.id === role.id)) return acc;
      acc.push({ id: role.id, name: role.name || role.id });
      return acc;
    }, [])
    .sort((a, b) => a.name.localeCompare(b.name));

  const branchOptions = users
    .filter((u) => u.branch_id && u.branch_name)
    .reduce<{ id: string; name: string }[]>((acc, user) => {
      if (acc.some((b) => b.id === user.branch_id)) return acc;
      acc.push({ id: user.branch_id as string, name: user.branch_name as string });
      return acc;
    }, [])
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Company Users</h1>
          <p className="text-sm text-muted-foreground">Manage users for this company.</p>
        </div>

        {error && <div className="text-sm text-destructive">{error}</div>}
        {!companyId ? (
          <div className="text-sm text-muted-foreground">Company is required.</div>
        ) : loading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (
          <div className={`${theme.cardBg} ${theme.cardBorder} rounded-2xl p-3`}>
            <UserListTable
              title="Company users"
              users={displayUsers}
              query={query}
              onQueryChange={setQuery}
              onSearch={load}
              onResetFilters={() => {
                setQuery("");
                setStatusFilter("all");
                setRoleFilter("");
                setBranchFilter("");
                load();
              }}
              onRefresh={load}
              roleOptions={roleOptions}
              roleFilter={roleFilter}
              onRoleFilterChange={setRoleFilter}
              branchOptions={branchOptions}
              branchFilter={branchFilter}
              onBranchFilterChange={setBranchFilter}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              showBranchColumn
              onCreate={() => (window.location.href = `/company/${companyId}/settings/security/users/new`)}
              onEdit={(id) => (window.location.href = `/company/${companyId}/settings/security/users/${id}`)}
              onRowClick={(id) => (window.location.href = `/company/${companyId}/settings/security/users/${id}`)}
              onToggleStatus={toggleStatus}
              statusUpdating={statusUpdating}
              statusError={statusError}
            />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
