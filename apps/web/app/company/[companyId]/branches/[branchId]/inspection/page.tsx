"use client";

import React from "react";
import { AppLayout } from "@repo/ui";

type Props = { params: { companyId: string; branchId: string } };

export default function BranchInspectionPage({ params }: Props) {
  const { companyId } = params;
  const inspectionsHref = `/company/${companyId}/workshop/inspections`;

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <div>
          <h1 className="text-2xl font-semibold">Branch Inspections</h1>
          <p className="text-sm text-muted-foreground">
            Inspections board is centralized. Open company inspections to view and create jobs.
          </p>
        </div>
        <a
          href={inspectionsHref}
          className="inline-block rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          Open Company Inspections
        </a>
      </div>
    </AppLayout>
  );
}
