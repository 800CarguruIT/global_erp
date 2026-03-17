"use client";

import { useState } from "react";
import type { ReactNode } from "react";

type TabKey = "overview" | "tech";

const TAB_CONFIG: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "tech", label: "Tech" },
];

export function DocTabs({ overview, tech }: { overview: ReactNode; tech: ReactNode }) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  return (
    <div className="space-y-4 rounded-2xl border border-white/5 bg-background/80 p-5 shadow-lg">
      <div className="flex flex-wrap gap-2">
        {TAB_CONFIG.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] transition ${
              activeTab === tab.key
                ? "border-primary bg-gradient-to-tr from-primary/90 to-primary/40 text-white shadow-[0_8px_20px_-10px_rgba(59,130,246,0.8)]"
                : "border-white/20 text-white/60 hover:border-white/50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="pt-4">{activeTab === "overview" ? overview : tech}</div>
    </div>
  );
}
