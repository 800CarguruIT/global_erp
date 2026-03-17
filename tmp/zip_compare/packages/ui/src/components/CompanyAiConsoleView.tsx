"use client";

import React, { useEffect, useState } from "react";
import { Card } from "./Card";
import { useTheme } from "../theme";

type AiModuleConfig = {
  key: string;
  label: string;
  category: string;
  description?: string | null;
  enabled: boolean;
};

type ApiResponse = {
  masterEnabled: boolean;
  modules: AiModuleConfig[];
};

export function CompanyAiConsoleView() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/ai/config");
        if (!res.ok) throw new Error("Failed to load AI config");
        const json: ApiResponse = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError("Failed to load AI settings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card title="AI Configuration (Global View)" className="space-y-4">
      <p className={`text-xs sm:text-sm opacity-80 ${theme.mutedText}`}>
        This company currently follows the global AI configuration. Editing AI
        settings is only available at the global level.
      </p>

      {error && (
        <div className="text-xs text-red-400 border border-red-400/40 rounded-lg px-3 py-2 bg-red-500/5">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-xs opacity-70">Loading AI configuration…</div>
      )}

      {!loading && data && (
        <div className="space-y-3">
          <div className="text-xs">
            <span className="font-semibold">Master switch: </span>
            {data.masterEnabled ? "Enabled" : "Disabled"}
          </div>
          <div className="border rounded-lg divide-y divide-white/5 text-xs sm:text-sm">
            {data.modules.map((m) => (
              <div key={m.key} className="px-3 py-2 flex justify-between gap-4">
                <div>
                  <div className="font-medium">{m.label}</div>
                  {m.description && (
                    <div className="text-[11px] opacity-70">
                      {m.description}
                    </div>
                  )}
                  <div className="text-[11px] opacity-60">
                    Category: {m.category}
                  </div>
                </div>
                <div className="text-[11px]">
                  {m.enabled ? "Enabled" : "Disabled"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
