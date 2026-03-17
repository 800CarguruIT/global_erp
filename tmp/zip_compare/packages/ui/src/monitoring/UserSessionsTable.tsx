"use client";

import React from "react";
import { UserRiskBadge } from "./UserRiskBadge";

type Session = {
  id: string;
  started_at: string;
  last_seen_at: string;
  ip_address?: string | null;
  geo_country?: string | null;
  geo_city?: string | null;
  scope: string;
  company_id?: string | null;
  branch_id?: string | null;
  vendor_id?: string | null;
  last_action?: string | null;
  last_action_at?: string | null;
  is_active?: boolean;
};

type Props = { sessions: Session[] };

export function UserSessionsTable({ sessions }: Props) {
  const rows = sessions ?? [];
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-xs uppercase opacity-70">
          <tr>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Started</th>
            <th className="px-3 py-2">Last seen</th>
            <th className="px-3 py-2">IP</th>
            <th className="px-3 py-2">Location</th>
            <th className="px-3 py-2">Last action</th>
            <th className="px-3 py-2">Scope</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const active = s.is_active ?? true;
            const statusCls = active
              ? "bg-emerald-500/20 text-emerald-100"
              : "bg-slate-500/20 text-slate-200";
            return (
              <tr key={s.id} className="border-b border-white/5">
                <td className="px-3 py-2">
                  <span className={`px-2 py-1 rounded-full text-xs ${statusCls}`}>
                    {active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-3 py-2">{new Date(s.started_at).toLocaleString()}</td>
                <td className="px-3 py-2">{new Date(s.last_seen_at).toLocaleString()}</td>
                <td className="px-3 py-2">{s.ip_address ?? "—"}</td>
                <td className="px-3 py-2">
                  {s.geo_country || s.geo_city
                    ? `${s.geo_city ?? ""} ${s.geo_country ?? ""}`.trim()
                    : "—"}
                </td>
                <td className="px-3 py-2">
                  {s.last_action ? (
                    <div className="flex flex-col">
                      <span>{s.last_action}</span>
                      {s.last_action_at && (
                        <span className="text-xs opacity-70">
                          {new Date(s.last_action_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 text-xs">
                  {s.scope}
                  {s.company_id && <span className="opacity-60"> / {s.company_id}</span>}
                  {s.branch_id && <span className="opacity-60"> / {s.branch_id}</span>}
                  {s.vendor_id && <span className="opacity-60"> / {s.vendor_id}</span>}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td className="px-3 py-3 text-sm opacity-70" colSpan={7}>
                No sessions.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
