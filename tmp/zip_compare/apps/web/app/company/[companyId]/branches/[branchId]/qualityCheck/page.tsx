"use client";

import React from "react";
import { AppLayout } from "@repo/ui";

type Props = { params: { companyId: string; branchId: string } };

export default function BranchQualityCheckPage({ params }: Props) {
  const { companyId } = params;
  const qcHref = `/company/${companyId}/workshop/qc`;

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <div>
          <h1 className="text-2xl font-semibold">Branch Quality Check</h1>
          <p className="text-sm text-muted-foreground">
            QC board is centralized. Open company QC to verify jobs before invoicing/gatepass.
          </p>
        </div>
        <a href={qcHref} className="inline-block rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
          Open Company QC
        </a>
      </div>
    </AppLayout>
  );
}
