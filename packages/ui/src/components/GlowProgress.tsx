"use client";

import React from "react";
import { useTheme } from "../theme";

type GlowProgressProps = {
  value: number; // 0-100
  label?: string;
  sublabel?: string;
};

export function GlowProgress({ value, label, sublabel }: GlowProgressProps) {
  const { theme } = useTheme();
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className={`${theme.cardBg} ${theme.cardBorder} rounded-2xl p-4`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          {label && <div className="text-sm font-semibold">{label}</div>}
          {sublabel && <div className={`${theme.mutedText} text-xs`}>{sublabel}</div>}
        </div>
        <div className="text-sm font-semibold">{clamped}%</div>
      </div>
      <div className="mt-3 h-3 w-full rounded-full bg-black/20 relative overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${theme.accent} transition-all duration-500`}
          style={{ width: `${clamped}%` }}
        />
        <div className="absolute inset-0 rounded-full blur-xl opacity-50 bg-gradient-to-r from-white/20 via-transparent to-white/10" />
      </div>
      <div className="mt-2 text-[11px] uppercase tracking-wide text-white/70">Progress</div>
    </div>
  );
}
