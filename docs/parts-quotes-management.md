# Parts Quotes Management

## Supplier Quote, Purchase Order, Ordering & Receiving Guide

## Who Should Read This?

- Procurement Officers
- Workshop Managers
- Inventory Controllers
- Operations Managers
- Company Administrators

## 1. What Is Parts Quotes Management?

Parts Quotes Management controls the sourcing process for required parts, from inquiry to purchase and stock receipt.

This process is used when service work requires parts that are not immediately available or need supplier pricing validation.

It connects:

- Estimate line items
- Vendor inquiries
- Supplier quotes
- Purchase orders
- Goods receipt
- Inventory availability

It ensures cost control, supplier comparison, and traceable procurement decisions.

## 2. Where the Process Starts

The process usually starts from approved or pending estimate line items that require external procurement.

Typical path:

Estimate Line Item -> Inquiry -> Supplier Quotes -> Approval -> Purchase Order -> Receive Parts

## 3. End-to-End Parts Quotes Flow

### Step 1: Identify Required Parts

- Review estimate/job requirements
- Confirm unavailable or externally sourced parts
- Group items for supplier inquiry

### Step 2: Create Inquiry

- Create inquiry for selected parts
- Define required quantity, specifications, and target delivery date
- Send inquiry to one or multiple approved vendors

### Step 3: Receive Quotes

- Vendors submit quotes (price, lead time, terms)
- Record/attach each quote in the system
- Validate quote completeness

### Step 4: Compare and Select Quote

- Compare price, delivery promise, and vendor reliability
- Apply approval rules (threshold or role-based)
- Select winning quote per item or grouped set

### Step 5: Create Purchase Order (PO)

- Generate PO from approved quote
- Confirm item details, quantity, unit price, taxes, and delivery address
- Submit PO to selected vendor

### Step 6: Order Tracking

- Track PO acknowledgment and shipment updates
- Monitor expected vs actual delivery timeline
- Update item status as required

### Step 7: Receive Ordered Parts

- Record goods receipt on arrival
- Validate quantity and quality
- Handle shortages/damage through discrepancy workflow
- Update inventory stock

### Step 8: Release to Job Execution

- Allocate received parts to related job/estimate
- Update line item and job readiness status
- Continue workshop execution

## 4. Common Line Item Statuses in Quotes Process

- **Pending:** Item identified but not yet moved to inquiry.
- **Inquiry:** Inquiry sent to vendor(s), awaiting quotes.
- **Quoted:** One or more supplier quotes received.
- **Approved:** Quote selection approved for purchasing.
- **Ordered:** PO issued to vendor.
- **Partially Received:** Some quantity received, balance pending.
- **Received:** Full quantity received and stocked.
- **Allocated:** Stock reserved for specific job.
- **Rejected:** Quote/item rejected due to cost, quality, or policy.
- **Cancelled:** Item or sourcing request cancelled.

## 5. Purchase Order Controls

PO process should enforce:

- PO only from approved quote (unless override by authorized role)
- Correct vendor, item code, and negotiated price
- Tax and commercial terms validation
- Approval trail for high-value orders
- Change/amendment logging after PO issuance

## 6. Receiving Controls

At receiving stage, validate:

- Received quantity vs PO quantity
- Part specification and condition
- Batch/serial details (if required)
- Delivery document reference
- Warehouse/bin location assignment

Do not close PO lines until received quantity is fully reconciled.

## 7. Exceptions and Restrictions

Operational restrictions:

- Do not create duplicate inquiries for the same item without reason
- Do not order from unapproved vendor (unless emergency override policy exists)
- Do not mark received without physical verification
- Do not invoice parts not received/approved
- Keep full audit history for quote and PO decisions

## 8. Verification in Operations Dashboard

Verify from operations dashboard:

- Inquiry queue shows pending quote actions
- Quote comparison and approval queue is visible
- Open PO and delayed delivery indicators are accurate
- Partially received items remain tracked until closure
- Received items reflect in inventory and job readiness

## 9. Validation Checklist

After completing parts quote process, confirm:

- Inquiry linked to correct estimate/job
- Supplier quote comparison is documented
- Approved quote used for PO creation
- Received quantities match PO or are discrepancy-tracked
- Inventory updated correctly
- Job card readiness updated after allocation

## Executive Summary

Parts Quotes Management ensures parts are sourced with control and traceability.

Flow:

Inquiry -> Receive Quotes -> Compare/Approve -> Create PO -> Order -> Receive Parts -> Allocate to Job

It protects procurement quality, cost accuracy, and execution continuity in automotive service operations.
