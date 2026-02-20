"use client";

import React, { useEffect, useState } from "react";
import { RoleListTable, useI18n } from "@repo/ui";
import { useGlobalPermissions } from "@/lib/auth/global-permissions";
import { AccessDenied } from "@/components/AccessDenied";

export default function GlobalRolesSettingsPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();
  const { hasPermission, loading: permLoading } = useGlobalPermissions();
  const canListRoles = hasPermission("global.roles.list");
  const canCreateRoles = hasPermission("global.roles.create");
  const canEditRoles = hasPermission("global.roles.edit");
  const canDeleteRoles = hasPermission("global.roles.delete");

  async function load() {
    setLoading(true);
    setError(null);
    if (!canListRoles) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/auth/roles?scope=global");
      if (!res.ok) throw new Error(t("settings.roles.error"));
      const data = await res.json();
      setRoles(data.data ?? data ?? []);
    } catch (err: any) {
      setError(err?.message ?? t("settings.roles.error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canListRoles) {
      setLoading(false);
      setError(null);
      return;
    }
    load();
  }, [canListRoles]);

  if (permLoading) {
    return <div className="py-4 text-sm text-muted-foreground">Loading access rights...</div>;
  }

  if (!canListRoles) {
    return (
      <div className="py-4">
        <AccessDenied
          title="Roles access locked"
          description="You need the global.roles.list permission to open this area."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-semibold">{t("settings.roles.title")}</h1>
          <button
            className="rounded-md border px-3 py-1 text-sm font-medium"
            onClick={() => (window.location.href = "/global/settings/security/roles/new")}
          >
            {t("settings.roles.new")}
          </button>
        </div>
      {error && <div className="text-sm text-destructive">{error ?? t("settings.roles.error")}</div>}
      {loading ? (
        <div className="text-sm text-muted-foreground">{t("settings.roles.loading")}</div>
      ) : (
        <RoleListTable
          roles={roles as any}
          onCreate={
            canCreateRoles ? () => (window.location.href = "/global/settings/security/roles/new") : undefined
          }
          onEdit={
            canEditRoles
              ? (id) => (window.location.href = `/global/settings/security/roles/${id}`)
              : undefined
          }
          onDelete={
            canDeleteRoles
              ? async (id) => {
                  await fetch(`/api/auth/roles/${id}?scope=global`, { method: "DELETE" });
                  load();
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
