"use client";

import { useState } from "react";

const PRESETS: { label: string; days: number | null }[] = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "YTD", days: -1 },
  { label: "1Y", days: 365 },
  { label: "ALL", days: null },
];

function getPresetDates(days: number | null): { from: string; to: string } {
  const to = new Date().toISOString().slice(0, 10);
  if (days === null) return { from: "2020-01-01", to };
  if (days === -1) return { from: `${new Date().getFullYear()}-01-01`, to };
  const f = new Date(Date.now() - days * 86400000);
  return { from: f.toISOString().slice(0, 10), to };
}

interface Props {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}

export function DateFilter({ from, to, onChange }: Props) {
  const [activePreset, setActivePreset] = useState<string>("ALL");

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {PRESETS.map(p => (
        <button
          key={p.label}
          onClick={() => {
            setActivePreset(p.label);
            const d = getPresetDates(p.days);
            onChange(d.from, d.to);
          }}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
            activePreset === p.label
              ? "bg-emerald-500/20 text-emerald-400"
              : "opacity-40 hover:opacity-70 hover:bg-muted/40"
          }`}
        >
          {p.label}
        </button>
      ))}
      <div className="w-px h-4 bg-muted mx-1" />
      <input
        type="date"
        value={from}
        onChange={e => { setActivePreset(""); onChange(e.target.value, to); }}
        className="bg-card/40 rounded-md px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-emerald-500/30"
      />
      <span className="opacity-30 text-xs">—</span>
      <input
        type="date"
        value={to}
        onChange={e => { setActivePreset(""); onChange(from, e.target.value); }}
        className="bg-card/40 rounded-md px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-emerald-500/30"
      />
    </div>
  );
}
