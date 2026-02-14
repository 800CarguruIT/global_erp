"use client";

import { useEffect, useState } from "react";
import { AppLayout, EstimateQuotesMain } from "@repo/ui";

export default function CompanyOperationsDashboardPage({
  params,
}: {
  params: { companyId: string } | Promise<{ companyId: string }>;
}) {
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve(params).then((p) => setCompanyId(p?.companyId ?? null));
  }, [params]);

  return (
    <AppLayout>
      {companyId ? (
        <EstimateQuotesMain
          companyId={companyId}
          title="Operations Dashboard"
          subtitle="Car in-out operations pipeline overview."
        />
      ) : (
        <div className="py-4 text-sm text-muted-foreground">Loading...</div>
      )}
    </AppLayout>
  );
}
