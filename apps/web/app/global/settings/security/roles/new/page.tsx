"use client";

import React, { useEffect, useState } from "react";
import { RoleForm, useI18n } from "@repo/ui";
import { useGlobalPermissions } from "@/lib/auth/global-permissions";
import { AccessDenied } from "@/components/AccessDenied";

export default function GlobalRoleNewSettingsPage() {
  const { t } = useI18n();
  const { hasPermission, loading: permLoading } = useGlobalPermissions();
  const canCreateRoles = hasPermission("global.roles.create");
  const [perms, setPerms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/auth/permissions?scope=global");
        if (!res.ok) throw new Error(t("settings.roles.permsError"));
        const data = await res.json();
        setPerms(data.data ?? data);
      } catch (err: any) {
        setError(err?.message ?? t("settings.roles.permsError"));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [t]);

  if (permLoading) {
    return <div className="py-4 text-sm text-muted-foreground">Loading access rights...</div>;
  }

  if (!canCreateRoles) {
    return (
      <div className="py-4">
        <AccessDenied
          title="Create roles access locked"
          description="You need the global.roles.create permission to add global roles."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-semibold">{t("settings.roles.createTitle")}</h1>
        <button
          className="rounded-md border px-3 py-1 text-sm font-medium"
          onClick={() => (window.location.href = "/global/settings/security/roles")}
        >
          {t("settings.roles.back")}
        </button>
      </div>
      {loading ? (
        <div className="text-sm text-muted-foreground">{t("settings.roles.loading")}</div>
      ) : (
        <RoleForm
          mode="create"
          scope={{ scope: "global" }}
          availablePermissions={perms}
          onSaved={() => (window.location.href = "/global/settings/security/roles")}
        />
      )}
      {error && <div className="text-sm text-destructive">{error}</div>}
    </div>
  );
}
