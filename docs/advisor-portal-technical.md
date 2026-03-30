# Advisor Portal -- Technical Documentation

## System Architecture

### Overview
The Advisor Portal is a real-time workspace for service center advisors to manage the complete vehicle service lifecycle from lead acceptance to car delivery. It operates within the Performance Intelligence System (PIS) and integrates with all workshop modules.

### Tech Stack
- **Frontend:** Next.js 16, React 19, TypeScript
- **Backend:** Next.js API Routes, PostgreSQL 16
- **Real-time:** Auto-refresh polling (5s with pending offers, 30s idle)
- **Auth:** Session-based JWT, PIS role-based access

### File Structure
```
apps/web/app/company/[companyId]/pis/advisor-portal/
  page.tsx                    -- Main advisor portal page (client component)

apps/web/app/api/company/[companyId]/pis/
  advisor-portal/route.ts     -- Main data API (leads, calls, workflow, KPIs)
  lead-distribution/
    route.ts                  -- Lead routing engine
    accept/route.ts           -- Lead acceptance endpoint
    config/route.ts           -- Distribution config

packages/ai-core/src/pis/
  leadDistribution/
    engine.ts                 -- PIS routing, cascade, accept logic
    autoAssign.ts             -- Auto-assign trigger on car check-in
    repository.ts             -- Queue CRUD operations
  advisorRepository.ts        -- Advisor scoring (7 weighted metrics)
  configRepository.ts         -- PIS config + service charges
  service.ts                  -- Master service aggregator
```

---

## Data Flow

### 1. Lead Assignment (Auto via PIS)
```
Car Check-In (lead_status = car_in)
  |
  v
triggerAutoAssignOnCarIn()  [autoAssign.ts]
  |
  v
Guard: already assigned? already in queue? -> SKIP
  |
  v
routeLead()  [engine.ts]
  |
  v
Fetch advisors sorted by composite_score DESC
  |
  v
Filter out locked advisors (handling another lead)
  |
  v
Offer to best available advisor
  |
  v
Create pis_lead_queue entry (status: offered)
  |
  v
Set locked_until = now + accept_window (tier-based: 5/7/10 min)
```

### 2. Lead Acceptance
```
POST /api/company/{id}/pis/lead-distribution/accept
  |
  v
acceptLead()  [engine.ts]
  |
  v
Update queue: status=locked, accepted_at=now, locked_until=now+120min
  |
  v
applyAdvisorToLead()  [autoAssign.ts]
  |
  v
Set leads.agent_employee_id, assigned_user_id, assigned_at
  |
  v
Log lead_event: advisor_accepted
```

### 3. Cascade on Timeout
```
checkExpiredOffers()  [engine.ts]
  |
  v
For each expired offer:
  Apply 5-point penalty to timed-out advisor
  Log history: timeout
  |
  v
cascade_count < max_cascade_attempts (5)?
  YES -> Offer to next best advisor
  NO  -> Escalate to manual queue
```

---

## API Endpoints

### GET /api/company/{companyId}/pis/advisor-portal
**Query:** `?advisorUserId={userId}`

**Returns:**
```typescript
{
  leads: Array<{
    id, customer_name, customer_phone, lead_status, lead_type,
    checkinAt, carPlateNumber, carModel, branchName, serviceType,
    customerId, customerWalletAmount,
    workflow: {
      inspection: { id, status } | null,
      estimate: { id, status, grandTotal } | null,
      jobCard: { id, status, startAt, completeAt, finalInspectionAt, carWash, ... } | null,
      parts: { orderedCount, receivedCount, items: [...] } | null,
      invoice: { id, status, grandTotal, invoiceNumber } | null,
      qualityCheck: { id, status } | null,
      gatepass: { id, status } | null,
      preInspectionForm: { status, submittedAt } | null,
    }
  }>,
  calls: Array<{ id, direction, from_number, to_number, status, duration_seconds }>,
  pendingOffers: Array<{ queueId, leadId, tier, offeredAt, lockedUntil, pipelineValue, customerName, ... }>,
  kpis: {
    totalLeads, convertedLeads, carInLeads, totalCalls, answerRate,
    revenue, invoiceCount, carOutCount, todayCollection
  }
}
```

### POST /api/company/{companyId}/pis/lead-distribution/accept
**Body:** `{ queueId: string }`

