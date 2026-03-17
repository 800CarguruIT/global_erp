"use client";

import React from "react";
import { useTheme } from "../theme";

// ── Types ──────────────────────────────────────────

export interface BarChartItem {
  label: string;
  value: number;
  color?: string;
}

export interface TrendPoint {
  label: string;
  value: number;
}

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

// ── Color Palette ──────────────────────────────────

const CHART_COLORS = [
  "#818cf8", // indigo
  "#34d399", // emerald
  "#fbbf24", // amber
  "#f87171", // red
  "#60a5fa", // blue
  "#a78bfa", // violet
  "#2dd4bf", // teal
  "#fb923c", // orange
];

// ── Bar Chart ──────────────────────────────────────

export function BarChart({
  data,
  height = 180,
  showValues = true,
  title,
  className = "",
}: {
  data: BarChartItem[];
  height?: number;
  showValues?: boolean;
  title?: string;
  className?: string;
}) {
  const { theme } = useTheme();
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className={`space-y-2 ${className}`}>
      {title && <div className="text-xs font-semibold uppercase tracking-wider opacity-70">{title}</div>}
      <div className="flex items-end gap-1.5" style={{ height }}>
        {data.map((item, idx) => {
          const pct = (item.value / max) * 100;
          const color = item.color ?? CHART_COLORS[idx % CHART_COLORS.length];
          return (
            <div key={item.label} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              {showValues && (
                <span className="text-[10px] font-medium text-muted-foreground">{formatCompact(item.value)}</span>
              )}
              <div
                className="w-full rounded-t-md transition-all duration-500 ease-out"
                style={{
                  height: `${Math.max(pct, 2)}%`,
                  backgroundColor: color,
                  opacity: 0.85,
                }}
                title={`${item.label}: ${item.value.toLocaleString()}`}
              />
              <span className="text-[9px] text-muted-foreground truncate w-full text-center">{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Horizontal Bar Chart ───────────────────────────

export function HorizontalBarChart({
  data,
  title,
  maxBars = 8,
  className = "",
}: {
  data: BarChartItem[];
  title?: string;
  maxBars?: number;
  className?: string;
}) {
  const items = data.slice(0, maxBars);
  const max = Math.max(...items.map((d) => d.value), 1);

  return (
    <div className={`space-y-2 ${className}`}>
      {title && <div className="text-xs font-semibold uppercase tracking-wider opacity-70">{title}</div>}
      <div className="space-y-1.5">
        {items.map((item, idx) => {
          const pct = (item.value / max) * 100;
          const color = item.color ?? CHART_COLORS[idx % CHART_COLORS.length];
          return (
            <div key={item.label} className="space-y-0.5">
              <div className="flex justify-between text-[10px]">
                <span className="truncate max-w-[60%]">{item.label}</span>
                <span className="font-medium text-muted-foreground">{formatCompact(item.value)}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted/20 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${Math.max(pct, 1)}%`, backgroundColor: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Sparkline (Mini Trend) ─────────────────────────

export function Sparkline({
  data,
  width = 120,
  height = 32,
  color = "#818cf8",
  showArea = true,
  className = "",
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showArea?: boolean;
  className?: string;
}) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;
  const w = width - padding * 2;
  const h = height - padding * 2;

  const points = data.map((val, i) => ({
    x: padding + (i / (data.length - 1)) * w,
    y: padding + h - ((val - min) / range) * h,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1]!.x},${height} L${points[0]!.x},${height} Z`;

  return (
    <svg width={width} height={height} className={className} viewBox={`0 0 ${width} ${height}`}>
      {showArea && <path d={areaPath} fill={color} opacity={0.12} />}
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={points[points.length - 1]!.x} cy={points[points.length - 1]!.y} r={2.5} fill={color} />
    </svg>
  );
}

// ── Trend Chart (Labeled) ──────────────────────────

export function TrendChart({
  data,
  height = 140,
  title,
  color = "#818cf8",
  valueFormat = "number",
  className = "",
}: {
  data: TrendPoint[];
  height?: number;
  title?: string;
  color?: string;
  valueFormat?: "number" | "currency" | "percent";
  className?: string;
}) {
  if (data.length < 2) return null;

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const chartH = height - 40;
  const chartW = 100; // percentage-based

  const points = data.map((d, i) => ({
    x: (i / (data.length - 1)) * chartW,
    y: chartH - ((d.value - min) / range) * chartH,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1]!.x},${chartH} L${points[0]!.x},${chartH} Z`;

  return (
    <div className={`space-y-2 ${className}`}>
      {title && <div className="text-xs font-semibold uppercase tracking-wider opacity-70">{title}</div>}
      <svg width="100%" height={height} viewBox={`0 0 ${chartW} ${height}`} preserveAspectRatio="none">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
          <line key={pct} x1={0} y1={chartH * (1 - pct)} x2={chartW} y2={chartH * (1 - pct)} stroke="currentColor" strokeOpacity={0.06} strokeWidth={0.3} />
        ))}
        {/* Area */}
        <path d={areaPath} fill={color} opacity={0.1} />
        {/* Line */}
        <path d={linePath} fill="none" stroke={color} strokeWidth={0.8} strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={1.2} fill={color} />
        ))}
      </svg>
      <div className="flex justify-between text-[9px] text-muted-foreground px-1">
        {data.filter((_, i) => i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2)).map((d, idx) => (
          <span key={idx}>{d.label}</span>
        ))}
      </div>
    </div>
  );
}

// ── Donut Chart ────────────────────────────────────

export function DonutChart({
  data,
  size = 120,
  thickness = 20,
  title,
  centerLabel,
  centerValue,
  className = "",
}: {
  data: DonutSegment[];
  size?: number;
  thickness?: number;
  title?: string;
  centerLabel?: string;
  centerValue?: string | number;
  className?: string;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return null;

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  let accumulated = 0;

  return (
    <div className={`space-y-2 ${className}`}>
      {title && <div className="text-xs font-semibold uppercase tracking-wider opacity-70">{title}</div>}
      <div className="flex items-center gap-4">
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {/* Background ring */}
            <circle cx={center} cy={center} r={radius} fill="none" stroke="currentColor" strokeOpacity={0.06} strokeWidth={thickness} />
            {/* Segments */}
            {data.map((seg, idx) => {
              const pct = seg.value / total;
              const dashLength = pct * circumference;
              const dashOffset = -(accumulated * circumference) + circumference * 0.25; // rotate to start from top
              accumulated += pct;
              return (
                <circle
                  key={idx}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={seg.color || CHART_COLORS[idx % CHART_COLORS.length]!}
                  strokeWidth={thickness}
                  strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  className="transition-all duration-500"
                />
              );
            })}
          </svg>
          {/* Center text */}
          {(centerLabel || centerValue != null) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {centerValue != null && <span className="text-lg font-bold">{centerValue}</span>}
              {centerLabel && <span className="text-[9px] text-muted-foreground">{centerLabel}</span>}
            </div>
          )}
        </div>
        {/* Legend */}
        <div className="space-y-1 text-[10px]">
          {data.map((seg, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: seg.color || CHART_COLORS[idx % CHART_COLORS.length] }} />
              <span className="truncate">{seg.label}</span>
              <span className="text-muted-foreground ml-auto">{formatCompact(seg.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Stat Card with Sparkline ───────────────────────

export function StatCardWithTrend({
  label,
  value,
  previousValue,
  format = "number",
  trendData,
  color = "#818cf8",
  className = "",
}: {
  label: string;
  value: number;
  previousValue?: number;
  format?: "number" | "currency" | "percent";
  trendData?: number[];
  color?: string;
  className?: string;
}) {
  const { theme } = useTheme();
  const formatted = formatValue(value, format);
  const trendPct = previousValue != null && previousValue > 0
    ? Math.round(((value - previousValue) / previousValue) * 100)
    : null;
  const isUp = trendPct != null && trendPct > 0;
  const isDown = trendPct != null && trendPct < 0;

  return (
    <div className={`rounded-xl border ${theme.cardBorder} ${theme.cardBg} p-3 sm:p-4 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</div>
          <div className="text-xl sm:text-2xl font-bold mt-0.5">{formatted}</div>
          {trendPct != null && (
            <div className={`text-xs font-medium mt-0.5 ${isUp ? "text-emerald-400" : isDown ? "text-red-400" : "text-muted-foreground"}`}>
              {isUp ? "↑" : isDown ? "↓" : "—"} {Math.abs(trendPct)}% vs prior
            </div>
          )}
        </div>
        {trendData && trendData.length >= 2 && (
          <Sparkline data={trendData} color={color} width={80} height={28} />
        )}
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${(value / 1_000).toFixed(1)}K`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function formatValue(value: number, format: string): string {
  if (format === "currency") return formatCompact(value);
  if (format === "percent") return `${value}%`;
  return formatCompact(value);
}
