"use client";

import React from "react";
import { AppLayout, WorkOrdersMain } from "@repo/ui";

type Props = { params: { companyId: string; branchId: string } };

export default function BranchWorkOrderPage({ params }: Props) {
  const { companyId, branchId } = params;
  return (
    <AppLayout>
      <WorkOrdersMain companyId={companyId} branchId={branchId} />
    </AppLayout>
  );
}
