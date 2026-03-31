"use client";

import React, { useEffect, useState } from "react";
import { AppLayout, useTheme } from "@repo/ui";

type EmployeeUserRow = {
  employee_id: string;
  auto_code: string;
  employee_name: string;
  department: string | null;
  employee_email: string | null;
  user_id: string | null;
  email: string | null;
  full_name: string | null;
  is_active: boolean | null;
  last_login_at: string | null;
  mobile: string | null;
  company_id: string | null;
  branch_id: string | null;
  branch_name: string | null;
  roles: { id: string; name: string }[];
};

type StatusFilter = "all" | "active" | "inactive" | "no_account";

type FilterOption = { value: string; label: string };

const PAGE_SIZE = 50;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all",        label: "All"        },
  { value: "active",     label: "Active"     },
  { value: "inactive",   label: "Inactive"   },
  { value: "no_account", label: "No Account" },
];

export default function CompanyUsersPage({
  params,
}: {
  params: { companyId: string } | Promise<{ companyId: string }>;
}) {
  const { theme } = useTheme();
  const [companyId, setCompanyId]   = useState<string | null>(null);
  const [rows, setRows]             = useState<EmployeeUserRow[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [query, setQuery]           = useState("");
  const [inputQuery, setInputQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [statusUpdating, setStatusUpdating] = useState<Record<string, boolean>>({});
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [branchFilter, setBranchFilter]         = useState("");
  const [roleFilter, setRoleFilter]             = useState("");
  const [departments, setDepartments]           = useState<FilterOption[]>([]);
  const [branches, setBranches]                 = useState<FilterOption[]>([]);
  const [roles, setRoles]                       = useState<FilterOption[]>([]);

  useEffect(() => {
    Promise.resolve(params).then((p: any) => {
      const id = p?.companyId?.toString?.().trim?.() || null;
      setCompanyId(id);
      if (!id) { setLoading(false); setError("Company is required"); }
    });
  }, [params]);

  // Load filter options (departments, branches, roles)
  useEffect(() => {
    if (!companyId) return;
    // Departments
    fetch(`/api/company/${companyId}/admin/users/departments`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const list = (data?.data ?? []) as string[];
        setDepartments(list.map((d) => ({ value: d, label: d })));
      })
      .catch(() => null);
    // Branches
    fetch(`/api/company/${companyId}/branches`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const list = (data?.data ?? data ?? []) as any[];
        setBranches(list.map((b: any) => ({ value: b.id, label: b.name })));
      })
      .catch(() => null);
    // Roles
    fetch(`/api/company/${companyId}/admin/roles`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const list = (data?.data ?? data ?? []) as any[];
        setRoles(list.map((r: any) => ({ value: r.id, label: r.name })));
      })
      .catch(() => null);
  }, [companyId]);

  async function load(opts?: { p?: number; q?: string; status?: StatusFilter; dept?: string; branch?: string; role?: string }) {
    if (!companyId) return;
    const p      = opts?.p      ?? page;
    const q      = opts?.q      ?? query;
    const status = opts?.status ?? statusFilter;
    const dept   = opts?.dept   ?? departmentFilter;
    const branch = opts?.branch ?? branchFilter;
    const role   = opts?.role   ?? roleFilter;

    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      sp.set("page", String(p));
      sp.set("pageSize", String(PAGE_SIZE));
      if (q) sp.set("q", q);
      if (status !== "all") sp.set("status", status);
      if (dept) sp.set("department", dept);
      if (branch) sp.set("branchId", branch);
      if (role) sp.set("roleId", role);

      const res = await fetch(`/api/company/${companyId}/admin/users/employees?${sp.toString()}`);
      if (!res.ok) throw new Error("Failed to load employees");
      const data = await res.json();
      setRows(data.data ?? []);
      setTotal(data.total ?? 0);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load employees");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (companyId) load(); }, [companyId]);

  function handleSearch() {
    setQuery(inputQuery);
    setPage(1);
    load({ p: 1, q: inputQuery });
  }

  function handleStatusChange(s: StatusFilter) {
    setStatusFilter(s);
    setPage(1);
    load({ p: 1, status: s });
  }

  function handleDepartmentChange(v: string) {
    setDepartmentFilter(v);
    setPage(1);
    load({ p: 1, dept: v });
  }

  function handleBranchChange(v: string) {
    setBranchFilter(v);
    setPage(1);
    load({ p: 1, branch: v });
  }

  function handleRoleChange(v: string) {
    setRoleFilter(v);
    setPage(1);
    load({ p: 1, role: v });
  }

  function clearFilters() {
    setDepartmentFilter("");
    setBranchFilter("");
    setRoleFilter("");
    setStatusFilter("all");
    setQuery("");
    setInputQuery("");
    setPage(1);
    load({ p: 1, q: "", status: "all", dept: "", branch: "", role: "" });
  }

  const hasActiveFilters = !!(departmentFilter || branchFilter || roleFilter || (statusFilter !== "all") || query);

  function goToPage(p: number) {
    setPage(p);
    load({ p });
  }

  async function toggleStatus(userId: string, next: boolean) {
    if (!companyId) return;
    setStatusUpdating((prev) => ({ ...prev, [userId]: true }));
    try {
      const res = await fetch(`/api/company/${companyId}/admin/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      setRows((prev) => prev.map((r) => (r.user_id === userId ? { ...r, is_active: next } : r)));
    } finally {
      setStatusUpdating((prev) => ({ ...prev, [userId]: false }));
    }
  }

  const totalPages   = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart   = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd     = Math.min(page * PAGE_SIZE, total);

  // Page number buttons (max 5 visible)
  const pageButtons: number[] = [];
  const delta = 2;
  for (let i = Math.max(1, page - delta); i <= Math.min(totalPages, page + delta); i++) {
    pageButtons.push(i);
  }

  return (
    <AppLayout>
      <div className="space-y-5 py-4">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Company Users</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {total > 0 ? `${total} employees found` : "No employees"}
            </p>
          </div>
          <a
            href={`/company/${companyId}/settings/security/users/new`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            + New User
          </a>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Search + Status filter */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search by name or email…"
            className="h-9 w-full max-w-xs rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-white/20"
          />
          <button
            onClick={handleSearch}
            className="h-9 rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-medium text-foreground transition hover:bg-white/10"
          >
            Search
          </button>

          {/* Status filter pills */}
          <div className="ml-auto flex items-center gap-1 rounded-lg bg-white/5 p-1">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleStatusChange(opt.value)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                  statusFilter === opt.value
                    ? "bg-white/10 text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filter dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Department */}
          <select
            value={departmentFilter}
            onChange={(e) => handleDepartmentChange(e.target.value)}
            className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-white/20 [&>option]:bg-gray-900 [&>option]:text-foreground"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>

          {/* Branch */}
          {branches.length > 0 && (
            <select
              value={branchFilter}
              onChange={(e) => handleBranchChange(e.target.value)}
              className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-white/20 [&>option]:bg-gray-900 [&>option]:text-foreground"
            >
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
          )}

          {/* Role */}
          {roles.length > 0 && (
            <select
              value={roleFilter}
              onChange={(e) => handleRoleChange(e.target.value)}
              className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-white/20 [&>option]:bg-gray-900 [&>option]:text-foreground"
            >
              <option value="">All Roles</option>
              {roles.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          )}

          {/* Clear all filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Loading…
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl bg-white/5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03]">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Employee</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Department</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Login Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Roles</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last Login</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      No employees found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.employee_id} className="transition hover:bg-white/[0.04]">

                      {/* Employee */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{row.employee_name}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{row.auto_code}</div>
                      </td>

                      {/* Department */}
                      <td className="px-4 py-3 text-sm text-foreground">
                        {row.department ?? <span className="text-muted-foreground">—</span>}
                      </td>

                      {/* Login email */}
                      <td className="px-4 py-3">
                        {row.email
                          ? <span className="text-sm text-foreground">{row.email}</span>
                          : <span className="text-sm italic text-muted-foreground">No account</span>}
                      </td>

                      {/* Roles */}
                      <td className="px-4 py-3">
                        {row.roles.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {row.roles.map((r) => (
                              <span key={r.id} className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-foreground">
                                {r.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Status (employee-level) */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            row.is_active === false
                              ? "bg-red-500/15 text-red-400"
                              : "bg-emerald-500/15 text-emerald-400"
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${row.is_active === false ? "bg-red-500" : "bg-emerald-500"}`} />
                          {row.is_active === false ? "Inactive" : "Active"}
                        </span>
                        {!row.user_id && (
                          <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            No Account
                          </span>
                        )}
                      </td>

                      {/* Last login */}
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {row.last_login_at
                          ? new Date(row.last_login_at).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
                          : "—"}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        {row.user_id ? (
                          <a
                            href={`/company/${companyId}/settings/security/users/${row.user_id}`}
                            className="inline-flex items-center rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-white/15"
                          >
                            Edit
                          </a>
                        ) : (
                          <a
                            href={`/company/${companyId}/settings/security/users/new?employeeId=${row.employee_id}&name=${encodeURIComponent(row.employee_name)}&email=${encodeURIComponent(row.employee_email ?? "")}`}
                            className="inline-flex items-center rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90"
                          >
                            Create Account
                          </a>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Footer: range info + pagination */}
            <div className="flex items-center justify-between border-t border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <span className="text-xs text-muted-foreground">
                {total === 0 ? "No results" : `${rangeStart}–${rangeEnd} of ${total}`}
              </span>

              <div className="flex items-center gap-1">
                {/* Prev */}
                <button
                  disabled={page <= 1}
                  onClick={() => goToPage(page - 1)}
                  className="rounded-md bg-white/5 px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-white/10 disabled:opacity-30"
                >
                  ‹ Prev
                </button>

                {/* First page if not in range */}
                {pageButtons[0] > 1 && (
                  <>
                    <button onClick={() => goToPage(1)} className="rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground">1</button>
                    {pageButtons[0] > 2 && <span className="px-1 text-xs text-muted-foreground">…</span>}
                  </>
                )}

                {pageButtons.map((p) => (
                  <button
                    key={p}
                    onClick={() => goToPage(p)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                      p === page
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-white/10 hover:text-foreground"
                    }`}
                  >
                    {p}
                  </button>
                ))}

                {/* Last page if not in range */}
                {pageButtons[pageButtons.length - 1] < totalPages && (
                  <>
                    {pageButtons[pageButtons.length - 1] < totalPages - 1 && <span className="px-1 text-xs text-muted-foreground">…</span>}
                    <button onClick={() => goToPage(totalPages)} className="rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground">{totalPages}</button>
                  </>
                )}

                {/* Next */}
                <button
                  disabled={page >= totalPages}
                  onClick={() => goToPage(page + 1)}
                  className="rounded-md bg-white/5 px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-white/10 disabled:opacity-30"
                >
                  Next ›
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
