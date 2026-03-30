-- 178_pis_sla_snapshots.sql
-- SLA compliance measurements for PIS dashboard

CREATE TABLE IF NOT EXISTS pis_sla_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sla_key         text NOT NULL,
  sla_label       text NOT NULL DEFAULT '',
  target_value    numeric(10,2) NOT NULL,
  actual_value    numeric(10,2) NOT NULL,
  compliance_pct  numeric(6,2) NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'WARNING' CHECK (status IN ('ON_TRACK','WARNING','BREACH')),
  source_engine   text NULL,
  snapshot_date   date NOT NULL DEFAULT current_date,
  detail          jsonb NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pis_sla_company ON pis_sla_snapshots (company_id, snapshot_date DESC);