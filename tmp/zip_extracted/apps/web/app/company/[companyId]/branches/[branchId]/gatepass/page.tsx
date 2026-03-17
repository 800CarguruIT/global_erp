"use client";

import React from "react";
import { AppLayout } from "@repo/ui";

type Props = { params: { companyId: string; branchId: string } };

export default function BranchGatepassPage({ params }: Props) {
  const { companyId } = params;
  const gatepassHref = `/company/${companyId}/workshop/gatepass`;

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <div>
          <h1 className="text-2xl font-semibold">Branch Gatepass</h1>
          <p className="text-sm text-muted-foreground">
            Gatepass release is centralized. Open the company gatepass board to manage handovers.
          </p>
        </div>
        <a href={gatepassHref} className="inline-block rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
          Open Company Gatepass
        </a>
      </div>
    </AppLayout>
  );
}
