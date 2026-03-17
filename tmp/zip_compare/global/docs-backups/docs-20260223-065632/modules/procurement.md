# Procurement

Owner: Supply Chain + Engineering  
Last Updated: 2026-02-20  
Status: draft

## Purpose

The Procurement module manages purchase orders (PO/LPO), goods receipt (GRN), and handoff of received parts into inventory.

## Users and Roles

- Company Admin: creates/updates POs and oversees lifecycle
- Procurement User: issues POs, receives items, runs GRN reconciliation
- Inventory User: moves eligible received lines to inventory stock
- Accounting User: validates GRN-driven accounting impact

## Features

1. Create purchase orders from vendor quote or manual lines
2. List and filter purchase orders by status and vendor
3. Receive PO items and generate GRN-linked inventory movements
4. Reconcile GRN data and accounting backfills
5. Move received inventory-request-linked PO items into inventory
6. Generate GRN PDF for operational records
7. Generate AI summary suggestions for procurement operations

## Data Model

Main entities/tables used by current implementation:

- `purchase_orders`
- `purchase_order_items`
- `inventory_order_request_items`
- `inventory_movements`
- `inventory_stock`
- `parts_catalog`
- `part_quotes`
- `line_items`
- `accounting_accounts`

Important fields:

- PO header: `status`, `po_number`, `po_type`, `source_type`, `vendor_id`, `total_cost`
- PO item: `status`, `quantity`, `received_qty`, `unit_cost`, `moved_to_inventory`
- Inventory movement: `direction`, `source_type`, `source_id`, `grn_number`, `purchase_order_id`

## API Surface

- `GET /api/company/[companyId]/workshop/procurement`
- `POST /api/company/[companyId]/workshop/procurement`
- `GET /api/company/[companyId]/workshop/procurement/[poId]`
- `PATCH /api/company/[companyId]/workshop/procurement/[poId]`
- `POST /api/company/[companyId]/workshop/procurement/[poId]/receive`
- `POST /api/company/[companyId]/workshop/procurement/[poId]/move-to-inventory`
- `POST /api/company/[companyId]/workshop/procurement/[poId]/reconcile-grn`
- `GET /api/company/[companyId]/workshop/procurement/[poId]/grn/pdf`
- `GET /api/company/[companyId]/workshop/procurement/next-po-number`
- `GET /api/company/[companyId]/workshop/procurement/ai-summary`

## Business Rules

1. PO status lifecycle: `draft -> issued -> partially_received -> received` (or `cancelled`)
2. PO line status lifecycle: `pending -> partial -> received` (or `cancelled`)
3. A PO cannot be manually marked `received` until all lines are fully received
4. `move-to-inventory` only applies to items linked to inventory request lines
5. `move-to-inventory` requires the PO item status to be `received`
6. Received quantities cannot exceed pending quantities in receiving flow

## Validations

1. `companyId`, `poId`, and `itemId` are required for move-to-inventory
2. `receive` requires `items[]` payload
3. `fromQuote` mode requires `quoteId` when creating a PO
4. Invalid PO transitions return `400`

## Error Cases

- PO not found -> `404`
- Required input missing -> `400`
- Move-to-inventory on non-linked/non-received line -> `400`
- Reconcile failures -> `400` with error message

## Audit and Logging

- GRN movements track quantities and references in `inventory_movements`
- Receipts can include receiver identity (`x-user-id` input in receive route)
- Reconcile flow records backfilled quantities/amounts in response payload

## Test Checklist

1. Create PO manually and from quote
2. Receive partial then full quantities and verify status transitions
3. Attempt invalid receive/move operations and verify expected errors
4. Run reconcile on mixed data and verify no duplicate over-posting
5. Generate GRN PDF and verify rows reflect recorded GRN entries
6. Verify inventory movement and stock updates after successful receive/move

## Known Issues

- Route-level auth/authorization checks should be reviewed for strict enforcement per company scope.
- The docs UI currently reads root `docs/` markdown files; new `global/docs` content is for governance and authoring unless linked by app changes.
