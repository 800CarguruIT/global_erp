"use client";

import { AppLayout, MainPageShell } from "@repo/ui";

export default function CompanyWorkOrderCreatePage() {
  return (
    <AppLayout>
      <MainPageShell
        title="Create Work Order"
        subtitle="Legacy placeholder until the booking flow is rebuilt."
        scopeLabel="Workshop"
      >
        <div className="rounded-2xl border border-border/60 bg-card/40 p-6 text-sm text-muted-foreground">
          <p>This screen is a stub. Fill in the workshop work order creation flow here when ready.</p>
        </div>
      </MainPageShell>
    </AppLayout>
  );
}
