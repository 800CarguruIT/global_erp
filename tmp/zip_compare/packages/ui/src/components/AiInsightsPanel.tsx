"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useTheme } from "../theme";

// ── Types ──────────────────────────────────────────

type InsightSeverity = "info" | "success" | "warning" | "critical";

interface AiInsight {
  id: string;
  category: string;
  severity: InsightSeverity;
  title: string;
  description: string;
  metric?: string | number | null;
  metricLabel?: string | null;
  trend?: "up" | "down" | "flat" | null;
  trendPercent?: number | null;
  actionLabel?: string | null;
  actionHref?: string | null;
}

interface AiKpi {
  key: string;
  label: string;
  value: number;
  previousValue?: number | null;
  trend?: "up" | "down" | "flat";
  trendPercent?: number | null;
  format?: "number" | "currency" | "percent";
  subtitle?: string | null;
}

interface InsightsResponse {
  insights: AiInsight[];
  kpis: AiKpi[];
  summary: string | null;
  generatedAt: string;
  aiUsed: boolean;
}

// ── Props ──────────────────────────────────────────

export interface AiInsightsPanelProps {
  companyId: string;
  page: string;
  branchId?: string;
  vendorId?: string;
  lang?: string;
  title?: string;
  showKpis?: boolean;
  showInsights?: boolean;
  showSummary?: boolean;
  compact?: boolean;
  maxInsights?: number;
  className?: string;
  kpiColumns?: number;
  onNavigate?: (href: string) => void;
}

// ── Helpers ────────────────────────────────────────

const SEVERITY_CONFIG: Record<InsightSeverity, { dot: string; bg: string; border: string }> = {
  critical: { dot: "bg-red-500", bg: "bg-red-500/10", border: "border-red-500/30" },
  warning: { dot: "bg-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/30" },
  success: { dot: "bg-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/30" },
  info: { dot: "bg-sky-400", bg: "bg-sky-400/10", border: "border-sky-400/30" },
};

function TrendArrow({ trend, percent }: { trend?: "up" | "down" | "flat" | null; percent?: number | null }) {
  if (!trend || trend === "flat") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const isUp = trend === "up";
  const color = isUp ? "text-emerald-400" : "text-red-400";
  const arrow = isUp ? "↑" : "↓";
  return (
    <span className={`text-xs font-medium ${color}`}>
      {arrow} {percent != null ? `${Math.abs(percent)}%` : ""}
    </span>
  );
}

