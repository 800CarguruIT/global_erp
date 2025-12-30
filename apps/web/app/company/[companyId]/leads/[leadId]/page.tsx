"use client";

import { useEffect, useState } from "react";
import { AppLayout, LeadDetailMain } from "@repo/ui";

type Params = { params: { companyId: string; leadId: string } | Promise<{ companyId: string; leadId: string }> };

export default function CompanyLeadDetailPage({ params }: Params) {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve(params).then((p) => {
      setCompanyId((p as any)?.companyId ?? null);
      setLeadId((p as any)?.leadId ?? null);
    });
  }, [params]);

  if (!companyId || !leadId) {
    return (
      <AppLayout>
        <div className="p-4 text-sm text-muted-foreground">Loading lead...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <LeadDetailMain companyId={companyId} leadId={leadId} />
    </AppLayout>
  );
}
