# SERVICE CENTER — Performance Intelligence System (PIS V4.0)
## 800CarGuru Sales Exchange Engine

| Field | Value |
|-------|-------|
| **Document Type** | Service Center Dashboard Module — PIS V4.0 |
| **Delivery Date** | March 30, 2026 |
| **Version** | 4.0.1 — Lead Distribution + AI Intelligence |
| **Classification** | CONFIDENTIAL — Internal Use Only |

---

## OVERVIEW

The Service Center module is a comprehensive Performance Intelligence System (PIS) built into the Global ERP platform. It provides real-time visibility into service advisor performance, lead management, revenue tracking, and AI-driven operational intelligence for the 800CarGuru service center operation.

The system pulls data from two sources:
1. **Legacy CarGuru2** — 433,512 leads, 324,624 estimates, 156,745 invoices (AED 100M+ revenue)
2. **Global ERP** — New leads, estimates, invoices, call sessions created through the ERP

All 22 Service Center Sales Department advisors are tracked with composite performance scores, commission calculations, and automated lead distribution.

---

## 13 DASHBOARD MODULES

| # | Module | Route | Function |
|---|--------|-------|----------|
| 1 | **Master** | `/pis/master` | 8 KPI cards, FOC banner, 9-stage funnel, advisor leaderboard, 12 SLA measurements, AI Intelligence sidebar |
| 2 | **Advisors** | `/pis/advisors` | Full advisor table (22 advisors), V4 composite score formula with GP%, conversion rate, call quality, SLA compliance, tier classification (ELITE/STANDARD) |
| 3 | **Lead Distribution** | `/pis/lead-distribution` | Auto-assignment engine, score-ranked routing, tier cascade (10/7/5 min windows), accept timers, lock/release (120 min), penalty system, 60-lead live simulation |
| 4 | **Funnel** | `/pis/funnel` | 9-stage mega funnel with volume, conversion %, SLA per gate, date range filter, stage-over-stage conversion analysis |
| 5 | **Estimates** | `/pis/estimates` | Approval rate, rejection value (AED), unapproved pipeline, pending > SLA, per-advisor breakdown |
| 6 | **WIP** | `/pis/wip` | Active WIP, capacity, on-time %, pickup rate, zero-revenue WIP flagged |
| 7 | **Collections** | `/pis/collections` | Revenue/cost/GP, collection rate, DSO, overdue tracking, per-advisor GP%, date range filter |
| 8 | **AI Engines** | `/pis/engines` | All 7 AI engines: Funnel (e1), Agent Performance (e2), Revenue Forecasting (e3), Churn & Retention (e4), Anomaly Detection (e5), Collections (e6), Coaching (e7) |
| 9 | **Signals** | `/pis/signals` | Full signal library with observation, diagnosis, action, urgency (HIGH/MED/LOW), owner, confidence %. Filter by urgency level |
| 10 | **Admin** | `/pis/admin` | Score weights, commission rates, SLA thresholds, tier boundaries, lead distribution config, revenue targets — all editable JSON config |
| 11 | **Advisor Extensions** | `/pis/extensions` | Assign dialer extensions + location (inhouse/remote) for all service center advisors |
| 12 | **Calls History** | `/pis/calls` | Call history for all SC agents with 7 KPI cards (total, inbound, outbound, completed, missed, avg duration, answer rate), direction filter, AI Intelligence panel |
| 13 | **Advisor Portal** | `/pis/advisor-portal` | Per-advisor management with 4 tabs (Leads, Car-In, Customers, Calls), KPIs, search filter, AI Coaching panel |

---

## LEAD DISTRIBUTION ALGORITHM

