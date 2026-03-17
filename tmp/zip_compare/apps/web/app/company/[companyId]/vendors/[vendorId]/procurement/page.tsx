"use client";

import { useEffect, useState } from "react";
import { AppLayout, AiInsightsPanel } from "@repo/ui";
import { useRouter } from "next/navigation";

export default function VendorProcurementPage({
  params,
}: {
  params: { companyId: string; vendorId: string } | Promise<{ companyId: string; vendorId: string }>;
}) {
  const router = useRouter();
  const [ids, setIds] = useState<{ companyId: string; vendorId: string } | null>(null);

  useEffect(() => {
    Promise.resolve(params).then((p) => setIds({ companyId: p.companyId, vendorId: p.vendorId }));
  }, [params]);

  if (!ids) return <AppLayout><div className="py-4 text-sm text-muted-foreground">Loading...</div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6 py-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold">Vendor Procurement</h1>
          <p className="text-sm text-muted-foreground">Purchase orders from accepted quotes, delivery tracking, and invoicing.</p>
        </div>
        <AiInsightsPanel companyId={ids.companyId} vendorId={ids.vendorId} page="vendor" title="Procurement Insights" showKpis={false} showInsights={true} compact={true} maxInsights={4} onNavigate={(href) => router.push(`/company/${ids.companyId}/${href}`)} />
      </div>
    </AppLayout>
  );
}
