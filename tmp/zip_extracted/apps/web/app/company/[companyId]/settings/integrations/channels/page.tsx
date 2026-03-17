"use client";

import { useEffect, useState } from "react";
import { AppLayout, ChannelIntegrationsScreen } from "@repo/ui";

type Params = { params: { companyId: string } | Promise<{ companyId: string }> };

export default function CompanyChannelsPage({ params }: Params) {
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve(params).then((p) => setCompanyId(p?.companyId ?? null));
  }, [params]);

  return (
    <AppLayout>
      <div className="space-y-6 py-4">
        <h1 className="text-xl sm:text-2xl font-semibold">Channel Integrations</h1>
        {companyId && <ChannelIntegrationsScreen scope="company" companyId={companyId} />}
      </div>
    </AppLayout>
  );
}
