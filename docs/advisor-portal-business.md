# Advisor Portal -- Business Documentation

## Purpose

The Advisor Portal is the primary workspace for **Service Center Sales Advisors** to manage their assigned vehicle service leads from check-in to delivery. It provides a single view of all active jobs, performance metrics, and action buttons to complete each workflow step.

---

## Business Value

| Benefit | Description |
|---------|-------------|
| **Single Dashboard** | Advisor sees everything in one place -- no switching between pages |
| **Auto-Assignment** | Leads are automatically assigned based on performance score |
| **Real-Time Updates** | Dashboard refreshes every 5-30 seconds |
| **Performance Tracking** | KPIs visible at all times (revenue, calls, conversions) |
| **Faster Turnaround** | One-click actions for each workflow step |
| **Accountability** | Every action is logged with timestamps |

---

## Advisor Responsibilities

### Daily Duties

| # | Duty | When | Action |
|---|------|------|--------|
| 1 | **Accept new leads** | When offered by system | Accept within time window (5-10 min based on tier) |
| 2 | **Review car check-in** | When car arrives | Verify photos, media, customer details |
| 3 | **Monitor inspection** | After check-in | Track inspection status, review findings |
| 4 | **Review estimate** | After inspection | Verify pricing, approve items, set service charges |
| 5 | **Track parts** | After estimate approval | Monitor part quotes, PO, delivery status |
| 6 | **Monitor job card** | During work | Track job progress, final inspection, car wash |
| 7 | **Create invoice** | After job completion | Add service charges, review totals, convert |
| 8 | **Collect payment** | After invoice | Top up wallet, process payment |
| 9 | **Release car** | After payment | Create gatepass, confirm handover |

---

## Workflow Stages

```
Lead Offered → Accept → Car Check-In → Inspection → Estimate →
Parts Approval → Procurement → Job Card → Quality Check →
Car Wash → Invoice → Payment → Gatepass → Car Release
```

### Stage Details

#### 1. Lead Acceptance
- System auto-assigns based on **PIS composite score** (7 metrics)
- Advisor has limited time to accept (tier-based: 5/7/10 minutes)
- If not accepted: 5-point penalty + cascades to next advisor
- After 5 cascades: escalated to manual queue for manager

#### 2. Pre-Inspection & Check-In
- Customer submits pre-inspection form (8 questions + signature)
- Workshop staff performs car check-in (4 photos + cluster + 360 video)
- Lead status changes to `car_in`
- Auto-triggers advisor assignment

#### 3. Inspection
- Inspector adds findings (parts/services needed)
- Each finding has: action (Replace/Service/Repair), priority, media evidence
- AI suggests related parts
- Inspection completed and PDF generated

#### 4. Estimate & Approval
- Estimate created from inspection findings
- Pricing set for each item (OE/OEM/Aftermarket/Used)
- Customer approval link generated and shared
- Customer reviews, selects items, signs digitally

#### 5. Parts & Procurement
- Vendor quotes requested for approved parts
- Vendor submits pricing + enters part number and diagram
- Purchase order created and issued
- Parts received at main warehouse → transferred to workshop
- GRN recorded with inventory movement

#### 6. Job Card Execution
- Job card created from approved estimate
- Stages: Quote Accept → Collect Car → Pre-Work Check → Start → Evidence → Complete
- Final inspection: checklist (test drive, cluster, tyre, computer reset, shields)
- Car wash: upload 5 media (front, rear, right, left, video)

#### 7. Invoice & Payment
- Invoice created with:
  - Parts subtotal (from estimate)
  - Service charges (inspection fee, labour charge, recovery fees)
  - Discount (amount or percentage)
  - VAT (5%)
  - Grand total
- Payment via customer wallet
- Auto-settlement if wallet has sufficient balance

#### 8. Car Delivery
- Gatepass created from paid invoice
- Supervisor approval
- Customer signature
- Car released
- Lead closed as `closed_won`

---

## KPIs Tracked

### Performance Metrics (8 KPIs)

| KPI | Description | Target |
|-----|-------------|--------|
| **Total Leads** | All leads assigned to advisor | Growth |
| **Converted** | Leads converted (closed_won/completed) | > 80% |
| **Car-In** | Active cars in workshop | Monitor |
| **Car-Out** | Cars delivered to customers | Growth |
| **Today Collection** | AED collected today | Daily target |
| **Total Revenue** | All-time revenue generated | Monthly target |
| **Total Calls** | Phone calls made/received | Activity target |
| **Answer Rate** | % of calls answered | > 80% |

### Scoring Weights
| Metric | Weight | Impact |
|--------|--------|--------|
| Conversion Rate | 25% | Most important |
| Gross Profit % | 20% | Profitability |
| Revenue | 15% | Volume |
| SLA Compliance | 15% | Timeliness |
| Customer Satisfaction | 10% | Quality |
| Call Quality | 10% | Communication |
| FOC Penalty | -5% | Negative impact |

### Tier System
| Tier | Score Range | Benefits |
|------|-------------|----------|
| **ELITE** | 80-100 | 10 min accept window, priority leads, 5-8% commission |
| **STANDARD** | 50-79 | 7 min accept window, 3-5% commission |
| **LOW** | 0-49 | 5 min accept window, 3% base commission |

---

## Service Charges

Managed by admin, editable by advisor before invoice conversion:

| Charge | Default (AED) | When Applied |
|--------|---------------|-------------|
| Inspection Fee | 150 | Always |
| Recovery Pickup Fee | 200 | If pickup recovery requested |
| Recovery Dropoff Fee | 200 | If dropoff recovery requested |
| Labour Charge | 0 | Configurable per job |

---

## Revenue Flow

```
Parts Sale (from estimate)
  + Inspection Fee
  + Labour Charge
  + Recovery Fees (if applicable)
  = Subtotal
  - Discount
  = Net Subtotal
  + VAT (5%)
  = Grand Total (Invoice Amount)

Customer pays from Wallet → Invoice marked Paid → Car Released
```

---

## Commission Structure

| Level | Base | Performance | Top 3 ELITE |
|-------|------|-------------|-------------|
| Rate | 3% | +2% (ELITE) | +5% (rank <= 3) |
| Requirement | All | Score >= 80 | Score >= 80, GP% >= 20% |
| FOC Deduction | — | — | AED 500 per FOC unit |

---

## Escalation Rules

| Scenario | Action | Owner |
|----------|--------|-------|
| Lead not accepted (5 timeouts) | Escalate to manual queue | Branch Manager |
| Wallet insufficient | Advisor prompts topup | Advisor |
| Parts delayed | Visible in parts order column | Advisor + Procurement |
| Quality check failed | Job card reopened for rework | Advisor + Technician |
| Customer complaint | Logged in lead events | Advisor + Manager |

---

## Reports Available

| Report | Access | Format |
|--------|--------|--------|
| Inspection Report | PDF button in inspection column | PDF |
| Estimate Quote | Print buttons in estimate page | PDF |
| GRN Report | GRN PDF button in procurement | PDF |
| Invoice | Print button in invoice | PDF |
| QC Report | View QC Report modal | On-screen |

---

_Version: 1.0 | Date: 2026-03-31 | Global ERP System_
