"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, UserListTable, useI18n } from "@repo/ui";
import { useGlobalPermissions } from "@/lib/auth/global-permissions";
import { AccessDenied } from "@/components/AccessDenied";

type UserRow = {
  id: string;
  email: string;
  full_name?: string | null;
  name?: string | null;
  roles?: { id: string; name: string }[];
  is_active?: boolean;
  last_login_at?: string | null;
  company_id?: string | null;
};

export default function GlobalUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resettingPasswordId, setResettingPasswordId] = useState<string | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<{ id: string; email: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<Record<string, boolean>>({});
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [roleFilter, setRoleFilter] = useState("");
  const { t } = useI18n();
  const { hasPermission, loading: permLoading } = useGlobalPermissions();
  const canListUsers = hasPermission("global.users.list");
  const canCreateUsers = hasPermission("global.users.create");
  const canEditUsers = hasPermission("global.users.edit");
  const canToggleStatus = hasPermission("global.users.status");
  const canDeleteUsers = hasPermission("global.users.delete");

  async function load() {
    setLoading(true);
    setError(null);
    if (!canListUsers) {
      setLoading(false);
      return;
    }
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      params.set("scope", "global");
      params.set("status", statusFilter);
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) throw new Error(t("settings.users.error"));
      const data = await res.json();
      const preservedNames = new Map(users.map((user) => [user.id, user.full_name ?? user.name ?? ""]));
      setUsers(
        (data.data ?? []).map((user: any) => ({
          ...user,
          full_name: user.full_name ?? preservedNames.get(user.id) ?? user.full_name,
        }))
      );
    } catch (err: any) {
      setError(err?.message ?? t("settings.users.error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canListUsers) {
      setLoading(false);
      setError(null);
      return;
    }
    load();
  }, [statusFilter, canListUsers]);

  async function handleDelete(id: string) {
    const target = users.find((u) => u.id === id);
    const label = target?.email || target?.full_name || target?.name || "this user";
    const confirmed = window.confirm(`Delete ${label}?`);
    if (!confirmed) return;

    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Failed to delete user (${res.status})`);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err: any) {
      setError(err?.message ?? t("settings.users.error"));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggleStatus(id: string, next: boolean) {
    setStatusError(null);
    setStatusUpdating((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Failed to update status");
      }
      await load();
    } catch (err: any) {
      setStatusError(err?.message ?? "Failed to update status");
    } finally {
      setStatusUpdating((prev) => ({ ...prev, [id]: false }));
    }
  }

  const displayUsers = useMemo(
    () =>
      users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.full_name ?? u.name ?? "",
        roles: u.roles ?? [],
        companyName: u.company_id ?? null,
        isActive: u.is_active ?? true,
        lastLoginAt: u.last_login_at ?? null,
      })),
    [users]
  );

  const roleOptions = useMemo(() => {
    const seen = new Map<string, { id: string; name: string }>();
    users.forEach((u) => {
      u.roles?.forEach((role) => {
        const roleId = role.id || role.name || "";
        if (!roleId || seen.has(roleId)) return;
        seen.set(roleId, { id: role.id || roleId, name: role.name || roleId });
      });
    });
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

  const filteredUsers = useMemo(
    () =>
      displayUsers.filter((user) => {
        if (statusFilter === "active" && user.isActive === false) return false;
        if (statusFilter === "inactive" && user.isActive !== false) return false;
        if (
          roleFilter &&
          !user.roles.some(
            (role) => (role.id || role.name || "").toLowerCase() === roleFilter.toLowerCase()
          )
        ) {
          return false;
        }
        return true;
      }),
    [displayUsers, roleFilter, statusFilter]
  );

  const generatePassword = () => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    return Array.from({ length: 12 }, () => alphabet.charAt(Math.floor(Math.random() * alphabet.length))).join("");
  };

  const openPasswordModal = (id: string, email: string) => {
    setResettingPasswordId(id);
    setPasswordError(null);
    setPasswordSuccess(null);
    setNewPassword(generatePassword());
    setPasswordTarget({ id, email });
  };

  const closePasswordModal = () => {
    setPasswordTarget(null);
    setNewPassword("");
    setPasswordSaving(false);
    setPasswordError(null);
    setPasswordSuccess(null);
    setResettingPasswordId(null);
  };

  const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!passwordTarget) return;
    setPasswordSaving(true);
    setPasswordError(null);
    setPasswordSuccess(null);
    try {
      const res = await fetch(`/api/admin/users/${passwordTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.error ?? "Failed to update password");
      }
      setPasswordSuccess("Password updated. Share it securely.");
      await load();
    } catch (err: any) {
      setPasswordError(err?.message ?? "Failed to update password");
    } finally {
      setPasswordSaving(false);
      setResettingPasswordId(null);
    }
  };

  const handleOpenPasswordModal = (id: string) => {
    const user = displayUsers.find((entry) => entry.id === id);
    if (!user) return;
    openPasswordModal(user.id, user.email);
  };

  if (permLoading) {
    return <div className="py-4 text-sm text-muted-foreground">Loading access rights...</div>;
  }

  if (!canListUsers) {
    return (
      <div className="py-4">
        <AccessDenied
          title="Users access locked"
          description="You need the global.users.list permission to manage global users."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 py-4">
      <Card className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold">{t("settings.users.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("settings.users.subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={() => (window.location.href = "/global/settings/security/users/new")}
            className="inline-flex items-center gap-2 rounded-md border border-white/20 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:border-white/50"
          >
            <span className="text-base font-bold">+</span>
            Add user
          </button>
        </div>

        {error && <div className="text-sm text-destructive">{error}</div>}
        {statusError && <div className="text-sm text-destructive">{statusError}</div>}
        <div className="rounded-2xl bg-muted/40 p-6 shadow-inner">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex w-full max-w-md items-center gap-2">
              <input
                className="w-full rounded-md bg-slate-50 px-4 py-2 text-sm  text-slate-500 shadow-inner outline-none focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder={t("settings.users.search")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") load();
                }}
              />
              <button
                type="button"
                onClick={load}
                className="rounded-md border border-white/20 px-4 py-2 text-xs  uppercase tracking-wide text-white transition hover:border-white/40"
              >
                {t("settings.users.searchBtn")}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-col text-xs  uppercase tracking-[0.2em] text-muted-foreground">
                <span className="text-[10px] text-muted-foreground mb-1">Status</span>
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as "all" | "active" | "inactive")
                  }
                className="rounded-md border border-white/20 bg-slate-50 px-3 py-1.5 text-sm  text-slate-500 shadow-inner focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="all">{t("settings.users.status.all")}</option>
                  <option value="active">{t("settings.users.status.active")}</option>
                  <option value="inactive">{t("settings.users.status.inactive")}</option>
                </select>
              </div>
              <div className="flex flex-col text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                <span className="text-[10px] text-muted-foreground mb-1">Roles</span>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                className="rounded-md border border-white/20 bg-slate-50 px-3 py-1.5 text-sm  text-slate-500 shadow-inner focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">{t("settings.users.roles.all")}</option>
                  {roleOptions.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="mt-6">
            {loading ? (
              <div className="text-sm text-muted-foreground">{t("settings.users.loading")}</div>
            ) : (
            <UserListTable
              users={filteredUsers}
              onCreate={
                canCreateUsers ? () => (window.location.href = "/global/settings/security/users/new") : undefined
              }
              onRowClick={
                canEditUsers ? (id) => (window.location.href = `/global/settings/security/users/${id}`) : undefined
              }
              onDelete={canDeleteUsers ? handleDelete : undefined}
              deletingId={deletingId}
              onResetPassword={canEditUsers ? handleOpenPasswordModal : undefined}
              resettingPasswordId={resettingPasswordId}
              onToggleStatus={canToggleStatus ? handleToggleStatus : undefined}
              statusUpdating={statusUpdating}
              statusError={statusError}
              hideCreateButton={!canCreateUsers}
            />
            )}
          </div>
        </div>
      </Card>
      {passwordTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="absolute inset-0 bg-slate-950/70" onClick={closePasswordModal} />
          <form
            onSubmit={handlePasswordSubmit}
            className="relative w-full max-w-md space-y-4 rounded-2xl border border-white/10 bg-background p-6 shadow-2xl"
          >
            <div className="text-lg font-semibold">Share new credentials</div>
            <p className="text-sm text-muted-foreground">Email and password for copying.</p>
            <div className="space-y-1 text-sm">
              <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Email</div>
              <input
                className="w-full rounded-lg border border-border/60 bg-slate-50 px-3 py-2 text-sm text-slate-800"
                value={passwordTarget.email}
                readOnly
              />
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-muted-foreground">
                <span>New password</span>
                <button
                  type="button"
                  className="text-[10px] font-semibold text-primary transition hover:text-primary-foreground"
                  onClick={() => {
                    const next = generatePassword();
                    setNewPassword(next);
                    setPasswordSuccess(null);
                    setPasswordError(null);
                  }}
                >
                  Regenerate
                </button>
              </div>
              <input
                required
                className="w-full rounded-lg border border-border/60 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:border-primary focus:ring-0"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            {passwordError && <div className="text-xs text-destructive">{passwordError}</div>}
            {passwordSuccess && <div className="text-xs text-emerald-500">{passwordSuccess}</div>}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="rounded-md border border-border/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition hover:border-white/40"
                onClick={closePasswordModal}
                disabled={passwordSaving}
              >
                Close
              </button>
              <button
                type="submit"
                className="rounded-md bg-primary px-4 py-1 text-xs font-semibold uppercase tracking-wide text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
                disabled={passwordSaving}
              >
                {passwordSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
