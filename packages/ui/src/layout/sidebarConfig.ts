export type NavScope = "global" | "company" | "branch" | "vendor";
export type NavCategory =
  | "Main"
  | "Call Center"
  | "Leads"
  | "Sales"
  | "Jobs"
  | "Accounting"
  | "Reports"
  | "HR"
  | "Analytics";

export interface SidebarItem {
  label?: string;
  labelKey?: string;
  href: string;
  moduleKey?: string;
  disabled?: boolean;
  exactMatch?: boolean;
  children?: SidebarItem[];
}

export const SIDEBAR_CONFIG: Record<NavScope, Partial<Record<NavCategory, SidebarItem[]>>> = {
  global: {
    Main: [
      { labelKey: "global.nav.main", href: "/global" },
      { labelKey: "global.nav.companies", href: "/global/companies" },
      { labelKey: "global.nav.callCenter", href: "/global/call-center" },
      { labelKey: "global.nav.leads", href: "/global/leads" },
      { labelKey: "global.nav.marketing", href: "/global/marketing" },
      { labelKey: "global.nav.hr", href: "/global/hr" },
      { labelKey: "global.nav.finance", href: "/global/accounting" },
      { label: "Invoices", href: "/global/accounting/invoices" },
    ],
  },
  company: {
    Main: [
      { labelKey: "global.nav.main", href: "/company/[companyId]" },
      { labelKey: "global.nav.callCenter", href: "/company/[companyId]/call-center" },
      { labelKey: "global.nav.leads", href: "/company/[companyId]/leads" },
      { labelKey: "global.nav.marketing", href: "/company/[companyId]/marketing" },
      { labelKey: "global.nav.hr", href: "/company/[companyId]/hr" },
      { labelKey: "global.nav.finance", href: "/company/[companyId]/accounting" },
      { label: "Inventory", href: "/company/[companyId]/inventory" },
      { label: "Procurement", href: "/company/[companyId]/procurement" },
      { label: "Vendor Quotes", href: "/company/[companyId]/quotes/vendor" },
      { label: "Branch Quotes", href: "/company/[companyId]/quotes/branch" },
      { label: "Jobs", href: "/company/[companyId]/jobs" },
      { label: "Branches", href: "/company/[companyId]/branches" },
      { label: "Vendors", href: "/company/[companyId]/vendors" },
      { label: "Customers", href: "/company/[companyId]/customers" },
      { label: "Cars", href: "/company/[companyId]/cars" },
    ],
    "Call Center": [
      { labelKey: "global.nav.callCenter", href: "/company/[companyId]/call-center" },
      { label: "Call history", href: "/company/[companyId]/call-center/history" },
    ],
    Jobs: [
      { label: "RSA", href: "/company/[companyId]/jobs/rsa", moduleKey: "jobs" },
      { label: "Recovery", href: "/company/[companyId]/jobs/recovery", moduleKey: "jobs" },
      { label: "Workshop", href: "/company/[companyId]/jobs/workshop", moduleKey: "jobs" },
    ],
    Sales: [
      { label: "My Leads", href: "/company/[companyId]/sales/my-leads", moduleKey: "sales" },
      { label: "Jobs", href: "/company/[companyId]/sales/jobs", moduleKey: "sales" },
    ],
    Accounting: [
      { label: "Accounts", href: "/company/[companyId]/accounting/accounts" },
      { label: "Journals", href: "/company/[companyId]/accounting/journals" },
      { label: "Trial Balance", href: "/company/[companyId]/accounting/trial-balance" },
      { label: "Profit & Loss", href: "/company/[companyId]/accounting/reports/pnl" },
      { label: "Cash Flow", href: "/company/[companyId]/accounting/reports/cashflow" },
      { label: "Balance Sheet", href: "/company/[companyId]/accounting/reports/balance-sheet" },
    ],
    Reports: [{ label: "Overview", href: "/company/[companyId]/reports/overview", moduleKey: "reports" }],
    HR: [{ label: "Overview", href: "/company/[companyId]/hr/overview", moduleKey: "hr" }],
  },
  branch: {
    Main: [
      { label: "Dashboard", href: "/company/[companyId]/branches/[branchId]" },
      { label: "Jobs", href: "/company/[companyId]/branches/[branchId]/jobs" },
      { label: "Quotes", href: "/company/[companyId]/branches/[branchId]/quotes" },
      { label: "Accounts", href: "/company/[companyId]/branches/[branchId]/accounting" },
      { label: "Inventory", href: "/company/[companyId]/branches/[branchId]/inventory" },
      { label: "Fleet", href: "/company/[companyId]/branches/[branchId]/fleet" },
      { label: "Bays", href: "/company/[companyId]/branches/[branchId]/bays" },
      { label: "Analytics", href: "/company/[companyId]/branches/[branchId]/analytics" },
      { label: "Users", href: "/company/[companyId]/branches/[branchId]/settings/security/users", moduleKey: "settings" },
    ],
    Jobs: [
      { label: "Workshop", href: "/company/[companyId]/branches/[branchId]/jobs/workshop", moduleKey: "jobs" },
    ],
  },
  vendor: {
    Main: [
      { label: "Dashboard", href: "/company/[companyId]/vendors/[vendorId]" },
      { label: "Quotes", href: "/company/[companyId]/vendors/[vendorId]/quotes" },
      { label: "Procurement", href: "/company/[companyId]/vendors/[vendorId]/procurement" },
      { label: "Accounts", href: "/company/[companyId]/vendors/[vendorId]/accounts" },
    ],
  },
};

