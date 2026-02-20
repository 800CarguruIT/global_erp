"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@repo/ui";
import { LeadsMain } from "@repo/ui/main-pages/LeadsMain";

export default function CompanyRsaLeadsPage({
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
        <LeadsMain companyId={companyId} initialTab="rsa" />
      ) : (
        <div className="py-4 text-sm text-muted-foreground">Loading...</div>
      )}
    </AppLayout>
  );
}

