export type DocSession = {
  slug: string;
  title: string;
  description: string;
  badge: string;
};

export type DocChapter = {
  key: string;
  title: string;
  tagline: string;
  description: string;
  sessions: DocSession[];
};

export const DOCUMENTATION_STRUCTURE: DocChapter[] = [
  {
    key: "global",
    title: "Global.",
    description:
      "Policies, organization-wide controls, and the high-level user management blueprint.",
    tagline: "Global scope",
    sessions: [
      {
        slug: "global-erp-overview",
        title: "System Overview",
        description:
          "High-level summary of modules, scopes, and the end-to-end business flow across the platform.",
        badge: "Overview",
      },
      {
        slug: "global-user-management",
        title: "User Management",
        description:
          "Create, invite, and monitor global admins plus how CMS profiles tie into the system.",
        badge: "User Ops",
      },
      {
        slug: "global-roles-and-permissions",
        title: "Roles & Permissions",
        description: "Blueprint for defining, assigning, and auditing global role templates.",
        badge: "Roles",
      },
      {
        slug: "companies-management",
        title: "Companies Management",
        description: "Create, update, and control company status with operational safeguards.",
        badge: "Companies",
      },
      {
        slug: "troubleshooting-faq",
        title: "Troubleshooting & FAQ",
        description: "Fast triage guide and common issue patterns across scopes.",
        badge: "Support",
      },
    ],
  },
  {
    key: "company",
    title: "Company.",
    description: "Day-to-day operations for company administrators and local RBAC workflows.",
    tagline: "Company systems",
    sessions: [
      {
        slug: "company-user-workflow",
        title: "Company user workflow",
        description:
          "Onboarding company staff, branch data ownership, and company-level audits.",
        badge: "Operations",
      },
      {
        slug: "branches-management",
        title: "Branches Management",
        description:
          "Create, update, activate, and control branch operations under a company.",
        badge: "Branches",
      },
      {
        slug: "vendors-management",
        title: "Vendors Management",
        description:
          "Register, classify, update, and control vendor status for company procurement workflows.",
        badge: "Vendors",
      },
      {
        slug: "customers-management",
        title: "Customers Management",
        description:
          "Create, update, and control customer records used across company operations.",
        badge: "Customers",
      },
      {
        slug: "cars-management",
        title: "Cars Management",
        description:
          "Manage vehicle profiles, ownership linkage, and active status for operations.",
        badge: "Cars",
      },
      {
        slug: "leads-management",
        title: "Leads Management",
        description:
          "Create and manage service leads from customer request to car out or delivery.",
        badge: "Leads",
      },
      {
        slug: "inspections-management",
        title: "Inspections",
        description:
          "Run and control inspection lifecycle from intake to technical approval.",
        badge: "Inspect",
      },
      {
        slug: "estimates-management",
        title: "Estimates",
        description:
          "Create and manage estimates, line items, approvals, and conversion to job cards and invoices.",
        badge: "Estimate",
      },
      {
        slug: "job-cards-management",
        title: "Job Cards",
        description:
          "Control job card lifecycle from creation and assignment to start and completion.",
        badge: "Job Card",
      },
      {
        slug: "parts-quotes-management",
        title: "Parts Quotes",
        description:
          "Manage supplier quotes, purchase orders, ordering, and parts receiving workflow.",
        badge: "Quotes",
      },
      {
        slug: "recovery-request-web-view",
        title: "Recovery Request",
        description:
          "Create and manage recovery requests from company operations screens.",
        badge: "Recovery",
      },
      {
        slug: "company-admin-roles",
        title: "Admin roles reference",
        description:
          "Role keys, scopes, and when to pick company_admin vs fine-grained permissions.",
        badge: "Roles",
      },
      {
        slug: "operations-overview",
        title: "Operations overview",
        description:
          "Simple day-to-day workflow from lead intake to billing and closure.",
        badge: "Ops",
      },
      {
        slug: "inventory-playbook",
        title: "Inventory playbook",
        description:
          "Practical stock movement and reconciliation rules for branch teams.",
        badge: "Inventory",
      },
      {
        slug: "procurement-playbook",
        title: "Procurement playbook",
        description:
          "Requirement-to-PO-to-receipt controls and vendor performance checklist.",
        badge: "Procurement",
      },
      {
        slug: "accounting-overview",
        title: "Accounting overview",
        description:
          "How operations map into journals, statements, and monthly close.",
        badge: "Finance",
      },
    ],
  },
  {
    key: "vendors",
    title: "Vendors Portal.",
    description: "Operating the vendor-facing workspace, quoting, and procurement topics.",
    tagline: "Vendor operations",
    sessions: [
      {
        slug: "vendor-portal-operations",
        title: "Operations guide",
        description:
          "Managing quotes, invoices, and service communications within the vendor portal.",
        badge: "Guides",
      },
    ],
  },
  {
    key: "workshop",
    title: "Workshops Portal.",
    description: "Guides for external partners integrating via the workshop APIs or portals.",
    tagline: "Third-party partners",
    sessions: [
      {
        slug: "workshop-integration-guide",
        title: "Workshop integration",
        description: "How to wire inspection, job, and parts data into your external tooling.",
        badge: "Integrations",
      },
    ],
  },
  {
    key: "workflow",
    title: "Workflow.",
    description: "End-to-end operational playbooks and lifecycle flows.",
    tagline: "Process flows",
    sessions: [
      {
        slug: "rsa-inquiry-to-close-lead-flow",
        title: "RSA Inquiry to Close",
        description:
          "Operational workflow from AI inquiry intake through RSA assignment, service, billing, and closure.",
        badge: "RSA",
      },
    ],
  },
  {
    key: "app-api",
    title: "App API.",
    description: "Web application backend endpoints for admin and operations.",
    tagline: "Backend endpoints",
    sessions: [
      {
        slug: "api-common",
        title: "Common",
        description: "Shared auth, headers, pagination, filtering, and sorting conventions.",
        badge: "Common",
      },
      {
        slug: "api-common-errors",
        title: "Error Model",
        description: "Standard API error codes and payload shapes.",
        badge: "Errors",
      },
      {
        slug: "api-status-dictionary",
        title: "Status Dictionary",
        description: "Standard status meanings and transition guidance by module.",
        badge: "Status",
      },
      {
        slug: "api-changelog",
        title: "Changelog",
        description: "Version history with breaking and non-breaking API changes.",
        badge: "Version",
      },
      {
        slug: "app-api-global-users-get-user",
        title: "Users",
        description: "Global users module endpoints for app clients.",
        badge: "Users",
      },
      {
        slug: "app-api-company-leads",
        title: "Leads",
        description: "Company leads module endpoints for app clients.",
        badge: "Leads",
      },
      {
        slug: "app-api-company-inspections",
        title: "Inspections",
        description: "Company inspections module endpoints for app clients.",
        badge: "Inspect",
      },
      {
        slug: "app-api-company-estimates",
        title: "Estimates",
        description: "Company estimates module endpoints for app clients.",
        badge: "Estimate",
      },
      {
        slug: "app-api-company-job-cards",
        title: "Job Cards",
        description: "Company job card module endpoints for app clients.",
        badge: "Job Card",
      },
      {
        slug: "app-api-company-inventory",
        title: "Inventory",
        description: "Company inventory module endpoints for app clients.",
        badge: "Inventory",
      },
      {
        slug: "app-api-company-procurement",
        title: "Procurement",
        description: "Company procurement module endpoints for app clients.",
        badge: "Procurement",
      },
      {
        slug: "recovery-request-api",
        title: "Recovery Request API",
        description:
          "API contracts for creating, assigning, tracking, and closing recovery requests.",
        badge: "Recovery",
      },
      {
        slug: "app-api-company-accounting",
        title: "Accounting",
        description: "Company accounting module endpoints for app clients.",
        badge: "Finance",
      },
    ],
  },
  {
    key: "mobile-api",
    title: "Mobile API.",
    description: "Mobile application endpoints for field and workshop workflows.",
    tagline: "Mobile endpoints",
    sessions: [
      {
        slug: "mobile-api-global-users-get-user",
        title: "Users",
        description: "Mobile auth and user profile endpoints.",
        badge: "Users",
      },
      {
        slug: "mobile-api-company-leads",
        title: "Leads",
        description: "Company leads module endpoints for mobile clients.",
        badge: "Leads",
      },
      {
        slug: "mobile-api-company-inspections",
        title: "Inspections",
        description: "Company inspections module endpoints for mobile clients.",
        badge: "Inspect",
      },
      {
        slug: "mobile-api-company-estimates",
        title: "Estimates",
        description: "Company estimates module endpoints for mobile clients.",
        badge: "Estimate",
      },
      {
        slug: "mobile-api-company-job-cards",
        title: "Job Cards",
        description: "Company job card module endpoints for mobile clients.",
        badge: "Job Card",
      },
      {
        slug: "mobile-api-company-inventory",
        title: "Inventory",
        description: "Company inventory module endpoints for mobile clients.",
        badge: "Inventory",
      },
      {
        slug: "mobile-api-company-procurement",
        title: "Procurement",
        description: "Company procurement module endpoints for mobile clients.",
        badge: "Procurement",
      },
      {
        slug: "mobile-api-company-accounting",
        title: "Accounting",
        description: "Company accounting module endpoints for mobile clients.",
        badge: "Finance",
      },
    ],
  },
];
