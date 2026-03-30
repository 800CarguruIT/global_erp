-- 182_vendor_part_details.sql
-- Add vendor part number and diagram fields to part_quotes

ALTER TABLE part_quotes
  ADD COLUMN IF NOT EXISTS vendor_part_number text NULL,
  ADD COLUMN IF NOT EXISTS diagram_file_id uuid NULL;