1. New lead enters system → System ranks ALL advisors by composite score (descending)
2. Lead routes to #1 highest-score AVAILABLE advisor. Tier 1 (ELITE) gets first access
3. Accept window: Tier 1 = 10 min, Tier 2 = 7 min, Tier 3 = 5 min. Configurable in Admin
4. If not accepted within window → auto-cascade to next highest-score advisor. Penalty applied
5. Once accepted → Lead LOCKED for 120 min (or until first call logged). Zero overlap enforced
6. If no call logged within lock period → auto-release + 5-point score penalty. Lead re-enters queue
7. Max 5 cascade attempts before lead enters manual queue. Failed leads flagged to Ops Manager
8. 60-lead live simulation shows algorithm in action: acceptance, cascades, timeouts, failures, pipeline value
9. Commission engine integrated: base 3%, performance 5%, top 7-8%. GP floor enforced. FOC penalty applied
10. All distribution parameters configurable in Admin Panel

---

## ADVISOR COMPOSITE SCORE — V4 FORMULA

The composite score determines advisor ranking, tier classification, lead priority, and commission rates.

| Metric | Weight | Source |
|--------|--------|--------|
| Conversion Rate | 25% | leads closed_won / total leads |
| GP % | 20% | (invoice revenue - estimate cost) / revenue |
| Revenue | 15% | SUM(invoices.grand_total) normalized to 100K |
| SLA Compliance | 15% | estimate approval rate |
| Customer Satisfaction | 10% | call completion rate as proxy |
| Call Quality | 10% | completed calls / total calls |
| FOC Penalty | -5% | % of zero-revenue invoices (negative weight) |

**Tier Classification:**
- **ELITE** (score >= 30): First access to all leads, 10-min accept window, higher commission
- **STANDARD** (score < 30): Standard access, 5-7 min accept window, base commission

---

## COMMISSION ENGINE

| Tier | Base % | Performance % | Top % | GP Floor |
|------|--------|---------------|-------|----------|
| STANDARD | 3% | — | — | — |
| ELITE | 3% | 5% | 7-8% (rank 1-3) | 20% GP minimum |

- FOC penalty: AED 500 per FOC unit deducted from commission
- Commission = (Revenue × Effective %) - FOC Deduction
- All rates configurable in Admin → Commission Rates

---

## 9-STAGE FUNNEL

| Stage | Gate | SLA Target | Source |
|-------|------|------------|--------|
| 1 | Lead Arrives | < 2 min | leads table |
| 2 | Assigned & Accepted | < 15 min | leads.agent_employee_id IS NOT NULL |
| 3 | First Contact | < 5 min post-accept | call_sessions joined to leads |
| 4 | Booking Confirmed | < 24h | leads.lead_status IN (accepted, car_in, closed_won) |
| 5 | Car-In | < 30 min of appointment | leads.checkin_at IS NOT NULL |
| 6 | Estimate Approved | < 30 min post check-in | estimates.status IN (approved, Invoiced) |
| 7 | WIP Complete | Per service SLA | work_orders.status = completed |
| 8 | Invoice & Payment | < 30 min post-job | invoices table |
| 9 | Vehicle Pickup | Same day | gatepasses table |

---

## 12 SLA MEASUREMENTS

| # | SLA | Target | Source Engine |
|---|-----|--------|--------------|
| 1 | Lead arrival → assignment | < 2 min | Funnel Intelligence |
| 2 | Assignment → accept/decline | < 15 min | Funnel Intelligence |
| 3 | Accept → first contact | < 5 min | Funnel Intelligence |
| 4 | First contact → booking | < 24h | Funnel Intelligence |
| 5 | Booking → car-in on-time % | >= 80% | Funnel Intelligence |
| 6 | Car-in → estimate created | < 30 min | Funnel Intelligence |
| 7 | Estimate approval rate | >= 75% | Agent Performance |
| 8 | WIP job on-time completion | >= 85% | Anomaly Detection |
| 9 | Customer update if WIP delayed | 100% notified | Anomaly Detection |
| 10 | Job complete → invoice | < 30 min | Agent Performance |
| 11 | Invoice paid → vehicle pickup | < 4 hours | Anomaly Detection |
| 12 | Invoice paid → post-sale follow-up | < 48 hr | Agent Performance |

