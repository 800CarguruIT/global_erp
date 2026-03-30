-- 174_pis_config.sql
-- PIS V4.0 configuration: score weights, commission rates, SLA thresholds, tier boundaries

CREATE TABLE IF NOT EXISTS pis_config (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  config_key      text NOT NULL,
  config_value    jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by      uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, config_key)
);

CREATE INDEX IF NOT EXISTS idx_pis_config_company ON pis_config (company_id);

-- Seed default config keys for existing companies
INSERT INTO pis_config (company_id, config_key, config_value)
SELECT c.id, key, value
FROM companies c,
(VALUES
  ('score_weights', '{"conversion_rate":25,"gp_pct":20,"revenue":15,"sla_compliance":15,"customer_satisfaction":10,"call_quality":10,"foc_penalty":-5}'::jsonb),
  ('tier_boundaries', '{"elite_min_score":80,"standard_min_score":50}'::jsonb),
  ('commission_rates', '{"base_pct":3,"performance_pct":5,"top_pct":8,"gp_floor_pct":20,"foc_penalty_per_unit":500}'::jsonb),
  ('sla_thresholds', '{"lead_to_assignment_min":2,"assignment_to_accept_min":15,"accept_to_first_contact_min":5,"first_contact_to_booking_hr":24,"booking_to_car_in_min":30,"car_in_to_estimate_min":30,"estimate_approval_rate_pct":75,"wip_on_time_pct":85,"job_complete_to_invoice_min":30,"invoice_to_pickup_hr":4,"invoice_to_follow_up_hr":48}'::jsonb),
  ('lead_distribution', '{"tier1_accept_window_min":10,"tier2_accept_window_min":7,"tier3_accept_window_min":5,"lock_duration_min":120,"no_call_penalty_points":5,"max_cascade_attempts":5}'::jsonb),
  ('revenue_targets', '{"monthly_target_aed":2000000,"gp_target_pct":45,"foc_max_pct":30}'::jsonb)
) AS defaults(key, value)
ON CONFLICT (company_id, config_key) DO NOTHING;