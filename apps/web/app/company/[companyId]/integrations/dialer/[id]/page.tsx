"use client";

import React, { useEffect, useState } from "react";
import { AppLayout, DialerIntegrationForm } from "@repo/ui";

type DialerRow = {
  id: string;
  provider: string;
  label: string;
  auth_type: "api_key" | "oauth2" | "sip" | string;
  credentials: Record<string, unknown>;
  is_global: boolean;
  company_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
type AuthType = DialerRow["auth_type"];

type Params = {
  params:
    | { companyId: string; id: string }
    | Promise<{ companyId: string; id: string }>;
};

export default function CompanyDialerEditPage({ params }: Params) {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [integrationId, setIntegrationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [integration, setIntegration] = useState<DialerRow | null>(null);

  useEffect(() => {
    Promise.resolve(params).then((p) => {
      setCompanyId(p?.companyId ?? null);
      setIntegrationId(p?.id ?? null);
    });
  }, [params]);

  useEffect(() => {
    if (!companyId || !integrationId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/dialer/integrations/${integrationId}?scope=company&companyId=${companyId}`
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to load integration");
        }
        const data: DialerRow = await res.json();
        if (!cancelled) setIntegration(data);
      } catch (err: unknown) {
        console.error(err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load integration");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [companyId, integrationId]);

  return (
    <AppLayout>
      <div className="space-y-6 py-4">
        <h1 className="text-xl sm:text-2xl font-semibold">Edit Company Dialer Integration</h1>

        <div className="flex justify-start">
          <button
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs sm:text-sm transition"
            onClick={() => {
              if (!companyId) {
                window.location.href = "/company";
                return;
              }
              window.location.href = `/company/${companyId}/integrations/dialer`;
            }}
          >
            Back to Dialer Integrations
          </button>
        </div>

        {!companyId && (
          <div className="text-xs sm:text-sm text-red-400">Company is required.</div>
        )}

        {loading && <div className="text-xs sm:text-sm opacity-70">Loading integration...</div>}

        {error && (
          <div className="text-xs sm:text-sm text-red-400 border border-red-400/40 rounded-lg px-3 py-2 bg-red-500/5">
            {error}
          </div>
        )}

        {!loading && integration && companyId && (
          <DialerIntegrationForm
            scope="company"
            companyId={companyId}
            mode="edit"
            integrationId={integration.id}
            initial={{
              label: integration.label,
              provider: integration.provider,
              authType: integration.auth_type as AuthType,
              isActive: integration.is_active,
              credentials: integration.credentials ?? {},
            }}
          />
        )}
      </div>
    </AppLayout>
  );
}
