import React from "react";
import { InventoryTransferDetailMain } from "@repo/ui/main-pages/InventoryTransferDetailMain";
import { AppLayout } from "@repo/ui";

type Props = { params: { companyId: string; transferId: string } };

export default function InventoryTransferDetailPage({ params }: Props) {
  const { companyId, transferId } = params;
  return (
    <AppLayout>
      <InventoryTransferDetailMain companyId={companyId} transferId={transferId} />
    </AppLayout>
  );
}
