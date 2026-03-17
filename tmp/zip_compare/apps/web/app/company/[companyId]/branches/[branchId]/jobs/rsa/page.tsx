"use client";

import React from "react";
import { AppLayout, JobsMain } from "@repo/ui";
import type { LeadType } from "@repo/ai-core/crm/leads/types";

type Props = {
  params: { companyId: string; branchId: string };
};

const RSA_TYPES: LeadType[] = ["rsa"];

export default function BranchRsaJobsPage({ params }: Props) {
  const { companyId, branchId } = params;
  return (
    <AppLayout>
      <JobsMain companyId={companyId} includeTypes={RSA_TYPES} />
    </AppLayout>
  );
}
