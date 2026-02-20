-- 101_drop_quote_tables.sql

-- Drop workshop portal quotes
DROP TRIGGER IF EXISTS trg_touch_workshop_portal_quotes_updated_at ON workshop_portal_quotes;
DROP FUNCTION IF EXISTS touch_workshop_portal_quotes_updated_at();
DROP TABLE IF EXISTS workshop_portal_quotes;

-- Drop workshop import quotes
DROP TRIGGER IF EXISTS trg_workshop_quotes_touch_updated_at ON workshop_quotes;
DROP FUNCTION IF EXISTS touch_workshop_quotes_updated_at();
DROP TABLE IF EXISTS workshop_quotes;

-- Drop quotes + items
DROP TRIGGER IF EXISTS trg_touch_quotes_updated_at ON quotes;
DROP FUNCTION IF EXISTS touch_quotes_updated_at();
DROP TABLE IF EXISTS quote_items;
DROP TABLE IF EXISTS quotes;
