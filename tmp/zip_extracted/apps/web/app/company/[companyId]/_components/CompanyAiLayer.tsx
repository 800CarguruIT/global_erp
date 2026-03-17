"use client";

import React from "react";
import { AiInsightsPanel, StaffCopilot } from "@repo/ui";
import { useRouter } from "next/navigation";

export function CompanyAiLayer({ companyId }: { companyId: string }) {
  const router = useRouter();

  return (
    <>
      <AiInsightsPanel
        companyId={companyId}
        page="company-dashboard"
        title="AI Business Intelligence"
        showKpis={true}
        showInsights={true}
        showSummary={true}
        kpiColumns={4}
        onNavigate={(href) => router.push(`/company/${companyId}/${href}`)}
      />
      <StaffCopilot
        companyId={companyId}
        currentPage="company-dashboard"
        onNavigate={(href) => router.push(href)}
      />
    </>
  );
}
