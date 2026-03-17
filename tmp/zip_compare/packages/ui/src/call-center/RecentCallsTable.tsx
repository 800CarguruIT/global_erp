"use client";

import React from "react";

export type RecentCallRow = {
  id: string;
  companyName?: string | null;
  from: string;
  to: string;
  direction: "inbound" | "outbound";
  status: string;
  startedAt: string;
  durationSeconds?: number | null;
};

export type RecentCallsTableProps = {
  calls: RecentCallRow[];
  showCompany?: boolean;
};

export function RecentCallsTable({ calls, showCompany = false }: RecentCallsTableProps) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
            {showCompany && <th className="py-2 px-3 text-left">Company</th>}
            <th className="py-2 px-3 text-left">From</th>
            <th className="py-2 px-3 text-left">To</th>
            <th className="py-2 px-3 text-left">Direction</th>
            <th className="py-2 px-3 text-left">Status</th>
            <th className="py-2 px-3 text-left">Started</th>
            <th className="py-2 px-3 text-left">Duration</th>
          </tr>
        </thead>
        <tbody>
          {calls.length === 0 ? (
            <tr>
              <td className="py-3 px-3 text-xs text-muted-foreground" colSpan={showCompany ? 7 : 6}>
                No recent calls.
              </td>
            </tr>
          ) : (
            calls.map((c) => (
              <tr key={c.id} className="border-b last:border-0">
                {showCompany && <td className="py-2 px-3 text-sm">{c.companyName ?? "—"}</td>}
                <td className="py-2 px-3">{c.from}</td>
                <td className="py-2 px-3">{c.to}</td>
                <td className="py-2 px-3 capitalize text-xs">{c.direction}</td>
                <td className="py-2 px-3 capitalize text-xs">{c.status.replace("_", " ")}</td>
                <td className="py-2 px-3 text-xs text-muted-foreground">
                  {new Date(c.startedAt).toLocaleString()}
                </td>
                <td className="py-2 px-3 text-xs text-muted-foreground">
                  {c.durationSeconds != null ? `${c.durationSeconds}s` : "—"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
