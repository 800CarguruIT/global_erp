export interface MasterDashboardFilter {
  companyId: string;
  branchId?: string | null;
  from: Date;
  to: Date;
}

export interface TopKpis {
  totalRevenue: number;
  totalBookings: number;
  totalCallsHandled: number;
  showUpRate: number;
  totalCancellations: number;
  prevTotalRevenue: number | null;
  prevTotalBookings: number | null;
  prevTotalCalls: number | null;
}

export interface KpiRow {
  metric: string;
  today: number; // raw number for the current period
  target: number;
  barPct: number;
  status: "EXCELLENT" | "GOOD" | "WARNING" | "POOR";
}

export interface DailyDataPoint {
  date: string;
  calls: number;
  bookings: number;
  revenue: number;
}

export interface TeamStats {
  totalCalls: number;
  answerRate: number;
  bookings: number;
  conversionRate: number;
  score: number;
  grade: string;
}

export interface InboundMetrics {
  callsReceived: number;
  answerRate: number;
  avgHandlingTimeSecs: number;
  avgResponseTimeSecs: number;
  firstCallResolutionRate: number;
  bookingsCreated: number;
  abandonmentRate: number;
  repeatCallRate: number;
  trend: DailyDataPoint[];
  teamStats: TeamStats;
}

export interface OutboundMetrics {
  totalDials: number;
  answerRate: number;
  totalTalkTimeSecs: number;
  contactsMade: number;
  bookingsSet: number;
  showUpRate: number;
  leadToBookingConversion: number;
  noShowRate: number;
  salesConversionRate: number;
  trend: DailyDataPoint[];
  teamStats: TeamStats;
}

export interface TeamLocationMetrics {
  totalCalls: number;
  answerRate: number;
  avgHandlingTimeSecs: number;
  avgResponseTimeSecs: number;
  bookingsCreated: number;
  totalCollection: number;
  agentCount: number;
  abandonmentRate: number;
  repeatCallRate: number;
  trend: DailyDataPoint[];
  teamStats: TeamStats;
}

export interface RevenueBreakdownItem {
  label: string;
  value: number;
  pct: number;
}

export interface TopPerformer {
  agentId: string;
  name: string;
  metricValue: number;
  targetPct: number;
}

export interface PortfolioMetrics {
  customersManaged: number;
  monthlyTouchpoints: number;
  bookingsCarIn: number;
  totalSales: number;
  upsellRate: number;
  retentionRate: number;
  customerToBookingRate: number;
  crossSellRate: number;
  revenuePerCustomer: number;
  revenueBreakdown: RevenueBreakdownItem[];
  topPerformers: TopPerformer[];
  needsAttention: Array<{ agentId: string; name: string; issue: string }>;
  teamStats: TeamStats;
}

export interface ConversionFunnel {
  totalCalls: number;
  connected: number;
  leadsCreated: number;
  bookings: number;
  showUps: number;
  revenue: number;
  overallConversionRate: number;
}

export interface MasterDashboardData {
  period: { from: Date; to: Date };
  topKpis: TopKpis;
  inbound: InboundMetrics;
  outbound: OutboundMetrics;
  inhouse: TeamLocationMetrics;
  remote: TeamLocationMetrics;
  portfolio: PortfolioMetrics;
  funnel: ConversionFunnel;
}
