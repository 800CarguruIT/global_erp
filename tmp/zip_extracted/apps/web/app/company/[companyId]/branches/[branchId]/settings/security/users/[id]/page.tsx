"use client";

import React, { useEffect, useState } from "react";
import { AppLayout, UserForm } from "@repo/ui";

type Role = { id: string; name: string };
type UserDetail = {
  id: string;
  email: string;
  name?: string | null;
  full_name?: string | null;
  roles?: { id: string; name: string }[];
  employee_id?: string | null;
  mobile?: string | null;
};

export default function BranchUserEditPage({
  params,
}: {
  params: { companyId: string; branchId: string; id: string } | Promise<{ companyId: string; branchId: string; id: string }>;
}) {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve(params).then((p) => {
      setCompanyId(p?.companyId ?? null);
      setBranchId(p?.branchId ?? null);
      setUserId(p?.id ?? null);
    });
  }, [params]);

  useEffect(() => {
    async function load() {
      if (!companyId || !branchId || !userId) return;
      setError(null);
      setLoading(true);
      try {
        const [rolesRes, userRes] = await Promise.all([
          fetch(`/api/auth/roles?scope=branch&companyId=${companyId}&branchId=${branchId}`),
          fetch(`/api/company/${companyId}/admin/users/${userId}?branchId=${branchId}`),
        ]);
        if (!rolesRes.ok) throw new Error("Failed to load roles");
        if (!userRes.ok) throw new Error("Failed to load user");
        const rolesJson = await rolesRes.json();
        const userJson = await userRes.json();
        setRoles(rolesJson?.data ?? rolesJson?.roles ?? []);
        setUser(userJson?.data ?? userJson ?? null);
      } catch (err: any) {
        setError(err?.message ?? "Failed to load user");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [companyId, branchId, userId]);

  async function handleSubmit(values: {
    email: string;
    name?: string | null;
    password?: string;
    roleIds: string[];
    employeeId?: string | null;
    mobile?: string | null;
  }) {
    if (!companyId || !branchId || !userId) {
      throw new Error("Company, branch, and user are required");
    }
    const res = await fetch(`/api/company/${companyId}/admin/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg || "Failed to update user");
    }
    window.location.href = `/company/${companyId}/branches/${branchId}/settings/security/users`;
  }

  const initialValues = user
    ? {
      email: user.email,
      name: user.full_name ?? user.name ?? "",
      roleIds: (user.roles ?? []).map((r) => r.id),
      employeeId: user.employee_id ?? undefined,
      mobile: user.mobile ?? undefined,
    }
    : undefined;

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Edit Branch User</h1>
          <p className="text-sm text-muted-foreground">Update user details and roles.</p>
        </div>
        {error && <div className="text-sm text-destructive">{error}</div>}
        {!companyId || !branchId || !userId ? (
          <div className="text-sm text-muted-foreground">Branch and user are required.</div>
        ) : loading || !user ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (
          <UserForm mode="edit" roles={roles} initialValues={initialValues} onSubmit={handleSubmit} />
        )}
      </div>
    </AppLayout>
  );
}
