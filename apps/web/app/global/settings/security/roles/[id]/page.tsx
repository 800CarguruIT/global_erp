"use client";

import React, { useEffect, useState } from "react";
import { RoleForm, useI18n } from "@repo/ui";

export default function GlobalRoleEditSettingsPage({ params }: { params: { id: string } }) {
  const { t } = useI18n();
  const { id } = params;
  const [role, setRole] = useState<any>(null);
  const [perms, setPerms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const [permRes, roleRes] = await Promise.all([
        fetch("/api/auth/permissions"),
        fetch(`/api/auth/roles/${id}?scope=global`),
      ]);
      if (!permRes.ok) throw new Error(t("settings.roles.permsError"));
      if (!roleRes.ok) throw new Error(t("settings.roles.roleError"));
      const permJson = await permRes.json();
      const roleJson = await roleRes.json();
      setPerms(permJson.data ?? permJson);
      setRole(roleJson.data ?? roleJson);
    } catch (err: any) {
      setError(err?.message ?? t("settings.roles.roleError"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-semibold">{t("settings.roles.editTitle")}</h1>
        <button
          className="rounded-md border px-3 py-1 text-sm font-medium"
          onClick={() => (window.location.href = "/global/settings/security/roles")}
        >
          {t("settings.roles.back")}
        </button>
      </div>
      {error && <div className="text-sm text-destructive">{error}</div>}
      {loading || !role ? (
        <div className="text-sm text-muted-foreground">{t("settings.roles.loading")}</div>
      ) : (
        <RoleForm
          mode="edit"
          scope={{ scope: "global" }}
          initial={role}
          availablePermissions={perms}
          onSaved={() => (window.location.href = "/global/settings/security/roles")}
        />
      )}
    </div>
  );
}
