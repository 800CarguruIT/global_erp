# USER MANUAL — Service Center (PIS V4.0)
## 800CarGuru Global ERP — Performance Intelligence System

**Version:** 4.0.1 | **Last Updated:** March 30, 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Accessing Service Center](#accessing-service-center)
3. [Master Dashboard](#master-dashboard)
4. [Advisors](#advisors)
5. [Lead Distribution](#lead-distribution)
6. [Funnel](#funnel)
7. [Estimates](#estimates)
8. [WIP](#wip)
9. [Collections](#collections)
10. [AI Engines](#ai-engines)
11. [Signals](#signals)
12. [Admin](#admin)
13. [Advisor Extensions](#advisor-extensions)
14. [Calls History](#calls-history)
15. [Advisor Portal](#advisor-portal)

---

## 1. Overview

The Service Center (PIS — Performance Intelligence System) is the comprehensive performance tracking and management module for service advisors at 800CarGuru. It tracks 22 service advisors across 60+ KPIs, automates lead distribution based on performance scores, and provides AI-driven operational intelligence.

**Who uses it:**
- Service Center Manager / Ops Director
- Service Advisors
- Finance (for commission tracking)
- Operations (for SLA monitoring)

**Key Principle:** Speed + performance = more leads. Top performers get first access. Bottom performers get restricted access. The system promotes and demotes automatically.

---

## 2. Accessing Service Center

1. Log into Global ERP
2. In the left sidebar, click **Service Center** to expand
3. You will see 13 modules:
   - Master, Advisors, Lead Distribution, Funnel, Estimates, WIP, Collections
   - AI Engines, Signals, Admin
   - Advisor Extensions, Calls History, Advisor Portal

**Permissions Required:** `pis.dashboard.view` or `callcenter.view`

---

## 3. Master Dashboard

**Path:** Service Center → Master
**Permission:** `pis.dashboard.view`

### What you see:
- **8 KPI Cards:** Total Revenue, Team GP%, Team FOC Rate, Cars In MTD, Active WIP, Unapproved Estimates, Commission Pool, Zero Revenue count
- **FOC Critical Banner:** Red alert when FOC rate exceeds 30%
- **9-Stage Funnel:** Visual pipeline from Lead Arrives → Vehicle Pickup
- **Advisor Leaderboard:** All 22 advisors ranked by composite score with ELITE/STANDARD tier badges
- **SLA Compliance Grid:** 12 SLA measurements with OK/WARNING/BREACH status
- **AI Intelligence Sidebar:** Real-time AI signals (toggle with "AI" button)

### How to use:

#### Date Range Filter:
1. Click preset buttons: **7D, 30D, 90D, YTD, 1Y, ALL**
2. Or use the custom date pickers
3. Data refreshes automatically when dates change
4. **ALL** shows complete history (recommended for first view)

#### AI Intelligence Panel:
1. Click **"AI"** button in the top right of the filter bar
2. The right sidebar shows signals from 4 engines: Funnel, Agent, Revenue, Anomaly
3. Switch between **Diag.** (what's happening), **Pred.** (what will happen), **Presc.** (what to do) tabs
4. Each signal shows urgency (HIGH/MED/LOW), confidence %, diagnosis, and recommended action
5. Click **"✕"** to close the panel

#### Reading the Leaderboard:
- **ELITE** (gold badge): Top performers with score ≥ 30. Get first access to leads, higher commission
- **STANDARD** (grey badge): Below threshold. Standard lead access, base commission
- Revenue shown in AED (thousands)
- "paid %" = percentage of invoices that were paid
- "FOC %" = percentage of free-of-charge (zero revenue) jobs

---

## 4. Advisors

**Path:** Service Center → Advisors
**Permission:** `pis.advisors.view`

### What you see:
- Full table of all 22 service advisors
- Columns: Rank, Name, Composite Score, Conversion %, GP %, Revenue, Paid %, FOC %, SLA, Call Quality, Tier

### How to use:
1. Scores are **auto-computed** every time you open the page
2. The **Composite Score** is calculated from 7 weighted metrics:
   - Conversion Rate (25%), GP% (20%), Revenue (15%), SLA (15%), Customer Satisfaction (10%), Call Quality (10%), FOC Penalty (-5%)
3. **Click "Refresh Scores"** to manually recompute
4. Advisors are sorted by composite score (highest first)

### Understanding Scores:
| Score Range | Tier | Meaning |
|-------------|------|---------|
| ≥ 30 | ELITE | Top performer, gets priority leads |
| < 30 | STANDARD | Average performer, standard lead access |

---

## 5. Lead Distribution

**Path:** Service Center → Lead Distribution
**Permission:** `pis.lead_distribution.view`

### What you see:
- **Config Cards:** Tier 1/2/3 accept windows, lock duration, penalty points, max cascades
- **Live Lead Queue:** Real-time view of leads being routed (polls every 5 seconds)
- **60-Lead Simulation:** Test the routing algorithm without affecting real data
- **Queue History:** Audit trail of all routing decisions

### How to use:

#### Live Queue:
- Automatically refreshes every 5 seconds
- Shows lead ID, status (PENDING/OFFERED/ACCEPTED/LOCKED), tier, offered-to advisor, cascade count, pipeline value
- Status colors: Blue=Offered, Green=Accepted, Purple=Locked, Red=Manual escalation

#### Running a Simulation:
1. Click **"Run Simulation"**
2. Watch 60 synthetic leads route through the algorithm
3. View results: Accepted, Cascaded, Manual Queue, Pipeline Value
4. Each step shows which advisor received the offer and the outcome
5. Simulation does NOT affect real data

#### How Lead Routing Works:
1. New lead enters → System ranks advisors by composite score
2. Offered to #1 available advisor (ELITE first)
3. If not accepted within window (10/7/5 min by tier) → Cascade to next + penalty
4. After 5 cascades → Manual queue for Ops Manager
5. Once accepted → Locked for 120 min

---

## 6. Funnel

**Path:** Service Center → Funnel
**Permission:** `pis.funnel.view`

### What you see:
- **Summary KPIs:** Total Leads, Invoiced, Overall Conversion, WIP Complete, Drop-off %
- **9-Stage Funnel:** Horizontal bars showing volume at each stage
- **Stage-over-Stage Conversion:** Shows conversion between adjacent stages

### The 9 Stages:
1. **Lead Arrives** — New lead created in system
2. **Assigned & Accepted** — Lead has an assigned advisor
3. **First Contact** — First completed call to customer
4. **Booking Confirmed** — Customer confirmed booking
5. **Car-In** — Vehicle checked in at workshop
6. **Estimate Approved** — Estimate created and approved/invoiced
7. **WIP Complete** — Work order completed
8. **Invoice & Payment** — Invoice generated
9. **Vehicle Pickup** — Customer picked up vehicle

### How to use:
1. Use **date filter** (7D/30D/90D/YTD/1Y/ALL) to select time period
2. Conversion % shows what percentage of total leads reached each stage
3. Green = OK (≥60%), Amber = Warning (≥30%), Red = Low (<30%)
4. Check **Stage-over-Stage** section for bottleneck identification

---

## 7. Estimates

**Path:** Service Center → Estimates
**Permission:** `pis.estimates.view`

### What you see:
- **6 KPI Cards:** Approval Rate, Total Estimates, Approved, Rejected, Rejected Value (AED), Pending > SLA
- **Per Advisor Breakdown:** Table showing each advisor's estimate stats

### How to use:
1. Review the approval rate — target is ≥ 75%
2. Check "Pending > SLA" for estimates exceeding the 30-minute processing SLA
3. Per-advisor table shows who has the most pending/rejected estimates
4. "Invoiced" status counts as approved (legacy CarGuru2 data uses this status)

---

## 8. WIP (Work In Progress)

**Path:** Service Center → WIP
**Permission:** `pis.wip.view`

### What you see:
- **5 KPI Cards:** Active WIP, Capacity, On-Time %, Pickup Rate, Zero Revenue WIP
- **Zero Revenue Alert:** Banner showing advisors with completed work but no invoice
- **Per Advisor Table:** Active jobs and on-time % per advisor

### How to use:
1. **Active WIP** = jobs currently in progress (not completed/cancelled)
2. **Capacity** = number of active service center advisors
3. **On-Time %** = percentage of jobs completed with `work_completed_at` set
4. Check the zero-revenue alert for jobs that need invoicing

---

## 9. Collections

**Path:** Service Center → Collections
**Permission:** `pis.collections.view`

### What you see:
- **8 KPI Cards:** Total Revenue, Gross Profit, GP%, Collection Rate, DSO, Overdue Amount, Overdue Count, Total Cost
- **Per Advisor GP% Table:** Revenue, Cost, GP, GP%, Collected, Outstanding per advisor

### How to use:
1. Use **date filter** (7D/30D/90D/YTD/1Y/ALL) to select time period
2. **GP%** = (Revenue - Cost) / Revenue — target is ≥ 45%
3. **Collection Rate** = Collected / Revenue — target is ≥ 95%
4. **Outstanding** = invoices not yet paid
5. Per-advisor table helps identify who has the most outstanding collections

---

## 10. AI Engines

**Path:** Service Center → AI Engines
**Permission:** `pis.engines.view`

### What you see:
- 7 AI engine cards, each showing generated signals

### The 7 Engines:
| Engine | What it does |
|--------|-------------|
| **Funnel Intelligence** | Identifies conversion bottlenecks |
| **Agent Performance** | Per-advisor coaching signals |
| **Revenue Forecasting** | Predicts revenue vs target |
| **Churn & Retention** | Customer churn risk detection |
| **Anomaly Detection** | Unusual patterns and SLA breaches |
| **Collections Intelligence** | Payment and overdue optimization |
| **Coaching Intelligence** | Personalized advisor coaching plans |

### How to use:
1. Each card shows the engine name, signal count, and top 3 signals
2. Signals show urgency level (HIGH/MED/LOW) and type (diagnostic/predictive/prescriptive)
3. Click into a signal to see the full observation, diagnosis, and recommended action

---

## 11. Signals

**Path:** Service Center → Signals
**Permission:** `pis.signals.view`

### What you see:
- Complete signal library from all AI engines
- Filter buttons: ALL, HIGH, MED, LOW

### How to use:
1. Click **HIGH** to see only critical signals that need immediate attention
2. Each signal card shows:
   - **Engine** (e.g., E1 Funnel, E2 Agent)
   - **Urgency** (HIGH/MED/LOW)
   - **Type** (diagnostic/predictive/prescriptive)
   - **Confidence** percentage
   - **Observation** — what is happening
   - **Diagnosis** — why it's happening
   - **Action** — what to do about it
   - **Owner** — who should act
   - **Response time** — how quickly to respond

---

## 12. Admin

**Path:** Service Center → Admin
**Permission:** `pis.admin.manage`

### What you see:
- 6 configuration sections with current values and edit capability

### Configuration Sections:

#### Score Weights:
Controls the composite score formula. Values must sum to ~100.
- `conversion_rate`: 25, `gp_pct`: 20, `revenue`: 15, `sla_compliance`: 15, `customer_satisfaction`: 10, `call_quality`: 10, `foc_penalty`: -5

#### Tier Boundaries:
- `elite_min_score`: 30 (minimum composite score for ELITE tier)
- `standard_min_score`: 15

#### Commission Rates:
- `base_pct`: 3%, `performance_pct`: 5%, `top_pct`: 8%, `gp_floor_pct`: 20%, `foc_penalty_per_unit`: 500

#### SLA Thresholds:
- All 12 SLA targets (in minutes/hours/percentages)

#### Lead Distribution:
- Accept windows per tier, lock duration, penalty points, max cascades

#### Revenue Targets:
- `monthly_target_aed`: 2,000,000, `gp_target_pct`: 45, `foc_max_pct`: 30

### How to edit:
1. Click **"Edit"** on any section
2. Modify the JSON values in the editor
3. Click **"Save"** to apply
4. Changes take effect immediately on next page load

---

## 13. Advisor Extensions

**Path:** Service Center → Advisor Extensions
**Permission:** `pis.advisors.view`

### What you see:
- Table of all Service Center Sales Department advisors
- Extension number and location fields

### How to use:
1. Find the advisor in the table
2. Enter the dialer **Extension** number (e.g., 1001)
3. Select **Location**: Inhouse or Remote
4. Click **"Save"** for that row
5. Green "Saved" confirmation appears briefly

---

## 14. Calls History

**Path:** Service Center → Calls History
**Permission:** `pis.dashboard.view`

### What you see:
- **7 KPI Cards:** Total Calls, Inbound, Outbound, Completed, Missed, Avg Duration, Answer Rate
- **Direction Filter:** ALL / INBOUND / OUTBOUND
- **Call Table:** Time, Direction, Agent, From, To, Customer, Status, Duration
- **AI Signals Panel** (toggle)

### How to use:
1. This shows calls **only from Service Center advisors** (not all company calls)
2. Filter by direction using the buttons
3. Click **"AI Signals"** to toggle the intelligence panel
4. Click **"Refresh"** to reload data

### Key Metrics:
- **Answer Rate** ≥ 80% = Good (green), < 80% = Needs attention (red)
- **Avg Duration** shows average call length for completed calls

---

## 15. Advisor Portal

**Path:** Service Center → Advisor Portal
**Permission:** `pis.lead_distribution.view`

### What you see:
- **Advisor Selector:** Dropdown to switch between advisors
- **5 KPI Cards:** Total Leads, Converted, Car-In, Total Calls, Answer Rate
- **4 Tabs:** Leads, Car-In, Customers, Calls
- **Search Bar:** Filter by name, phone, email, plate number
- **AI Coaching Panel** (toggle)

### Tabs:

#### Leads Tab:
- All leads assigned to the selected advisor
- Shows: Customer, Phone, Status (color-coded badge), Type, Source, Created date
- Status colors: Blue=Open, Indigo=Assigned, Amber=Onboarding, Orange=In Process, Green=Completed/Won, Red=Lost

#### Car-In Tab:
- Filtered to leads with car_in status or check-in timestamp
- Shows: Customer, Phone, Plate Number (amber highlighted), Car Model, Status, Stage, Branch, Checked In time, Service type

#### Customers Tab:
- Customers assigned to this advisor (from Data Center)
- Shows: Customer name, Phone, Email, Segment, Assigned date

#### Calls Tab:
- Call history for this advisor
- Shows: Time, Direction (IN/OUT badge), From, To, Customer, Status, Duration

### How to use:
1. **Select an advisor** from the dropdown (supervisors can view any advisor)
2. Use the **search bar** to find specific leads/customers
3. Switch between tabs to see different views
4. Click **"AI Coaching"** for AI-generated performance signals
5. Click **"Refresh"** to reload data

---

## Quick Reference — Keyboard Shortcuts

| Action | How |
|--------|-----|
| Switch advisor | Use dropdown at top right |
| Toggle AI panel | Click "AI" / "AI Coaching" / "AI Signals" button |
| Change date range | Click preset buttons (7D/30D/90D/YTD/1Y/ALL) |
| Search | Type in the search bar |
| Refresh data | Click "Refresh" button |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Service Center not in sidebar | Ensure role has `pis.dashboard.view` or `callcenter.view` permission |
| All advisor scores are 0 | Click "Refresh Scores" on the Advisors page to recompute |
| Leaderboard shows AED 0K | Leads may not be linked to advisors. Contact admin |
| Funnel shows 0 at some stages | Legacy data may not have all fields (checkin_at, gatepass). New ERP data will fill these |
| AI panel shows "Analysing..." | Wait 30-60 seconds for AI engines to generate signals |
| Date filter not working | Ensure from date is before to date. Try "ALL" preset |
| Simulation not running | Click "Run Simulation" button. Requires at least 1 advisor with scores |

---

**CONFIDENTIAL — 800CARGURU**
PIS V4.0.1 — Performance Intelligence System
