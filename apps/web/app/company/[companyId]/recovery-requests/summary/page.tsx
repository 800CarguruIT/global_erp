"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@repo/ui";
import { RecoverySummaryMain } from "@repo/ui/main-pages/RecoverySummaryMain";

export default function CompanyRecoverySummaryPage({
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
        <RecoverySummaryMain companyId={companyId} />
      ) : (
        <div className="py-4 text-sm text-muted-foreground">Loading...</div>
      )}
    </AppLayout>
  );
}
