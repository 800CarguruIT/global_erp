-- 087_accounting_accounts_seed.sql
-- Seed accounts per group

WITH entities AS (
  SELECT id, company_id
  FROM accounting_entities
  WHERE scope = 'company'
),
groups AS (
  SELECT g.id, g.group_code, g.company_id, g.heading_id, g.subheading_id, h.head_code
  FROM accounting_groups g
  JOIN accounting_headings h ON h.id = g.heading_id
),
type_map AS (
  SELECT
    g.id AS group_id,
    g.head_code,
    CASE g.head_code
      WHEN '1' THEN 'asset'
      WHEN '2' THEN 'liability'
      WHEN '3' THEN 'equity'
      WHEN '4' THEN 'income'
      WHEN '5' THEN 'expense'
      ELSE 'asset'
    END AS type,
    CASE g.head_code
      WHEN '1' THEN 'debit'
      WHEN '2' THEN 'credit'
      WHEN '3' THEN 'credit'
      WHEN '4' THEN 'credit'
      WHEN '5' THEN 'debit'
      ELSE 'debit'
    END AS normal_balance
  FROM groups g
)
INSERT INTO accounting_accounts (
  entity_id,
  heading_id,
  subheading_id,
  group_id,
  company_id,
  account_code,
  account_name,
  code,
  name,
  type,
  normal_balance,
  is_leaf,
  is_active
)
SELECT
  e.id,
  g.heading_id,
  g.subheading_id,
  g.id,
  g.company_id,
  v.account_code,
  v.account_name,
  v.account_code,
  v.account_name,
  tm.type,
  tm.normal_balance,
  true,
  true
