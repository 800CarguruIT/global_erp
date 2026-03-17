"use client";

import React, { useEffect, useState } from "react";
import { RoleForm, useI18n } from "@repo/ui";
import { useGlobalPermissions } from "@/lib/auth/global-permissions";
import { AccessDenied } from "@/components/AccessDenied";

export default function GlobalRoleEditSettingsPage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  const { t } = useI18n();
  const { hasPermission, loading: permLoading } = useGlobalPermissions();
  const canEditRoles = hasPermission("global.roles.edit");
  const [role, setRole] = useState<any>(null);
  const [perms, setPerms] = useState<any[]>([]);
  const [roleId, setRoleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.resolve(params).then((resolved) => {
      const nextId = resolved?.id?.toString?.().trim?.();
      if (mounted) {
        setRoleId(nextId && nextId !== "undefined" ? nextId : null);
      }
    });
    return () => {
      mounted = false;
    };
  }, [params]);

  async function load() {
    if (!roleId) {
      setError(t("settings.roles.roleError"));
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const [permRes, roleRes] = await Promise.all([
        fetch("/api/auth/permissions?scope=global"),
        fetch(`/api/auth/roles/${roleId}?scope=global`),
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
    if (!canEditRoles) {
      setLoading(false);
      return;
    }
    if (!roleId) {
      setError(t("settings.roles.roleError"));
      setLoading(false);
      return;
    }
    load();
  }, [roleId, canEditRoles]);

  if (permLoading) {
    return <div className="py-4 text-sm text-muted-foreground">Loading access rights...</div>;
  }

  if (!canEditRoles) {
    return (
      <div className="py-4">
        <AccessDenied
          title="Edit roles access locked"
          description="You need the global.roles.edit permission to modify global roles."
        />
      </div>
    );
  }

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
