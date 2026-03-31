# Global ERP -- Full Flow Business Documentation

## Workshop Service Lifecycle: Lead to Car Delivery

_Version: 2.0 | Updated: 2026-03-31_

---

## Business Overview

Global ERP manages the complete vehicle service lifecycle through 11 connected stages. Every step is tracked, measured, and auditable.

---

## The 11 Stages

### Stage 1: Lead Creation & Booking
**Who:** Sales Agent / Call Center
**Purpose:** Register customer inquiry and schedule appointment

| Action | Outcome |
|--------|---------|
| Create lead (Workshop/RSA/Recovery) | Lead record with customer + car |
| Create booking (Walk-in/Recovery) | Appointment scheduled, pre-inspection form sent |
| Customer submits pre-inspection form | 8 questions + digital signature |
| Car check-in (at workshop) | 4 photos + cluster + 360 video captured |

**Revenue Impact:** None yet -- opportunity created

---

### Stage 2: Advisor Assignment
**Who:** System (automatic via PIS)
**Purpose:** Assign best-performing advisor to the lead

| Action | Outcome |
|--------|---------|
| System scores all advisors (7 metrics) | Ranked by composite score |
| Top advisor gets offer with countdown | 5/7/10 min based on tier |
| Advisor accepts | Lead assigned, 120-min lock |
| Advisor times out | 5-point penalty, next advisor gets offer |
| 5 timeouts | Escalated to manual queue (branch manager) |

**Revenue Impact:** Better advisors = higher conversion + profit

---

### Stage 3: Inspection
**Who:** Inspector / Technician
**Purpose:** Assess vehicle condition and identify work needed

| Action | Outcome |
|--------|---------|
| Collect car media review | Verify check-in photos match car |
| Process checks (Oil/Battery/Tyre/OBD) | Condition assessment with photos |
| Vehicle data entry | VIN decode, make/model/year, tyre sizes |
| Add findings (parts/services) | Each with action, priority, evidence |
| Complete inspection | PDF report generated |

**Revenue Impact:** Findings drive estimate value

---

### Stage 4: Estimate & Approval
**Who:** Advisor + Customer
**Purpose:** Quote the work and get customer approval

| Action | Outcome |
|--------|---------|
| Create estimate from inspection | All findings priced (OE/OEM/AFTM/Used) |
| AI market pricing analysis | Competitive pricing verification |
| Generate customer approval link | 7-day expiry, shareable |
| Customer reviews + selects items | Chooses preferred part types |
| Customer signs + accepts terms | Estimate approved |

**Revenue Impact:** Approved estimate = committed revenue

---

### Stage 5: Parts Approval & Vendor Quotes
**Who:** Procurement + Vendor
**Purpose:** Source parts at best price and quality

| Action | Outcome |
|--------|---------|
| Send inquiry to vendors | Request quotes for approved parts |
| Vendor submits quote (4 types) | OEM/OE/Aftermarket/Used prices |
| Vendor enters part number + diagram | Required before order processing |
| System selects optimal vendor | Based on quality/price/reliability score |
| Parts approved for ordering | Ready for purchase order |

**Revenue Impact:** Cost control → gross profit

---

### Stage 6: Procurement & Receiving
**Who:** Procurement + Warehouse
**Purpose:** Order parts, receive delivery, manage inventory

| Action | Outcome |
|--------|---------|
| Create purchase order | Items, quantities, vendor, costs |
| PO approved and issued | Sent to vendor |
| Vendor delivers parts | Physical delivery |
| Record goods receipt (GRN) | Stock into Main Warehouse |
| Transfer to workshop branch | Stock available for job |
| Accounting journal posted | Inventory ↑, AP ↑ |

**Revenue Impact:** Parts cost recorded, inventory valued

---

### Stage 7: Job Card Execution
**Who:** Technician + Advisor
**Purpose:** Execute the repair/service work

| Stage | Required Actions |
|-------|-----------------|
| Quote Accepted | Verify quote is accepted/verified |
| Collect Car | Review media, verify condition |
| Pre-Work Check | Record mileage, confirm car details |
| Parts Receive | At least 1 part received, photos uploaded |
| Start Job | Begin work execution |
| Evidence Upload | Working video, completion evidence |
| Completed | Mark job done |
| Final Inspection | Checklist (6 items) + 4 car photos |
| Car Wash | 5 media files (front/rear/right/left/video) |

**Revenue Impact:** Labour hours, parts consumed

