"use client";

import React, { useEffect, useState } from "react";
import { AppLayout, ChannelIntegrationForm } from "@repo/ui";

type Params = { params: { companyId: string } | Promise<{ companyId: string }> };

export default function CompanyChannelsNewPage({ params }: Params) {
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve(params).then((p) => setCompanyId(p?.companyId ?? null));
  }, [params]);

  return (
    <AppLayout>
      <div className="space-y-6 py-4">
        <h1 className="text-xl sm:text-2xl font-semibold">Create Company Channel Integration</h1>
        <div className="flex justify-start">
          <button
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs sm:text-sm transition"
            onClick={() => {
              if (!companyId) {
                window.location.href = "/company";
                return;
              }
              window.location.href = `/company/${companyId}/settings/integrations/channels`;
            }}
          >
            Back to Channel Integrations
          </button>
        </div>
        {companyId ? (
          <ChannelIntegrationForm scope="company" companyId={companyId} />
        ) : (
          <div className="text-xs sm:text-sm opacity-70">Company is required.</div>
        )}
      </div>
    </AppLayout>
  );
}
