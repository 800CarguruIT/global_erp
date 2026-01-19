"use client";

import React, { useState } from "react";
import { Card } from "../components/Card";

type Dialer = {
  id: string;
  label: string;
  provider: string;
  level?: "global" | "company";
  companyName?: string | null;
};

type Props = {
  dialers: Dialer[];
  onTestCall: (args: { integrationId: string; to: string; from?: string }) => Promise<void>;
};

export function DialerListWithTestCall({ dialers, onTestCall }: Props) {
  const [integrationId, setIntegrationId] = useState<string>(dialers[0]?.id ?? "");
  const [to, setTo] = useState("");
  const [from, setFrom] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!integrationId || !to.trim()) {
      setError("Integration and destination number are required.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await onTestCall({ integrationId, to: to.trim(), from: from.trim() || undefined });
      setMessage("Test call triggered.");
    } catch (err: any) {
      setError(err?.message ?? "Failed to trigger test call");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Dialer Integrations</h2>
          <p className="text-xs text-muted-foreground">Select a dialer and place a quick test call.</p>
        </div>
      </div>

      {dialers.length === 0 ? (
        <p className="text-xs text-muted-foreground">No active dialers.</p>
      ) : (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-md border">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <th className="py-2 px-3 text-left">Label</th>
                  <th className="py-2 px-3 text-left">Provider</th>
                  <th className="py-2 px-3 text-left">Scope</th>
                </tr>
              </thead>
              <tbody>
                {dialers.map((d) => (
                  <tr key={d.id} className="border-b last:border-0">
                    <td className="py-2 px-3">{d.label}</td>
                    <td className="py-2 px-3 text-xs">{d.provider}</td>
                    <td className="py-2 px-3 text-xs text-muted-foreground">
                      {d.level ?? "company"} {d.companyName ? `• ${d.companyName}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-medium">Dialer</label>
              <select
                className="w-full rounded border bg-background px-3 py-2 text-sm"
                value={integrationId}
                onChange={(e) => setIntegrationId(e.target.value)}
              >
                {dialers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label} ({d.provider})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">To</label>
              <input
                className="w-full rounded border bg-background px-3 py-2 text-sm"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="+9715..."
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">From / Caller ID (optional)</label>
              <input
                className="w-full rounded border bg-background px-3 py-2 text-sm"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder="+9715..."
              />
            </div>
            <div className="sm:col-span-4 flex items-center gap-2">
              <button type="submit" className="rounded-md border px-3 py-2 text-sm font-medium" disabled={saving}>
                {saving ? "Sending..." : "Send test call"}
              </button>
              {message && <span className="text-xs text-emerald-500">{message}</span>}
              {error && <span className="text-xs text-destructive">{error}</span>}
            </div>
          </form>
        </div>
      )}
    </Card>
  );
}
