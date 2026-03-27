-- 170_line_items_action_priority.sql
-- Add action type, priority, and AI description to line items

ALTER TABLE line_items ADD COLUMN IF NOT EXISTS action_type TEXT NULL;       -- replace | service | repair
ALTER TABLE line_items ADD COLUMN IF NOT EXISTS priority TEXT NULL;          -- safety_risk | mandatory | recommended
ALTER TABLE line_items ADD COLUMN IF NOT EXISTS ai_description TEXT NULL;    -- AI-generated description of finding
