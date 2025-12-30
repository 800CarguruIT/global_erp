"use client";

import React from "react";

type Log = {
  id: string;
  timestamp: string;
  action_key: string;
  entity_type?: string | null;
  entity_id?: string | null;
  summary?: string | null;
  ip_address?: string | null;
};

type Props = {
  logs: Log[];
  title?: string;
  limitMessage?: string;
};

export function UserLogsTable({ logs, title, limitMessage }: Props) {
  return (
    <div className="space-y-2">
      {title && <h3 className="text-sm font-semibold">{title}</h3>}
      {limitMessage && <div className="text-xs opacity-70">{limitMessage}</div>}
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase opacity-70">
            <tr>
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Summary</th>
              <th className="px-3 py-2">Entity</th>
              <th className="px-3 py-2">IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-white/5">
                <td className="px-3 py-2">{new Date(log.timestamp).toLocaleString()}</td>
                <td className="px-3 py-2">{log.action_key}</td>
                <td className="px-3 py-2">{log.summary ?? "—"}</td>
                <td className="px-3 py-2 text-xs">
                  {log.entity_type ?? "—"}
                  {log.entity_id && <span className="opacity-60"> / {log.entity_id.slice(0, 8)}</span>}
                </td>
                <td className="px-3 py-2">{log.ip_address ?? "—"}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td className="px-3 py-3 text-sm opacity-70" colSpan={5}>
                  No activity.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
