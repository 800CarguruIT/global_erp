export type NavScope = "global" | "company" | "branch" | "vendor";
export type NavCategory =
  | "Main"
  | "Sales"
  | "Service Center"
  | "Jobs";

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
      { label: "Products", href: "/global/products" },
      { labelKey: "global.nav.documentation", href: "/global/docs" },
      {
        labelKey: "global.nav.settings",
        href: "/global/settings",
        permissionKeys: ["global.settings.manage"],
      },
    ],
  },
  company: {
    Sales: [
      { label: "Call History", href: "/company/[companyId]/call-center/history" },
      { label: "Inquiry", href: "/company/[companyId]/settings/ai/inquiries" },
      { label: "Leads", href: "/company/[companyId]/leads" },
      { label: "Booking", href: "/company/[companyId]/leads/booking" },
      { label: "RSA Leads", href: "/company/[companyId]/leads/rsa" },
      { label: "Estimates", href: "/company/[companyId]/estimates" },
    ],
    "Service Center": [
      { label: "Advisor Portal", href: "/company/[companyId]/pis/advisor-portal" },
      { label: "Car In Dashboard", href: "/company/[companyId]/car-in-dashboard" },
    ],
    Main: [
      { label: "Operations Dashboard", href: "/company/[companyId]/operations-dashboard" },
      { label: "Parts Quotes", href: "/company/[companyId]/parts-quotes" },
    ],
  },
  branch: {
    Main: [
      { label: "Dashboard", href: "/company/[companyId]/branches/[branchId]" },
      { label: "Jobs", href: "/company/[companyId]/branches/[branchId]/jobs" },
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
      { label: "Procurement", href: "/company/[companyId]/vendors/[vendorId]/procurement" },
      { label: "Accounts", href: "/company/[companyId]/vendors/[vendorId]/accounts" },
    ],
  },
};

/** Selectable landing pages per scope, stored as path templates in roles.home_page.
 *  At login time [companyId] / [branchId] / [vendorId] are replaced with real IDs. */
export const HOME_PAGE_OPTIONS: Record<NavScope, { label: string; href: string }[]> = {
  global: [
    { label: "Global Dashboard", href: "/global" },
    { label: "Companies", href: "/global/companies" },
    { label: "Users", href: "/global/settings/security/users" },
  ],
  company: [
    { label: "Company Overview", href: "/company/[companyId]" },
    { label: "Agent Dashboard", href: "/company/[companyId]/call-center/agent-dashboard" },
    { label: "Performance Summary", href: "/company/[companyId]/call-center/performance" },
    { label: "Master Performance", href: "/company/[companyId]/master-dashboard" },
    { label: "Leads", href: "/company/[companyId]/leads" },
    { label: "Jobs", href: "/company/[companyId]/jobs" },
    { label: "Workshop Jobs", href: "/company/[companyId]/jobs/workshop" },
    { label: "Workshop Earnings", href: "/company/[companyId]/workshop/earnings" },
    { label: "Customers", href: "/company/[companyId]/customers" },
    { label: "Accounting", href: "/company/[companyId]/accounting" },
    { label: "Inventory", href: "/company/[companyId]/inventory" },
    { label: "HR", href: "/company/[companyId]/hr" },
    { label: "Branches", href: "/company/[companyId]/branches" },
    { label: "PIS Dashboard", href: "/company/[companyId]/pis" },
    { label: "Advisor Portal", href: "/company/[companyId]/pis/advisor-portal" },
  ],
  branch: [
    { label: "Branch Dashboard", href: "/company/[companyId]/branches/[branchId]" },
    { label: "Jobs", href: "/company/[companyId]/branches/[branchId]/jobs" },
    { label: "Workshop Jobs", href: "/company/[companyId]/branches/[branchId]/jobs/workshop" },
    { label: "Inventory", href: "/company/[companyId]/branches/[branchId]/inventory" },
    { label: "Fleet", href: "/company/[companyId]/branches/[branchId]/fleet" },
    { label: "Accounting", href: "/company/[companyId]/branches/[branchId]/accounting" },
    { label: "Analytics", href: "/company/[companyId]/branches/[branchId]/analytics" },
  ],
  vendor: [
    { label: "Vendor Dashboard", href: "/company/[companyId]/vendors/[vendorId]" },
    { label: "Procurement", href: "/company/[companyId]/vendors/[vendorId]/procurement" },
    { label: "Accounts", href: "/company/[companyId]/vendors/[vendorId]/accounts" },
  ],
};

export const SIDEBAR_TREE: Partial<Record<NavScope, SidebarItem[]>> = {
  global: [
    { labelKey: "global.nav.dashboard", href: "/global" },
    { labelKey: "global.nav.userManagement", href: "/global/settings/security/users" },
    { labelKey: "global.nav.rolesAndPermissions", href: "/global/settings/security/roles" },
    { labelKey: "global.nav.companies", href: "/global/companies" },
    { label: "Products", href: "/global/products" },
    { labelKey: "global.nav.settings", href: "/global/settings" },
    { labelKey: "global.nav.documentation", href: "/global/docs" },
  ],
  company: [
    {
      label: "Sales",
      href: "/company/[companyId]/call-center/history",
      children: [
        { label: "Call History", href: "/company/[companyId]/call-center/history" },
        { label: "Inquiry", href: "/company/[companyId]/settings/ai/inquiries" },
        { label: "Leads", href: "/company/[companyId]/leads" },
        { label: "Booking", href: "/company/[companyId]/leads/booking" },
        { label: "RSA Leads", href: "/company/[companyId]/leads/rsa" },
        { label: "Estimates", href: "/company/[companyId]/estimates" },
      ],
    },
    {
      label: "Service Center",
      href: "/company/[companyId]/pis/advisor-portal",
      children: [
        { label: "Advisor Portal", href: "/company/[companyId]/pis/advisor-portal" },
        { label: "Car In Dashboard", href: "/company/[companyId]/car-in-dashboard" },
      ],
    },
    {
      label: "Operations Dashboard",
      href: "/company/[companyId]/operations-dashboard",
    },
    {
      label: "Parts Quotes",
      href: "/company/[companyId]/parts-quotes",
    },
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
