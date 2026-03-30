import { getSql } from "../db";
import type { PisConfig, ScoreWeights, TierBoundaries, CommissionRates, SlaThresholds, LeadDistributionConfig, RevenueTargets } from "./types";

const DEFAULTS: Record<string, unknown> = {
  score_weights: { conversion_rate: 25, gp_pct: 20, revenue: 15, sla_compliance: 15, customer_satisfaction: 10, call_quality: 10, foc_penalty: -5 },
  tier_boundaries: { elite_min_score: 80, standard_min_score: 50 },
  commission_rates: { base_pct: 3, performance_pct: 5, top_pct: 8, gp_floor_pct: 20, foc_penalty_per_unit: 500 },
  sla_thresholds: { lead_to_assignment_min: 2, assignment_to_accept_min: 15, accept_to_first_contact_min: 5, first_contact_to_booking_hr: 24, booking_to_car_in_min: 30, car_in_to_estimate_min: 30, estimate_approval_rate_pct: 75, wip_on_time_pct: 85, job_complete_to_invoice_min: 30, invoice_to_pickup_hr: 4, invoice_to_follow_up_hr: 48 },
  lead_distribution: { tier1_accept_window_min: 10, tier2_accept_window_min: 7, tier3_accept_window_min: 5, lock_duration_min: 120, no_call_penalty_points: 5, max_cascade_attempts: 5 },
  revenue_targets: { monthly_target_aed: 2000000, gp_target_pct: 45, foc_max_pct: 30 },
};

export async function getConfig(companyId: string): Promise<PisConfig> {
  const sql = getSql();
  const rows = await sql<{ config_key: string; config_value: unknown }[]>`
    SELECT config_key, config_value FROM pis_config WHERE company_id = ${companyId}
  `;
  const map: Record<string, unknown> = {};
  for (const r of rows) map[r.config_key] = r.config_value;

  return {
    score_weights: (map.score_weights ?? DEFAULTS.score_weights) as ScoreWeights,
    tier_boundaries: (map.tier_boundaries ?? DEFAULTS.tier_boundaries) as TierBoundaries,
    commission_rates: (map.commission_rates ?? DEFAULTS.commission_rates) as CommissionRates,
    sla_thresholds: (map.sla_thresholds ?? DEFAULTS.sla_thresholds) as SlaThresholds,
    lead_distribution: (map.lead_distribution ?? DEFAULTS.lead_distribution) as LeadDistributionConfig,
    revenue_targets: (map.revenue_targets ?? DEFAULTS.revenue_targets) as RevenueTargets,
  };
}

export async function updateConfig(companyId: string, key: string, value: unknown, userId?: string): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO pis_config (company_id, config_key, config_value, updated_by, updated_at)
    VALUES (${companyId}, ${key}, ${JSON.stringify(value)}::jsonb, ${userId ?? null}, now())
    ON CONFLICT (company_id, config_key)
    DO UPDATE SET config_value = ${JSON.stringify(value)}::jsonb, updated_by = ${userId ?? null}, updated_at = now()
  `;
}

export async function getAllConfigs(companyId: string): Promise<Record<string, unknown>> {
  const sql = getSql();
  const rows = await sql<{ config_key: string; config_value: unknown }[]>`
    SELECT config_key, config_value FROM pis_config WHERE company_id = ${companyId}
  `;
  const result: Record<string, unknown> = { ...DEFAULTS };
  for (const r of rows) result[r.config_key] = r.config_value;
  return result;
}