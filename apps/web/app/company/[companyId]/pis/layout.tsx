"use client";

import { AppLayout } from "@repo/ui";

export default function PisLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout>
      <div className="min-h-screen">
        <div className="border-b border-white/10 bg-slate-950/80 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-sm font-bold text-white">PIS</div>
              <div>
                <h1 className="text-lg font-bold text-white tracking-wide">800CARGURU — PERFORMANCE INTELLIGENCE SYSTEM</h1>
                <p className="text-[11px] text-slate-400">V4.0 · 9-STAGE · 60+ KPIs · 7 AI ENGINES · ADMIN-CONFIGURABLE</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />LIVE
              </span>
            </div>
          </div>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </AppLayout>
  );
}
