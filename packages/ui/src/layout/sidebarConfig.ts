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
