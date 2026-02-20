"use client";

import React from "react";

export interface UserListTableProps {
  users: Array<{
    id: string;
    email: string;
    name?: string | null;
    roles: { id: string; name: string }[];
    companyName?: string | null;
    branchId?: string | null;
    branchName?: string | null;
    isActive?: boolean;
    lastLoginAt?: string | null;
  }>;
  title?: string;
  query?: string;
  onQueryChange?: (value: string) => void;
  onSearch?: () => void;
  onResetFilters?: () => void;
  onRefresh?: () => void;
  roleOptions?: Array<{ id: string; name: string }>;
  roleFilter?: string;
  onRoleFilterChange?: (value: string) => void;
  branchOptions?: Array<{ id: string; name: string }>;
  branchFilter?: string;
  onBranchFilterChange?: (value: string) => void;
  statusFilter?: "all" | "active" | "inactive";
  onStatusFilterChange?: (value: "all" | "active" | "inactive") => void;
  showBranchColumn?: boolean;
  loading?: boolean;
  emptyText?: string;
  onEdit?: (id: string) => void;
  onToggleStatus?: (id: string, next: boolean) => void;
  statusUpdating?: Record<string, boolean>;
  statusError?: string | null;
  onCreate?: () => void;
  onRowClick?: (id: string) => void;
  onResetPassword?: (id: string) => void;
  resettingPasswordId?: string | null;
  onDelete?: (id: string) => void;
  deletingId?: string | null;
  hideCreateButton?: boolean;
}

