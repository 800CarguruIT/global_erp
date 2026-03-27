"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@repo/ui";
import { LeadsMain } from "@repo/ui/main-pages/LeadsMain";
import { AIPanel } from "../../../(components)/intelligence/AIPanel";

export default function CompanyLeadsPage({
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
        <>
          <AIPanel companyId={companyId} engines={["e1", "e4"]} />
          <LeadsMain companyId={companyId} />
        </>
      ) : (
        <div className="py-4 text-sm text-muted-foreground">Loading...</div>
      )}
    </AppLayout>
  );
}
