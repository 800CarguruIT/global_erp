# Global Roles and Permissions

## Security & Access Control Guide

## Who Should Read This?

- Global Administrators
- Security Teams
- System Administration Teams
- IT Management

## What Are Roles and Permissions?

Roles and permissions control what users are allowed to see and do inside the automotive ERP system.

They ensure that:

- Workshop staff access only operational tools
- Procurement teams access supplier modules
- Finance teams access accounting features
- Sensitive system settings remain restricted

## Understanding the Access Model (Simple Explanation)

### Permissions

Permissions are individual action rights inside the system.

Examples:

- View users
- Create job cards
- Approve purchase orders
- Manage branches

Think of permissions as individual access keys.

### Roles

A role is a group of permissions combined together based on a job function.

Examples:

- Global Administrator
- Workshop Manager
- Procurement Officer
- Finance Controller

A role defines what a specific type of employee can do.

### Users

Users do not receive permissions directly.
They receive access by being assigned one or more roles.

This makes access easy to manage and update.

## A. Creating a New Role

### When Should You Create a Role?

Create a new role when:

- A new operational position is introduced
- A department needs defined system access
- You need better separation between responsibilities

### Required Information

When creating a role, define:

- Role Name - Clear business title (e.g., Procurement Manager)
- Role Code - Internal system identifier
- Description - What this role is allowed to do

Once created, the role becomes available for assigning permissions and users.

## B. Assigning Permissions to a Role

After creating the role, define what actions it can perform.

Permissions are usually grouped by:

- Module (Users, Jobs, Inventory, Procurement, Finance)
- Action (View, Create, Edit, Approve, Manage)

### Example Permission Patterns

#### User Management Role

- View users
- Create users
- Edit users

#### Procurement Role

- View inquiries
- Create purchase orders
- Approve supplier quotes

#### Company Oversight Role

- View companies
- Manage branches

Once saved, anyone assigned this role will inherit those permissions.

## C. Assigning a Role to a User

Roles are assigned during:

- Employee onboarding
- Job promotions
- Department transfers
- Responsibility changes

After assignment:

- The user gains access to features included in the role
- The user cannot access areas outside those permissions

This ensures controlled system usage.

## D. Updating an Existing Role

Roles may need updates when:

- New features are introduced
- Operational processes change
- Security improvements are required

Important:

Since multiple users may share a role, changes affect all of them immediately.

After updates:

- Re-test access for impacted users
- Confirm no unintended access is granted

## E. Disabling or Retiring a Role

If a role is no longer needed:

- Remove it from assigned users
- Mark it inactive instead of deleting it
- Keep historical records for audit tracking

This preserves accountability for past actions.

## Security & Access Control Principles

To maintain a secure automotive ERP environment:

### 1. Apply Least-Access Principle

Give users only the access required for their job.

### 2. Limit Full Administrator Roles

Full system control should be restricted to a small trusted group.

### 3. Separate Critical Responsibilities

For example:

The person creating purchase orders should not be the same person approving payments (if possible).

### 4. Review Roles Periodically

Regularly review access to ensure it matches current responsibilities.

## Why This Matters in an Automotive ERP

Proper role management:

- Prevents unauthorized job modifications
- Protects financial data
- Secures supplier transactions
- Maintains operational control across branches
- Reduces risk of internal errors or misuse

## Simple Summary

- Permissions = Individual actions
- Roles = Group of permissions
- Users = Assigned roles

Roles and permissions form the foundation of secure system administration and operational control in the Global Automotive ERP.
