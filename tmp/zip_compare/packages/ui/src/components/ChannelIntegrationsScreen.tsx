"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card } from "./Card";
import { useTheme } from "../theme";
import {
  CHANNEL_PROVIDER_TEMPLATES,
  ChannelCategory,
  ChannelType,
  getChannelCategoryForType,
} from "../channelProviderCatalog";

type Scope = "global" | "company";

type ChannelRow = {
  id: string;
  scope: Scope;
  company_id: string | null;
  name: string;
  channel_type: ChannelType;
  provider_key: string;
  auth_type: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

type TestState = {
  to: string;
  from?: string;
  subject?: string;
  body: string;
  htmlBody?: string;
  submitting: boolean;
  result?: string;
  error?: string;
};

type Props = {
  scope: Scope;
  companyId?: string;
};

const SEND_CAPABLE_TYPES = new Set<ChannelType>(["email", "sms", "whatsapp", "messaging", "meta"]);
type Health = {
  status: "healthy" | "degraded" | "unreachable" | "unknown";
  lastCheckedAt?: string | Date;
  lastError?: string | null;
};

export function ChannelIntegrationsScreen({ scope, companyId }: Props) {
  const { theme } = useTheme();
  const [items, setItems] = useState<ChannelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [testStates, setTestStates] = useState<Record<string, TestState>>({});
  const [categoryFilter, setCategoryFilter] = useState<ChannelCategory | "All">("All");
  const [providerFilter, setProviderFilter] = useState<string | "All">("All");
  const [health, setHealth] = useState<Record<string, Health>>({});
  const baseTestState: TestState = {
    to: "",
    from: "",
    subject: "",
    body: "",
    htmlBody: "",
    submitting: false,
  };

  const mergeTestState = (id: string, patch: Partial<TestState>) =>
    setTestStates((prev) => ({
      ...prev,
      [id]: { ...baseTestState, ...(prev[id] ?? {}), ...patch },
    }));

  const scopeParam =
    scope === "global" ? "scope=global" : `scope=company&companyId=${companyId ?? ""}`;

  const createHref =
    scope === "global"
      ? "/global/integrations/channels/new"
      : `/company/${companyId}/integrations/channels/new`;

  const backHref =
    scope === "global"
      ? "/global/integrations"
      : `/company/${companyId}/integrations`;

  const providerOptionsForFilter = useMemo(() => {
    if (categoryFilter === "All") return CHANNEL_PROVIDER_TEMPLATES;
    return CHANNEL_PROVIDER_TEMPLATES.filter((t) => t.category === categoryFilter);
  }, [categoryFilter]);

  const providerLabel = (providerKey: string) =>
    CHANNEL_PROVIDER_TEMPLATES.find((t) => t.key === providerKey)?.label ?? providerKey;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/channels/integrations?${scopeParam}`);
        if (!res.ok) throw new Error("Failed to load channel integrations");
        const data = await res.json();
        if (!cancelled) setItems(data.items ?? []);
      } catch (err: unknown) {
        if (!cancelled) {
          // degrade gracefully: empty list, no blocking error
          setItems([]);
          setError(null);
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

  useEffect(() => {
    async function loadHealth(ids: string[]) {
      const entries = await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await fetch(`/api/channels/integrations/${id}/health?${scopeParam}`);
            if (!res.ok) return [id, undefined] as const;
            const body = await res.json();
            return [id, body.data as Health] as const;
          } catch {
            return [id, undefined] as const;
          }
        })
      );
      setHealth((prev) => {
        const next = { ...prev };
        for (const [id, h] of entries) {
          if (h) next[id] = h;
        }
        return next;
      });
    }
    if (items.length) loadHealth(items.map((i) => i.id));
  }, [items, scopeParam]);

  function gotoEdit(id: string) {
    if (scope === "global") {
      window.location.href = `/global/integrations/channels/${id}`;
    } else {
      window.location.href = `/company/${companyId}/integrations/channels/${id}`;
    }
  }

  async function softDelete(id: string) {
    setMutatingId(id);
    try {
      // Load existing
      const detailRes = await fetch(`/api/channels/integrations/${id}?${scopeParam}`);
      if (!detailRes.ok) {
        const body = await detailRes.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load integration");
      }
      const detail: ChannelRow & {
        credentials?: Record<string, unknown>;
        metadata?: Record<string, unknown> | null;
        webhooks?: Record<string, unknown> | null;
      } =
        await detailRes.json();

      const res = await fetch(`/api/channels/integrations/${id}?${scopeParam}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          companyId: scope === "company" ? companyId : null,
          name: detail.name,
          channelType: detail.channel_type,
          providerKey: detail.provider_key,
          authType: detail.auth_type,
          credentials: detail.credentials ?? {},
          metadata: detail.metadata ?? {},
          webhooks: detail.webhooks ?? {},
          isActive: false,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to delete integration");
      }
      setItems((prev) => prev.filter((row) => row.id !== id));
    } catch (err: unknown) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to delete integration");
    } finally {
      setMutatingId(null);
    }
  }

  const filteredItems = useMemo(() => {
    return items.filter((row) => {
      const cat = getChannelCategoryForType(row.channel_type as ChannelType);
      if (categoryFilter !== "All" && cat !== categoryFilter) return false;
      if (providerFilter !== "All" && row.provider_key !== providerFilter) return false;
      return true;
    });
  }, [items, categoryFilter, providerFilter]);

  const headerText = useMemo(() => {
    if (loading) return "Loading channel integrations…";
    const count = filteredItems.length;
    return count === 0
      ? "No channel integrations configured."
      : `${count} channel integration${count === 1 ? "" : "s"}.`;
  }, [filteredItems.length, loading]);

  function toggleTest(id: string) {
    setTestStates((prev) => {
      const next = { ...prev };
      if (next[id]) {
        delete next[id];
      } else {
        next[id] = { ...baseTestState };
      }
      return next;
    });
  }

  async function submitTest(id: string) {
    const state = testStates[id];
    if (!state || !state.to.trim() || !state.body.trim()) {
      mergeTestState(id, { error: "To and body are required", submitting: false });
      return;
    }
    mergeTestState(id, { submitting: true, error: undefined, result: undefined });

    try {
      const res = await fetch(`/api/channels/integrations/${id}/send?${scopeParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: state.to,
          from: state.from,
          subject: state.subject,
          body: state.body,
          htmlBody: state.htmlBody,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Failed to send test message");
      }
      mergeTestState(id, {
        submitting: false,
        result: JSON.stringify(body.data ?? body, null, 2),
        error: undefined,
      });
    } catch (err: unknown) {
      console.error(err);
      mergeTestState(id, {
        submitting: false,
        error: err instanceof Error ? err.message : "Failed to send test message",
      });
    }
  }

  async function runHealth(id: string) {
    setHealth((prev) => ({ ...prev, [id]: { ...(prev[id] ?? {}), status: "unknown" } }));
    try {
      const res = await fetch(`/api/channels/integrations/${id}/health?${scopeParam}`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Health check failed");
      setHealth((prev) => ({ ...prev, [id]: body.data as Health }));
    } catch (err: unknown) {
      console.error(err);
      setHealth((prev) => ({
        ...prev,
        [id]: {
          status: "unreachable",
          lastError: err instanceof Error ? err.message : "Health check failed",
        },
      }));
    }
  }

  function renderHealthRow(id: string) {
    const h = health[id];
    if (!h) return null;
    const color =
      h.status === "healthy"
        ? "text-emerald-300"
        : h.status === "degraded"
        ? "text-amber-300"
        : h.status === "unreachable"
        ? "text-red-300"
        : "text-slate-300";
    return (
      <div className="flex items-center gap-3">
        <span className={`px-2 py-1 rounded bg-white/10 text-[11px] ${color}`}>{h.status}</span>
        {h.lastCheckedAt && (
          <span className="text-[11px] opacity-70">
            Last checked: {new Date(h.lastCheckedAt).toLocaleString()}
          </span>
        )}
        {h.lastError && <span className="text-[11px] text-red-300">Error: {h.lastError}</span>}
      </div>
    );
  }

  return (
    <Card title={`${scope === "global" ? "GLOBAL" : "COMPANY"} CHANNEL INTEGRATIONS`} className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs sm:text-sm opacity-70">{headerText}</div>
        <div className="flex gap-2">
          <button
            className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs sm:text-sm transition"
            onClick={() => (window.location.href = backHref)}
          >
            ← Back
          </button>
          <button
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs sm:text-sm transition"
            onClick={() => (window.location.href = createHref)}
          >
            + Create Channel Integration
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase opacity-60">Category</label>
          <select
            className={theme.input}
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value as ChannelCategory | "All");
              setProviderFilter("All");
            }}
          >
            <option value="All">All</option>
            <option value="Advertising">Advertising</option>
            <option value="Analytics">Analytics</option>
            <option value="Social">Social</option>
            <option value="Email">Email</option>
            <option value="Messaging">Messaging</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase opacity-60">Provider</label>
          <select
            className={theme.input}
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value as string | "All")}
            disabled={providerOptionsForFilter.length === 0}
          >
            <option value="All">All</option>
            {providerOptionsForFilter.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="text-xs sm:text-sm text-red-400 border border-red-400/40 rounded-lg px-3 py-2 bg-red-500/5">
          {error}
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-4 py-2 text-left font-medium">Name</th>
                <th className="px-4 py-2 text-left font-medium">Channel</th>
                <th className="px-4 py-2 text-left font-medium">Provider</th>
                <th className="px-4 py-2 text-left font-medium">Active</th>
                <th className="px-4 py-2 text-left font-medium">Created</th>
                <th className="px-4 py-2 text-left font-medium">Updated</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filteredItems.map((row) => {
                const test = testStates[row.id];
                return (
                  <React.Fragment key={row.id}>
                    <tr className="hover:bg-white/5 transition">
                      <td className="px-4 py-3">{row.name}</td>
                      <td className="px-4 py-3 uppercase text-[11px]">{row.channel_type}</td>
                      <td className="px-4 py-3">{providerLabel(row.provider_key)}</td>
                      <td className="px-4 py-3">
                        {row.is_active ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-[11px] text-emerald-300">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-[11px] text-red-300">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">{row.created_at ? new Date(row.created_at).toLocaleString() : "—"}</td>
                      <td className="px-4 py-3">{row.updated_at ? new Date(row.updated_at).toLocaleString() : "—"}</td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button
                          className="px-3 py-1 text-xs rounded bg-white/10 hover:bg-white/20 transition"
                          onClick={() => gotoEdit(row.id)}
                        >
                          Edit
                        </button>
                        <button
                          className="px-3 py-1 text-xs rounded bg-red-500/10 hover:bg-red-500/20 text-red-200 transition disabled:opacity-50"
                          disabled={mutatingId === row.id}
                          onClick={() => softDelete(row.id)}
                        >
                          {mutatingId === row.id ? "Removing…" : "Delete"}
                        </button>
                        {SEND_CAPABLE_TYPES.has(row.channel_type) && (
                          <button
                            className="px-3 py-1 text-xs rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-200 transition"
                            onClick={() => toggleTest(row.id)}
                          >
                            {test ? "Close Test" : "Test Send"}
                          </button>
                        )}
                        <button
                          className="px-3 py-1 text-xs rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-200 transition"
                          onClick={() => runHealth(row.id)}
                        >
                          Test Connection
                        </button>
                      </td>
                    </tr>
                    <tr className="bg-white/5">
                      <td colSpan={7} className="px-4 pb-3 text-[11px]">
                        {renderHealthRow(row.id)}
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="border border-dashed border-white/10 rounded-lg px-4 py-6 text-xs sm:text-sm opacity-80 flex flex-col items-start gap-3">
          <div>
            You don&apos;t have any channel integrations yet. Configure one to enable outbound messaging.
          </div>
          <button
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs sm:text-sm transition"
            onClick={() => (window.location.href = createHref)}
          >
            + Create your first integration
          </button>
        </div>
      )}

      {Object.entries(testStates).map(([id, state]) => {
        const row = items.find((r) => r.id === id);
        if (!row || !SEND_CAPABLE_TYPES.has(row.channel_type)) return null;
        return (
          <div key={id} className={`rounded-lg border border-white/10 p-3 ${theme.surfaceSubtle}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs sm:text-sm font-semibold">Test send: {row.name}</div>
              <button
                className="text-[11px] px-2 py-1 rounded bg-white/10 hover:bg-white/20"
                onClick={() => toggleTest(id)}
              >
                Close
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                className={theme.input}
                placeholder="To"
                value={state.to}
                onChange={(e) =>
                  mergeTestState(id, { to: e.target.value })
                }
              />
              <input
                className={theme.input}
                placeholder="From (optional)"
                value={state.from ?? ""}
                onChange={(e) =>
                  mergeTestState(id, { from: e.target.value })
                }
              />
              {["email", "meta"].includes(row.channel_type as string) && (
                <input
                  className={theme.input}
                  placeholder="Subject (optional)"
                  value={state.subject ?? ""}
                  onChange={(e) =>
                    mergeTestState(id, { subject: e.target.value })
                  }
                />
              )}
            </div>
            <div className="flex flex-col gap-2 mt-2">
              <textarea
                className={`${theme.input} min-h-[100px]`}
                placeholder="Body"
                value={state.body}
                onChange={(e) =>
                  mergeTestState(id, { body: e.target.value })
                }
              />
              {row.channel_type === "email" && (
                <textarea
                  className={`${theme.input} min-h-[80px]`}
                  placeholder="HTML Body (optional)"
                  value={state.htmlBody ?? ""}
                  onChange={(e) =>
                    mergeTestState(id, { htmlBody: e.target.value })
                  }
                />
              )}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <button
                className="px-3 py-1.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-xs sm:text-sm transition disabled:opacity-50"
                disabled={state.submitting}
                onClick={() => submitTest(id)}
              >
                {state.submitting ? "Sending…" : "Send Test"}
              </button>
              {state.error && <span className="text-xs text-red-400">{state.error}</span>}
              {state.result && (
                <span className="text-[11px] text-emerald-300">
                  Success: {state.result.slice(0, 120)}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </Card>
  );
}
