"use client";

import { useEffect, useState } from "react";
import { AppLayout, RoleListTable } from "@repo/ui";

export default function VendorRolesPage({
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
          <h1 className="text-xl sm:text-2xl font-semibold">Vendor Roles & Permissions</h1>
          <p className="text-sm text-muted-foreground">Manage roles for this vendor portal.</p>
        </div>
        <RoleListTable scope="vendor" scopeId={ids.vendorId} companyId={ids.companyId} />
      </div>
    </AppLayout>
  );
}
