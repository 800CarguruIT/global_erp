"use client";

import React from "react";
import { AppLayout } from "@repo/ui";

type Props = { params: { companyId: string; branchId: string } };

export default function BranchPartsPage({ params }: Props) {
  const { companyId } = params;
  const partsHref = `/company/${companyId}/workshop/parts`;
  const procurementHref = `/company/${companyId}/workshop/procurement`;

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <div>
          <h1 className="text-2xl font-semibold">Branch Parts</h1>
          <p className="text-sm text-muted-foreground">
            Review parts requirements and procurement. Managed centrally at company level.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <a href={partsHref} className="rounded-xl border p-4 hover:bg-muted">
            <h3 className="text-sm font-semibold">Parts Board</h3>
            <p className="text-xs text-muted-foreground">Open company parts requirements and receipts.</p>
          </a>
          <a href={procurementHref} className="rounded-xl border p-4 hover:bg-muted">
            <h3 className="text-sm font-semibold">Procurement</h3>
            <p className="text-xs text-muted-foreground">Manage POs/LPOs supplying parts to branches.</p>
          </a>
        </div>
      </div>
    </AppLayout>
  );
}