export const SIDEBAR_TREE: Partial<Record<NavScope, SidebarItem[]>> = {
  company: [
    { label: "Dashboard", href: "/company/[companyId]" },
    {
      label: "Branches",
      href: "/company/[companyId]/branches",
      children: [
        { label: "Create", href: "/company/[companyId]/branches/new" },
        { label: "List", href: "/company/[companyId]/branches", exactMatch: true },
      ],
    },
    {
      label: "Vendors",
      href: "/company/[companyId]/vendors",
      children: [
        { label: "Create", href: "/company/[companyId]/vendors/new" },
        { label: "List", href: "/company/[companyId]/vendors", exactMatch: true },
      ],
    },
    {
      label: "Call Center",
      href: "/company/[companyId]/call-center",
      children: [
        { label: "Overview", href: "/company/[companyId]/call-center", exactMatch: true },
        { label: "History", href: "/company/[companyId]/call-center/history" },
      ],
    },
    {
      label: "Leads",
      href: "/company/[companyId]/leads",
      children: [
        { label: "Create", href: "/company/[companyId]/leads/new" },
        { label: "List", href: "/company/[companyId]/leads", exactMatch: true },
      ],
    },
    {
      label: "Inventory",
      href: "/company/[companyId]/inventory",
      children: [
        { label: "Create", href: "/company/[companyId]/inventory/new", disabled: true },
        { label: "List", href: "/company/[companyId]/inventory", exactMatch: true },
      ],
    },
    {
      label: "Procurement",
      href: "/company/[companyId]/procurement",
      children: [
        { label: "Create", href: "/company/[companyId]/procurement/new", disabled: true },
        { label: "List", href: "/company/[companyId]/procurement", exactMatch: true },
      ],
    },
    {
      label: "Quotes",
      href: "/company/[companyId]/quotes",
      children: [
        { label: "Vendor", href: "/company/[companyId]/quotes/vendor" },
        { label: "Branch", href: "/company/[companyId]/quotes/branch" },
      ],
    },
    { label: "Jobs", href: "/company/[companyId]/jobs" },
    { label: "Cars", href: "/company/[companyId]/cars" },
    {
      label: "Marketing",
      href: "/company/[companyId]/marketing",
      children: [
        { label: "Campaigns", href: "/company/[companyId]/marketing/campaigns" },
        { label: "Ads", href: "/company/[companyId]/marketing/ads" },
        { label: "SMS", href: "/company/[companyId]/marketing/sms" },
        { label: "Email", href: "/company/[companyId]/marketing/email" },
        { label: "Templates", href: "/company/[companyId]/marketing/templates" },
        { label: "Social", href: "/company/[companyId]/marketing/posts" },
        { label: "Dialer", href: "/company/[companyId]/settings/integrations/dialer" },
      ],
    },
    { label: "Finance", href: "/company/[companyId]/accounting" },
    {
      label: "Customers",
      href: "/company/[companyId]/customers",
      children: [
        { label: "Create", href: "/company/[companyId]/customers/new" },
        { label: "List", href: "/company/[companyId]/customers", exactMatch: true },
      ],
    },
    {
      label: "HR",
      href: "/company/[companyId]/hr",
      children: [
        { label: "Employees", href: "/company/[companyId]/hr/employees" },
        { label: "Company Users", href: "/company/[companyId]/settings/security/users" },
        { label: "Branch Users", href: "/company/[companyId]/hr/branch-users" },
        { label: "Vendor Users", href: "/company/[companyId]/hr/vendor-users" },
      ],
    },
    {
      label: "Accounts",
      href: "/company/[companyId]/accounting",
      children: [
        { label: "Accounts", href: "/company/[companyId]/accounting/accounts" },
        { label: "Journals", href: "/company/[companyId]/accounting/journals" },
        { label: "Trial Balance", href: "/company/[companyId]/accounting/trial-balance" },
        { label: "Profit & Loss", href: "/company/[companyId]/accounting/reports/pnl" },
        { label: "Cash Flow", href: "/company/[companyId]/accounting/reports/cashflow" },
        { label: "Balance Sheet", href: "/company/[companyId]/accounting/reports/balance-sheet" },
      ],
    },
    { label: "Reports", href: "/company/[companyId]/reports/overview" },
  ],
};
