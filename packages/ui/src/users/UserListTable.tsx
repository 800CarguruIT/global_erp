"use client";

import React from "react";

export interface UserListTableProps {
  users: Array<{
    id: string;
    email: string;
    name?: string | null;
    roles: { id: string; name: string }[];
    companyName?: string | null;
    isActive?: boolean;
    lastLoginAt?: string | null;
  }>;
  onCreate?: () => void;
  onRowClick?: (id: string) => void;
  onDelete?: (id: string) => void;
  deletingId?: string | null;
}

export function UserListTable({ users, onCreate, onRowClick, onDelete, deletingId }: UserListTableProps) {
  const showActions = Boolean(onDelete);

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-semibold">Users</h2>
        {onCreate && (
          <button
            type="button"
            onClick={onCreate}
            className="rounded-md border px-3 py-1 text-sm font-medium hover:bg-primary/10"
          >
            New User
          </button>
        )}
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
              <th className="py-2 px-3 text-left">Name</th>
              <th className="py-2 px-3 text-left">Email</th>
              <th className="py-2 px-3 text-left">Roles</th>
              <th className="py-2 px-3 text-left">Company</th>
              <th className="py-2 px-3 text-left">Status</th>
              <th className="py-2 px-3 text-left">Last login</th>
              {showActions && <th className="py-2 px-3 text-left">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td className="py-3 px-4 text-sm text-muted-foreground" colSpan={showActions ? 7 : 6}>
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr
                  key={u.id}
                  className="border-b last:border-0 hover:bg-muted/40 cursor-pointer"
                  onClick={() => onRowClick?.(u.id)}
                >
                  <td className="py-2 px-3">{u.name || "-"}</td>
                  <td className="py-2 px-3">{u.email}</td>
                  <td className="py-2 px-3 text-xs text-muted-foreground">
                    {u.roles?.map((r) => r.name || r.id).join(", ") || "-"}
                  </td>
                  <td className="py-2 px-3 text-xs text-muted-foreground">{u.companyName || "-"}</td>
                  <td className="py-2 px-3 text-xs">{u.isActive === false ? "Inactive" : "Active"}</td>
                  <td className="py-2 px-3 text-xs text-muted-foreground">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "-"}
                  </td>
                  {showActions && (
                    <td className="py-2 px-3 text-xs text-muted-foreground">
                      <button
                        type="button"
                        className="text-red-500 hover:underline disabled:opacity-60 disabled:cursor-not-allowed"
                        disabled={deletingId === u.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete?.(u.id);
                        }}
                      >
                        {deletingId === u.id ? "Deleting..." : "Delete"}
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
