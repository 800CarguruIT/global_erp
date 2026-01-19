"use client";

import React, { useEffect, useState } from "react";
import { AppLayout, RoleForm } from "@repo/ui";

export default function CompanyRoleNewPage({
  params,
}: {
  params: { companyId: string } | Promise<{ companyId: string }>;
}) {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [perms, setPerms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

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

  useEffect(() => {
    async function load() {
      if (!companyId) return;
      try {
        setForbidden(false);
        const authRes = await fetch(`/api/auth/roles?scope=company&companyId=${companyId}`);
        if (authRes.status === 401 || authRes.status === 403) {
          setForbidden(true);
          setLoading(false);
          return;
        }
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
  }, [companyId]);

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-semibold">Create Company Role</h1>
          <button
            className="rounded-md border px-3 py-1 text-sm font-medium"
            onClick={() => (window.location.href = `/company/${companyId ?? ""}/settings/security/roles`)}
          >
            Back to Roles
          </button>
        </div>
        {forbidden ? (
          <div className="text-sm text-destructive">Only company admins can manage roles and permissions.</div>
        ) : loading || !companyId ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (
          <RoleForm
            mode="create"
            scope={{ scope: "company", companyId }}
            availablePermissions={perms}
            onSaved={() => (window.location.href = `/company/${companyId ?? ""}/settings/security/roles`)}
          />
        )}
        {error && <div className="text-sm text-destructive">{error}</div>}
      </div>
    </AppLayout>
  );
}
