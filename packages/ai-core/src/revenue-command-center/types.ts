export interface RccFilter {
  companyId: string;
  from: Date;
  to: Date;
  branchId?: string | null;
  segment?: "all" | "chsc" | "non_chsc" | "insurance" | "warranty";
}

// --- Tab 1: Command Center ---

export interface RccKpi {
  label: string;
  value: number;
  formatted: string;
  trend?: number; // % change vs previous period
}

export interface LeadSourceDistribution {
  source: string;
  count: number;
  pct: number;
}

export interface PipelineStage {
  stage: number;
  label: string;
  count: number;
  aedValue: number;
  dropPct: number;
  leadsLost: number;
}

export interface AgentLeaderboardEntry {
  rank: number;
  agentUserId: string;
  agentName: string;
  department: string;
  leadCount: number;
  conversionPct: number;
  revenue: number;
  rpl: number; // revenue per lead
}

export interface HeatmapCell {
  day: number; // 0=Sun..6=Sat
  hour: number; // 0-23
  revenue: number;
}

export interface AiSignal {
  id: string;
  severity: "CRITICAL" | "HIGH" | "MED";
  category: string; // Revenue Leak, Source ROI, Channel Shift, Booking Drop, Upsell Gap, Referral Engine
  title: string;
  description: string;
  impactAed: number;
  confidencePct: number;
  suggestedFix?: string;
  effortLevel?: "Low" | "Medium" | "High";
  timeline?: string;
  engineKey?: string;
}

export interface RccOverviewData {
  kpis: RccKpi[];
  leadSources: LeadSourceDistribution[];
  pipeline: PipelineStage[];
  leaderboard: AgentLeaderboardEntry[];
  heatmap: HeatmapCell[];
  aiSignals: AiSignal[];
}

// --- Tab 2: Lead Sources ---

export interface LeadSourcePerformance {
  source: string;
  leads: number;
  qualified: number;
  booked: number;
  showed: number;
  converted: number;
  revenue: number;
  rpl: number;
  cpa: number;
  roi: number;
}

export interface RccLeadSourceData {
  table: LeadSourcePerformance[];
  totals: LeadSourcePerformance;
}

// --- Tab 3: Pipeline ---

export interface StageConversionRow {
  source: string;
  leadToQual: number;
  qualToBook: number;
  bookToShow: number;
  showToSale: number;
  endToEnd: number;
}

export interface RccPipelineData {
  pipeline: PipelineStage[];
  conversionMatrix: StageConversionRow[];
}

// --- Tab 4: Leakage & Fix ---

export interface LeakageStage {
  fromStage: string;
  toStage: string;
  cause: string;
  leadsLost: number;
  aedLost: number;
  suggestedFix: string;
}

export interface FixRoadmapItem {
  rank: number;
  title: string;
  description: string;
  effortLevel: "Low" | "Medium" | "High";
  timeline: string;
  recoverableAed: number;
}

export interface RccLeakageData {
  kpis: RccKpi[];
  leakageByStage: LeakageStage[];
  fixRoadmap: FixRoadmapItem[];
}

// --- Tab 5: AI Engine ---

export interface AiEngineStatus {
  key: string;
  name: string;
  isActive: boolean;
  signalCount: number;
  topAction: string;
}

export interface RccAiEngineData {
  kpis: RccKpi[];
  signals: AiSignal[];
  engines: AiEngineStatus[];
}

// --- Marketing Spend ---

export interface MarketingSpend {
  id: string;
  companyId: string;
  source: string;
  periodStart: string;
  periodEnd: string;
  spendAmount: number;
  currency: string;
  notes: string | null;
}
