"use client";

import { useEffect, useState } from "react";
import { AppLayout, UserMonitoringOverview } from "@repo/ui";

export default function VendorSecurityMonitoringPage({
  params,
}: {
  params: { companyId: string; vendorId: string } | Promise<{ companyId: string; vendorId: string }>;
}) {
  const [ids, setIds] = useState<{ companyId: string; vendorId: string } | null>(null);

  useEffect(() => {
    Promise.resolve(params).then((p) => setIds({ companyId: p.companyId, vendorId: p.vendorId }));
  }, [params]);

  if (!ids) return <AppLayout><div className="py-4 text-sm text-muted-foreground">Loading...</div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6 py-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold">Vendor Security Monitoring</h1>
          <p className="text-sm text-muted-foreground">Session tracking and activity logs for this vendor.</p>
        </div>
        <UserMonitoringOverview scope="vendor" scopeId={ids.vendorId} />
      </div>
    </AppLayout>
  );
}
