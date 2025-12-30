"use client";

import React, { useEffect, useState } from "react";
import { Card } from "./Card";

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
  const [name, setName] = useState(initial?.name ?? "");
  const [key, setKey] = useState(initial?.key ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [selectedPerms, setSelectedPerms] = useState<string[]>(
    (initial?.permissions ?? []).map((p) => p.key)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (initial) {
      setName(initial.name);
      setKey(initial.key);
      setDescription(initial.description ?? "");
      setSelectedPerms((initial.permissions ?? []).map((p) => p.key));
    }
  }, [initial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const payload = {
        name,
        key,
        description,
        scope: scope.scope,
        companyId: scope.companyId ?? null,
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card title="Role">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs uppercase opacity-70">Name</label>
            <input
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-xs uppercase opacity-70">Key</label>
            <input
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              required
              disabled={mode === "edit" || initial?.is_system}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs uppercase opacity-70">Description</label>
            <textarea
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 min-h-[80px]"
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
      </Card>
      <Card title="Permissions">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
          {availablePermissions.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedPerms.includes(p.key)}
                onChange={(e) =>
                  setSelectedPerms((prev) =>
                    e.target.checked ? [...prev, p.key] : prev.filter((k) => k !== p.key)
                  )
                }
              />
              <span>
                <strong>{p.key}</strong> – {p.description}
              </span>
            </label>
          ))}
        </div>
      </Card>

      {error && <div className="text-red-400 text-sm">{error}</div>}
      {success && <div className="text-green-400 text-sm">{success}</div>}

      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 via-indigo-500 to-fuchsia-500 text-white shadow-lg disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Role"}
      </button>
    </form>
  );
}
