-- 085_accounting_groups_seed.sql
-- Seed accounting groups per subheading

WITH headings AS (
  SELECT id, head_code
  FROM accounting_headings
),
subheadings AS (
  SELECT s.id, s.heading_id, s.subhead_code
  FROM accounting_subheadings s
)
INSERT INTO accounting_groups (heading_id, subheading_id, company_id, name, group_code)
SELECT
  h.id,
  s.id,
  'edbab966-f85e-4bb1-a2b2-7d2a644f5638'::uuid,
  v.name,
  v.group_code
FROM (
  VALUES
    ('1', '12', '1201', 'Stock in Hand'),
    ('1', '12', '1202', 'Advances'),
    ('1', '12', '1203', 'Account Receivables'),
    ('1', '12', '1204', 'Cash and Cash Equivalents'),
    ('1', '12', '1205', 'Payment Solutions'),
    ('1', '12', '1206', 'Prepaid Expenses'),
    ('1', '12', '1207', 'Short term Deposits'),
    ('1', '11', '1101', 'Property, Plant & Equipment'),
    ('1', '11', '1102', 'Long-Term Deposits'),
    ('1', '11', '1103', 'Long Term Investments'),
    ('2', '22', '2201', 'Accounts Payable (A/P)'),
    ('2', '22', '2202', 'Payroll liabilities'),
    ('2', '22', '2203', 'Short-term Loans'),
    ('2', '22', '2204', 'Duties & Taxes'),
    ('2', '21', '2106', 'Long-term Loans and Crediters'),
    ('3', '31', '3101', 'Owners'' Equity'),
    ('3', '32', '3102', 'Retained Earning'),
    ('3', '33', '3103', 'owners'' Withdrawl  / Deposits'),
    ('4', '41', '4101', 'Income From Main Activities'),
    ('4', '41', '4102', 'Income Adjustment'),
    ('4', '42', '4103', 'Other Income'),
    ('4', '42', '4104', 'Financial Income'),
    ('5', '51', '5101', 'Purchase of Goods'),
    ('5', '51', '5102', 'Other Direct Expenses'),
    ('5', '52', '5201', 'Selling & Distribution'),
    ('5', '52', '5202', 'Marketing, Promotional & Advertisement'),
    ('5', '52', '5203', 'Utilities (Telephone & Utilities)'),
    ('5', '52', '5204', 'Payroll & Employee Benefits'),
    ('5', '52', '5205', 'Rent or Lease of Buildings'),
    ('5', '52', '5206', 'Finance costs'),
    ('5', '52', '5207', 'Legal and professional fees'),
    ('5', '52', '5208', 'Other General and Administrative Expenses')
) AS v(head_code, subhead_code, group_code, name)
JOIN headings h ON h.head_code = v.head_code
JOIN subheadings s ON s.heading_id = h.id AND s.subhead_code = v.subhead_code
ON CONFLICT (subheading_id, group_code) DO NOTHING;
