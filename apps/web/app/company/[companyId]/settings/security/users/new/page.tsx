"use client";

import React, { useEffect, useState } from "react";
import { AppLayout, UserForm, useTheme } from "@repo/ui";

type ScopeOption = {
  id: string;
  type: "company" | "branch" | "vendor";
  label: string;
  hint?: string | null;
};

type Role = { id: string; name: string };
type Employee = { id: string; name?: string | null; full_name?: string | null };

export default function CompanyUserCreatePage({
  params,
}: {
  params: { companyId: string } | Promise<{ companyId: string }>;
}) {
  const { card, cardBorder } = useTheme();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [scopeOptions, setScopeOptions] = useState<ScopeOption[]>([]);
  const [selectedScope, setSelectedScope] = useState<ScopeOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(true);

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

  useEffect(() => {
    async function load() {
      if (!companyId || !selectedScope) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        const scope = selectedScope.type === "company" ? "company" : selectedScope.type;
        params.set("scope", scope);
        params.set("companyId", companyId);
        if (selectedScope.type === "branch") params.set("branchId", selectedScope.id);
        if (selectedScope.type === "vendor") params.set("vendorId", selectedScope.id);

        const roleParams = new URLSearchParams();
        roleParams.set("scope", "company");
        roleParams.set("companyId", companyId);

        const [rolesRes, employeesRes] = await Promise.all([
          fetch(`/api/auth/roles?${roleParams.toString()}`),
          fetch(`/api/hr/employees?${params.toString()}&activeOnly=true`),
        ]);
        if (!rolesRes.ok) throw new Error("Failed to load roles");
        if (!employeesRes.ok) throw new Error("Failed to load employees");
        const rolesData = await rolesRes.json();
        const employeesData = await employeesRes.json();
        setRoles(rolesData.data ?? rolesData);
        setEmployees(
          (employeesData.data ?? employeesData ?? []).map((e: any) => ({
            id: e.id,
            name: e.full_name ?? e.name ?? `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim(),
          }))
        );
      } catch (err: any) {
        setError(err?.message ?? "Failed to load roles");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [companyId, selectedScope]);

  async function handleSubmit(values: {
    email: string;
    name?: string | null;
    password?: string;
    roleIds: string[];
    employeeId?: string | null;
    scope?: ScopeOption | null;
  }) {
    if (!companyId) {
      throw new Error("Company is required");
    }
    const payload: any = {
      email: values.email,
      name: values.name,
      password: values.password,
      roleIds: values.roleIds,
      employeeId: values.employeeId ?? null,
    };
    if (selectedScope) {
      payload.scope = selectedScope.type;
      payload.branchId = selectedScope.type === "branch" ? selectedScope.id : null;
      payload.vendorId = selectedScope.type === "vendor" ? selectedScope.id : null;
      payload.companyId = companyId;
    }

    const res = await fetch(`/api/company/${companyId}/admin/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const msg =
        (await res.json().catch(() => ({}))).error ??
        "Failed to create user";
      throw new Error(msg);
    }
    window.location.href = `/company/${companyId}/settings/security/users`;
  }

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <h1 className="text-xl sm:text-2xl font-semibold">Create User</h1>
        {error && <div className="text-sm text-destructive">{error}</div>}
        {!companyId ? (
          <div className="text-sm text-muted-foreground">Company is required.</div>
        ) : loading || optionsLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (
          <div className={`${card} ${cardBorder} rounded-2xl p-4`}>
            <UserForm
              mode="create"
              roles={roles}
              employees={employees}
              scopeOptions={scopeOptions}
              scopeValue={selectedScope}
              onScopeChange={(value) => setSelectedScope(value)}
              scopeLabel="Assign to (company / branch / vendor)"
              onSubmit={handleSubmit}
              onCancel={() =>
                (window.location.href =
                  `/company/${companyId ?? ""}/settings/security/users`)
              }
            />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
