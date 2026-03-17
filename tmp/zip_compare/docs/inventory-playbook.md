# Inventory Management

## Stock Receiving, Movement, Issuing & Reconciliation Guide

## Who Should Read This?

- Inventory Managers
- Storekeepers
- Procurement Users
- Workshop Supervisors
- Operations Managers
- Company Administrators

## 1. What Is Inventory Management?

Inventory Management controls the full stock lifecycle, from receiving items into store to issuing them for jobs and reconciling balances.

It ensures:

- Right part availability
- Accurate stock valuation and quantity
- Traceable stock movements
- Reduced operational delays

## 2. Where Inventory Process Starts

Inventory flow starts when stock is received from procurement, transferred between locations, or adjusted through controlled processes.

Common flow:

Receive -> Put Away -> Reserve/Allocate -> Issue/Transfer -> Reconcile -> Report

## 3. Core Inventory Lifecycle

### Step 1: Item Master Readiness

- Ensure item code is valid and unique
- Confirm UOM and category
- Define reorder levels where required

### Step 2: Goods Receipt

- Receive stock against PO
- Validate quantity and condition
- Capture receipt details
- Update available stock

### Step 3: Put Away and Location Mapping

- Move received stock to correct bin/location
- Maintain location-level visibility
- Confirm traceability for future picking

### Step 4: Reserve or Allocate Stock

- Reserve stock for active job cards or requests
- Prevent accidental consumption by unrelated jobs

### Step 5: Issue Stock to Operations

- Issue parts against approved job or request
- Capture quantity consumed and responsible user
- Update on-hand stock immediately

### Step 6: Transfers and Adjustments

- Transfer stock between branches/stores with references
- Process approved adjustments for variance, damage, or expiry
- Record reason for every manual adjustment

### Step 7: Reconciliation and Close

- Perform cycle count/stock count
- Resolve variances
- Close reporting period with approved adjustments

## 4. Inventory Status Concepts (Typical)

Common status concepts:

- Available
- Reserved
- Allocated
- In Transit
- Issued
- Damaged/Blocked
- Adjusted

Statuses may be system-specific, but behavior must be consistent across locations.

## 5. Movement Types

Typical movement types to track:

- Receipt
- Issue
- Transfer Out
- Transfer In
- Return
- Adjustment Increase
- Adjustment Decrease

Every movement should have source, destination, actor, and timestamp.

## 6. Controls and Restrictions

Core controls:

- No negative stock without controlled override policy
- No issue without valid operational reference where applicable
- No transfer without source and destination confirmation
- No manual adjustment without reason and approval
- Restricted access for stock correction actions

These controls prevent data corruption and stock misuse.

## 7. Reorder and Availability Controls

Use reorder settings for critical items:

- Minimum stock
- Reorder point
- Target stock level
- Lead-time awareness

When reorder threshold is hit, procurement action should be triggered quickly.

## 8. Validation Checklist

After inventory operations, confirm:

- Item balances are accurate
- Location mapping is correct
- Reserved vs available quantities are consistent
- Issues are linked to valid jobs/requests
- Adjustments are approved and documented
- Variance report is reviewed

## 9. Reporting and KPIs

Recommended metrics:

- Stock accuracy percentage
- Stock-out frequency
- Slow/fast moving items
- Adjustment frequency
- Inventory aging
- Branch-wise consumption trends

## Executive Summary

Inventory Management keeps stock reliable for service execution.

Flow:

Receive -> Store -> Allocate -> Issue/Transfer -> Reconcile -> Report

It is critical for workshop continuity, procurement planning, and financial accuracy in automotive operations.
