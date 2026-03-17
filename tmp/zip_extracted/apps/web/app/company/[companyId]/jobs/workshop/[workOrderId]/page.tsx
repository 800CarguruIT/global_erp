"use client";

import React from "react";
import { AppLayout, WorkOrderDetailMain } from "@repo/ui";

export default function CompanyJobsWorkshopDetailPage({
  params,
}: {
  params: { companyId: string; workOrderId: string };
}) {
  const { companyId, workOrderId } = params;
  return (
    <AppLayout>
      <WorkOrderDetailMain
        companyId={companyId}
        workOrderId={workOrderId}
      />
    </AppLayout>
  );
}