function formatKpiValue(value: number, format?: string): string {
  if (format === "currency") {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toLocaleString("en", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  if (format === "percent") return `${value}%`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

// ── Subcomponents ──────────────────────────────────

function KpiCard({ kpi }: { kpi: AiKpi }) {
  const { theme } = useTheme();
  return (
    <div className={`rounded-xl border ${theme.cardBorder} ${theme.cardBg} p-3 sm:p-4 flex flex-col gap-1`}>
      <div className="text-[11px] text-muted-foreground uppercase tracking-wider">{kpi.label}</div>
      <div className="flex items-end gap-2">
        <span className="text-xl sm:text-2xl font-bold">{formatKpiValue(kpi.value, kpi.format)}</span>
        {kpi.trend && <TrendArrow trend={kpi.trend} percent={kpi.trendPercent} />}
      </div>
      {kpi.subtitle && <div className="text-[10px] text-muted-foreground">{kpi.subtitle}</div>}
    </div>
  );
}

function InsightCard({ insight, onNavigate }: { insight: AiInsight; onNavigate?: (href: string) => void }) {
  const config = SEVERITY_CONFIG[insight.severity] ?? SEVERITY_CONFIG.info;

  return (
    <div className={`rounded-xl border ${config.border} ${config.bg} p-3 sm:p-4 space-y-2`}>
      <div className="flex items-start gap-2">
        <div className={`mt-1 h-2 w-2 rounded-full ${config.dot} shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold leading-tight">{insight.title}</div>
          <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{insight.description}</div>
        </div>
        {insight.metric != null && (
          <div className="text-right shrink-0">
            <div className="text-lg font-bold">{insight.metric}</div>
            {insight.metricLabel && <div className="text-[10px] text-muted-foreground">{insight.metricLabel}</div>}
            {insight.trend && <TrendArrow trend={insight.trend} percent={insight.trendPercent} />}
          </div>
        )}
      </div>
      {insight.actionLabel && insight.actionHref && onNavigate && (
        <button
          onClick={() => onNavigate(insight.actionHref!)}
          className="text-xs font-medium text-primary hover:underline"
        >
          {insight.actionLabel} →
        </button>
      )}
    </div>
  );
}

function LoadingSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border/30 bg-muted/10 p-4">
          <div className="flex gap-2">
            <div className="h-2 w-2 rounded-full bg-muted/30 mt-1" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-muted/20 rounded w-2/3" />
              <div className="h-2 bg-muted/15 rounded w-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AiStatusBadge({ aiUsed }: { aiUsed: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
        aiUsed
          ? "bg-violet-500/15 text-violet-300 border border-violet-500/30"
          : "bg-muted/20 text-muted-foreground border border-border/30"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${aiUsed ? "bg-violet-400 animate-pulse" : "bg-muted-foreground/50"}`} />
      {aiUsed ? "AI Enhanced" : "Rule-based"}
    </span>
  );
}

// ── Main Component ─────────────────────────────────

export function AiInsightsPanel({
  companyId,
  page,
  branchId,
  vendorId,
  lang = "en",
  title = "AI Insights",
  showKpis = true,
  showInsights = true,
  showSummary = true,
  compact = false,
  maxInsights = 6,
  className = "",
  kpiColumns = 4,
  onNavigate,
}: AiInsightsPanelProps) {
  const { theme } = useTheme();
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page, lang });
      if (branchId) params.set("branchId", branchId);
      if (vendorId) params.set("vendorId", vendorId);
      const res = await fetch(`/api/company/${companyId}/ai/insights?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load insights");
      const json: InsightsResponse = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load AI insights");
    } finally {
      setLoading(false);
    }
  }, [companyId, page, branchId, vendorId, lang]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const kpis = data?.kpis ?? [];
  const insights = (data?.insights ?? []).slice(0, maxInsights);
  const criticalCount = insights.filter((i) => i.severity === "critical").length;
  const warningCount = insights.filter((i) => i.severity === "warning").length;

  const gridCols = kpiColumns === 3
    ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
    : kpiColumns === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4";

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-xs text-muted-foreground hover:text-foreground transition"
          >
            {collapsed ? "▶" : "▼"}
          </button>
          <h2 className="text-sm font-semibold uppercase tracking-wider opacity-80">{title}</h2>
          {data && <AiStatusBadge aiUsed={data.aiUsed} />}
          {criticalCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-300">
              {criticalCount} critical
            </span>
          )}
          {warningCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
              {warningCount} warning{warningCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <button
          onClick={fetchInsights}
          disabled={loading}
          className="text-xs text-muted-foreground hover:text-foreground transition disabled:opacity-40"
        >
          {loading ? "Loading…" : "↻ Refresh"}
        </button>
      </div>

      {collapsed ? null : (
        <>
          {/* Summary */}
          {showSummary && data?.summary && (
            <div className={`rounded-xl border ${theme.cardBorder} ${theme.cardBg} p-3 sm:p-4`}>
              <div className="text-xs text-muted-foreground mb-1 font-medium">Executive Summary</div>
              <div className="text-sm leading-relaxed">{data.summary}</div>
            </div>
          )}

          {/* KPIs Grid */}
          {showKpis && kpis.length > 0 && (
            <div className={`grid gap-3 ${gridCols}`}>
              {kpis.map((kpi) => (
                <KpiCard key={kpi.key} kpi={kpi} />
              ))}
            </div>
          )}

          {/* Insights */}
          {showInsights && (
            <>
              {loading && !data && <LoadingSkeleton count={compact ? 2 : 3} />}
              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                  {error}
                </div>
              )}
              {!loading && insights.length > 0 && (
                <div className={compact ? "space-y-2" : "space-y-3"}>
                  {insights.map((insight) => (
                    <InsightCard key={insight.id} insight={insight} onNavigate={onNavigate} />
                  ))}
                </div>
              )}
              {!loading && insights.length === 0 && !error && (
                <div className="rounded-xl border border-dashed border-border/30 bg-muted/5 p-4 text-center text-xs text-muted-foreground">
                  No insights to show. All systems operating normally.
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
