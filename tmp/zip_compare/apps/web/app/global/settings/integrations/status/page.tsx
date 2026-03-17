"use client";

import { AppLayout, IntegrationHealthDashboard } from "@repo/ui";

export default function GlobalSettingsIntegrationStatusPage() {
  return (
    <AppLayout>
      <div className="space-y-6 py-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold">Integration Health</h1>
          <p className="text-sm text-muted-foreground">Real-time health monitoring for all dialer and channel integrations.</p>
        </div>
        <IntegrationHealthDashboard scope="global" />
      </div>
    </AppLayout>
  );
}
