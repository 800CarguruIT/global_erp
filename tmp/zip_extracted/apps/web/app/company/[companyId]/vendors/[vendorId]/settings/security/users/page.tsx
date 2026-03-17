"use client";

import React, { useEffect, useState } from "react";
import { AppLayout, UserListTable } from "@repo/ui";

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

export default function VendorUsersPage({
  params,
}: {
  params: { companyId: string; vendorId: string };
}) {
  const { companyId, vendorId } = params;
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusUpdating, setStatusUpdating] = useState<Record<string, boolean>>({});
  const [statusError, setStatusError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const search = new URLSearchParams();
      if (query) search.set("q", query);
      // Reuse company admin users endpoint for now
      const res = await fetch(`/api/company/${companyId}/admin/users?${search.toString()}`);
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
    load();
  }, [companyId, vendorId]);

  async function toggleStatus(userId: string, next: boolean) {
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
    <AppLayout>
      <div className="space-y-4 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold">Vendor Users</h1>
            <p className="text-sm text-muted-foreground">
              Manage users for this vendor (company-scoped list for now).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="rounded border bg-background px-3 py-2 text-sm"
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
              className="rounded-md border px-3 py-1 text-sm font-medium"
            >
              Search
            </button>
          </div>
        </div>

        {error && <div className="text-sm text-destructive">{error}</div>}
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (
          <UserListTable
            users={displayUsers}
            onCreate={() =>
              (window.location.href = `/company/${companyId}/settings/security/users/new`)
            }
            onRowClick={(id) =>
              (window.location.href = `/company/${companyId}/settings/security/users/${id}`)
            }
            onToggleStatus={toggleStatus}
            statusUpdating={statusUpdating}
            statusError={statusError}
          />
        )}
      </div>
    </AppLayout>
  );
}
