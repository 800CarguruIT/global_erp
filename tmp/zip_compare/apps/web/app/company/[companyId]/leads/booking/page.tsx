"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@repo/ui";
import { LeadsBookingMain } from "@repo/ui/main-pages/LeadsBookingMain";

export default function CompanyLeadsBookingPage({
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
        <LeadsBookingMain companyId={companyId} />
      ) : (
        <div className="py-4 text-sm text-muted-foreground">Loading...</div>
      )}
    </AppLayout>
  );
}
