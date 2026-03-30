# Auto-Assign Advisor -- Implementation Plan

## Overview

Automatically assign the best-available advisor to a lead when the car checks in, using the existing PIS scoring engine. No manual "Assign" button needed at this stage.

---

## Trigger

| Event | Condition |
|-------|-----------|
| Lead stage changes to `checkin` (Car In) | `lead_stage = 'checkin'` OR `lead_status = 'car_in'` |
| Source | PATCH `/api/company/[companyId]/sales/leads/[id]` with `status: "car_in"` |

The auto-assignment fires **once** when the car-in event occurs. It does not re-trigger if the lead is already assigned.

---

## Selection Criteria (Using PIS Engine)

### Step 1: Get Eligible Advisors

| Filter | Rule | Source |
|--------|------|--------|
| Department | Only "Service Center Sales Department" employees | `employees.department` |
| Company | Same company as the lead | `employees.company_id = lead.company_id` |
| Active | `is_active = true` | `employees.is_active` |
| Not Locked | Not currently handling another lead (within 120 min lock window) | `pis_lead_queue.status != 'locked'` |

**Note:** No branch filter. Car check-in can happen at any branch (including recovery drop-off at a different branch).

### Step 2: Rank by PIS Composite Score

Use the existing PIS weighted scoring:

| Metric | Weight | Description |
|--------|--------|-------------|
| Conversion Rate | 25% | Leads converted to closed_won / total leads |
| Gross Profit % | 20% | (Revenue - Cost) / Revenue |
| Revenue | 15% | Normalized total revenue |
| SLA Compliance | 15% | Estimate approval/invoice rate |
| Customer Satisfaction | 10% | Call completion / lead health |
| Call Quality | 10% | Completed calls % |
| FOC Penalty | -5% | Free-of-charge invoice rate |

**Composite Score** = weighted sum of normalized metrics (0-100 scale)

Advisors are sorted **descending** by composite score. The highest-scoring available advisor is offered the lead first.

### Step 3: Determine Tier & Accept Window

| Tier | Score Range | Accept Window |
|------|-------------|---------------|
| Tier 1 (ELITE) | >= 80 | 10 minutes |
| Tier 2 (STANDARD) | >= 50 | 7 minutes |
| Tier 3 (LOW) | < 50 | 5 minutes |

### Step 4: Offer Lead to Advisor

1. Create `pis_lead_queue` entry with `status = 'offered'`
2. Set `offered_to_user_id`, `offered_at`, `locked_until` (now + accept window)
3. Log `pis_lead_queue_history` with `action = 'offered'`
4. Log `lead_events` with `event_type = 'advisor_auto_assigned'`
5. Send push notification to advisor (Firebase)

### Step 5: Wait for Acceptance

- Advisor sees the lead in their portal / mobile app
- Advisor clicks "Accept" -> `status = 'accepted'`, `accepted_at = now()`, lock for 120 min
- Log history: `action = 'accepted'`

### Step 6: Cascade on Timeout

If advisor does not accept within the accept window:

1. Apply **5-point penalty** to timed-out advisor
2. Log history: `action = 'timeout'`, `penalty_points = 5`
3. Increment `cascade_count`
4. Check if `cascade_count >= 5` (max cascades)
   - **Yes**: Set `status = 'manual'`, notify branch manager
   - **No**: Offer to next best available advisor (repeat from Step 3)

---

## Implementation Steps

### Phase 1: Backend Hook (Trigger)

**File:** `packages/ai-core/src/crm/leads/repository.ts` (or new service file)

1. Create function `triggerAdvisorAutoAssign(companyId, leadId)`
2. Call this function inside `updateLeadPartial()` when:
   - `leadStatus` changes to `car_in`, OR
   - `leadStage` changes to `checkin`
3. Guard: Skip if lead already has `agent_employee_id` set (already assigned)
4. Guard: Skip if `pis_lead_queue` already has an entry for this lead

### Phase 2: Reuse PIS Engine

**File:** `packages/ai-core/src/pis/leadDistribution/engine.ts`

The existing `routeLead(companyId, leadId, pipelineValue)` function already does everything needed:
- Fetches advisors sorted by composite score
- Filters out locked advisors
- Creates queue entry with offer
- Handles tier-based accept windows

We just need to call `routeLead()` from the car-in trigger.

**Pipeline value:** Calculate from the estimate linked to the lead (if exists), otherwise use 0.

### Phase 3: Auto-Check Expired Offers

**File:** `packages/ai-core/src/pis/leadDistribution/engine.ts`

The existing `checkExpiredOffers(companyId)` function handles cascade logic. It needs to run periodically:

**Option A:** Call it on every leads API request (current approach with `releaseExpiredAssignments`)
**Option B (Recommended):** Set up a cron job / interval that runs every 1-2 minutes

