"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { UserForm, useI18n } from "@repo/ui";

type Role = { id: string; name: string };
type Employee = { id: string; name: string };
type UserDetail = {
  id: string;
  email: string;
  full_name?: string | null;
  name?: string | null;
  roles?: { id: string; name: string }[];
  employee_id?: string | null;
};

export default function GlobalUserEditPage() {
  const { t } = useI18n();
  const params = useParams<{ id: string }>();
  const userId = params?.id?.toString();
  const [roles, setRoles] = useState<Role[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setError(t("settings.users.missingId"));
      setLoading(false);
      return;
    }
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [userRes, rolesRes, employeesRes] = await Promise.all([
          fetch(`/api/admin/users/${userId}`),
          fetch("/api/auth/roles?scope=global"),
          fetch("/api/hr/employees?scope=global"),
        ]);
        if (!userRes.ok) throw new Error(t("settings.users.error"));
        if (!rolesRes.ok) throw new Error(t("settings.users.rolesError"));
        const userJson = await userRes.json();
        const rolesJson = await rolesRes.json();
        setUser(userJson.data ?? userJson);
        setRoles(rolesJson.data ?? rolesJson);
        if (employeesRes.ok) {
          const employeesJson = await employeesRes.json();
          setEmployees(
            (employeesJson.data ?? employeesJson ?? []).map((e: any) => {
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
        setError(err?.message ?? t("settings.users.error"));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [t, userId]);

  async function handleSubmit(values: {
    email: string;
    name?: string | null;
    password?: string;
    roleIds: string[];
    employeeId?: string | null;
  }) {
    if (!userId) return;
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: values.email,
        name: values.name,
        password: values.password,
        roleIds: values.roleIds,
        employeeId: values.employeeId ?? null,
      }),
    });
    if (!res.ok) {
      const msg = (await res.json().catch(() => ({}))).error ?? t("settings.users.updateError");
      throw new Error(msg);
    }
    window.location.href = "/global/settings/security/users";
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
    <div className="space-y-4 py-4">
      <h1 className="text-xl sm:text-2xl font-semibold">{t("settings.users.editTitle")}</h1>
      {error && <div className="text-sm text-destructive">{error}</div>}
      {loading || !initialValues ? (
        <div className="text-sm text-muted-foreground">{t("settings.users.loading")}</div>
      ) : (
        <UserForm
          mode="edit"
          roles={roles}
          employees={employees}
          initialValues={initialValues}
          onSubmit={handleSubmit}
          onCancel={() => (window.location.href = "/global/settings/security/users")}
        />
      )}
    </div>
  );
}