FROM (
  VALUES
    ('1201', '120101', 'Battery Stock'),
    ('1201', '120102', 'Tyres Stock'),
    ('1201', '120103', 'Spare Parts Stock'),
    ('1201', '120104', 'Lubricants Stock'),
    ('1201', '120105', 'Others Consumables'),
    ('1202', '120201', 'General Advances'),
    ('1202', '120202', 'Advances to Employees'),
    ('1203', '120303', 'Trade receiveabls'),
    ('1203', '120304', 'Other Receieables'),
    ('1204', '120401', 'Cash Service Center (1)'),
    ('1204', '120402', 'Cash Service Center (2)'),
    ('1204', '120403', 'Cash Abu Dhabi - RSA'),
    ('1204', '120404', 'Hamad (Petty Cash)'),
    ('1204', '120405', 'Rounding Up'),
    ('1204', '120406', 'Qashio Cards'),
    ('1204', '120407', 'RAK BANK'),
    ('1204', '120408', 'FAB Bank'),
    ('1205', '120501', 'Network Solutions'),
    ('1205', '120502', 'Tabby Payments'),
    ('1205', '120503', 'PostPay Payment'),
    ('1205', '120504', 'Spotii Payment'),
    ('1205', '120505', 'SOUQ .com'),
    ('1205', '120506', 'Tammara Payment'),
    ('1205', '120507', 'Paytab Payment'),
    ('1205', '120508', 'ADCB - POS PAYMENT'),
    ('1205', '120509', 'Telr Payments'),
    ('1205', '120510', 'Noon - E-COMMERCE'),
    ('1205', '120511', 'Spotti'),
    ('1206', '120602', 'Company Legal Documentation'),
    ('1206', '120603', 'Prepaid Building Rent'),
    ('1206', '120604', 'Employee leave salary'),
    ('1206', '120605', 'Employee Medical Insurance'),
    ('1207', '120701', 'Employee VISA deposits'),
    ('1207', '120702', 'Govt Deposits (eg DEWA)'),
    ('1207', '120703', 'Other Commercial Deposits'),
    ('1207', '120704', 'Undeposit Funds'),
    ('1101', '110101', 'Accumulated Depreciation'),
    ('1101', '110102', 'Office Furniture'),
    ('1101', '110103', 'Property, Plant and Equipment'),
    ('1101', '110104', 'Computer,printer & Others'),
    ('1101', '110105', 'Fleet'),
    ('1101', '110106', 'Air Conditoners & Electric equipment'),
    ('1101', '110107', 'Workshop Heavy equipment'),
    ('1101', '110108', 'Workshop Lifts & Jacks'),
    ('1102', '110201', 'Long term Employee VISA deposits'),
    ('1102', '110202', 'Long term Govt Deposits (eg DEWA)'),
    ('1102', '110203', 'Long Term Other Commercial Deposits'),
    ('1103', '110301', 'Long Term Bank Inestments'),
    ('2201', '220101', 'Trade Payables'),
    ('2201', '220102', 'Sundry Creditors'),
    ('2202', '220201', 'Salary Payable'),
    ('2202', '220202', 'Employee Advances'),
    ('2202', '220203', 'Employee Re-imbursement'),
    ('2203', '220301', 'RAK BANK POS LOAN A/C'),
    ('2203', '220302', 'Auto Loan RAK Bank'),
    ('2204', '220401', 'VAT account'),
    ('2204', '220402', 'Corporate tax'),
    ('2106', '210601', 'RAK BANK POS LOAN A/C'),
    ('2106', '210602', 'Auto Loan RAK Bank'),
    ('3101', '310101', 'Ovais Capital Account'),
    ('3101', '310102', 'Mukhtar Current Capital Account'),
    ('3101', '310103', 'Hammad Capital Account'),
    ('3102', '310201', 'Retained Earning'),
    ('3103', '310301', 'Ovais Cash Account'),
    ('3103', '310302', 'Mukhtar Cash Accounts'),
    ('3103', '310303', 'Hammad Cash Account'),
    ('4101', '410101', 'Revenue - Road Side Assistance (RSA)'),
    ('4101', '410102', 'Sales - Service Center -'),
    ('4101', '410103', 'Sales- CHSC'),
    ('4101', '410104', 'Sales -Car Wash Package'),
    ('4101', '410105', 'Sales- Tyres'),
    ('4101', '410106', 'Revenue-Insured Customers-RSA'),
    ('4102', '410201', 'Sales Refund'),
    ('4103', '410301', 'Scrape-Sale'),
    ('4103', '410302', 'Dissount & Rebate'),
    ('4104', '410401', 'Interest from Bank'),
    ('5101', '510101', 'Battery Purchase'),
    ('5101', '510102', 'Tyre Purchase'),
    ('5101', '510103', 'Oil Purchase'),
    ('5101', '510104', 'Spare Parts Purchase'),
    ('5101', '510105', 'Other Purchases'),
    ('5102', '510201', 'Car Wash Consumable & Other Expenses'),
    ('5102', '510202', 'Repair & Lathe Work'),
    ('5102', '510203', 'Recovery & Transport'),
    ('5201', '520101', 'Fuel Cash'),
    ('5201', '520102', 'Fuel VIP Tags - Recovery'),
    ('5201', '520103', 'Fuel VIP Tags - RSA'),
    ('5201', '520104', 'SALIK'),
    ('5201', '520105', 'Customers  Vehicle Passing'),
    ('5201', '520106', 'Company Vehicle Passing & Renewal'),
    ('5201', '520107', 'RSA Vehicle Repair & Maintenance'),
    ('5201', '520108', 'Recovery Vehicle Repair & Maintenance'),
    ('5202', '520201', 'Google Promotion & Markeitng'),
    ('5202', '520202', 'Branding (sticker, Uniform etc)'),
    ('5202', '520203', 'Social Media Promotion And Advertisment'),
    ('5202', '520204', 'SMS & Email marketing'),
    ('5203', '520301', 'Etisalat'),
    ('5203', '520302', 'DU'),
    ('5203', '520303', 'DEWA'),
    ('5204', '520401', 'Payroll - RSA - Technicians'),
    ('5204', '520402', 'Payroll - SC-1'),
    ('5204', '520403', 'Payroll - SC2'),
    ('5204', '520404', 'Payroll - Call Center'),
    ('5204', '520405', 'Payroll - Admin Staff'),
    ('5204', '520406', 'Payroll CHSC-TELESALES'),
    ('5204', '520407', 'Payroll Expenses-HOUSE HELPER'),
    ('5204', '520408', 'Payroll Expenses-WASHING ANKIT TEAM'),
    ('5204', '520409', 'Employee Visa Expense'),
    ('5204', '520410', 'Commissions CHSC & Service Centre'),
    ('5204', '520411', 'Leave Salary & Air Tickets'),
    ('5204', '520412', 'Incentive-Bonus (Reviews & Others)'),
    ('5205', '520501', 'Rent - SC 1 - AL QUOZ'),
    ('5205', '520502', 'Rent - SC-2 - AL Quoz'),
    ('5205', '520503', 'Rent - Abu Dhabi Staff Accommodation'),
    ('5205', '520504', 'Director Accommodation'),
    ('5205', '520505', 'Rent - Car Wash Team Accommodation'),
    ('5205', '520506', 'Rent- Car Wash Building Rent'),
    ('5205', '520507', 'Rent or Lease of Buildings'),
    ('5206', '520601', 'Bank Charges - RAK'),
    ('5206', '520602', 'Bank Charges - FAB'),
    ('5206', '520603', 'Network Charges'),
    ('5206', '520604', 'Postpay Charges'),
    ('5206', '520605', 'Tabby Charges'),
    ('5206', '520606', 'Tammara Charges'),
    ('5206', '520607', 'Paytab Charges'),
    ('5206', '520608', 'ADCB Charges'),
    ('5207', '520701', 'Trade License & Local Sponsor'),
    ('5207', '520702', 'Audit Fee'),
    ('5207', '520703', 'Professional Advisory'),
    ('5208', '520801', 'Directors Travelling Expense'),
    ('5208', '520802', 'Staff Travelling Expense'),
    ('5208', '520803', 'Staff Wellfare (Medical Etc)'),
    ('5208', '520804', 'Mobile Recharge'),
    ('5208', '520805', 'Office Supplies'),
    ('5208', '520806', 'Office Expense - Building Maintenance'),
    ('5208', '520807', 'Miscellaneous Expenses (H)'),
    ('5208', '520808', 'Other Expenses - SMJ'),
    ('5208', '520809', 'Workshop Renovation & Fitouts'),
    ('5208', '520810', 'Meal & Entertainment'),
    ('5208', '520811', 'Cleaning Expenses'),
    ('5208', '520812', 'Printing & Stationary'),
    ('5208', '520813', 'IT Subscription & Repairs'),
    ('5208', '520814', 'Office Others / Miscellaneous'),
    ('5208', '520815', 'Insurance Expenses'),
    ('5208', '520815', 'Charitable Contributions'),
    ('5208', '520816', 'Home Cars Maintenance'),
    ('5208', '520817', 'Round Off')
) AS v(group_code, account_code, account_name)
JOIN groups g ON g.group_code = v.group_code
JOIN entities e ON e.company_id = g.company_id
JOIN type_map tm ON tm.group_id = g.id
ON CONFLICT (group_id, account_code) DO NOTHING;
