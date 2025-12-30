"use client";

import React from "react";

type StatusRow = { label: string; count: number; extra?: string | number | null };

export function DashboardTable({
  title,
  rows,
  headers,
}: {
  title: string;
  rows: StatusRow[];
  headers: string[];
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-100">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-gray-100">
          <thead>
            <tr className="text-left border-b border-slate-800 text-gray-300">
              {headers.map((h) => (
                <th key={h} className="px-2 py-1">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="px-2 py-3 text-gray-500" colSpan={headers.length}>
                  No data.
                </td>
              </tr>
            )}
            {rows.map((r, idx) => (
              <tr key={idx} className="border-b border-slate-800 last:border-b-0">
                <td className="px-2 py-1">{r.label}</td>
                <td className="px-2 py-1">{r.count}</td>
                {headers.length > 2 && <td className="px-2 py-1">{r.extra ?? "—"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
