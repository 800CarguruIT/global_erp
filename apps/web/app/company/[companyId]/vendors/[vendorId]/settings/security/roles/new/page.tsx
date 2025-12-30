"use client";

import React, { useEffect, useState } from "react";
import { AppLayout, RoleForm } from "@repo/ui";

export default function VendorRoleNewPage({
  params,
}: {
  params: { companyId: string; vendorId: string };
}) {
  const { companyId, vendorId } = params;
  const [perms, setPerms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/auth/permissions");
        if (!res.ok) throw new Error("Failed to load permissions");
        const data = await res.json();
        setPerms(data.data ?? data);
      } catch (err: any) {
        setError(err?.message ?? "Failed to load permissions");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-semibold">Create Vendor Role</h1>
          <button
            className="rounded-md border px-3 py-1 text-sm font-medium"
            onClick={() =>
              (window.location.href = `/company/${companyId}/vendors/${vendorId}/settings/security/roles`)
            }
          >
            Back to Roles
          </button>
        </div>
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (
          <RoleForm
            mode="create"
            scope={{ scope: "company", companyId }}
            availablePermissions={perms}
            onSaved={() =>
              (window.location.href = `/company/${companyId}/vendors/${vendorId}/settings/security/roles`)
            }
          />
        )}
        {error && <div className="text-sm text-destructive">{error}</div>}
      </div>
    </AppLayout>
  );
}
