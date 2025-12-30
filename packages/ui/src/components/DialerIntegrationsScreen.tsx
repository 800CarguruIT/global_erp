"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card } from "./Card";
import { useTheme } from "../theme";

type Level = "global" | "company";

type DialerRow = {
  id: string;
  provider: string;
  label: string;
  auth_type: string;
  is_global: boolean;
  company_id: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

type Props = {
  level: Level;
  companyId?: string;
};

type TestCallState = {
  to: string;
  from?: string;
  callerId?: string;
  submitting: boolean;
  result?: string;
  error?: string;
};

type Health = {
  status: "healthy" | "degraded" | "unreachable" | "unknown";
  lastCheckedAt?: string | Date;
  lastError?: string | null;
};

export function DialerIntegrationsScreen({ level, companyId }: Props) {
  const { theme } = useTheme();

  const [items, setItems] = useState<DialerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [testStates, setTestStates] = useState<Record<string, TestCallState>>({});
  const [health, setHealth] = useState<Record<string, Health>>({});
  const baseTestCall: TestCallState = {
    to: "",
    from: "",
    callerId: "",
    submitting: false,
  };

  const mergeTestState = (id: string, patch: Partial<TestCallState>) =>
    setTestStates((prev) => ({
      ...prev,
      [id]: { ...baseTestCall, ...(prev[id] ?? {}), ...patch },
    }));

  const scopeParam =
    level === "global" ? "scope=global" : `scope=company&companyId=${companyId ?? ""}`;

  const createHref =
    level === "global"
      ? "/global/integrations/dialer/new"
      : `/company/${companyId}/integrations/dialer/new`;

  const backHref =
    level === "global"
      ? "/global/integrations"
      : `/company/${companyId}/integrations`;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/dialer/integrations?${scopeParam}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to load dialer integrations");
        }
        const data = await res.json();
        if (!cancelled) setItems(data.items ?? []);
      } catch (err: unknown) {
        console.error(err);
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Failed to load dialer integrations";
          setError(message);
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
            const res = await fetch(`/api/dialer/integrations/${id}/health`);
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
  }, [items]);

  function formatAuthType(auth: string) {
    switch (auth) {
      case "sip":
        return "SIP / PBX";
      case "api_key":
        return "API key";
      case "oauth2":
        return "OAuth2";
      default:
        return auth;
    }
  }

  function gotoEdit(id: string) {
    if (level === "global") {
      window.location.href = `/global/integrations/dialer/${id}`;
    } else {
      window.location.href = `/company/${companyId}/integrations/dialer/${id}`;
    }
  }

  async function softDelete(id: string) {
    setMutatingId(id);
    try {
      const detailRes = await fetch(`/api/dialer/integrations/${id}?${scopeParam}`);
      if (!detailRes.ok) {
        const body = await detailRes.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load integration");
      }
      const detail: DialerRow & { credentials?: Record<string, unknown>; auth_type: string } =
        await detailRes.json();

      const res = await fetch(`/api/dialer/integrations/${id}?${scopeParam}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: detail.provider,
          label: detail.label,
          authType: detail.auth_type,
          credentials: detail.credentials ?? {},
          isActive: false,
          scope: level === "global" ? "global" : "company",
          companyId: level === "company" ? companyId : null,
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

  const headerText = useMemo(() => {
    if (loading) return "Loading dialer integrations…";
    return items.length === 0
      ? "No dialer integrations configured."
      : `${items.length} dialer integration${items.length === 1 ? "" : "s"}.`;
  }, [items.length, loading]);

  function toggleTest(id: string) {
    setTestStates((prev) => {
      const next = { ...prev };
      if (next[id]) {
        delete next[id];
      } else {
        next[id] = { ...baseTestCall };
      }
      return next;
    });
  }

  async function submitTest(id: string) {
    const state = testStates[id];
    if (!state || !state.to.trim()) {
      mergeTestState(id, { error: "Destination number is required", submitting: false });
      return;
    }
    mergeTestState(id, { submitting: true, error: undefined, result: undefined });

    try {
      const res = await fetch(`/api/dialer/integrations/${id}/call?${scopeParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: state.to,
          from: state.from,
          callerId: state.callerId,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Failed to place test call");
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
        error: err instanceof Error ? err.message : "Failed to place test call",
      });
    }
  }

  async function runHealth(id: string) {
    setHealth((prev) => ({ ...prev, [id]: { ...(prev[id] ?? {}), status: "unknown" } }));
    try {
      const res = await fetch(`/api/dialer/integrations/${id}/health`, { method: "POST" });
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
    <Card title={`${level === "global" ? "GLOBAL" : "COMPANY"} DIALER INTEGRATIONS`} className="space-y-4">
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
            + Create Dialer Integration
          </button>
        </div>
      </div>

      {error && (
        <div className="text-xs sm:text-sm text-red-400 border border-red-400/40 rounded-lg px-3 py-2 bg-red-500/5">
          {error}
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-4 py-2 text-left font-medium">Name</th>
                <th className="px-4 py-2 text-left font-medium">Provider</th>
                <th className="px-4 py-2 text-left font-medium">Auth</th>
                <th className="px-4 py-2 text-left font-medium">Active</th>
                <th className="px-4 py-2 text-left font-medium">Created</th>
                <th className="px-4 py-2 text-left font-medium">Updated</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {items.map((row) => {
                const testState = testStates[row.id];
                return (
                  <React.Fragment key={row.id}>
                    <tr className="hover:bg-white/5 transition">
                      <td className="px-4 py-3">{row.label}</td>
                      <td className="px-4 py-3">{row.provider}</td>
                      <td className="px-4 py-3">{formatAuthType(row.auth_type)}</td>
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
                        <button
                          className="px-3 py-1 text-xs rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-200 transition"
                          onClick={() => toggleTest(row.id)}
                        >
                          {testState ? "Close Test" : "Test Call"}
                        </button>
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
            You don&apos;t have any dialer integrations yet. Configure one to allow
            outbound calling via your provider.
          </div>
          <button
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs sm:text-sm transition"
            onClick={() => (window.location.href = createHref)}
          >
            + Create your first dialer
          </button>
        </div>
      )}

      {Object.entries(testStates).map(([id, state]) => {
        const row = items.find((r) => r.id === id);
        if (!row) return null;
        return (
          <div key={id} className={`rounded-lg border border-white/10 p-3 ${theme.surfaceSubtle}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs sm:text-sm font-semibold">Test call: {row.label}</div>
              <button
                className="text-[11px] px-2 py-1 rounded bg-white/10 hover:bg-white/20"
                onClick={() => toggleTest(id)}
              >
                Close
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <input
                className={theme.input}
                placeholder="To"
                value={state.to}
                onChange={(e) => mergeTestState(id, { to: e.target.value })}
              />
              <input
                className={theme.input}
                placeholder="From (optional)"
                value={state.from ?? ""}
                onChange={(e) => mergeTestState(id, { from: e.target.value })}
              />
              <input
                className={theme.input}
                placeholder="Caller ID (optional)"
                value={state.callerId ?? ""}
                onChange={(e) => mergeTestState(id, { callerId: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <button
                className="px-3 py-1.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-xs sm:text-sm transition disabled:opacity-50"
                disabled={state.submitting}
                onClick={() => submitTest(id)}
              >
                {state.submitting ? "Calling…" : "Send Test Call"}
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
