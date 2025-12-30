"use client";

import React, { useEffect, useState } from "react";
import { AppLayout, RoleForm } from "@repo/ui";

type Params =
  | { params: { companyId: string; id: string } }
  | { params: Promise<{ companyId: string; id: string }> };

export default function CompanyRoleEditPage({ params }: Params) {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [roleId, setRoleId] = useState<string | null>(null);
  const [role, setRole] = useState<any>(null);
  const [perms, setPerms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Resolve params which may be a promise in App Router
  useEffect(() => {
    let active = true;
    Promise.resolve((params as any)?.companyId ? (params as any) : (params as any)?.params ?? params)
      .then((p: any) => {
        if (!active) return;
        const cid = p?.companyId?.toString?.().trim?.() || null;
        const rid = p?.id?.toString?.().trim?.() || null;
        setCompanyId(cid);
        setRoleId(rid);
        if (!cid || !rid) {
          setError("Company and role are required");
          setLoading(false);
        }
      })
      .catch(() => {
        if (!active) return;
        setError("Company and role are required");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [params]);

  async function load() {
    if (!companyId || !roleId) return;
    setError(null);
    setLoading(true);
    try {
      const [permRes, roleRes] = await Promise.all([
        fetch("/api/auth/permissions"),
        fetch(`/api/auth/roles/${roleId}?scope=company&companyId=${companyId}`),
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
  }, [companyId, roleId]);

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-semibold">Edit Company Role</h1>
          <button
            className="rounded-md border px-3 py-1 text-sm font-medium"
            onClick={() => (window.location.href = `/company/${companyId}/settings/security/roles`)}
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
            onSaved={() => (window.location.href = `/company/${companyId}/settings/security/roles`)}
          />
        )}
      </div>
    </AppLayout>
  );
}
