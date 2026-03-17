"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card } from "./Card";
import { useTheme } from "../theme";
import {
  CHANNEL_PROVIDER_TEMPLATES,
  ChannelCategory,
  getChannelCategoryForType,
} from "../channelProviderCatalog";

type Scope = "global" | "company";

type DialerRow = {
  id: string;
  label: string;
  provider: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

type ChannelRow = {
  id: string;
  name: string;
  provider_key: string;
  channel_type: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

type Health = {
  status: "healthy" | "degraded" | "unreachable" | "unknown";
  lastCheckedAt?: string | Date;
  lastError?: string | null;
};

type Row = {
  id: string;
  name: string;
  type: "Dialer" | "Channel";
  category: string;
  provider: string;
  status?: Health;
  created_at?: string;
  updated_at?: string;
};

type Props = {
  scope: Scope;
  companyId?: string;
};

const STATUS_ORDER: Record<Health["status"], number> = {
  healthy: 1,
  degraded: 2,
  unreachable: 3,
  unknown: 4,
};

export function IntegrationHealthDashboard({ scope, companyId }: Props) {
  const { theme } = useTheme();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"All" | "Dialer" | "Channel">("All");
  const [statusFilter, setStatusFilter] = useState<Health["status"] | "All">("All");

  const scopeParam =
    scope === "global" ? "scope=global" : `scope=company&companyId=${companyId ?? ""}`;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [dialerRes, channelRes] = await Promise.all([
          fetch(`/api/dialer/integrations?${scopeParam}`),
          fetch(`/api/channels/integrations?${scopeParam}`),
        ]);
        if (!dialerRes.ok || !channelRes.ok) {
          throw new Error("Failed to load integrations");
        }
        const dialerData = await dialerRes.json();
        const channelData = await channelRes.json();
        const dialers: DialerRow[] = dialerData.items ?? [];
        const channels: ChannelRow[] = channelData.items ?? [];

        const dialerHealth = await Promise.all(
          dialers.map(async (d) => {
            try {
              const res = await fetch(`/api/dialer/integrations/${d.id}/health`);
              if (!res.ok) return [d.id, undefined] as const;
              const body = await res.json();
              return [d.id, body.data as Health] as const;
            } catch {
              return [d.id, undefined] as const;
            }
          })
        );
        const channelHealth = await Promise.all(
          channels.map(async (c) => {
            try {
              const res = await fetch(`/api/channels/integrations/${c.id}/health?${scopeParam}`);
              if (!res.ok) return [c.id, undefined] as const;
              const body = await res.json();
              return [c.id, body.data as Health] as const;
            } catch {
              return [c.id, undefined] as const;
            }
          })
        );

        const dialerHealthMap = Object.fromEntries(dialerHealth);
        const channelHealthMap = Object.fromEntries(channelHealth);

        const dialerRows: Row[] = dialers.map((d) => ({
          id: d.id,
          name: d.label,
          type: "Dialer",
          category: "PBX / Dialer",
          provider: d.provider,
          status: dialerHealthMap[d.id],
          created_at: d.created_at,
          updated_at: d.updated_at,
        }));

        const channelRows: Row[] = channels.map((c) => {
          const cat = getChannelCategoryForType(c.channel_type as any);
          const provLabel =
            CHANNEL_PROVIDER_TEMPLATES.find((t) => t.key === c.provider_key)?.label ??
            c.provider_key;
          return {
            id: c.id,
            name: c.name,
            type: "Channel",
            category: cat,
            provider: provLabel,
            status: channelHealthMap[c.id],
            created_at: c.created_at,
            updated_at: c.updated_at,
          };
        });

        if (!cancelled) setRows([...dialerRows, ...channelRows]);
      } catch (err: unknown) {
        console.error(err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load integration health");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [scopeParam]);

  const filteredRows = useMemo(() => {
    return rows
      .filter((r) => (typeFilter === "All" ? true : r.type === typeFilter))
      .filter((r) => (statusFilter === "All" ? true : r.status?.status === statusFilter))
      .sort((a, b) => {
        const sa = STATUS_ORDER[a.status?.status ?? "unknown"];
        const sb = STATUS_ORDER[b.status?.status ?? "unknown"];
        return sa - sb;
      });
  }, [rows, typeFilter, statusFilter]);

  function renderStatus(h?: Health) {
    if (!h) return <span className="text-[11px] text-slate-300">unknown</span>;
    const color =
      h.status === "healthy"
        ? "text-emerald-300"
        : h.status === "degraded"
        ? "text-amber-300"
        : h.status === "unreachable"
        ? "text-red-300"
        : "text-slate-300";
    return <span className={`px-2 py-1 rounded bg-white/10 text-[11px] ${color}`}>{h.status}</span>;
  }

  return (
    <Card title="Integration Health" className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="text-xs sm:text-sm opacity-70">
          {loading
            ? "Loading health…"
            : `${filteredRows.length} integration${filteredRows.length === 1 ? "" : "s"} shown`}
        </div>
        <div className="flex gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase opacity-60">Type</label>
            <select
              className={theme.input}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
            >
              <option value="All">All</option>
              <option value="Dialer">Dialer</option>
              <option value="Channel">Channel</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase opacity-60">Status</label>
            <select
              className={theme.input}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="All">All</option>
              <option value="healthy">Healthy</option>
              <option value="degraded">Degraded</option>
              <option value="unreachable">Unreachable</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-400 border border-red-400/40 rounded-lg px-3 py-2 bg-red-500/5">
          {error}
        </div>
      )}

      {!loading && !error && filteredRows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Provider</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Last Checked</th>
                <th className="px-4 py-2">Last Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filteredRows.map((r) => (
                <tr key={`${r.type}-${r.id}`} className="hover:bg-white/5">
                  <td className="px-4 py-3">{r.name}</td>
                  <td className="px-4 py-3">{r.type}</td>
                  <td className="px-4 py-3">{r.category}</td>
                  <td className="px-4 py-3">{r.provider}</td>
                  <td className="px-4 py-3">{renderStatus(r.status)}</td>
                  <td className="px-4 py-3">
                    {r.status?.lastCheckedAt
                      ? new Date(r.status.lastCheckedAt).toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {r.status?.lastError ? (
                      <span className="text-red-300">{r.status.lastError.slice(0, 80)}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && filteredRows.length === 0 && (
        <div className="border border-dashed border-white/10 rounded-lg px-4 py-6 text-xs sm:text-sm opacity-80">
          No integrations found for the selected filters.
        </div>
      )}
    </Card>
  );
}
