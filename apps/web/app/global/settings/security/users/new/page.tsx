"use client";

import React, { useEffect, useState } from "react";
import { UserForm, useI18n } from "@repo/ui";

type Role = { id: string; name: string };
type Employee = { id: string; name: string };

export default function GlobalUserCreatePage() {
  const { t } = useI18n();
  const [roles, setRoles] = useState<Role[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [rolesRes, employeesRes] = await Promise.all([
          fetch("/api/auth/roles?scope=global"),
          fetch("/api/hr/employees?scope=global"),
        ]);
        if (!rolesRes.ok) throw new Error(t("settings.users.rolesError"));
        const rolesData = await rolesRes.json();
        setRoles(rolesData.data ?? rolesData);

        if (employeesRes.ok) {
          const employeesData = await employeesRes.json();
          setEmployees(
            (employeesData.data ?? employeesData ?? []).map((e: any) => {
              const baseName = e.fullName ?? e.full_name ?? `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim();
              return {
                id: e.id,
                name: baseName && baseName.length > 0 ? baseName : e.id,
              };
            })
          );
        } else {
          console.warn("Failed to load employees for user link");
        }
      } catch (err: any) {
        setError(err?.message ?? t("settings.users.rolesError"));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [t]);

  async function handleSubmit(values: {
    email: string;
    name?: string | null;
    password?: string;
    roleIds: string[];
    employeeId?: string | null;
    mobile?: string | null;
  }) {
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: values.email,
        name: values.name,
        password: values.password,
        roleIds: values.roleIds,
        employeeId: values.employeeId ?? null,
        mobile: values.mobile ?? null,
      }),
    });
    if (!res.ok) {
      const msg = (await res.json().catch(() => ({}))).error ?? t("settings.users.createError");
      throw new Error(msg);
    }
    window.location.href = "/global/settings/security/users";
  }

  return (
    <div className="space-y-4 py-4">
      <h1 className="text-xl sm:text-2xl font-semibold">{t("settings.users.createTitle")}</h1>
      {error && <div className="text-sm text-destructive">{error}</div>}
      {loading ? (
        <div className="text-sm text-muted-foreground">{t("settings.users.loading")}</div>
      ) : (
        <UserForm
          mode="create"
          roles={roles}
          employees={employees}
          onSubmit={handleSubmit}
          onCancel={() => (window.location.href = "/global/settings/security/users")}
        />
      )}
    </div>
  );
}