---

## 7 AI INTELLIGENCE ENGINES

| Engine | Key | Function |
|--------|-----|----------|
| Funnel Intelligence | e1 | Conversion funnel analysis, drop-off detection, bottleneck identification |
| Agent Performance | e2 | Per-advisor coaching signals, performance trends, improvement actions |
| Revenue Forecasting | e3 | 72h revenue forecast vs target, risk identification |
| Churn & Retention | e4 | Customer churn prediction, retention signals |
| Anomaly Detection | e5 | SLA breaches, unusual patterns, operational anomalies |
| Collections Intelligence | e6 | Payment tracking, overdue alerts, collection optimization |
| Coaching Intelligence | e7 | Personalized coaching plans, skill gap analysis |

Each engine produces **Diagnostic** (what is happening), **Predictive** (what will happen), and **Prescriptive** (what to do) signals with urgency levels, confidence scores, owner assignment, and response deadlines.

---

## 8 MASTER KPIs

| KPI | Source | Description |
|-----|--------|-------------|
| Total Revenue | invoices.grand_total | Total invoiced revenue for the period |
| Team GP% | (revenue - cost) / revenue | Gross profit margin across all advisors |
| Team FOC Rate | zero-revenue invoices / total | Free-of-charge rate (target < 30%) |
| Cars In MTD | leads.checkin_at count | Vehicles checked in month-to-date |
| Active WIP | work_orders not completed | Jobs currently in progress |
| Unapproved Est. | estimates not approved | Pipeline value at risk |
| Commission Pool | pis_commission_records | Total commission earned by team |
| Zero Revenue | advisors with AED 0 | Advisors generating no billable revenue |

---

## DATABASE TABLES (PIS-Specific)

| Table | Purpose |
|-------|---------|
| `pis_config` | Company-scoped JSONB configuration (score weights, commission rates, SLA thresholds, tier boundaries, lead distribution params) |
| `pis_advisor_scores` | Materialized composite scores per advisor per period |
| `pis_lead_queue` | Lead distribution routing queue with cascade tracking |
| `pis_lead_queue_history` | Audit trail of all routing decisions |
| `pis_commission_records` | Monthly commission calculations per advisor |
| `pis_sla_snapshots` | SLA compliance measurement snapshots |

---

## PERMISSIONS (11 Granular)

| Permission Key | Description |
|----------------|-------------|
| `pis.dashboard.view` | View PIS master dashboard |
| `pis.advisors.view` | View advisor scores and leaderboard |
| `pis.lead_distribution.view` | View lead distribution queue |
| `pis.lead_distribution.manage` | Manage lead routing |
| `pis.funnel.view` | View funnel analytics |
| `pis.estimates.view` | View estimate pipeline |
| `pis.wip.view` | View WIP tracking |
| `pis.collections.view` | View collections and revenue |
| `pis.engines.view` | View AI engines |
| `pis.signals.view` | View AI signals |
| `pis.admin.manage` | Manage PIS admin configuration |

Auto-granted to `global_admin` and `company_admin` roles.

---

## TECHNOLOGY STACK

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS |
| Backend | Next.js API Routes, PostgreSQL, postgres.js |
| AI | Anthropic Claude (via @anthropic-ai/sdk), 7 intelligence engines |
| Charts | recharts (installed, available for visualization) |
| Theme | Midnight Neon (dark), 5 themes available |
| Auth | Session-based, RBAC with granular permissions |

---

## KEY PRINCIPLE

> **Speed + performance = more leads. The system promotes and demotes without human intervention. Top performers get first access. Bottom performers get restricted access. Zero-revenue advisors get nothing.**

---

**CONFIDENTIAL — 800CARGURU**
PIS V4.0.1 — Performance Intelligence System + Lead Distribution Engine
