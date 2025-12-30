"use client";

import React, { useEffect, useState } from "react";
import { AppLayout, RoleForm } from "@repo/ui";

export default function VendorRoleEditPage({
  params,
}: {
  params: { companyId: string; vendorId: string; id: string };
}) {
  const { companyId, vendorId, id } = params;
  const [role, setRole] = useState<any>(null);
  const [perms, setPerms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const [permRes, roleRes] = await Promise.all([
        fetch("/api/auth/permissions"),
        fetch(`/api/auth/roles/${id}?scope=company&companyId=${companyId}`),
      ]);
      if (!permRes.ok) throw new Error("Failed to load permissions");
      if (!roleRes.ok) throw new Error("Failed to load role");
      const permJson = await permRes.json();
      const roleJson = await roleRes.json();
      setPerms(permJson.data ?? permJson);
      setRole(roleJson.data ?? roleJson);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load role");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [companyId, vendorId, id]);

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-semibold">Edit Vendor Role</h1>
          <button
            className="rounded-md border px-3 py-1 text-sm font-medium"
            onClick={() =>
              (window.location.href = `/company/${companyId}/vendors/${vendorId}/settings/security/roles`)
            }
          >
            Back to Roles
          </button>
        </div>
        {error && <div className="text-sm text-destructive">{error}</div>}
        {loading || !role ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (
          <RoleForm
            mode="edit"
            scope={{ scope: "company", companyId }}
            initial={role}
            availablePermissions={perms}
            onSaved={() =>
              (window.location.href = `/company/${companyId}/vendors/${vendorId}/settings/security/roles`)
            }
          />
        )}
      </div>
    </AppLayout>
  );
}
