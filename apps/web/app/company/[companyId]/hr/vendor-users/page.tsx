"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppLayout, Card, UserListTable, UserForm } from "@repo/ui";

type Vendor = { id: string; name?: string | null; display_name?: string | null; code?: string | null };
type Params = { params: { companyId: string } | Promise<{ companyId: string }> };

export default function VendorUsersHub({ params }: Params) {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    Promise.resolve(params).then((p) => setCompanyId(p?.companyId ?? null));
  }, [params]);

  useEffect(() => {
    async function load() {
      if (!companyId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/company/${companyId}/vendors`);
        if (!res.ok) throw new Error("Failed to load vendors");
        const data = await res.json();
        const list = data.vendors ?? data.data ?? [];
        setVendors(list);
        setSelectedVendorId((prev) => prev ?? (list[0]?.id ?? null));
      } catch (err: any) {
        setError(err?.message ?? "Failed to load vendors");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [companyId]);

  const selectedVendor = useMemo(
    () => vendors.find((v) => v.id === selectedVendorId) ?? null,
    [vendors, selectedVendorId]
  );

  useEffect(() => {
    async function loadUsers() {
      if (!companyId || !selectedVendorId) return;
      setUsersLoading(true);
      try {
        const search = new URLSearchParams();
        if (query) search.set("q", query);
        search.set("vendorId", selectedVendorId);
        const res = await fetch(`/api/company/${companyId}/admin/users?${search.toString()}`);
        if (!res.ok) throw new Error("Failed to load users");
        const data = await res.json();
        setUsers(data.data ?? data ?? []);
      } catch (err: any) {
        setError(err?.message ?? "Failed to load users");
      } finally {
        setUsersLoading(false);
      }
    }
    loadUsers();
  }, [companyId, selectedVendorId, query]);

  const displayUsers = users.map((u: any) => ({
    id: u.id,
    email: u.email,
    name: u.full_name ?? u.name ?? "",
    roles: u.roles ?? [],
    companyName: selectedVendor
      ? selectedVendor.display_name ?? selectedVendor.name ?? selectedVendor.code ?? "Vendor"
      : u.company_id ?? null,
    isActive: u.is_active ?? true,
    lastLoginAt: u.last_login_at ?? null,
  }));

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Vendor Users</h1>
          <p className="text-sm text-muted-foreground">Manage users linked to each vendor.</p>
        </div>

        {error && <div className="text-sm text-destructive">{error}</div>}
        {loading ? <div className="text-sm text-muted-foreground">Loading vendors...</div> : null}
        {!loading && vendors.length === 0 ? (
          <div className="text-sm text-muted-foreground">No vendors found.</div>
        ) : null}

        {!loading && vendors.length > 0 ? (
          <Card className="space-y-3 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="text-base font-semibold">Select vendor</div>
                <div className="text-xs text-muted-foreground">Open users for a specific vendor.</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="rounded border px-3 py-2 text-sm"
                  value={selectedVendorId ?? ""}
                  onChange={(e) => setSelectedVendorId(e.target.value || null)}
                >
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.display_name ?? v.name ?? v.code ?? "Vendor"}
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
          </Card>
        ) : null}

        {!loading && selectedVendor ? (
          <UserListTable
            users={displayUsers}
            onCreate={() =>
              companyId &&
              selectedVendorId &&
              (window.location.href = `/company/${companyId}/vendors/${selectedVendorId}/settings/security/users/new`)
            }
            onRowClick={async (id) => {
              const res = await fetch(`/api/company/${companyId}/admin/users/${id}`);
              if (res.ok) {
                const json = await res.json();
                setEditingUser(json.data ?? json);
              }
            }}
            loading={usersLoading}
            emptyText="No users found."
          />
        ) : null}

        {editingUser && selectedVendor ? (
          <Card className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-base font-semibold">Edit user</div>
                <div className="text-xs text-muted-foreground">
                  {editingUser.email} — {selectedVendor.display_name ?? selectedVendor.name ?? selectedVendor.code}
                </div>
              </div>
              <button
                className="text-sm text-muted-foreground hover:underline"
                onClick={() => setEditingUser(null)}
              >
                Close
              </button>
            </div>
            <UserForm
              mode="edit"
              roles={[]}
              initialValues={{
                email: editingUser.email,
                name: editingUser.full_name ?? editingUser.name ?? "",
                roleIds: (editingUser.roles ?? []).map((r: any) => r.id),
                employeeId: editingUser.employee_id ?? undefined,
              }}
              onSubmit={async (values) => {
                setSaving(true);
                const res = await fetch(`/api/company/${companyId}/admin/users/${editingUser.id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(values),
                });
                setSaving(false);
                if (res.ok) {
                  setEditingUser(null);
                  setUsers((prev) =>
                    prev.map((u) => (u.id === editingUser.id ? { ...u, ...values, full_name: values.name } : u))
                  );
                } else {
                  const msg = await res.text();
                  throw new Error(msg || "Failed to update user");
                }
              }}
            />
            {saving && <div className="text-xs text-muted-foreground">Saving...</div>}
          </Card>
        ) : null}
      </div>
    </AppLayout>
  );
}
