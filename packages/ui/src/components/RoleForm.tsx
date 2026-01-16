"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card } from "./Card";
import { useI18n } from "../i18n";

type RoleScope = "global" | "company" | "branch" | "vendor";

type Permission = { id: string; key: string; description: string };
type Role = {
  id?: string;
  name: string;
  key: string;
  description?: string | null;
  scope: RoleScope;
  company_id?: string | null;
  branch_id?: string | null;
  vendor_id?: string | null;
  is_system?: boolean;
  permissions?: Permission[];
};

type Props = {
  mode?: "create" | "edit";
  initial?: Role;
  availablePermissions: Permission[];
  scope: { scope: RoleScope; companyId?: string; branchId?: string; vendorId?: string };
  onSaved?: (role: any) => void;
};

export function RoleForm({ mode = "create", initial, availablePermissions, scope, onSaved }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState(initial?.name ?? "");
  const [key, setKey] = useState(initial?.key ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [selectedPerms, setSelectedPerms] = useState<string[]>(
    (initial?.permissions ?? []).map((p) => p.key)
  );
  const [search, setSearch] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const resolvedCompanyId = useMemo(() => {
    if (scope.companyId) return scope.companyId;
    if (typeof window === "undefined") return undefined;
    const match = window.location.pathname.match(/\/company\/([^/]+)/);
    return match?.[1];
  }, [scope.companyId]);

  useEffect(() => {
    if (initial) {
      setName(initial.name);
      setKey(initial.key);
      setDescription(initial.description ?? "");
      setSelectedPerms((initial.permissions ?? []).map((p) => p.key));
    }
  }, [initial]);

  useEffect(() => {
    if (mode === "edit" || initial?.is_system) return;
    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "");
    const suffix = resolvedCompanyId ? `.${resolvedCompanyId}` : "";
    setKey(`${slug}${suffix}`);
  }, [name, mode, initial?.is_system, resolvedCompanyId]);

  async function handleSave() {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      if (scope.scope === "company" && !resolvedCompanyId) {
        throw new Error("Company is required");
      }
      const payload = {
        name,
        key,
        description,
        scope: scope.scope,
        companyId: resolvedCompanyId ?? null,
        branchId: scope.branchId ?? null,
        vendorId: scope.vendorId ?? null,
        permissionKeys: selectedPerms,
      };
      const url =
        mode === "edit" && initial?.id ? `/api/auth/roles/${initial.id}` : "/api/auth/roles";
      const res = await fetch(url, {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save role");
      }
      const data = await res.json();
      setSuccess("Saved");
      onSaved?.(data);
    } catch (err: any) {
      setError(err?.message ?? "Failed to save role");
    } finally {
      setSaving(false);
    }
  }

  const normalizedSearch = search.trim().toLowerCase();
  const filteredPermissions = useMemo(() => {
    if (!normalizedSearch) return availablePermissions;
    return availablePermissions.filter((perm) => {
      const text = `${perm.key} ${perm.description ?? ""}`.toLowerCase();
      return text.includes(normalizedSearch);
    });
  }, [availablePermissions, normalizedSearch]);

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, Permission[]>();
    filteredPermissions.forEach((perm) => {
      const group = perm.key.includes(".") ? perm.key.split(".")[0] : "other";
      const list = groups.get(group) ?? [];
      list.push(perm);
      groups.set(group, list);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredPermissions]);

  const togglePermission = (permKey: string, checked: boolean) => {
    setSelectedPerms((prev) =>
      checked ? (prev.includes(permKey) ? prev : [...prev, permKey]) : prev.filter((k) => k !== permKey)
    );
  };

  const toggleGroup = (keys: string[], checked: boolean) => {
    setSelectedPerms((prev) => {
      if (checked) {
        const next = new Set(prev);
        keys.forEach((k) => next.add(k));
        return Array.from(next);
      }
      return prev.filter((k) => !keys.includes(k));
    });
  };

  const canProceed = name.trim().length > 0 && key.trim().length > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (step === 1) setStep(2);
      }}
      className="space-y-4"
    >
      <div className="flex items-center gap-3 text-xs uppercase tracking-wide">
        <span className={`rounded-full px-3 py-1 ${step === 1 ? "bg-white/15" : "bg-white/5 opacity-60"}`}>
          {t("settings.roles.form.step.role")}
        </span>
        <span className={`rounded-full px-3 py-1 ${step === 2 ? "bg-white/15" : "bg-white/5 opacity-60"}`}>
          {t("settings.roles.form.step.permissions")}
        </span>
      </div>

      {step === 1 ? (
        <Card title={t("settings.roles.form.title.role")}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase opacity-70">{t("settings.roles.form.field.name")}</label>
              <input
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs uppercase opacity-70">{t("settings.roles.form.field.key")}</label>
              <input
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                value={key}
                required
                readOnly
                disabled={mode === "edit" || initial?.is_system}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs uppercase opacity-70">{t("settings.roles.form.field.description")}</label>
              <textarea
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 min-h-[80px]"
                value={description ?? ""}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
        </Card>
      ) : (
        <Card title={t("settings.roles.form.title.permissions")}>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <input
                className="w-full sm:max-w-sm rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                placeholder={t("settings.roles.form.search.placeholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="flex items-center gap-2 text-xs">
                <span className="opacity-70">
                  {t("settings.roles.form.selected.label")} {selectedPerms.length} / {availablePermissions.length}
                </span>
                <button
                  type="button"
                  className="rounded-md border border-white/10 px-2 py-1 text-xs"
                  onClick={() => toggleGroup(filteredPermissions.map((p) => p.key), true)}
                >
                  {t("settings.roles.form.selectFiltered")}
                </button>
                <button
                  type="button"
                  className="rounded-md border border-white/10 px-2 py-1 text-xs"
                  onClick={() => toggleGroup(filteredPermissions.map((p) => p.key), false)}
                >
                  {t("settings.roles.form.clearFiltered")}
                </button>
              </div>
            </div>
          <div className="space-y-3 pr-1">
              {groupedPermissions.map(([group, perms]) => {
                const keys = perms.map((p) => p.key);
                const selectedCount = keys.filter((k) => selectedPerms.includes(k)).length;
                const allSelected = selectedCount === keys.length && keys.length > 0;
                return (
                  <div key={group} className="rounded-lg border border-white/10 bg-white/5 p-2">
                    <div className="flex items-center justify-between px-1 pb-2 text-xs uppercase tracking-wide opacity-70">
                      <span>{group}</span>
                      <div className="flex items-center gap-2">
                        <span>
                          {selectedCount}/{keys.length}
                        </span>
                      <button
                        type="button"
                        className="rounded-md border border-white/10 px-2 py-0.5 text-[10px]"
                        onClick={() => toggleGroup(keys, !allSelected)}
                      >
                        {allSelected ? t("settings.roles.form.clearAll") : t("settings.roles.form.selectAll")}
                      </button>
                    </div>
                  </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {perms.map((p) => (
                        <label key={p.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedPerms.includes(p.key)}
                            onChange={(e) => togglePermission(p.key, e.target.checked)}
                          />
                        <span>{p.description ?? p.key}</span>
                      </label>
                      ))}
                    </div>
                  </div>
                );
            })}
            {groupedPermissions.length === 0 && (
              <div className="text-sm opacity-70">{t("settings.roles.form.empty")}</div>
            )}
          </div>
        </div>
      </Card>
      )}

      {error && <div className="text-red-400 text-sm">{error}</div>}
      {success && <div className="text-green-400 text-sm">{success}</div>}

      <div className="flex items-center gap-2">
        {step === 2 ? (
          <button
            type="button"
            className="px-3 py-2 rounded-xl border border-white/10 text-white/80"
            onClick={() => setStep(1)}
          >
            {t("settings.roles.form.back")}
          </button>
        ) : null}
        {step === 1 ? (
          <button
            type="button"
            disabled={!canProceed}
            className="px-4 py-2 rounded-xl bg-white/10 text-white shadow disabled:opacity-50"
            onClick={() => setStep(2)}
          >
            {t("settings.roles.form.next")}
          </button>
        ) : (
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 via-indigo-500 to-fuchsia-500 text-white shadow-lg disabled:opacity-50"
            onClick={handleSave}
          >
            {saving ? t("settings.roles.form.saving") : t("settings.roles.form.save")}
          </button>
        )}
      </div>
    </form>
  );
}
