"use client";

import React, { useEffect, useState } from "react";
import { AppLayout, UserForm } from "@repo/ui";

type ScopeOption = {
  id: string;
  type: "company" | "branch" | "vendor";
  label: string;
  hint?: string | null;
};

type Role = { id: string; name: string };
type Employee = { id: string; name?: string | null; full_name?: string | null };
type UserDetail = {
  id: string;
  email: string;
  full_name?: string | null;
  name?: string | null;
  roles?: { id: string; name: string }[];
  employee_id?: string | null;
};

export default function CompanyUserEditPage({
  params,
}: {
  params: { companyId: string; id: string } | Promise<{ companyId: string; id: string }>;
}) {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [scopeOptions, setScopeOptions] = useState<ScopeOption[]>([]);
  const [selectedScope, setSelectedScope] = useState<ScopeOption | null>(null);
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [employeesLoading, setEmployeesLoading] = useState(true);

  useEffect(() => {
    Promise.resolve(params).then((p: any) => {
      const cid = p?.companyId?.toString?.().trim?.() || null;
      const uid = p?.id?.toString?.().trim?.() || null;
      setCompanyId(cid);
      setUserId(uid);
      if (!cid || !uid) {
        setLoading(false);
        setError("Company and user are required");
      }
    });
  }, [params]);

  useEffect(() => {
    async function loadScopeOptions() {
      if (!companyId) return;
      setOptionsLoading(true);
      try {
        const [branchesRes, vendorsRes] = await Promise.all([
          fetch(`/api/company/${companyId}/branches`),
          fetch(`/api/company/${companyId}/vendors`),
        ]);
        const branchesJson = branchesRes.ok ? await branchesRes.json() : { branches: [] };
        const vendorsJson = vendorsRes.ok ? await vendorsRes.json() : { vendors: [] };
        const base: ScopeOption = { id: companyId, type: "company", label: "Company (default)" };
        const branchOpts: ScopeOption[] = (branchesJson.branches ?? []).map((b: any) => ({
          id: b.id,
          type: "branch",
          label: b.display_name ?? b.name ?? b.code ?? "Branch",
          hint: b.code ?? undefined,
        }));
        const vendorOpts: ScopeOption[] = (vendorsJson.vendors ?? []).map((v: any) => ({
          id: v.id,
          type: "vendor",
          label: v.display_name ?? v.name ?? v.code ?? "Vendor",
          hint: v.code ?? undefined,
        }));
        const all = [base, ...branchOpts, ...vendorOpts];
        setScopeOptions(all);
        setSelectedScope((prev) => prev ?? base);
      } catch (err) {
        console.warn("Failed to load scope options", err);
        const fallback: ScopeOption = { id: companyId, type: "company", label: "Company (default)" };
        setScopeOptions([fallback]);
        setSelectedScope((prev) => prev ?? fallback);
      } finally {
        setOptionsLoading(false);
      }
    }
    loadScopeOptions();
  }, [companyId]);

  // Load user details once
  useEffect(() => {
    async function loadUser() {
      if (!companyId || !userId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/company/${companyId}/admin/users/${userId}`);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Failed to load user");
        }
        const userJson = await res.json();
        setUser(userJson.data ?? userJson);
        // Default the scope dropdown to the user's company if we don't have a selection yet
        setSelectedScope((prev) => prev ?? (scopeOptions.find((o) => o.type === "company") ?? null));
      } catch (err: any) {
        setError(err?.message ?? "Failed to load user");
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, [companyId, userId]);

  // Load all roles across company, branch, and vendor scopes.
  useEffect(() => {
    async function loadAllRoles() {
      if (!companyId || scopeOptions.length === 0) return;
      setRolesLoading(true);
      try {
        const responses = await Promise.all(
          scopeOptions.map(async (opt) => {
            const params = new URLSearchParams();
            params.set("scope", opt.type);
            params.set("companyId", companyId);
            if (opt.type === "branch") params.set("branchId", opt.id);
            if (opt.type === "vendor") params.set("vendorId", opt.id);
            const res = await fetch(`/api/auth/roles?${params.toString()}`);
            if (!res.ok) return [];
            const json = await res.json();
            return (json.data ?? json) as Role[];
          })
        );
        const merged = new Map<string, Role>();
        responses.flat().forEach((role) => {
          if (!merged.has(role.id)) merged.set(role.id, role);
        });
        setRoles(Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name)));
      } catch (err) {
        console.warn("Failed to load roles", err);
      } finally {
        setRolesLoading(false);
      }
    }
    loadAllRoles();
  }, [companyId, scopeOptions]);

  // Load employees for the selected scope
  useEffect(() => {
    async function loadEmployees() {
      if (!companyId || !selectedScope) return;
      setEmployeesLoading(true);
      try {
        const params = new URLSearchParams();
        const scope = selectedScope.type === "company" ? "company" : selectedScope.type;
        params.set("scope", scope);
        params.set("companyId", companyId);
        if (selectedScope.type === "branch") params.set("branchId", selectedScope.id);
        if (selectedScope.type === "vendor") params.set("vendorId", selectedScope.id);
        const employeesRes = await fetch(`/api/hr/employees?${params.toString()}&activeOnly=true`);
        if (employeesRes.ok) {
          const employeesJson = await employeesRes.json();
          setEmployees(
            (employeesJson.data ?? employeesJson ?? []).map((e: any) => ({
              id: e.id,
              name: e.full_name ?? e.name ?? `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim(),
            }))
          );
        }
      } catch (err) {
        console.warn("Failed to load employees", err);
      } finally {
        setEmployeesLoading(false);
      }
    }
    loadEmployees();
  }, [companyId, selectedScope]);

  async function handleSubmit(values: {
    email: string;
    name?: string | null;
    password?: string;
    roleIds: string[];
    employeeId?: string | null;
    scope?: ScopeOption | null;
  }) {
    if (!companyId || !userId) {
      throw new Error("Company and user are required");
    }
    const res = await fetch(`/api/company/${companyId}/admin/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: values.email,
        name: values.name,
        password: values.password,
        roleIds: values.roleIds,
        employeeId: values.employeeId ?? null,
        scope: selectedScope?.type ?? null,
        branchId: selectedScope?.type === "branch" ? selectedScope.id : null,
        vendorId: selectedScope?.type === "vendor" ? selectedScope.id : null,
      }),
    });
    if (!res.ok) {
      const msg =
        (await res.json().catch(() => ({}))).error ??
        "Failed to update user";
      throw new Error(msg);
    }
    window.location.href = `/company/${companyId}/settings/security/users`;
  }

  const initialValues = user
    ? {
        email: user.email,
        name: user.full_name ?? user.name ?? "",
        roleIds: user.roles?.map((r) => r.id) ?? [],
        employeeId: user.employee_id ?? undefined,
      }
    : undefined;

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <h1 className="text-xl sm:text-2xl font-semibold">Edit User</h1>
        {error && <div className="text-sm text-destructive">{error}</div>}
        {!companyId || !userId ? (
          <div className="text-sm text-muted-foreground">Company and user are required.</div>
        ) : loading || !initialValues || optionsLoading || rolesLoading || employeesLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (
          <UserForm
            mode="edit"
            roles={roles}
            employees={employees}
            scopeOptions={scopeOptions}
            scopeValue={selectedScope}
            onScopeChange={(value) => setSelectedScope(value)}
            scopeLabel="Assign to (company / branch / vendor)"
            initialValues={initialValues}
            onSubmit={handleSubmit}
            onCancel={() =>
              (window.location.href =
                `/company/${companyId ?? ""}/settings/security/users`)
            }
          />
        )}
      </div>
    </AppLayout>
  );
}
