import * as repo from "./repository";
import { generateAiSignals, getEngineStatuses } from "./aiSignalGenerator";
import type {
  RccFilter, RccOverviewData, RccLeadSourceData,
  RccPipelineData, RccLeakageData, RccAiEngineData,
  RccKpi, FixRoadmapItem,
} from "./types";

// ── Tab 1: Command Center ──────────────────

export async function getOverviewTab(filter: RccFilter): Promise<RccOverviewData> {
  const [kpis, leadSources, pipeline, leaderboard, heatmap, aiSignals] = await Promise.all([
    repo.getOverviewKpis(filter),
    repo.getLeadSourceDistribution(filter),
    repo.getPipelineFunnel(filter),
    repo.getAgentLeaderboard(filter),
    repo.getRevenueHeatmap(filter),
    generateAiSignals(filter),
  ]);
  return { kpis, leadSources, pipeline, leaderboard, heatmap, aiSignals };
}

// ── Tab 2: Lead Sources ────────────────────

export async function getLeadSourcesTab(filter: RccFilter): Promise<RccLeadSourceData> {
  const table = await repo.getLeadSourcePerformance(filter);
  const totals = table.reduce(
    (acc, r) => ({
      source: "TOTAL",
      leads: acc.leads + r.leads,
      qualified: acc.qualified + r.qualified,
      booked: acc.booked + r.booked,
      showed: acc.showed + r.showed,
      converted: acc.converted + r.converted,
      revenue: acc.revenue + r.revenue,
      rpl: 0, cpa: 0, roi: 0,
    }),
    { source: "TOTAL", leads: 0, qualified: 0, booked: 0, showed: 0, converted: 0, revenue: 0, rpl: 0, cpa: 0, roi: 0 },
  );
  totals.rpl = totals.leads === 0 ? 0 : Math.round(totals.revenue / totals.leads);
  return { table, totals };
}

// ── Tab 3: Pipeline ────────────────────────

export async function getPipelineTab(filter: RccFilter): Promise<RccPipelineData> {
  const [pipeline, conversionMatrix] = await Promise.all([
    repo.getPipelineFunnel(filter),
    repo.getConversionMatrix(filter),
  ]);
  return { pipeline, conversionMatrix };
}

// ── Tab 4: Leakage & Fix ──────────────────

export async function getLeakageTab(filter: RccFilter): Promise<RccLeakageData> {
  const leakageByStage = await repo.getLeakageByStage(filter);

  const totalLeakage = leakageByStage.reduce((s, l) => s + l.aedLost, 0);
  const totalLost = leakageByStage.reduce((s, l) => s + l.leadsLost, 0);
  const biggest = leakageByStage[0]; // already sorted by aedLost desc

  const kpis: RccKpi[] = [
    { label: "Total Leakage", value: totalLeakage, formatted: `AED ${totalLeakage.toLocaleString()}` },
    { label: "Leads Lost", value: totalLost, formatted: totalLost.toLocaleString() },
    { label: "Biggest Leak", value: 0, formatted: biggest ? `${biggest.fromStage} → ${biggest.toStage}` : "N/A" },
    { label: "Fastest Fix", value: 0, formatted: "Speed-to-Lead" },
  ];

  // Static fix roadmap based on common leakage patterns
  const fixRoadmap: FixRoadmapItem[] = [
    { rank: 1, title: "60-Second Lead Response SLA", description: "Auto-assign all inbound/WhatsApp/App leads. Escalate at 60 sec.", effortLevel: "Low", timeline: "Week 1", recoverableAed: 0 },
    { rank: 2, title: "Same-Day Booking Push", description: "Agent must attempt booking on qualification call. If no in-call booking, auto-callback in 2h.", effortLevel: "Medium", timeline: "Week 1-2", recoverableAed: 0 },
    { rank: 3, title: "Triple-Touch Confirmation Flow", description: "WhatsApp + SMS + Call confirmation 24h, 4h, 1h before appointment.", effortLevel: "Low", timeline: "Week 1", recoverableAed: 0 },
    { rank: 4, title: "Referral Program Launch", description: "AED 50 credit per converting referral. Target: 3x referral volume.", effortLevel: "Medium", timeline: "Week 2-4", recoverableAed: 0 },
    { rank: 5, title: "Upsell Checklist at Car-In", description: "Service advisor presents 3 AI-recommended upsells before invoice.", effortLevel: "Low", timeline: "Week 1", recoverableAed: 0 },
    { rank: 6, title: "Kill/Fix Social Media Spend", description: "Pause or retarget social spend where RPL < CPA.", effortLevel: "Low", timeline: "Immediate", recoverableAed: 0 },
  ];

  // Distribute recoverable AED from leakage data to roadmap items
  if (leakageByStage.length > 0) {
    const sortedLeaks = [...leakageByStage];
    fixRoadmap[0].recoverableAed = sortedLeaks.find(l => l.fromStage === "New Lead")?.aedLost ?? 0;
    fixRoadmap[1].recoverableAed = sortedLeaks.find(l => l.fromStage === "Qualified")?.aedLost ?? 0;
    fixRoadmap[2].recoverableAed = sortedLeaks.find(l => l.fromStage === "Booked")?.aedLost ?? 0;
    fixRoadmap[3].recoverableAed = Math.round(totalLeakage * 0.15); // estimate
    fixRoadmap[4].recoverableAed = sortedLeaks.find(l => l.fromStage === "Showed Up")?.aedLost ?? 0;
    fixRoadmap[5].recoverableAed = Math.round(totalLeakage * 0.02); // estimate
  }
  fixRoadmap.sort((a, b) => b.recoverableAed - a.recoverableAed);

  return { kpis, leakageByStage, fixRoadmap };
}

// ── Tab 5: AI Engine ──────────────────────

export async function getAiEngineTab(filter: RccFilter): Promise<RccAiEngineData> {
  const [signals, engines] = await Promise.all([
    generateAiSignals(filter),
    getEngineStatuses(filter),
  ]);

  const totalImpact = signals.reduce((s, sig) => s + sig.impactAed, 0);
  const avgConf = signals.length === 0 ? 0 : Math.round(signals.reduce((s, sig) => s + sig.confidencePct, 0) / signals.length);
  const activeEngines = engines.filter(e => e.isActive).length;

  const kpis: RccKpi[] = [
    { label: "Total AI Impact", value: totalImpact, formatted: `+AED ${totalImpact.toLocaleString()}` },
    { label: "Active Signals", value: signals.length, formatted: signals.length.toString() },
    { label: "Avg Confidence", value: avgConf, formatted: `${avgConf}%` },
    { label: "Engines Active", value: activeEngines, formatted: `${activeEngines} / ${engines.length}` },
  ];

  return { kpis, signals, engines };
}

// ── Marketing Spend ───────────────────────

export const getMarketingSpend = repo.getMarketingSpend;
export const upsertMarketingSpend = repo.upsertMarketingSpend;
