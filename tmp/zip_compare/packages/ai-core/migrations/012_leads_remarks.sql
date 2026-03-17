-- 012_leads_remarks.sql

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS agent_remark text,
  ADD COLUMN IF NOT EXISTS customer_remark text;
