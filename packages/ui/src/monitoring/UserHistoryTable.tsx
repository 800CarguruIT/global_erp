"use client";

import React from "react";

type Item = {
  id: string;
  change_timestamp: string;
  change_type: string;
  entity_type: string;
  entity_id: string;
  summary?: string | null;
};

type Props = {
  items: Item[];
};

export function UserHistoryTable({ items }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-xs uppercase opacity-70">
          <tr>
            <th className="px-3 py-2">Time</th>
            <th className="px-3 py-2">Change</th>
            <th className="px-3 py-2">Entity</th>
            <th className="px-3 py-2">Summary</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className="border-b border-white/5">
              <td className="px-3 py-2">{new Date(it.change_timestamp).toLocaleString()}</td>
              <td className="px-3 py-2">{it.change_type}</td>
              <td className="px-3 py-2 text-xs">
                {it.entity_type} / {it.entity_id.slice(0, 8)}
              </td>
              <td className="px-3 py-2">{it.summary ?? "—"}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td className="px-3 py-3 text-sm opacity-70" colSpan={4}>
                No change history.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
