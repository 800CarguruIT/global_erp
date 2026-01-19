"use client";

import React, { useEffect, useState } from "react";
import { AppLayout, UserForm } from "@repo/ui";

type Role = { id: string; name: string };
type UserPayload = {
  email: string;
  name?: string | null;
  roleIds: string[];
  employeeId?: string | null;
  password?: string;
};

export default function BranchUserCreatePage({
  params,
}: {
  params: { companyId: string; branchId: string } | Promise<{ companyId: string; branchId: string }>;
}) {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve(params).then((p) => {
      setCompanyId(p?.companyId ?? null);
      setBranchId(p?.branchId ?? null);
    });
  }, [params]);

  useEffect(() => {
    async function load() {
      if (!companyId) return;
      setError(null);
      setLoading(true);
      try {
        // Load branch-scoped roles; branch admin has branch.admin permission
        const res = await fetch(`/api/auth/roles?scope=branch&companyId=${companyId}&branchId=${branchId}`);
        if (!res.ok) throw new Error("Failed to load roles");
        const data = await res.json();
        setRoles(data?.data ?? []);
      } catch (err: any) {
        setError(err?.message ?? "Failed to load roles");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [companyId]);

  async function handleSubmit(values: UserPayload) {
    if (!companyId || !branchId) throw new Error("Company and branch are required");
    const res = await fetch(`/api/company/${companyId}/admin/users?branchId=${branchId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, branchId }),
    });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg || "Failed to create user");
    }
    window.location.href = `/company/${companyId}/branches/${branchId}/settings/security/users`;
  }

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Create Branch User</h1>
          <p className="text-sm text-muted-foreground">
            Create a user under this branch (company scoped for now).
          </p>
        </div>
        {error && <div className="text-sm text-destructive">{error}</div>}
        {!companyId || !branchId ? (
          <div className="text-sm text-muted-foreground">Branch is required.</div>
        ) : loading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (
          <UserForm mode="create" roles={roles} onSubmit={handleSubmit} />
        )}
      </div>
    </AppLayout>
  );
}
