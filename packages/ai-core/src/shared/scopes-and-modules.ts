export type Scope = "global" | "company" | "branch" | "vendor";

export type ModuleKey =
  | "companies"
  | "callCenter"
  | "sales"
  | "leads"
  | "jobs"
  | "inspection"
  | "estimate"
  | "parts"
  | "workOrder"
  | "qualityCheck"
  | "invoice"
  | "gatepass"
  | "quotes"
  | "procurement"
  | "inventory"
  | "accounting"
  | "analytics"
  | "reports"
  | "hr"
  | "settings"
  | "customers"
  | "cars"
  | "fleet"
  | "bays"
  | "vendors"
  | "branches"
  | "aiPanel"
  | "integrationPanel"
  | "sessionPanel";

export type ModulePhase = "phase1" | "full";

export const CURRENT_MODULE_PHASE: ModulePhase = "phase1";

export const MODULE_PHASE_CONFIG: Record<ModulePhase, Record<Scope, ModuleKey[]>> = {
  phase1: {
    global: ["companies", "settings"],
    company: ["settings", "hr", "reports", "vendors", "branches"],
    branch: ["settings", "hr"],
    vendor: ["settings"],
  },
  full: {
    global: [],
    company: [],
    branch: [],
    vendor: [],
  },
};

export interface ModuleConfig {
  key: ModuleKey;
  label: string;
  enabledScopes: Scope[];
  description?: string;
}

export interface ScopeContext {
  scope: Scope;
  companyId?: string | null;
  branchId?: string | null;
  vendorId?: string | null;
}

export const MODULES: Record<ModuleKey, ModuleConfig> = {
  companies: {
    key: "companies",
    label: "Companies",
    enabledScopes: ["global"],
    description: "Manage companies and branches.",
  },
  callCenter: {
    key: "callCenter",
    label: "Call Center",
    enabledScopes: ["global", "company"],
    description: "Dialer and call handling.",
  },
  sales: {
    key: "sales",
    label: "Sales",
    enabledScopes: ["global", "company"],
    description: "Sales pipeline and CRM activities.",
  },
  leads: {
    key: "leads",
    label: "Leads",
    enabledScopes: ["global", "company"],
    description: "Capture and manage new leads.",
  },
  jobs: {
    key: "jobs",
    label: "Jobs",
    enabledScopes: ["global", "company", "branch"],
    description: "RSA, recovery, and workshop jobs.",
  },
  inspection: {
    key: "inspection",
    label: "Inspection",
    enabledScopes: ["global", "company", "branch"],
    description: "Pre- and post-work inspections.",
  },
  estimate: {
    key: "estimate",
    label: "Estimate",
    enabledScopes: ["global", "company", "branch"],
    description: "Estimate work and parts quickly.",
  },
  parts: {
    key: "parts",
    label: "Parts",
    enabledScopes: ["global", "company", "branch"],
    description: "Parts requests and allocations.",
  },
  workOrder: {
    key: "workOrder",
    label: "Work Order",
    enabledScopes: ["global", "company", "branch"],
    description: "Track work orders through the shop.",
  },
  qualityCheck: {
    key: "qualityCheck",
    label: "Quality Check",
    enabledScopes: ["global", "company", "branch"],
    description: "QC steps before delivery.",
  },
  invoice: { key: "invoice", label: "Invoice", enabledScopes: ["global", "company", "branch"] },
  gatepass: {
    key: "gatepass",
    label: "Gatepass",
    enabledScopes: ["global", "company", "branch"],
    description: "Control vehicle in/out movements.",
  },
  quotes: {
    key: "quotes",
    label: "Quotes",
    enabledScopes: ["global", "company", "branch", "vendor"],
    description: "Create and track quotations.",
  },
  procurement: {
    key: "procurement",
    label: "Procurement",
    enabledScopes: ["global", "company", "branch", "vendor"],
    description: "Purchase requests and POs.",
  },
  inventory: {
    key: "inventory",
    label: "Inventory",
    enabledScopes: ["global", "company", "branch", "vendor"],
    description: "Stock, parts, and materials.",
  },
  accounting: {
    key: "accounting",
    label: "Accounting",
    enabledScopes: ["global", "company", "branch", "vendor"],
    description: "SOA, postings, invoices, and payments.",
  },
  analytics: {
    key: "analytics",
    label: "Analytics",
    enabledScopes: ["global", "company", "branch", "vendor"],
    description: "KPIs and dashboards.",
  },
  reports: {
    key: "reports",
    label: "Reports",
    enabledScopes: ["global", "company", "branch", "vendor"],
    description: "Operational and financial reports.",
  },
  hr: {
    key: "hr",
    label: "HR",
    enabledScopes: ["global", "company", "branch"],
    description: "Employees, attendance, and roles.",
  },
  settings: {
    key: "settings",
    label: "Settings",
    enabledScopes: ["global", "company", "branch", "vendor"],
    description: "Configuration and master data.",
  },
  customers: {
    key: "customers",
    label: "Customers",
    enabledScopes: ["global", "company"],
    description: "Customers and contacts.",
  },
  cars: {
    key: "cars",
    label: "Cars",
    enabledScopes: ["global", "company"],
    description: "Customer cars and details.",
  },
  fleet: {
    key: "fleet",
    label: "Fleet",
    enabledScopes: ["global", "company", "branch"],
    description: "Owned fleet, drivers, and usage.",
  },
  bays: {
    key: "bays",
    label: "Bays",
    enabledScopes: ["global", "company", "branch"],
    description: "Workshop bays and availability.",
  },
  vendors: {
    key: "vendors",
    label: "Vendors",
    enabledScopes: ["global", "company"],
    description: "Manage vendor partners and contacts.",
  },
  branches: {
    key: "branches",
    label: "Branches",
    enabledScopes: ["global", "company"],
    description: "Manage company branches and locations.",
  },
  aiPanel: {
    key: "aiPanel",
    label: "AI Panel",
    enabledScopes: ["global", "company"],
    description: "AI console and tools.",
  },
  integrationPanel: {
    key: "integrationPanel",
    label: "Integrations",
    enabledScopes: ["global", "company"],
    description: "Channel and system integrations.",
  },
  sessionPanel: {
    key: "sessionPanel",
    label: "Sessions",
    enabledScopes: ["global", "company"],
    description: "User sessions and monitoring.",
  },
};

export function isModuleEnabled(scope: Scope, moduleKey: ModuleKey): boolean {
  return MODULES[moduleKey].enabledScopes.includes(scope);
}

export function isModuleVisibleForScope(
  scope: Scope,
  moduleKey: ModuleKey,
  phase: ModulePhase = CURRENT_MODULE_PHASE
): boolean {
  if (phase === "full") {
    return isModuleEnabled(scope, moduleKey);
  }
  const allowed = MODULE_PHASE_CONFIG[phase]?.[scope];
  if (allowed && allowed.length > 0) {
    return allowed.includes(moduleKey);
  }
  return isModuleEnabled(scope, moduleKey);
}
