-- 083_accounting_subheadings_seed.sql
-- Seed accounting subheadings per heading

WITH headings AS (
  SELECT id, head_code
  FROM accounting_headings
)
INSERT INTO accounting_subheadings (heading_id, name, subhead_code)
SELECT h.id, v.name, v.subhead_code
FROM headings h
JOIN (
  VALUES
    ('1', 'Fixed Assets', '11'),
    ('1', 'Current Assets', '12'),
    ('2', 'Long-term Liabilities', '21'),
    ('2', 'Current liabilities', '22'),
    ('3', 'Capital', '31'),
    ('3', 'Retained Earning', '32'),
    ('3', 'Owners'' Current A/c', '33'),
    ('4', 'Direct Income', '41'),
    ('4', 'Indirect Income', '42'),
    ('5', 'Direct Expenses', '51'),
    ('5', 'Indirect Expenses', '52')
) AS v(head_code, name, subhead_code)
  ON v.head_code = h.head_code
ON CONFLICT (heading_id, subhead_code) DO NOTHING;
