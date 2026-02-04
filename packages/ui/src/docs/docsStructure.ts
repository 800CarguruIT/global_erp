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
        slug: "global-user-management",
        title: "User Management",
        description:
          "Create, invite, and monitor global admins plus how CMS profiles tie into the system.",
        badge: "User Ops",
      },
      {
        slug: "global-security-guidelines",
        title: "Security & Permissions",
        description:
          "Role-based access patterns and how global admin permissions cascade into companies.",
        badge: "Security",
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
        slug: "company-admin-roles",
        title: "Admin roles reference",
        description:
          "Role keys, scopes, and when to pick company_admin vs fine-grained permissions.",
        badge: "Roles",
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
      {
        slug: "workshop-api-contacts",
        title: "API contacts & SLAs",
        description:
          "Who to reach out to, rate limits, and monitoring dashboards for workshop partners.",
        badge: "API",
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
        slug: "vendor-portal-onboarding",
        title: "Vendor onboarding",
        description:
          "Steps for inviting vendors, verifying licenses, and setting their portal profile.",
        badge: "Vendors",
      },
      {
        slug: "vendor-portal-operations",
        title: "Operations guide",
        description:
          "Managing quotes, invoices, and service communications within the vendor portal.",
        badge: "Guides",
      },
    ],
  },
];
