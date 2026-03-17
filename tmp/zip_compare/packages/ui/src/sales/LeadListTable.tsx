"use client";

import React from "react";

export interface LeadListTableProps {
  leads: Array<{
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    status?: string | null;
    source?: string | null;
    ownerName?: string | null;
    createdAt?: string | null;
  }>;
  onCreate?: () => void;
  onRowClick?: (id: string) => void;
}

export function LeadListTable({ leads, onCreate, onRowClick }: LeadListTableProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Leads</h2>
        {onCreate && (
          <button
            type="button"
            onClick={onCreate}
            className="rounded-md border px-3 py-1 text-sm font-medium hover:bg-white/10"
          >
            New Lead
          </button>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
              <th className="py-2 pl-3 pr-4 text-left">Name</th>
              <th className="px-3 py-2 text-left">Phone</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Source</th>
              <th className="px-3 py-2 text-left">Owner</th>
              <th className="px-3 py-2 text-left">Created</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-4 text-center text-xs text-muted-foreground">
                  No leads yet.
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="border-b last:border-0 hover:bg-muted/40 cursor-pointer"
                  onClick={() => onRowClick?.(lead.id)}
                >
                  <td className="py-2 pl-3 pr-4">{lead.name || "Unnamed"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{lead.phone ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{lead.email ?? "—"}</td>
                  <td className="px-3 py-2 text-xs capitalize">{lead.status ?? "—"}</td>
                  <td className="px-3 py-2 text-xs capitalize">{lead.source ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{lead.ownerName ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : "—"}
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
