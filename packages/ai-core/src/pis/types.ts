export interface PisFilter {
  companyId: string;
  branchId?: string | null;
  from: Date;
  to: Date;
}

export interface PisConfig {
  score_weights: ScoreWeights;
  tier_boundaries: TierBoundaries;
  commission_rates: CommissionRates;
  sla_thresholds: SlaThresholds;
  lead_distribution: LeadDistributionConfig;
  revenue_targets: RevenueTargets;
}

export interface ScoreWeights {
  conversion_rate: number;
  gp_pct: number;
  revenue: number;
  sla_compliance: number;
  customer_satisfaction: number;
  call_quality: number;
  foc_penalty: number;
}

export interface TierBoundaries {
  elite_min_score: number;
  standard_min_score: number;
}

export interface CommissionRates {
  base_pct: number;
  performance_pct: number;
  top_pct: number;
  gp_floor_pct: number;
  foc_penalty_per_unit: number;
}

export interface SlaThresholds {
  lead_to_assignment_min: number;
  assignment_to_accept_min: number;
  accept_to_first_contact_min: number;
  first_contact_to_booking_hr: number;
  booking_to_car_in_min: number;
  car_in_to_estimate_min: number;
  estimate_approval_rate_pct: number;
  wip_on_time_pct: number;
  job_complete_to_invoice_min: number;
  invoice_to_pickup_hr: number;
  invoice_to_follow_up_hr: number;
}

export interface LeadDistributionConfig {
  tier1_accept_window_min: number;
  tier2_accept_window_min: number;
  tier3_accept_window_min: number;
  lock_duration_min: number;
  no_call_penalty_points: number;
  max_cascade_attempts: number;
}

export interface RevenueTargets {
  monthly_target_aed: number;
  gp_target_pct: number;
  foc_max_pct: number;
}

export type AdvisorTier = "ELITE" | "STANDARD";

export interface AdvisorScore {
  advisorUserId: string;
  advisorName: string;
  compositeScore: number;
  conversionRate: number;
  gpPct: number;
  revenue: number;
  paidPct: number;
  focPct: number;
  slaCompliance: number;
  callQuality: number;
  customerSat: number;
  tier: AdvisorTier;
  rank: number;
  scoreBreakdown: Record<string, number>;
}

export interface PisMasterData {
  kpis: PisKpi[];
  focBanner: FocBanner | null;
  funnel: FunnelStage[];
  leaderboard: AdvisorScore[];
  slaItems: SlaItem[];
}

export interface PisKpi {
  key: string;
  label: string;
  value: number | string;
  subtitle: string;
  trend: "up" | "down" | "flat";
  color: string;
}

export interface FocBanner {
  focRate: number;
  focCount: number;
  totalCars: number;
  estimatedLoss: number;
}

export interface FunnelStage {
  stage: number;
  label: string;
  count: number;
  conversionPct: number;
  avgLag: string;
  slaTarget: string;
  slaStatus: "ON_TRACK" | "WARNING" | "BREACH";
}

export interface SlaItem {
  key: string;
  label: string;
  target: string;
  actual: string;
  status: "ON_TRACK" | "WARNING" | "BREACH";
  sourceEngine: string;
}

export interface LeadQueueItem {
  id: string;
  leadId: string;
  leadName: string;
  status: string;
  currentTier: number;
  cascadeCount: number;
  offeredTo: string | null;
  offeredToName: string | null;
  offeredAt: string | null;
  acceptedAt: string | null;
  lockedUntil: string | null;
  pipelineValue: number;
  createdAt: string;
}

export interface SimulationStep {
  stepNumber: number;
  leadNumber: number;
  action: "route" | "accept" | "cascade" | "timeout" | "manual" | "complete";
  advisorName: string | null;
  advisorTier: AdvisorTier | null;
  advisorScore: number | null;
  cascadeAttempt: number;
  pipelineValue: number;
  outcome: string;
}

export interface SimulationResult {
  totalLeads: number;
  accepted: number;
  cascaded: number;
  timedOut: number;
  manualQueue: number;
  totalPipelineValue: number;
  steps: SimulationStep[];
  advisorStats: Array<{
    name: string;
    tier: AdvisorTier;
    leadsOffered: number;
    leadsAccepted: number;
    leadsTimedOut: number;
    penalties: number;
  }>;
}

export interface CommissionRecord {
  advisorUserId: string;
  advisorName: string;
  tier: AdvisorTier;
  basePct: number;
  performancePct: number;
  effectivePct: number;
  revenueBase: number;
  gpBase: number;
  focDeduction: number;
  commissionAmount: number;
}

export interface EstimatePipelineData {
  approvalRate: number;
  totalEstimates: number;
  approvedCount: number;
  rejectedCount: number;
  rejectedValueAed: number;
  unapprovedPipeline: number;
  pendingOverSla: number;
  perAdvisor: Array<{
    advisorName: string;
    total: number;
    approved: number;
    rejected: number;
    pending: number;
    approvalRate: number;
  }>;
}

export interface WipData {
  activeWip: number;
  totalCapacity: number;
  onTimePct: number;
  pickupRate: number;
  zeroRevenueWip: number;
  zeroRevenueAdvisors: string[];
  perAdvisor: Array<{
    advisorName: string;
    activeJobs: number;
    onTimePct: number;
    pickupRate: number;
    zeroRevenue: number;
  }>;
}

export interface CollectionsData {
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  gpPct: number;
  collectionRate: number;
  dso: number;
  overdueAmount: number;
  overdueCount: number;
  perAdvisor: Array<{
    advisorName: string;
    revenue: number;
    cost: number;
    gp: number;
    gpPct: number;
    collected: number;
    outstanding: number;
  }>;
}