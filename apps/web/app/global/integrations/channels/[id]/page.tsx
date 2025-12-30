"use client";

import React, { useEffect, useState } from "react";
import { AppLayout, ChannelIntegrationForm } from "@repo/ui";
import { ChannelTypes } from "@repo/ai-core";

type ChannelRow = {
  id: string;
  scope: "global" | "company";
  company_id: string | null;
  name: string;
  channel_type: ChannelTypes.ChannelType;
  provider_key: string;
  auth_type: string;
  credentials: Record<string, unknown>;
  metadata?: Record<string, unknown> | null;
  webhooks?: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export default function GlobalChannelsEditPage({
  params,
}: {
  params: { id: string };
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [row, setRow] = useState<ChannelRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/channels/integrations/${params.id}?scope=global`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to load integration");
        }
        const data: ChannelRow = await res.json();
        if (!cancelled) setRow(data);
      } catch (err: unknown) {
        console.error(err);
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load integration");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  return (
    <AppLayout>
      <div className="space-y-6 py-4">
        <h1 className="text-xl sm:text-2xl font-semibold">Edit Global Channel Integration</h1>

        <div className="flex justify-start">
          <button
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs sm:text-sm transition"
            onClick={() => (window.location.href = "/global/integrations/channels")}
          >
            ← Back to Channel Integrations
          </button>
        </div>

        {loading && <div className="text-xs sm:text-sm opacity-70">Loading integration…</div>}

        {error && (
          <div className="text-xs sm:text-sm text-red-400 border border-red-400/40 rounded-lg px-3 py-2 bg-red-500/5">
            {error}
          </div>
        )}

        {!loading && row && (
          <ChannelIntegrationForm
            scope="global"
            mode="edit"
            integrationId={row.id}
            initialValues={{
              id: row.id,
              scope: "global",
              name: row.name,
              channelType: row.channel_type,
              providerKey: row.provider_key,
              authType: row.auth_type,
              credentials: row.credentials ?? {},
              metadata: row.metadata ?? {},
              webhooks: row.webhooks ?? {},
              isActive: row.is_active,
            }}
          />
        )}
      </div>
    </AppLayout>
  );
}
