export type EngineKey = "e1" | "e2" | "e3" | "e4" | "e5" | "e6" | "e7" | "e8";

export type SignalType = "diagnostic" | "predictive" | "prescriptive";

export type Urgency = "HIGH" | "MED" | "LOW";

export interface Signal {
  type: SignalType;
  metric: string;
  observation: string;
  diagnosis: string;
  action: string;
  urgency: Urgency;
  owner_role: string;
  respond_by_hours: number;
  confidence: number;
  expected_outcome: string;
  engine_key?: EngineKey;
}

export interface EngineResult {
  engine_key: EngineKey;
  signals: Signal[];
  cached: boolean;
  generated_at: string;
  error?: string | null;
}

export interface EngineConfig {
  engine_key: EngineKey;
  enabled: boolean;
  refresh_interval_min: number;
  thresholds: Record<string, unknown>;
  prompt_override: string | null;
}

export interface RunIntelligenceParams {
  companyId: string;
  branchId: string | null;
  engineKeys: EngineKey[];
  from: Date;
  to: Date;
}

export const ENGINE_LABELS: Record<EngineKey, string> = {
  e1: "Funnel Intelligence",
  e2: "Agent Performance",
  e3: "Revenue Forecasting",
  e4: "Churn & Retention",
  e5: "Anomaly Detection",
  e6: "Collections Intelligence",
  e7: "Coaching Intelligence",
  e8: "Call Center Performance Intelligence",
};

export const ALL_ENGINE_KEYS: EngineKey[] = ["e1", "e2", "e3", "e4", "e5", "e6", "e7", "e8"];
