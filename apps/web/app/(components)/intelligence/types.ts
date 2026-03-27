export type EngineKey = "e1" | "e2" | "e3" | "e4" | "e5" | "e6" | "e7";
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

export const ENGINE_LABELS: Record<EngineKey, string> = {
  e1: "Funnel",
  e2: "Agent",
  e3: "Revenue",
  e4: "Churn",
  e5: "Anomaly",
  e6: "Collections",
  e7: "Coaching",
};