### GET /api/company/{companyId}/workshop/service-charges
**Query:** `?leadId={leadId}`
**Returns:** `{ inspectionFee, recoveryPickupFee, recoveryDropoffFee, labourCharge, currency }`

### POST /api/company/{companyId}/workshop/invoices
**Body:** `{ estimateId, serviceCharges: { inspectionFee, recoveryPickupFee, recoveryDropoffFee, labourCharge }, autoSettleOnConvert, autoCarOutOnAutoPaid }`

### POST /api/customers/{id}/wallet/transactions
**Body:** `{ companyId, amount, paymentMethod, paymentDate, paymentProofFileId }`

### POST /api/company/{companyId}/workshop/invoices/{invoiceId}/pay
**Body:** `{ paymentMethod: "wallet" }`

### POST /api/company/{companyId}/workshop/gatepass
**Body:** `{ invoiceId, handoverType: "branch" | "dropoff_recovery" }`

### PATCH /api/company/{companyId}/workshop/gatepass/{gatepassId}
**Body:** `{ status: "released", customerSigned: true, supervisorApprovedAt, finalNote }`

---

## Database Tables

### Core Tables
| Table | Purpose |
|-------|---------|
| `leads` | Master lead record with agent assignment |
| `pis_lead_queue` | Lead offer/acceptance queue |
| `pis_lead_queue_history` | Queue action audit trail |
| `pis_advisor_scores` | Advisor performance scores |
| `pis_config` | PIS configuration (weights, thresholds, service charges) |

### Workflow Tables
| Table | Purpose |
|-------|---------|
| `inspections` | Vehicle inspection records |
| `estimates` | Cost estimates with items |
| `job_cards` | Work execution tracking |
| `part_quotes` | Vendor quotes for parts |
| `purchase_orders` | Parts procurement |
| `invoices` | Customer billing |
| `gatepasses` | Car delivery/handover |
| `quality_checks` | QC records (optional, final inspection used) |

### Supporting Tables
| Table | Purpose |
|-------|---------|
| `line_items` | Inspection findings / parts needed |
| `estimate_items` | Estimate line items with pricing |
| `invoice_items` | Invoice line items |
| `purchase_order_items` | PO line items |
| `inventory_movements` | Stock movements (GRN) |
| `inventory_stock` | Current stock levels |
| `lead_bookings` | Appointment bookings |
| `pre_inspection_form_requests` | Customer pre-inspection forms |
| `customer_wallet_transactions` | Wallet topup records |

---

## Scoring Algorithm

### Composite Score (0-100)
| Metric | Weight | Description |
|--------|--------|-------------|
| Conversion Rate | 25% | Leads converted / total leads |
| Gross Profit % | 20% | (Revenue - Cost) / Revenue |
| Revenue | 15% | Normalized total revenue |
| SLA Compliance | 15% | Estimate approval rate |
| Customer Satisfaction | 10% | Call completion / health scores |
| Call Quality | 10% | Completed calls % |
| FOC Penalty | -5% | Free-of-charge rate (negative) |

### Tier Assignment
| Tier | Score | Accept Window |
|------|-------|---------------|
| 1 (ELITE) | >= 80 | 10 minutes |
| 2 (STANDARD) | >= 50 | 7 minutes |
| 3 (LOW) | < 50 | 5 minutes |

---

## Configuration (PIS Admin)

### service_charges
```json
{
  "inspection_fee": 150,
  "recovery_pickup_fee": 200,
  "recovery_dropoff_fee": 200,
  "labour_charge": 0,
  "currency": "AED"
}
```

### lead_distribution
```json
{
  "tier1_accept_window_min": 10,
  "tier2_accept_window_min": 7,
  "tier3_accept_window_min": 5,
  "lock_duration_min": 120,
  "no_call_penalty_points": 5,
  "max_cascade_attempts": 5
}
```

---

## Error Handling

| Scenario | Handling |
|----------|----------|
| No advisors available | Queue stays pending, retries on next check |
| Accept window expired | Auto-cascade with 5-point penalty |
| Max cascades exceeded | Escalate to manual queue |
| Wallet insufficient | Show shortfall, allow topup |
| Invoice creation fails | Show error, keep estimate |
| Gatepass release fails | Show error, retry available |

---

## Security

- Session-based authentication required
- Company-scoped data isolation
- Role-based permission checks on mutations
- Auto-refresh uses authenticated API calls
- File uploads via `/api/files/upload` with auth

---

_Version: 1.0 | Date: 2026-03-31 | Global ERP System_
