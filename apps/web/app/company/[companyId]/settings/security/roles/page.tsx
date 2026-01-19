"use client";

import React, { useEffect, useState } from "react";
import { AppLayout, RoleListTable } from "@repo/ui";

type RoleRow = { id: string; name: string; key: string; permissions?: { key: string }[] };

type Params =
  | { params: { companyId: string } }
  | { params: Promise<{ companyId: string }> };

export default function CompanyRolesPage({ params }: Params) {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.resolve((params as any)?.companyId ? (params as any) : (params as any)?.params ?? params)
      .then((p: any) => {
        if (!active) return;
        const cid = p?.companyId?.toString?.().trim?.() || null;
        setCompanyId(cid);
        if (!cid) {
          setError("Company is required");
          setLoading(false);
        }
      })
      .catch(() => {
        if (!active) return;
        setError("Company is required");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [params]);

  async function load() {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const res = await fetch(`/api/auth/roles?scope=company&companyId=${companyId}`);
      if (res.status === 401 || res.status === 403) {
        setForbidden(true);
        setRoles([]);
        setError("Only company admins can manage roles and permissions.");
        return;
      }
      if (!res.ok) throw new Error("Failed to load roles");
      const data = await res.json();
      setRoles((data?.data ?? []) as any);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load roles");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [companyId]);

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold">Company Roles</h1>
            <p className="text-sm text-muted-foreground">Manage roles and permissions for this company.</p>
          </div>
          {!forbidden ? (
            <button
              className="rounded-md border px-3 py-1 text-sm font-medium"
              onClick={() => (window.location.href = `/company/${companyId}/settings/security/roles/new`)}
            >
              New Role
            </button>
          ) : null}
        </div>
        {error && <div className="text-sm text-destructive">{error}</div>}
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (
          <RoleListTable
            roles={roles as any}
            onCreate={
              forbidden
                ? undefined
                : () => (window.location.href = `/company/${companyId}/settings/security/roles/new`)
            }
            onEdit={
              forbidden
                ? undefined
                : (id) => (window.location.href = `/company/${companyId}/settings/security/roles/${id}`)
            }
            onDelete={
              forbidden
                ? undefined
                : async (id) => {
                    await fetch(`/api/auth/roles/${id}?scope=company&companyId=${companyId}`, { method: "DELETE" });
                    load();
                  }
            }
          />
        )}
      </div>
    </AppLayout>
  );
}
