# Procurement Flow: Inquiry to Inventory

## Purpose
This document defines the operational flow from parts inquiry until stock is moved to inventory, including PO/LPO issue, GRN handling, and line-level actions.

## Scope
- Workshop procurement lifecycle
- Per-line-item receiving (GRN)
- PO completion and inventory movement

## Key Terms
- `Inquiry`: Request for quote/price from vendor/workshop.
- `PO`: Purchase Order (formal order).
- `LPO`: Local Purchase Order (local supplier order type).
- `GRN`: Goods Receipt Note (proof of received quantity).
- `PO Item`: A single line in PO/LPO.

## Roles
- `Advisor / Operations`: Reviews and confirms inquiries, creates/approves order.
- `Procurement User`: Issues PO/LPO, receives items, manages GRN.
- `Inventory User`: Moves received items to stock and validates classification.

## End-to-End Process
1. `Inquiry Created`
- Source: estimate/inspection line items requiring procurement.
- Output: inquiry record with part, qty, and context.

2. `Quotes Collected`
- Vendors/workshops submit pricing and ETA.
- Advisor/operations compares and selects best quote.

3. `PO/LPO Created`
- System creates PO with selected supplier and line items.
- Initial status: `draft`.

4. `PO/LPO Issued`
- One-click issue (recommended): save + validate + mark as `issued`.
- Required before receiving.

5. `Receive by Line Item (GRN Creation)`
- User clicks `Receive` on a PO line.
- Enters receive quantity in modal.
- System validates:
  - qty > 0
  - qty <= pending qty
- On success:
  - GRN entry created
  - PO item received qty updated
  - PO item status updated (`partial` or `received`)
  - PO header status updated (`partially_received` or `received`)

6. `Per-Line GRN Actions`
- For each GRN under a PO item:
  - `View`
  - `Print`
- GRN history remains linked to the line item.

7. `Move to Inventory`
- Allowed after line is fully `received`.
- User confirms classification fields (type/category/subcategory/make/model/year/unit/brand).
- System creates inventory part record and marks line as moved.

8. `Close PO`
- Allowed when all items are either:
  - `received`, or
  - `cancelled`
- PO status finalized.

## Status Model
### PO Header
- `draft` -> `issued` -> `partially_received` -> `received` -> `cancelled`

### PO Item
- `pending` -> `partial` -> `received`
- optional terminal: `cancelled`

## Simplified UI Rules
1. Keep this page focused on receiving and GRN:
- Primary actions: `Receive`, `View/Print GRN`, `Move to Inventory`, `Close PO`.

2. Keep PO authoring separate:
- `Save` and `Issue PO` belong to create/edit flow.
- Receiving page should avoid heavy editing.

3. Per-line cards should show:
- Ordered qty, received qty, pending qty
- Current status
- Line GRN history

## Validation Rules
1. Do not receive more than pending quantity.
2. Do not create zero/negative GRN quantity.
3. Do not move line to inventory before status `received`.
4. Do not close PO while any line is still `pending`/`partial`.

## API Touchpoints (Current)
- `GET /api/company/{companyId}/workshop/procurement/{poId}`
- `PATCH /api/company/{companyId}/workshop/procurement/{poId}`
- `POST /api/company/{companyId}/workshop/procurement/{poId}/receive`
- `POST /api/company/{companyId}/workshop/procurement/{poId}/move-to-inventory`
- `GET /company/{companyId}/workshop/procurement/{poId}/grn`
- `GET /api/company/{companyId}/workshop/procurement/{poId}/grn/pdf`

## Audit & Reporting
- Track at minimum:
  - who issued PO
  - who received each GRN line
  - GRN timestamp
  - moved-to-inventory timestamp
- Recommended KPI:
  - issue-to-first-receipt time
  - partial-receipt ratio
  - supplier fulfillment rate

