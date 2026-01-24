-- 081_accounting_headings_seed.sql
-- Seed top-level accounting headings (global)

INSERT INTO accounting_headings (head_code, name, financial_stmt)
VALUES
  ('1', 'Assets', 'Balance Sheet'),
  ('2', 'Liabilities', 'Balance Sheet'),
  ('3', 'Equity', 'Balance Sheet'),
  ('4', 'Income', 'Profit & Loss'),
  ('5', 'Expenses', 'Profit & Loss')
ON CONFLICT (head_code) DO NOTHING;
