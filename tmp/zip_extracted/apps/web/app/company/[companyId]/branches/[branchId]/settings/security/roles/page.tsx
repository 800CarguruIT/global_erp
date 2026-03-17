"use client";

import { useEffect, useState } from "react";
import { AppLayout, RoleListTable } from "@repo/ui";

export default function BranchRolesPage({
  params,
}: {
  params: { companyId: string; branchId: string } | Promise<{ companyId: string; branchId: string }>;
}) {
  const [ids, setIds] = useState<{ companyId: string; branchId: string } | null>(null);

  useEffect(() => {
    Promise.resolve(params).then((p) => setIds({ companyId: p.companyId, branchId: p.branchId }));
  }, [params]);

  if (!ids) return <AppLayout><div className="py-4 text-sm text-muted-foreground">Loading...</div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6 py-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold">Branch Roles & Permissions</h1>
          <p className="text-sm text-muted-foreground">Manage roles for this branch.</p>
        </div>
        <RoleListTable scope="branch" scopeId={ids.branchId} companyId={ids.companyId} />
      </div>
    </AppLayout>
  );
}
