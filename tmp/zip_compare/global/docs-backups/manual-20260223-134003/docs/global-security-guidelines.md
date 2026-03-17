# Global Security Guidelines

To maintain a consistent security posture, keep the `global_admin` role minimal and pair it with monitor-only roles for reporting.

* Document every permission you grant inside `roles` using the Roles & Permissions form. Each `permission` key is a guardrail for API routes and UI sections.
* Regularly review the `user_roles` table: only global admins, company admins, and service accounts should have entries here.
* Use the `Security Monitoring` screen to view sessions, auth events, and to revoke tokens for compromised accounts.

Use the policy notes below to run quarterly audits.