---

### Stage 8: Invoice & Service Charges
**Who:** Advisor
**Purpose:** Bill the customer with all charges

| Line Item | Source | Editable |
|-----------|--------|----------|
| Parts (from estimate) | Approved items with pricing | No (set in estimate) |
| Inspection Fee | Admin config (default AED 150) | Yes (by advisor) |
| Labour Charge | Admin config (default AED 0) | Yes (by advisor) |
| Recovery Pickup Fee | Admin config (default AED 200) | Yes (if applicable) |
| Recovery Dropoff Fee | Admin config (default AED 200) | Yes (if applicable) |
| Discount | Amount or percentage | Yes |
| VAT | 5% on net total | Auto-calculated |

**Invoice = Parts + Service Charges - Discount + VAT**

**Revenue Impact:** Total billable amount confirmed

---

### Stage 9: Payment & Collections
**Who:** Advisor / Cashier
**Purpose:** Collect payment from customer

| Method | Process |
|--------|---------|
| **Wallet** | Deduct from customer wallet balance |
| **Cash** | Record cash payment with proof |
| **Card** | Record card payment with proof |
| **Bank Transfer** | Record transfer with proof |

**Wallet Topup Flow:**
1. Advisor clicks "Top Up" in advisor portal
2. Enters amount, payment method, date, uploads proof
3. Wallet balance increases immediately
4. Payment can then be processed from wallet

**Auto-Settlement:** If wallet balance >= invoice total, auto-pay on invoice creation

**Revenue Impact:** Cash collected, revenue recognized

---

### Stage 10: Gatepass & Car Release
**Who:** Advisor + Supervisor
**Purpose:** Formally release car to customer

| Step | Action | Required |
|------|--------|----------|
| Create gatepass | From paid invoice | Invoice must be paid |
| Supervisor approval | Timestamp recorded | Yes |
| Customer signature | Signed handover | Yes |
| Final notes | Handover remarks | Optional |
| Release car | Status → released | Closes lead |

**Revenue Impact:** Service completed, lead closed as `closed_won`

---

### Stage 11: Post-Delivery
**Who:** System
**Purpose:** Close the loop, update metrics

| Action | Automatic |
|--------|-----------|
| Lead closed as `closed_won` | Yes (on gatepass release) |
| `closed_at` timestamp set | Yes |
| Advisor KPIs updated | Yes (conversion, revenue) |
| Car-Out tab populated | Yes |
| Customer history updated | Yes |

---

## Financial Summary Per Job

```
REVENUE:
  Parts Sale:            AED xxx.xx
  Inspection Fee:        AED 150.00
  Labour Charge:         AED xxx.xx
  Recovery Fees:         AED xxx.xx (if applicable)
  ─────────────────────────────────
  Subtotal:              AED xxx.xx
  Discount:             -AED xxx.xx
  VAT (5%):              AED xxx.xx
  ─────────────────────────────────
  GRAND TOTAL:           AED xxx.xx

COST:
  Parts Cost:            AED xxx.xx (from PO)
  Labour Cost:           AED xxx.xx (internal)
  ─────────────────────────────────
  TOTAL COST:            AED xxx.xx

GROSS PROFIT:            AED xxx.xx (Revenue - Cost)
GP%:                     xx.x%
```

---

## KPI Dashboard (8 Metrics)

| KPI | Description | Target |
|-----|-------------|--------|
| Total Leads | Leads assigned | Growth |
| Converted | Closed won | > 80% conversion |
| Car-In | Active in workshop | Monitor throughput |
| Car-Out | Delivered | Growth |
| Today Collection | AED collected today | Daily target |
| Total Revenue | All-time revenue | Monthly target: AED 2M |
| Total Calls | Calls made/received | Activity metric |
| Answer Rate | Calls answered % | > 80% |

---

## Roles & Permissions

| Role | Key Actions |
|------|-------------|
| **Advisor** | Accept leads, monitor workflow, create invoices, collect payment, release cars |
| **Inspector** | Perform inspections, add findings, upload evidence |
| **Technician** | Execute job card, upload evidence, complete work |
| **Procurement** | Manage POs, receive parts, track inventory |
| **Vendor** | Submit quotes, enter part details, manage deliveries |
| **Branch Manager** | Escalation handling, manual assignments, oversight |
| **Admin** | Configure service charges, PIS settings, permissions |

---

_Global ERP System | Version 2.0 | 2026-03-31_