### Phase 4: Update Lead on Acceptance

When advisor accepts (POST `/pis/lead-distribution/accept`):

1. Set `leads.agent_employee_id` = accepted advisor's employee ID
2. Set `leads.assigned_user_id` = accepted advisor's user ID
3. Set `leads.assigned_at` = now()
4. Log `lead_events` with `event_type = 'advisor_accepted'`

### Phase 5: Notifications

1. **On offer:** Push notification to advisor via Firebase
   - Title: "New Lead Assigned"
   - Body: "Customer {name} - {car} checked in. Accept within {window} minutes."
2. **On timeout cascade:** Push notification to next advisor
3. **On manual escalation:** Push notification to branch manager
4. **On acceptance:** Push notification to front-desk / check-in agent confirming advisor assigned

---

## Data Flow

```
Car Check-In
  |
  v
PATCH /sales/leads/[id]  { status: "car_in", leadStage: "checkin" }
  |
  v
updateLeadPartial() detects car_in status
  |
  v
triggerAdvisorAutoAssign(companyId, leadId)
  |
  v
Guard: already assigned? already in queue? -> SKIP
  |
  v
Calculate pipeline value from linked estimate
  |
  v
PIS engine.routeLead(companyId, leadId, pipelineValue)
  |
  v
Fetch advisors -> sort by composite_score DESC -> filter locked
  |
  v
Offer to top advisor -> create pis_lead_queue entry
  |
  v
Push notification to advisor
  |
  v
[Advisor accepts within window]     [Timeout]
  |                                    |
  v                                    v
Set agent on lead                   Apply penalty
Lock 120 min                        Cascade to next advisor
Log events                          (max 5 cascades -> manual)
```

---

## Files to Modify

| File | Change |
|------|--------|
| `packages/ai-core/src/crm/leads/repository.ts` | Add auto-assign trigger in `updateLeadPartial()` |
| `packages/ai-core/src/pis/leadDistribution/engine.ts` | Reuse `routeLead()` -- no changes needed |
| `apps/web/app/api/company/[companyId]/pis/lead-distribution/accept/route.ts` | Add lead field updates on acceptance |
| `packages/ai-core/src/pis/advisorRepository.ts` | No changes -- scoring already works |
| `packages/ui/src/components/leads/LeadsTable.tsx` | Remove manual Assign button (after auto-assign is live) |

## New Files

| File | Purpose |
|------|---------|
| `packages/ai-core/src/pis/leadDistribution/autoAssign.ts` | Auto-assign service: trigger, guards, pipeline value calculation |

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| No advisors available (all locked) | Set queue status to `pending`, retry when `checkExpiredOffers` runs |
| No advisors in system | Skip auto-assign, log warning, keep lead unassigned |
| Lead already assigned | Skip (guard check on `agent_employee_id`) |
| Lead already in queue | Skip (guard check on existing `pis_lead_queue` entry) |
| Advisor goes offline after offer | Timeout will cascade automatically |
| Multiple car check-ins for same lead | Guard prevents duplicate queue entries |
| VIP customer | Future: add priority flag to skip workload check, assign to top performer |

---

## Testing Checklist

| # | Test | Expected |
|---|------|----------|
| 1 | Car check-in with available advisors | Top-scored advisor gets offer, queue entry created |
| 2 | Advisor accepts within window | Lead gets `agent_employee_id`, queue status = `accepted` |
| 3 | Advisor times out | Penalty applied, cascades to next advisor |
| 4 | 5 timeouts | Queue status = `manual`, branch manager notified |
| 5 | All advisors locked | Queue stays `pending`, retries later |
| 6 | Lead already assigned | No queue entry created, skipped |
| 7 | Car check-in via recovery (different branch) | Works without branch filter |
| 8 | Push notification delivery | Advisor receives notification on mobile |
| 9 | Pipeline value from estimate | Correct value passed to queue |
| 10 | Multiple check-ins same lead | Only first one triggers assignment |

---

## Configuration (PIS Admin)

All settings are configurable via PIS Admin panel (`/company/[companyId]/pis/admin`):

| Setting | Default | Key |
|---------|---------|-----|
| Elite min score | 80 | `tier_boundaries.elite_min_score` |
| Standard min score | 50 | `tier_boundaries.standard_min_score` |
| Tier 1 accept window | 10 min | `lead_distribution.tier1_accept_window_min` |
| Tier 2 accept window | 7 min | `lead_distribution.tier2_accept_window_min` |
| Tier 3 accept window | 5 min | `lead_distribution.tier3_accept_window_min` |
| Lock duration | 120 min | `lead_distribution.lock_duration_min` |
| Timeout penalty | 5 points | `lead_distribution.no_call_penalty_points` |
| Max cascade attempts | 5 | `lead_distribution.max_cascade_attempts` |
| Score weights | See table above | `score_weights.*` |
