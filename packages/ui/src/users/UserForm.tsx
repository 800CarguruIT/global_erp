"use client";

import React, { useEffect, useState } from "react";
import { useTheme } from "../theme";

export interface UserFormProps {
  mode: "create" | "edit";
  initialValues?: {
    email: string;
    name?: string | null;
    roleIds: string[];
    employeeId?: string | null;
    mobile?: string | null;
  };
  roles: Array<{ id: string; name: string }>;
  employees?: Array<{ id: string; name: string }>;
  scopeOptions?: ScopeOption[];
  scopeValue?: ScopeOption | null;
  onScopeChange?: (value: ScopeOption | null) => void;
  scopeLabel?: string;
  scopeSearchPlaceholder?: string;
  onSubmit: (values: {
    email: string;
    name?: string | null;
    password?: string;
    roleIds: string[];
    employeeId?: string | null;
    mobile?: string | null;
    scope?: ScopeOption | null;
  }) => Promise<void>;
  onCancel?: () => void;
}

export type ScopeOption = {
  id: string;
  type: "company" | "branch" | "vendor";
  label: string;
  hint?: string | null;
};

export function UserForm({
  mode,
  initialValues,
  roles,
  employees,
  scopeOptions,
  scopeValue,
  onScopeChange,
  scopeLabel = "Assign to",
  scopeSearchPlaceholder = "Search company / branch / vendor",
  onSubmit,
  onCancel,
}: UserFormProps) {
  const { theme } = useTheme();
  const [email, setEmail] = useState(initialValues?.email ?? "");
  const [name, setName] = useState(initialValues?.name ?? "");
  const [password, setPassword] = useState("");
  const [roleIds, setRoleIds] = useState<string[]>(initialValues?.roleIds ?? []);
  const [employeeId, setEmployeeId] = useState<string | undefined>(initialValues?.employeeId ?? undefined);
  const [mobile, setMobile] = useState(initialValues?.mobile ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [scopeSearch, setScopeSearch] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    setEmail(initialValues?.email ?? "");
    setName(initialValues?.name ?? "");
    setRoleIds(initialValues?.roleIds ?? []);
    setEmployeeId(initialValues?.employeeId ?? undefined);
    setMobile(initialValues?.mobile ?? "");
  }, [initialValues]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await onSubmit({
        email,
        name,
        password: mode === "create" ? password : password || undefined,
        roleIds,
        employeeId,
        mobile: mobile || undefined,
        scope: scopeValue ?? null,
      });
      setSaved(true);
    } catch (err: any) {
      setError(err?.message || "Failed to save user");
    } finally {
      setSaving(false);
      setTimeout(() => setSaved(false), 1500);
    }
  }

  function toggleRole(id: string) {
    setRoleIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  }

  const inputClass = theme.input;
  const scopeKey = (opt: ScopeOption) => `${opt.type}:${opt.id}`;
  const filteredScopeOptions =
    scopeOptions?.filter((opt) => {
      if (!scopeSearch) return true;
      const haystack = `${opt.label} ${opt.hint ?? ""}`.toLowerCase();
      return haystack.includes(scopeSearch.toLowerCase());
    }) ?? [];

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 rounded-xl p-4 ${theme.cardBg} ${theme.cardBorder}`}>
      <div className="grid gap-3 md:grid-cols-2">
        {scopeOptions && scopeOptions.length > 0 && (
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium">{scopeLabel}</label>
            <div className="grid gap-2 md:grid-cols-[1fr,240px]">
              <input
                className={inputClass}
                value={scopeSearch}
                onChange={(e) => setScopeSearch(e.target.value)}
                placeholder={scopeSearchPlaceholder}
              />
              <select
                className={inputClass}
                value={scopeValue ? scopeKey(scopeValue) : ""}
                onChange={(e) => {
                  const next = scopeOptions.find((o) => scopeKey(o) === e.target.value) ?? null;
                  onScopeChange?.(next);
                }}
              >
                <option value="">Select</option>
                {filteredScopeOptions.map((opt) => (
                  <option key={scopeKey(opt)} value={scopeKey(opt)}>
                    {opt.label} {opt.hint ? `• ${opt.hint}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs font-medium">Name</label>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Email</label>
          <input
            required
            type="email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Mobile number</label>
          <input
            type="tel"
            className={inputClass}
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="+971 5X XXXX XXX"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Password {mode === "create" ? "(required)" : "(leave blank to keep)"}</label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type={showPassword ? "text" : "password"}
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "create" ? "••••••" : "Leave blank to keep current"}
              required={mode === "create"}
            />
            <button
              type="button"
              className="rounded-md border border-border/50 bg-muted/10 px-3 py-1 text-xs font-semibold text-muted-foreground transition hover:bg-muted/30"
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
            {mode === "create" && (
              <button
                type="button"
                className="rounded-md border border-border/50 bg-muted/10 px-3 py-1 text-xs font-semibold text-muted-foreground transition hover:bg-muted/30"
                onClick={() => {
                  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
                  const size = 10;
                  let generated = "";
                  for (let i = 0; i < size; i += 1) {
                    generated += chars.charAt(Math.floor(Math.random() * chars.length));
                  }
                  setPassword(generated);
                  setShowPassword(true);
                }}
              >
                Generate
              </button>
            )}
          </div>
        </div>
        {employees && employees.length > 0 && (
          <div className="space-y-1">
            <label className="text-xs font-medium">Employee link</label>
            <select
              className={inputClass}
              value={employeeId ?? ""}
              onChange={(e) => setEmployeeId(e.target.value || undefined)}
            >
              <option value="">None</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium">Roles</div>
        <div className="grid gap-2 md:grid-cols-2">
          {roles.map((r) => (
            <label key={r.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={roleIds.includes(r.id)} onChange={() => toggleRole(r.id)} className="rounded" />
              {r.name || r.id}
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <button
          type="submit"
          className="rounded-md border px-3 py-1 font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          disabled={saving}
        >
          {saving ? "Saving..." : mode === "create" ? "Create user" : "Update user"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-md border px-3 py-1 font-medium hover:bg-muted/50">
            Cancel
          </button>
        )}
        {saved && <span className="text-xs text-emerald-600">Saved</span>}
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    </form>
  );
}
