"use client";

import React from "react";

export interface AccountsTableProps {
  accounts: Array<{
    id: string;
    code: string;
    name: string;
    type: string;
    isActive?: boolean;
  }>;
}

export function AccountsTable({ accounts }: AccountsTableProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Chart of Accounts</h2>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
              <th className="py-2 pl-3 pr-4 text-left">Code</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 text-center text-xs text-muted-foreground">
                  No accounts found.
                </td>
              </tr>
            ) : (
              accounts.map((a) => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="py-2 pl-3 pr-4 font-medium">{a.code}</td>
                  <td className="px-3 py-2">{a.name}</td>
                  <td className="px-3 py-2 text-xs uppercase text-muted-foreground">{a.type}</td>
                  <td className="px-3 py-2 text-xs">
                    {a.isActive ?? true ? (
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-600 dark:text-emerald-200">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-rose-600 dark:text-rose-200">
                        Inactive
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
