# Global ERP System Overview

## Who Should Read This?

- New team members onboarding to the platform
- Product and operations stakeholders
- Engineers who need a quick end-to-end context

## What Is Global ERP?

Global ERP is a multi-tenant operations platform for managing business workflows across:

- Global administration
- Company operations
- Branch operations
- Vendor and workshop collaboration

It combines user management, workflow execution, procurement, inventory, and accounting in one system.

## Core Platform Goals

1. Provide one source of truth for operations data.
2. Standardize process flow from lead to fulfillment to accounting.
3. Enforce secure, role-based access across global/company/branch scopes.
4. Enable external collaboration with vendors and workshop partners.

## Main User Scopes

## Global Scope
- Cross-company governance
- Global users, permissions, monitoring, and platform policy

## Company Scope
- Day-to-day business operations
- Master data, reporting, branch oversight

## Branch Scope
- Execution layer
- Jobs, inspections, inventory movement, local operational control

## Vendor / Partner Scope
- Procurement interactions
- Quote handling, inquiry response, delivery and fulfillment updates

## Business Modules (Simple View)

1. Identity & Access
2. Leads / CRM
3. Workshop & Job Operations
4. Procurement & Vendor Workflows
5. Inventory & Stock Movement
6. Billing & Accounting
7. Reporting & Analytics
8. Mobile APIs

## Typical End-to-End Flow

1. Lead is created and qualified.
2. Inspection and job planning are performed.
3. Required parts are sourced via procurement.
4. Inventory receives and issues stock.
5. Work is executed and billed.
6. Accounting entries and reports are generated.

## Data Model (At a Glance)

- Global entities: users, permissions, governance
- Company entities: branches, customers, vendors, products
- Operational entities: leads, inspections, job cards, quotes, POs
- Inventory entities: locations, stock, movements, transfers
- Financial entities: invoices, journals, accounts, reports

## Security Model

- Role-based permissions by scope (global, company, branch)
- Auditability for critical operations
- Controlled API access for mobile and integrations

## Integration Surfaces

- Web application routes under `apps/web/app/*`
- REST APIs under `apps/web/app/api/*`
- Mobile APIs under `apps/web/app/api/mobile/*`
- Core domain logic in `packages/ai-core/src/*`

## Recommended Reading Path

1. `global-erp-overview.md` (this page)
2. `global-user-management.md`
3. `global-roles-and-permissions.md`
4. `company-user-workflow.md`
5. `procurement-inquiry-to-inventory-flow.md`
6. `technical-document.md`

## Quick Glossary

- Lead: potential customer work opportunity
- Inspection: technical assessment before work decisions
- Job Card: structured execution unit for work
- PO: purchase order for sourcing parts/services
- GRN: goods receipt confirmation step
- Inventory Movement: stock in/out event recorded for traceability
