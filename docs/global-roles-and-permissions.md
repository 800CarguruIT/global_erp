# Global Roles & Permissions

This chapter explains how the global Roles & Permissions dashboard governs access across the platform.

## Overview

The Roles & Permissions screen lists every global role template, assigns permissions to each nested scope (company, branch, vendor), and exposes the effective permissions granted to each user. Administrators can:

- Review role definitions grouped by scope (global, company, branch, vendor).
- Clone an existing role to build a specialized template before assigning it to a user.
- Audit the exact permission keys (e.g., `company.users.view`, `branches.edit`) attached to a role and see which services they unlock.
- Snapshot the current permission set when onboarding a new partner, ensuring the same access rebuilds at any time.

Changes here immediately affect both the Global Users screen and companies whose admins inherit those roles.

## Technical

### API & Endpoints

- `GET /api/admin/roles`: Returns all configured roles with metadata, permission keys, and the last update timestamp.
- `POST /api/admin/roles`: Creates a new role. Payload includes `name`, `scope`, `permissions` (array of keys), and `description`.
- `PATCH /api/admin/roles/:id`: Updates permissions or scope for an existing role while keeping audit logs in `audit_logs`.
- `DELETE /api/admin/roles/:id`: Soft-deletes the role and removes it from users who exclusively rely on it via cascade logic.
- `POST /api/admin/users/:userId/roles`: Assigns multiple role IDs to a global user, triggering the permission reconciliation that updates the user’s session claims.

### Database

- **global_roles**: Stores `id`, `name`, `scope`, `description`, `permissions` (JSON array), and `updated_at`.
- **global_user_roles**: Join table linking `global_users.id` with `global_roles.id` to define which roles each admin has.
- **permissions**: Reference table listing every supported permission key used in the UI and API. Used to validate incoming payloads.

### Diagrams & Flow

1. Role definition → saved in `global_roles`.
2. Assignment to user(s) via `global_user_roles`.
3. Permission reconciliation service reads the user’s roles and issues the union of permission keys.
4. Every UI call (Global Users table, role assignment, API requests) checks permissions against this union via middleware such as `requirePermission`.

Audit trail for every change flows through `audit_logs`, enabling Security Monitoring to show who last modified roles—even before the user list refreshes.