export function UserListTable({
  users,
  title = "",
  query,
  onQueryChange,
  onSearch,
  onResetFilters,
  onRefresh,
  roleOptions,
  roleFilter,
  onRoleFilterChange,
  branchOptions,
  branchFilter,
  onBranchFilterChange,
  statusFilter,
  onStatusFilterChange,
  showBranchColumn = false,
  loading = false,
  emptyText,
  onEdit,
  onToggleStatus,
  statusUpdating,
  statusError,
  onCreate,
  onRowClick,
  onResetPassword,
  resettingPasswordId,
  onDelete,
  deletingId,
  hideCreateButton = false,
}: UserListTableProps) {
  const showActions = Boolean(onEdit || onDelete || onResetPassword);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">{title}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {onCreate && !hideCreateButton && (
            <button
              type="button"
              onClick={onCreate}
              className="inline-flex items-center rounded-md border border-white/30 bg-primary px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground shadow-md transition hover:opacity-90 hover:shadow-lg"
            >
              <svg viewBox="0 0 24 24" className="-ml-1 mr-2 h-4 w-4" aria-hidden="true">
                <path
                  d="M12 5v14M5 12h14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              Add User
            </button>
          )}
        </div>
      </div>
      <div className="rounded-2xl border-0 bg-background shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/30 px-4 py-3">
          {onStatusFilterChange ? (
            <div className="inline-flex rounded-lg bg-muted/40 p-1 text-xs">
              {(["all", "active", "inactive"] as const).map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => onStatusFilterChange(val)}
                  className={`rounded-md px-3 py-1.5 font-medium transition ${
                    statusFilter === val
                      ? "bg-background text-foreground shadow-sm border border-border/40"
                      : "border border-transparent text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  {val === "all" ? "All" : val === "active" ? "Active" : "Inactive"}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Users</div>
          )}
          <div className="flex w-full max-w-md flex-wrap items-center gap-2 justify-end">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-md transition hover:bg-slate-50 hover:shadow-lg"
              >
                <svg viewBox="0 0 24 24" className="-ml-1 mr-2 h-4 w-4" aria-hidden="true">
                  <path
                    d="M4 12a8 8 0 0 1 13.66-5.66M20 12a8 8 0 0 1-13.66 5.66M4 4v5h5M20 20v-5h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Refresh
              </button>
            )}
            {roleOptions?.length ? (
              <select
                value={roleFilter ?? ""}
                onChange={(e) => onRoleFilterChange?.(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-normal tracking-wide text-slate-500 shadow-md"
              >
                <option value="">All roles</option>
                {roleOptions.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            ) : null}
            {branchOptions?.length ? (
              <select
                value={branchFilter ?? ""}
                onChange={(e) => onBranchFilterChange?.(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-normal tracking-wide text-slate-500 shadow-md"
              >
                <option value="">All branches</option>
                {branchOptions.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            ) : null}
            {onQueryChange && (
              <div className="relative w-full max-w-xs">
                <input
                  value={query ?? ""}
                  onChange={(e) => onQueryChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSearch?.();
                  }}
                  spellCheck={false}
                  autoComplete="off"
                  placeholder="Search"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-9 text-sm  text-slate-500 placeholder:text-slate-400 caret-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                    <path
                      d="M15.5 15.5L21 21M10.5 18a7.5 7.5 0 1 1 0-15a7.5 7.5 0 0 1 0 15Z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </div>
            )}
          </div>
        </div>
        {statusError && <div className="px-4 pt-3 text-xs text-red-500">{statusError}</div>}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr className="text-left bg-muted/20">
                <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
                  Name
                </th>
                <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
                  Email
                </th>
                <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
                  Roles
                </th>
                {false ? (
                  <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
                    Company
                  </th>
                ) : null}
                {showBranchColumn ? (
                  <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
                    Branch
                  </th>
                ) : null}
                <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
                  Last login
                </th>
                {showActions && (
                  <th className="px-4 py-3 text-right sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    className="px-3 py-6 text-muted-foreground text-center"
                    colSpan={showActions ? (showBranchColumn ? 7 : 6) : showBranchColumn ? 6 : 5}
                  >
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td
                    className="px-3 py-6 text-muted-foreground text-center"
                    colSpan={showActions ? (showBranchColumn ? 7 : 6) : showBranchColumn ? 6 : 5}
                  >
                    {emptyText ?? "No users found."}
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/20" onClick={() => onRowClick?.(u.id)}>
                    <td className="px-4 py-3 border-b border-border/30">{u.name || "-"}</td>
                    <td className="px-4 py-3 border-b border-border/30">{u.email}</td>
                    <td className="px-4 py-3 border-b border-border/30">
                      {u.roles?.length ? (
                        <div className="flex flex-wrap gap-2">
                          {u.roles.map((r) => (
                            <span
                              key={r.id}
                              className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/70"
                            >
                              {r.name || r.id}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    {false ? (
                      <td className="px-4 py-3 border-b border-border/30 text-xs text-muted-foreground">
                        {u.companyName || "-"}
                      </td>
                    ) : null}
                    {showBranchColumn ? (
                      <td className="px-4 py-3 border-b border-border/30 text-xs text-muted-foreground">
                        {u.branchName || "-"}
                      </td>
                    ) : null}
                    <td className="px-4 py-3 border-b border-border/30">
                      <div className="flex items-center gap-3">
                        {onToggleStatus && (
                          <button
                            type="button"
                            role="switch"
                            aria-checked={u.isActive !== false}
                            aria-busy={statusUpdating?.[u.id] ?? false}
                            disabled={statusUpdating?.[u.id] ?? false}
                            onClick={(e) => {
                              e.stopPropagation();
                              const isActive = u.isActive !== false;
                              onToggleStatus(u.id, !isActive);
                            }}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full border transition duration-200 ${
                              u.isActive === false
                                ? "border-border/40 bg-muted/40"
                                : "border-emerald-400 bg-emerald-500/30"
                            } ${statusUpdating?.[u.id] ? "cursor-wait opacity-80" : ""}`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                                u.isActive === false ? "translate-x-1" : "translate-x-5"
                              }`}
                            />
                          </button>
                        )}
                        <span
                          className={`text-xs font-semibold ${
                            u.isActive === false ? "text-amber-400" : "text-emerald-400"
                          }`}
                        >
                          {u.isActive === false ? "Inactive" : "Active"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 border-b border-border/30 text-xs text-muted-foreground">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "-"}
                    </td>
                    {showActions && (
                      <td className="px-4 py-3 text-right border-b border-border/30">
                        <div className="flex items-center justify-end gap-2">
                          {onEdit && (
                            <button
                              type="button"
                              className="inline-flex items-center rounded-md border border-white/30 bg-primary px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground shadow-sm transition hover:opacity-90 hover:shadow-md"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEdit(u.id);
                              }}
                            >
                              Edit
                            </button>
                          )}
                          {onResetPassword && (
                            <button
                              type="button"
                              className="inline-flex items-center rounded-md border border-white/30 bg-muted/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground shadow-sm transition hover:opacity-90 hover:shadow-md"
                              disabled={resettingPasswordId === u.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                onResetPassword(u.id);
                              }}
                            >
                              {resettingPasswordId === u.id ? "Generating..." : "Reset password"}
                            </button>
                          )}
                          {onDelete && (
                            <button
                              type="button"
                              className="text-red-500 hover:underline disabled:opacity-60 disabled:cursor-not-allowed text-xs"
                              disabled={deletingId === u.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                onDelete(u.id);
                              }}
                            >
                              {deletingId === u.id ? "Deleting..." : "Delete"}
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 text-xs text-muted-foreground">
          <span>Page 1 of 1</span>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              disabled
            >
              Previous
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              disabled
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
