"use client";

import { AppLayout, IntegrationHealthDashboard } from "@repo/ui";

export default function GlobalIntegrationStatusPage() {
  return (
    <AppLayout>
      <div className="space-y-6 py-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold">Global Integration Status</h1>
          <p className="text-sm text-muted-foreground">Health dashboard for all platform integrations across all companies.</p>
        </div>
        <IntegrationHealthDashboard scope="global" />
      </div>
    </AppLayout>
  );
}
