"use client";

import React, { useEffect, useState } from "react";
import { InventoryTransferDetailMain } from "@repo/ui/main-pages/InventoryTransferDetailMain";
import { AppLayout } from "@repo/ui";

type Props = { params: Promise<{ companyId: string; transferId: string }> };

export default function InventoryTransferDetailPage({ params }: Props) {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [transferId, setTransferId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve(params)
      .then((resolved) => {
        if (!cancelled) {
          setCompanyId(resolved.companyId);
          setTransferId(resolved.transferId);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCompanyId(null);
          setTransferId(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [params]);

  if (!companyId || !transferId) {
    return (
      <AppLayout>
        <div className="p-4 text-sm text-destructive">Transfer details are required.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <InventoryTransferDetailMain companyId={companyId} transferId={transferId} />
    </AppLayout>
  );
}
