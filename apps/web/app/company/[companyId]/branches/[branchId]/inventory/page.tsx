import React from "react";
import { AppLayout } from "@repo/ui";
import { InventoryMain } from "@repo/ui/main-pages/InventoryMain";

type Params = { companyId: string; branchId: string };

export default async function BranchInventoryPage({ params }: { params: Params } | { params: Promise<Params> }) {
  const { companyId, branchId } = await Promise.resolve(params);

  return (
    <AppLayout>
      <InventoryMain companyId={companyId} branchId={branchId} />
    </AppLayout>
  );
}
