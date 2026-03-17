"use client";

import { AppLayout, UserMonitoringOverview } from "@repo/ui";

export default function GlobalSettingsMonitoringPage() {
  return (
    <AppLayout>
      <div className="space-y-6 py-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold">Global Security Monitoring</h1>
          <p className="text-sm text-muted-foreground">Platform-wide session tracking, activity logs, and risk analysis.</p>
        </div>
        <UserMonitoringOverview scope="global" />
      </div>
    </AppLayout>
  );
}
