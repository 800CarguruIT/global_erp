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
  permissionKeys?: string[];
  disabled?: boolean;
  exactMatch?: boolean;
  children?: SidebarItem[];
}

export const SIDEBAR_CONFIG: Record<NavScope, Partial<Record<NavCategory, SidebarItem[]>>> = {
  global: {
    Main: [
      { labelKey: "global.nav.dashboard", href: "/global" },
      {
        labelKey: "global.nav.userManagement",
        href: "/global/settings/security/users",
        permissionKeys: ["global.users.list"],
      },
      {
        labelKey: "global.nav.rolesAndPermissions",
        href: "/global/settings/security/roles",
        permissionKeys: ["global.roles.list"],
      },
      {
        labelKey: "global.nav.companies",
        href: "/global/companies",
        permissionKeys: ["global.companies.list"],
      },
      { labelKey: "global.nav.documentation", href: "/global/docs" },
      {
        labelKey: "global.nav.settings",
        href: "/global/settings",
        permissionKeys: ["global.settings.manage"],
      },
    ],
  },
  company: {
    Main: [
      { labelKey: "global.nav.main", href: "/company/[companyId]" },
      { labelKey: "global.nav.callCenter", href: "/company/[companyId]/call-center" },
      { labelKey: "global.nav.leads", href: "/company/[companyId]/leads" },
      { labelKey: "global.nav.marketing", href: "/company/[companyId]/marketing" },
      { labelKey: "global.nav.hr", href: "/company/[companyId]/hr" },
      { label: "Roles & Permissions", href: "/company/[companyId]/settings/security/roles" },
      { label: "Users", href: "/company/[companyId]/settings/security/users" },
      { labelKey: "global.nav.finance", href: "/company/[companyId]/accounting" },
      { label: "Inventory", href: "/company/[companyId]/inventory" },
      { label: "Procurement", href: "/company/[companyId]/procurement" },
      { label: "Vendor Quotes", href: "/company/[companyId]/quotes/vendor" },
      { label: "Branch Quotes", href: "/company/[companyId]/quotes/branch" },
      { label: "Parts Quotes", href: "/company/[companyId]/parts-quotes" },
      { label: "Jobs", href: "/company/[companyId]/jobs" },
      { label: "Recovery Requests", href: "/company/[companyId]/recovery-requests" },
      { label: "Job Cards", href: "/company/[companyId]/workshop/job-cards" },
      { label: "Branches", href: "/company/[companyId]/branches" },
      { label: "Vendors", href: "/company/[companyId]/vendors" },
      { label: "Customers", href: "/company/[companyId]/customers" },
      { label: "Car In Dashboard", href: "/company/[companyId]/car-in-dashboard" },
      { label: "Revenue Dashboard", href: "/company/[companyId]/revenue-dashboard" },
      { label: "Inspections", href: "/company/[companyId]/inspections" },
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
      { label: "Charts of Accounts", href: "/company/[companyId]/accounting/chart-of-accounts", permissionKeys: ["accounting.manage_chart"] },
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
  global: [
    { labelKey: "global.nav.dashboard", href: "/global" },
    { labelKey: "global.nav.userManagement", href: "/global/settings/security/users" },
    { labelKey: "global.nav.rolesAndPermissions", href: "/global/settings/security/roles" },
    { labelKey: "global.nav.companies", href: "/global/companies" },
    { labelKey: "global.nav.settings", href: "/global/settings" },
    { labelKey: "global.nav.documentation", href: "/global/docs" },
  ],
  company: [
    {
      label: "Dashboard",
      href: "/company/[companyId]",
      permissionKeys: ["company.dashboard.view"],
      children: [
        { label: "Overview", href: "/company/[companyId]", exactMatch: true, permissionKeys: ["company.dashboard.view"] },
        { label: "Car In Dashboard", href: "/company/[companyId]/car-in-dashboard", permissionKeys: ["company.dashboard.view"] },
        { label: "Parts Dashboard", href: "/company/[companyId]/parts-dashboard", permissionKeys: ["company.dashboard.view"] },
        { label: "Revenue Dashboard", href: "/company/[companyId]/revenue-dashboard", permissionKeys: ["company.dashboard.view"] },
      ],
    },
    {
      label: "Users",
      href: "/company/[companyId]/settings/security/users",
      exactMatch: true,
      permissionKeys: ["company.users.view"],
    },
    {
      label: "Branches",
      href: "/company/[companyId]/branches",
      permissionKeys: ["branches.view", "branches.create"],
      children: [
        { label: "Create", href: "/company/[companyId]/branches/new", permissionKeys: ["branches.create"] },
        { label: "List", href: "/company/[companyId]/branches", exactMatch: true, permissionKeys: ["branches.view"] },
      ],
    },
    {
      label: "Vendors",
      href: "/company/[companyId]/vendors",
      permissionKeys: ["vendors.view", "vendors.create"],
      children: [
        { label: "Create", href: "/company/[companyId]/vendors/new", permissionKeys: ["vendors.create"] },
        { label: "List", href: "/company/[companyId]/vendors", exactMatch: true, permissionKeys: ["vendors.view"] },
      ],
    },
    {
      label: "Call Center",
      href: "/company/[companyId]/call-center",
      permissionKeys: ["callcenter.view"],
      children: [
        { label: "Overview", href: "/company/[companyId]/call-center", exactMatch: true, permissionKeys: ["callcenter.view"] },
        { label: "History", href: "/company/[companyId]/call-center/history", permissionKeys: ["callcenter.history.view"] },
      ],
    },
    {
      label: "Leads",
      href: "/company/[companyId]/leads",
      permissionKeys: ["leads.view", "leads.create"],
      children: [
        { label: "Create", href: "/company/[companyId]/leads/new", permissionKeys: ["leads.create"] },
        { label: "List", href: "/company/[companyId]/leads", exactMatch: true, permissionKeys: ["leads.view"] },
      ],
    },
    {
      label: "Inventory",
      href: "/company/[companyId]/inventory",
      permissionKeys: ["inventory.view", "inventory.create"],
      children: [
        { label: "Overview", href: "/company/[companyId]/inventory", exactMatch: true, permissionKeys: ["inventory.view"] },
        { label: "Stock", href: "/company/[companyId]/inventory/stock", permissionKeys: ["inventory.view"] },
        { label: "Locations", href: "/company/[companyId]/inventory/locations", permissionKeys: ["inventory.view"] },
        { label: "Transfers", href: "/company/[companyId]/inventory/transfers", permissionKeys: ["inventory.view"] },
        { label: "Products", href: "/company/edbab966-f85e-4bb1-a2b2-7d2a644f5638/inventory/products", permissionKeys: ["inventory.view"] },
        { label: "Create order request", href: "/company/[companyId]/inventory/order-requests", permissionKeys: ["inventory.view"] },
        { label: "Settings", href: "/company/[companyId]/inventory/settings", permissionKeys: ["inventory.view"] },
      ],
    },
    {
      label: "Procurement",
      href: "/company/[companyId]/procurement",
      permissionKeys: ["procurement.view", "procurement.create"],
      children: [
        { label: "Create", href: "/company/[companyId]/procurement/new", disabled: true, permissionKeys: ["procurement.create"] },
        { label: "List", href: "/company/[companyId]/procurement", exactMatch: true, permissionKeys: ["procurement.view"] },
      ],
    },
    {
      label: "Quotes",
      href: "/company/[companyId]/quotes",
      permissionKeys: ["quotes.vendor.view", "quotes.branch.view"],
      children: [
        { label: "Vendor", href: "/company/[companyId]/quotes/vendor", permissionKeys: ["quotes.vendor.view"] },
        { label: "Branch", href: "/company/[companyId]/quotes/branch", permissionKeys: ["quotes.branch.view"] },
      ],
    },
    {
      label: "Parts Order",
      href: "/company/[companyId]/parts-quotes",
      children: [
        { label: "Parts Quotes", href: "/company/[companyId]/parts-quotes" },
      ],
    },
    {
      label: "Estimates",
      href: "/company/[companyId]/estimates",
      permissionKeys: ["estimates.view", "estimates.create"],
      children: [
        { label: "Create", href: "/company/[companyId]/estimates/new", permissionKeys: ["estimates.create"] },
        { label: "List", href: "/company/[companyId]/estimates", exactMatch: true, permissionKeys: ["estimates.view"] },
        { label: "Estimate Quotes", href: "/company/[companyId]/estimates/quotes", permissionKeys: ["estimates.view"] },
      ],
    },
    {
      label: "Inspections",
      href: "/company/[companyId]/inspections",
      permissionKeys: ["inspections.view", "inspections.create"],
      children: [
        { label: "Create", href: "/company/[companyId]/inspections/new", permissionKeys: ["inspections.create"] },
        { label: "List", href: "/company/[companyId]/inspections", exactMatch: true, permissionKeys: ["inspections.view"] },
      ],
    },
    { label: "Jobs", href: "/company/[companyId]/jobs", permissionKeys: ["jobs.view"] },
    { label: "Recovery Requests", href: "/company/[companyId]/recovery-requests", permissionKeys: ["jobs.view"] },
    { label: "Job Cards", href: "/company/[companyId]/workshop/job-cards", permissionKeys: ["jobs.view"] },
    { label: "Cars", href: "/company/[companyId]/cars", permissionKeys: ["fleet.cars.view"] },
    {
      label: "Marketing",
      href: "/company/[companyId]/marketing",
      permissionKeys: [
        "marketing.campaigns.view",
        "marketing.ads.view",
        "marketing.sms.view",
        "marketing.email.view",
        "marketing.templates.view",
        "marketing.social.view",
        "integrations.dialer.use",
      ],
      children: [
        { label: "Campaigns", href: "/company/[companyId]/marketing/campaigns", permissionKeys: ["marketing.campaigns.view"] },
        { label: "Ads", href: "/company/[companyId]/marketing/ads", permissionKeys: ["marketing.ads.view"] },
        { label: "SMS", href: "/company/[companyId]/marketing/sms", permissionKeys: ["marketing.sms.view"] },
        { label: "Email", href: "/company/[companyId]/marketing/email", permissionKeys: ["marketing.email.view"] },
        { label: "Templates", href: "/company/[companyId]/marketing/templates", permissionKeys: ["marketing.templates.view"] },
        { label: "Social", href: "/company/[companyId]/marketing/posts", permissionKeys: ["marketing.social.view"] },
        { label: "Dialer", href: "/company/[companyId]/settings/integrations/dialer", permissionKeys: ["integrations.dialer.use"] },
      ],
    },
    { label: "Finance", href: "/company/[companyId]/accounting", permissionKeys: ["accounting.view"] },
    {
      label: "Customers",
      href: "/company/[companyId]/customers",
      permissionKeys: ["crm.customers.view", "crm.customers.edit"],
      children: [
        { label: "Create", href: "/company/[companyId]/customers/new", permissionKeys: ["crm.customers.edit"] },
        { label: "List", href: "/company/[companyId]/customers", exactMatch: true, permissionKeys: ["crm.customers.view"] },
        {
          label: "Wallet Transactions",
          href: "/company/[companyId]/customers/wallet-transactions",
          permissionKeys: ["crm.customers.view"],
        },
      ],
    },
    {
      label: "HR",
      href: "/company/[companyId]/hr",
      permissionKeys: ["hr.employees.view", "company.users.view", "hr.branch_users.view", "hr.vendor_users.view"],
      children: [
        { label: "Employees", href: "/company/[companyId]/hr/employees", permissionKeys: ["hr.employees.view"] },
        { label: "Company Users", href: "/company/[companyId]/settings/security/users", permissionKeys: ["company.users.view"] },
        { label: "Branch Users", href: "/company/[companyId]/hr/branch-users", permissionKeys: ["hr.branch_users.view"] },
        { label: "Vendor Users", href: "/company/[companyId]/hr/vendor-users", permissionKeys: ["hr.vendor_users.view"] },
      ],
    },
    { label: "Roles & Permissions", href: "/company/[companyId]/settings/security/roles", permissionKeys: ["company.roles.manage"] },
    {
      label: "Accounts",
      href: "/company/[companyId]/accounting",
      permissionKeys: ["accounting.manage_chart", "accounting.post", "accounting.view"],
      children: [
        { label: "Charts of Accounts", href: "/company/[companyId]/accounting/chart-of-accounts", permissionKeys: ["accounting.manage_chart"] },
        { label: "Accounts", href: "/company/[companyId]/accounting/accounts", permissionKeys: ["accounting.manage_chart"] },
        { label: "Journals", href: "/company/[companyId]/accounting/journals", permissionKeys: ["accounting.post"] },
        { label: "Trial Balance", href: "/company/[companyId]/accounting/trial-balance", permissionKeys: ["accounting.view"] },
        { label: "Profit & Loss", href: "/company/[companyId]/accounting/reports/pnl", permissionKeys: ["accounting.view"] },
        { label: "Cash Flow", href: "/company/[companyId]/accounting/reports/cashflow", permissionKeys: ["accounting.view"] },
        { label: "Balance Sheet", href: "/company/[companyId]/accounting/reports/balance-sheet", permissionKeys: ["accounting.view"] },
      ],
    },
    { label: "Reports", href: "/company/[companyId]/reports/overview", permissionKeys: ["reports.view"] },
  ],
  branch: [
    {
      label: "Branches",
      href: "/branches/[branchId]/branches",
      permissionKeys: [
        "branches.view",
        "branches.create",
        "branches.edit",
        "branches.delete",
      ],
    },
  ],
};
