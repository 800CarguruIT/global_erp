"use client";

import React from "react";
import { Card } from "./Card";

type Role = {
  id: string;
  name: string;
  key: string;
  scope: string;
  is_system: boolean;
  permissions?: { id: string }[];
};

type Props = {
  roles: Role[];
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onCreate?: () => void;
};

export function RoleListTable({ roles, onEdit, onDelete, onCreate }: Props) {
  return (
    <Card title="Roles">
      <div className="flex justify-end mb-3">
        {onCreate && (
          <button
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs sm:text-sm transition"
            onClick={onCreate}
          >
            + Create Role
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left">
          <thead>
            <tr className="text-xs uppercase opacity-70">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Key</th>
              <th className="px-3 py-2">Scope</th>
              <th className="px-3 py-2">Permissions</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role.id} className="border-b border-white/5">
                <td className="px-3 py-2">{role.name}</td>
                <td className="px-3 py-2">{role.key}</td>
                <td className="px-3 py-2">{role.scope}</td>
                <td className="px-3 py-2">{role.permissions?.length ?? 0}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    {onEdit && (
                      <button
                        className="text-xs px-2 py-1 rounded-md bg-white/10 hover:bg-white/20"
                        onClick={() => onEdit(role.id)}
                      >
                        Edit
                      </button>
                    )}
                    {onDelete && !role.is_system && (
                      <button
                        className="text-xs px-2 py-1 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-100"
                        onClick={() => onDelete(role.id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {roles.length === 0 && (
          <div className="text-sm opacity-70 py-3 text-center">No roles yet.</div>
        )}
      </div>
    </Card>
  );
}
