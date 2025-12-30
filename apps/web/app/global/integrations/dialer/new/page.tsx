"use client";

import React from "react";
import { AppLayout, DialerIntegrationForm } from "@repo/ui";

export default function GlobalDialerNewPage() {
  return (
    <AppLayout>
      <div className="space-y-6 py-4">
        <h1 className="text-xl sm:text-2xl font-semibold">
          Create Global Dialer Integration
        </h1>

        <div className="flex justify-start">
          <button
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs sm:text-sm transition"
            onClick={() =>
              (window.location.href = "/global/integrations/dialer")
            }
          >
            ← Back to Dialer Integrations
          </button>
        </div>

        <DialerIntegrationForm scope="global" />
      </div>
    </AppLayout>
  );
}
