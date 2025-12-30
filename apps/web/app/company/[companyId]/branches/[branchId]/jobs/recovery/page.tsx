"use client";

import React from "react";
import { AppLayout, JobsMain } from "@repo/ui";
import type { LeadType } from "@repo/ai-core/crm/leads/types";

type Props = {
  params: { companyId: string; branchId: string };
};

const RECOVERY_TYPES: LeadType[] = ["recovery"];

export default function BranchRecoveryJobsPage({ params }: Props) {
  const { companyId, branchId } = params;
  return (
    <AppLayout>
      <JobsMain companyId={companyId} includeTypes={RECOVERY_TYPES} />
    </AppLayout>
  );
}
