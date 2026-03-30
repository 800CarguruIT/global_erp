# Parts Receiving & Stock Transfer Process

## Global ERP -- Workshop Parts Management

---

## Process Overview

All parts received from vendors enter through the **Main Warehouse** (central receiving point), then are transferred to the **Workshop Branch** location where the car is being serviced.

```
Vendor Delivers Parts
        |
        v
Step 1: GOODS RECEIPT (GRN)
        Parts enter Main Warehouse
        |
        v
Step 2: STOCK TRANSFER
        Parts move from Main Warehouse to Workshop Branch
        |
        v
Step 3: WORKSHOP RECEIVES
        Parts available for job card execution
```

---

## Step 1: Goods Receipt (GRN)

### Purpose
Record the physical receipt of parts from vendor into the Main Warehouse.

### Trigger
- Workshop staff confirms delivery against Purchase Order (PO)

### Endpoint
`POST /api/company/{companyId}/workshop/procurement/{poId}/receive`

### Input
| Field | Required | Description |
|-------|----------|-------------|
| items[].itemId | Yes | Purchase order item UUID |
| items[].receivedQty | Yes | Quantity physically received |
| grnNumber | No | Auto-generated if not provided |

### Process
1. Validate PO exists and is not cancelled
2. Validate each item belongs to this PO
3. Validate received qty does not exceed ordered qty
4. Update PO item: `received_qty += deliveredQty`
5. Update PO item status: `received` (if full) or `partial`
6. Update PO status: `received` (if all items done) or `partially_received`
7. Create inventory movement record (GRN)
8. Update inventory stock at Main Warehouse
9. Create accounting journal entry
10. Update part quote status

### Database Changes

**purchase_order_items:**
| Column | Change |
|--------|--------|
| received_qty | += delivered quantity |
| status | `received` (if full) or `partial` |

**purchase_orders:**
| Column | Change |
|--------|--------|
| status | `received` (all done) or `partially_received` |

**inventory_movements:**
| Column | Value |
|--------|-------|
| company_id | Company UUID |
| source_type | `receipt` |
| source_id | PO item UUID |
| movement_type | `in` |
| quantity | Received qty |
| grn_number | GRN-{poId}-{itemId} |
| purchase_order_id | PO UUID |
| location_id | **Main Warehouse location UUID** |

**inventory_stock:**
| Column | Change |
|--------|--------|
| location_id | Main Warehouse |
| quantity | += received qty (UPSERT) |

**accounting_journals:**
| Column | Value |
|--------|-------|
| reference | GRN-{poId}-{itemId} |
| description | Goods Receipt for PO {poNumber} |
| is_posted | true |

**accounting_journal_lines:**
| Line | Account | Debit | Credit |
|------|---------|-------|--------|
| 1 | Inventory (Asset) | amount | 0 |
| 2 | Accounts Payable (Liability) | 0 | amount |
| | _amount = received_qty x unit_cost_ | | |

**part_quotes:**
| Column | Change |
|--------|--------|
| status | `Received` |
| delivery_note_status | `received` |

### Cases

| Case | Behavior | PO Item Status | PO Status |
|------|----------|---------------|-----------|
| Full delivery (all items, all qty) | All items received | `received` | `received` |
| Partial delivery (some items only) | Only delivered items updated | `received` / unchanged | `partially_received` |
| Partial quantity (2 of 5 ordered) | `received_qty` = 2 | `partial` | `partially_received` |
| Second delivery (remaining 3) | `received_qty` = 5 | `received` | `received` (if all done) |
| Over-delivery (6 of 5 ordered) | **REJECTED** | No change | No change |
| PO cancelled | **BLOCKED** | No change | No change |
| PO already fully received | **BLOCKED** | No change | No change |
| Zero cost item | Receipt OK, no journal entry | Updated | Updated |
| No accounting entity configured | Receipt OK, journal skipped | Updated | Updated |

### Accounting Impact
```
Balance Sheet:
  Assets:       Inventory         +amount (debit)
  Liabilities:  Accounts Payable  +amount (credit)

P&L: No impact at receipt stage
     (expense recognized when parts are consumed)
```

---

## Step 2: Stock Transfer (Main Warehouse to Workshop)

### Purpose
Move received parts from the Main Warehouse to the Workshop Branch where the car is being serviced.

### Trigger
- Warehouse manager initiates transfer after GRN is recorded
- Or automatic transfer when all PO items for a job are received

### Endpoint
`POST /api/company/{companyId}/inventory/transfer`

### Input
| Field | Required | Description |
|-------|----------|-------------|
| fromLocationId | Yes | Main Warehouse location UUID |
| toLocationId | Yes | Workshop Branch location UUID |
| items[].productId | Yes | Product/part UUID |
| items[].quantity | Yes | Quantity to transfer |
| transferNote | No | Reference note |

### Process
1. Validate source location has sufficient stock
2. Create OUT movement at source location
3. Create IN movement at destination location
4. Decrease stock at source location
5. Increase stock at destination location
6. Create internal transfer journal (optional)

### Database Changes

