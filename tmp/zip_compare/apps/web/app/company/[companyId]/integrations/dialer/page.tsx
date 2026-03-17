"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppLayout, DialerIntegrationsScreen } from "@repo/ui";

type Params = { params: { companyId: string } | Promise<{ companyId: string }> };

export default function CompanyDialerIntegrationsPage({ params }: Params) {
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve(params).then((p) => setCompanyId(p?.companyId ?? null));
  }, [params]);

  return (
    <AppLayout>
      <div className="space-y-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-semibold">Dialer Integrations</h1>
          {companyId ? (
            <Link
              href={`/company/${companyId}/integrations/dialer/extensions`}
              className="rounded-full border border-white/25 px-3 py-1 text-xs hover:border-white/60"
            >
              Assign Extensions
            </Link>
          ) : null}
        </div>
        {companyId ? (
          <DialerIntegrationsScreen level="company" companyId={companyId} />
        ) : (
          <div className="text-xs sm:text-sm opacity-70">Company is required.</div>
        )}
      </div>
    </AppLayout>
  );
}
