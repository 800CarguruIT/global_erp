# Global Companies & Users

Use the **Global Companies** screen (`/global/companies`) to oversee every company that consumes the platform, then drill into each organization's user roster when needed.

1. The list shows company status, subscribed modules, and linked branches. Filtering by "Active", "Pending", or "Paused" lets you spot onboarding issues immediately.
2. Selecting a company takes you to its detail panel where you can review assigned global owners, manage linked branches, and see current RBAC templates.
3. While still on the global view you can invite a new company-level user across any branch by clicking "Add User" and filling the company-specific details. The request routes through `/api/global/companies/:companyId/users` but you interact with it via the global layout.
4. Role assignments rely on the `company_roles` catalog, and the UI designates recommended combos (e.g., enabling `branches.view` before expanding `workshop` access).

Overview widgets highlight invite status, pending approvals, and the global user filter (Active/Inactive/Pending) so you never leave the `/global/companies` path when assessing company health.