**inventory_movements (OUT):**
| Column | Value |
|--------|-------|
| source_type | `transfer` |
| movement_type | `out` |
| quantity | Transfer qty |
| location_id | **Main Warehouse** (source) |
| transfer_reference | Transfer note/ID |

**inventory_movements (IN):**
| Column | Value |
|--------|-------|
| source_type | `transfer` |
| movement_type | `in` |
| quantity | Transfer qty |
| location_id | **Workshop Branch** (destination) |
| transfer_reference | Transfer note/ID |

**inventory_stock:**
| Location | Change |
|----------|--------|
| Main Warehouse | quantity -= transfer qty |
| Workshop Branch | quantity += transfer qty |

### Cases

| Case | Behavior | Main Warehouse | Workshop |
|------|----------|---------------|----------|
| Transfer full qty (5 of 5) | All stock moves | qty = 0 | qty = 5 |
| Transfer partial qty (3 of 5) | Split stock | qty = 2 | qty = 3 |
| Transfer to multiple workshops | Multiple transfers | qty decreases per transfer | Each branch gets its share |
| Insufficient stock | **BLOCKED** | No change | No change |
| Transfer back (return to warehouse) | Reverse direction | qty += returned | qty -= returned |
| Same location (source = dest) | **BLOCKED** | No change | No change |

### Accounting Impact (Optional Internal Transfer)
```
If tracked at cost center level:
  Debit:  Workshop Branch Inventory
  Credit: Main Warehouse Inventory
  (Asset-to-asset transfer, no P&L impact)
```

---

## Step 3: Workshop Receives Parts

### Purpose
Workshop branch confirms parts are physically available for the job.

### What Happens
- Workshop inventory shows updated stock
- Job card prerequisites met (parts available)
- Technician can start work

### Effects on Workflow

| System Area | Change |
|-------------|--------|
| Job Card | Parts readiness = `Ready` (unlocks "Start" action) |
| Car-In Dashboard | Parts column shows `Received` badge |
| Advisor Portal | Parts Order shows received count |
| Test Panel | Step 7 shows pass for goods received |
| Lead Stage | May advance to next stage if all parts ready |

---

## Configuration Required

### Company Level
| Setting | Description |
|---------|-------------|
| `main_warehouse_location_id` | UUID of the default receiving warehouse location |

### Per Branch
| Setting | Description |
|---------|-------------|
| `branch_location_id` | UUID of the branch's inventory location |

### Setup Steps
1. Create inventory locations for Main Warehouse
2. Create inventory locations for each Workshop Branch
3. Set Main Warehouse as default receiving location in company settings
4. Link each branch to its inventory location

---

## Complete Data Flow Diagram

```
VENDOR
  |
  | Delivers parts
  v
+------------------------------------------+
|          GOODS RECEIPT (GRN)             |
|                                          |
|  PO Item: received_qty ↑                |
|  PO Status: received/partially_received  |
|  Movement: IN at Main Warehouse          |
|  Stock: Main Warehouse qty ↑             |
|  Journal: Debit Inventory, Credit AP     |
|  Quote: status = Received                |
+------------------------------------------+
  |
  | Transfer initiated
  v
+------------------------------------------+
|          STOCK TRANSFER                  |
|                                          |
|  Movement OUT: Main Warehouse qty ↓      |
|  Movement IN: Workshop Branch qty ↑      |
|  Stock: Main Warehouse qty ↓             |
|  Stock: Workshop Branch qty ↑            |
+------------------------------------------+
  |
  | Parts available
  v
+------------------------------------------+
|          WORKSHOP RECEIVES               |
|                                          |
|  Job Card: parts ready ✓                 |
|  Dashboard: Parts = Received             |
|  Lead: stage may advance                 |
|  Notification: advisor notified          |
+------------------------------------------+
```

---

## Error Handling Summary

| Error | HTTP | Message | Stage |
|-------|------|---------|-------|
| PO not found | 404 | Purchase order not found | Receipt |
| PO cancelled | 400 | Cannot receive against cancelled PO | Receipt |
| Item not in PO | 400 | Item does not belong to this PO | Receipt |
| Over-delivery | 400 | Received qty exceeds ordered qty | Receipt |
| Already received | 400 | Item already fully received | Receipt |
| Insufficient stock | 400 | Not enough stock at source location | Transfer |
| Same location | 400 | Source and destination must be different | Transfer |
| Location not found | 404 | Inventory location not found | Transfer |
| No warehouse configured | 400 | Main warehouse location not configured | Receipt |

---

## Inventory Movement Types Summary

| Movement Type | Source Type | Direction | When |
|--------------|------------|-----------|------|
| `in` | `receipt` | Vendor → Main Warehouse | GRN recorded |
| `out` | `transfer` | Main Warehouse → | Transfer initiated |
| `in` | `transfer` | → Workshop Branch | Transfer completed |
| `out` | `consumption` | Workshop → | Parts used in job card |
| `in` | `return` | Workshop → Main Warehouse | Unused parts returned |

---

_Document Version: 1.0 | Date: 2026-03-30 | Global ERP System_
