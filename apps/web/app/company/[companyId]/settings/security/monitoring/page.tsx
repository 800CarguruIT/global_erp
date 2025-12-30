"use client";

import React from "react";
import { AppLayout, ModulePlaceholder } from "@repo/ui";

type Props = { params: { companyId: string } };

export default function CompanySettingsMonitoringPage({ params }: Props) {
  return (
    <AppLayout>
      <ModulePlaceholder
        title="Security – Monitoring"
        description="Company sessions and monitoring (coming soon)."
      />
    </AppLayout>
  );
}
