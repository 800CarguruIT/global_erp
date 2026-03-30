---
pdf_options:
  format: A4
  margin: 20mm 15mm
  printBackground: true
stylesheet: https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown.min.css
body_class: markdown-body
---

# Revenue Command Center
## Integration Plan for Global ERP + Legacy CarGuru Data

**Date:** March 30, 2026
**Module:** Revenue Command Center (RCC)
**Status:** Proposed

---

## 1. Context

The **Revenue Command Center** is a 5-tab analytics dashboard for end-to-end lead-to-cash performance tracking. It will be built as a new module in Global ERP, pulling data from **two sources**:

1. **Global ERP (native)** - Leads, invoices, call sessions, PIS advisor scores, AI engines
2. **Legacy CarGuru v2 (migrated)** - Historical customers, inspections, estimates, invoices, CHSC contracts stored in `carguru2` schema with mapping tables in `migration` schema

### Data Architecture

```
+---------------------+       +------------------------+
|   Global ERP        |       |  Legacy CarGuru v2     |
|   (public schema)   |       |  (carguru2 schema)     |
+---------------------+       +------------------------+
| leads               |       | inspections            |
| invoices            |       | estimates              |
| estimates           |       | leads                  |
| call_sessions       |       | customers              |
| customers           |       | cars                   |
| lead_bookings       |       | transactions           |
| pis_advisor_scores  |       +------------------------+
| service_contracts   |                |
+---------------------+                |
         |                   +------------------------+
         +------------------>| migration schema       |
                             | (mapping tables)       |
                             +------------------------+
                             | legacy_lead_map        |
                             | legacy_customer_map    |
                             | legacy_car_map         |
                             | legacy_inspection_map  |
                             +------------------------+
```

**Key principle**: All legacy data has been migrated into the `public` schema (leads, customers, invoices, etc.) with `legacy_*` metadata fields. The `carguru2` schema is used for runtime fallback lookups only. The RCC queries the `public` schema and gets both native + legacy data automatically.

---

## 2. Dashboard Overview

| Tab | Purpose | Key Widgets |
|-----|---------|-------------|
| **Command Center** | Executive overview | 5 KPI cards, Lead Sources donut, Live Pipeline funnel, Agent Revenue Leaderboard, Revenue Heatmap, AI Signals |
| **Lead Sources** | Source ROI analysis | End-to-end performance table per source, Source summary cards |
| **Pipeline** | Funnel health | 8-stage lifecycle, Stage cards with drop-off %, Source-Stage conversion matrix |
| **Leakage & Fix** | Revenue recovery | Leakage by stage with causes, Prioritized Fix Roadmap |
| **AI Engine** | Intelligence hub | AI signals ranked by impact, 7 engine status indicators |

---

## 3. Data Sources: Global ERP + Legacy CarGuru

### 3.1 Where Data Lives

| Data Type | Native ERP | Legacy CarGuru | How Combined |
|-----------|-----------|----------------|--------------|
| **Customers** | `customers` table | Migrated into `customers` with `code = 'CU-LEG-{id}'` | Same table - no JOIN needed |
| **Customer Segments** | `customer_type` field | CHSC customers marked via service_contracts existence | `customer_type IN ('CHSC','INSURANCE','BATTERY WARRANTY')` |
| **Leads** | `leads` table | Migrated into `leads` via 14-phase migration | Same table - transparent |
| **Inspections** | `inspections` table | Migrated + fallback via `migration.legacy_inspection_map` -> `carguru2.inspections` | JOIN for legacy details |
| **Estimates** | `estimates` table | Migrated with `meta.legacy_source = 'carguru2.estimates'` | Same table - filter by meta |
| **Invoices** | `invoices` table | Migrated with `meta.legacy_invoice_number` | Same table - transparent |
| **Calls** | `call_sessions` (Yeastar PBX) | No legacy call data | ERP-only |
| **CHSC Contracts** | `service_contracts` + `service_contract_entitlements` | Migrated from legacy CHSC packages | Same tables |
| **Insurance Data** | `insurance_data` table (46K+ rows) | Imported from legacy MySQL | Matched to customers by phone/name |
| **Marketing Spend** | **NEW** `rcc_marketing_spend` | No legacy equivalent | New table (manual entry) |

### 3.2 Customer Segmentation (Critical for RCC)

The Data Center module already segments customers from legacy CarGuru data:

| Segment | Query Logic | Source |
|---------|-------------|--------|
| **CHSC Active** | `customer_type = 'CHSC' AND is_active = TRUE` | Legacy CarGuru contracts |
| **CHSC Inactive** | `customer_type = 'CHSC' AND is_active = FALSE` | Legacy CarGuru contracts |
| **Non-CHSC Active** | `customer_type NOT IN ('CHSC','INSURANCE',...) AND is_active = TRUE` | Mixed |
| **Non-CHSC Inactive** | `customer_type NOT IN ('CHSC','INSURANCE',...) AND is_active = FALSE` | Mixed |
| **Insurance** | `customer_type IN ('INSURANCE','INSURANCE CUSTOMER')` grouped by `insurance_name` | Legacy insurance_data |
| **Warranty** | `customer_type IN ('BATTERY WARRANTY','WARRANTY')` | Legacy CarGuru |

**RCC Implication**: Revenue, pipeline, and source analytics can be filtered by customer segment, enabling comparisons like "CHSC customer revenue vs Non-CHSC" or "Insurance company ROI".

### 3.3 Revenue Data Unification

```
NATIVE INVOICES                    LEGACY INVOICES (migrated)
+---------------------------+      +----------------------------------+
| invoices.grand_total      |      | invoices.grand_total             |
| invoices.paid_at          |      | invoices.paid_at                 |
| invoices.lead_id -> leads |      | meta.legacy_source =             |
| invoices.work_order_id    |      |   'carguru2.estimates'           |
| Normal invoice numbers    |      | meta.legacy_invoice_number       |
+---------------------------+      | Invoice # = 'CG-INV-{legacy_id}'|
            |                      +----------------------------------+
            +----------+-----------+
                       |
              RCC queries both transparently
              via: SELECT FROM invoices
              WHERE company_id = $1
              AND created_at BETWEEN $2 AND $3
```

### 3.4 Lead Source Mapping

| Current Value | Dashboard Label | Data Source |
|---|---|---|
| `whatsapp` | WhatsApp | ERP native |
| `call` + `call_sessions.direction='inbound'` | Inbound Calls | Yeastar PBX |
| `call` + `call_sessions.direction='outbound'` | Outbound Calls | Yeastar PBX |
| `walk_in` | Walk-In | Both (legacy + native) |
| `website` | Website | ERP native |
| `referral` | Referral | Both |
| `ads` | Social Media | ERP native |
| **NEW** `mobile_app` | Mobile App | ERP native |
| `other` | Other | Legacy fallback |

**Legacy leads** often have `source = 'other'` or NULL because CarGuru v2 had limited source tracking. The RCC should handle this gracefully with an "Unknown/Legacy" bucket.

### 3.5 Pipeline Stage Mapping

| Dashboard Stage | Query Source | Native ERP | Legacy CarGuru |
|---|---|---|---|
| **New Lead** | `leads` | `created_at` range | Migrated leads included |
| **Contacted** | `leads` + `call_sessions` | Yeastar call match | Legacy leads may lack call data -> show as "not contacted" |
| **Qualified** | `leads` | `lead_status IN ('accepted','processing','car_in','closed_won')` | Legacy leads with these statuses included |
| **Quote Sent** | `estimates` | `estimate.lead_id` | Legacy estimates with `meta.legacy_source` included |
| **Booked** | `lead_bookings` | Active/completed bookings | Legacy leads may lack bookings (ERP-only table) |
| **Showed Up** | `leads` | `checkin_at IS NOT NULL` | Legacy car-in leads included |
| **Invoiced** | `invoices` | `invoice.lead_id` | Legacy invoices (CG-INV-*) included |
| **Cash Collected** | `invoices` | `paid_at IS NOT NULL` | Legacy paid invoices included |

**Important caveat**: Legacy CarGuru data may have gaps in the pipeline (e.g., no `call_sessions`, no `lead_bookings`). The RCC should:
- Include a date range filter defaulting to post-migration date
- Allow toggling "Include legacy data" on/off
- Show "Legacy" badge on metrics that include pre-migration data

---

## 4. Implementation Plan

### Phase 1: Backend Foundation

#### 4.1 Database Migrations

**Migration 184: `rcc_marketing_spend`**
```
- id (UUID, PK)
- company_id (UUID, FK)
- source (TEXT) - matches lead source values
- period_start, period_end (DATE)
- spend_amount (NUMERIC 14,2)
- currency (TEXT, default 'AED')
- notes (TEXT)
- created_by_user_id (UUID, FK)
- created_at, updated_at
```

**Migration 185: Permissions**
- `rcc.dashboard.view` - View Revenue Command Center
- `rcc.marketing_spend.manage` - Manage marketing spend data

#### 4.2 New Backend Module

**Location:** `packages/ai-core/src/revenue-command-center/`

| File | Purpose |
|------|---------|
| `types.ts` | Interfaces: `RccFilter` (adds `segment?` and `includeLegacy?` fields), all data types |
| `repository.ts` | SQL queries - modeled after `funnelRepository.ts` |
| `service.ts` | Orchestration with `Promise.all` parallelism |
| `aiSignalGenerator.ts` | Transforms existing engine signals into RCC categories |

**Repository Functions:**

| Function | Data Sources | Legacy Handling |
|----------|-------------|-----------------|
| `getOverviewKpis(filter)` | `invoices`, `leads`, `rcc_marketing_spend` | All invoices included (native + legacy) |
| `getPipelineFunnel(filter)` | `leads`, `call_sessions`, `estimates`, `lead_bookings`, `invoices` | Legacy leads counted; missing stages shown as 0 |
| `getLeadSourceDistribution(filter)` | `leads`, `call_sessions` | Legacy `source=NULL/'other'` grouped as "Unknown/Legacy" |
| `getAgentLeaderboard(filter)` | `pis_advisor_scores`, `leads`, `invoices` | ERP advisors only (no legacy agents) |
| `getRevenueHeatmap(filter)` | `invoices` | All invoices (native + legacy) |
| `getLeadSourcePerformance(filter)` | Multiple tables | Per-source with legacy bucket |
| `getConversionMatrix(filter)` | Multiple tables | Full matrix; legacy sources grouped |
| `getLeakageByStage(filter)` | Pipeline tables | Legacy gaps flagged separately |
| `getMarketingSpend(filter)` | `rcc_marketing_spend` | New table only (no legacy equivalent) |
| `getSegmentBreakdown(filter)` | `customers`, `invoices`, `leads` | **NEW** - Revenue by CHSC/Non-CHSC/Insurance segment |

**Key query pattern for combining native + legacy:**
```sql
-- Revenue includes both native and legacy invoices
SELECT
  COALESCE(l.source, 'unknown') as source,
  COUNT(DISTINCT l.id) as lead_count,
  SUM(i.grand_total) as revenue,
  -- Segment from customer
  CASE
    WHEN UPPER(c.customer_type) = 'CHSC' THEN 'chsc'
    WHEN UPPER(c.customer_type) LIKE '%INSURANCE%' THEN 'insurance'
    ELSE 'non_chsc'
  END as segment
FROM leads l
LEFT JOIN customers c ON c.id = l.customer_id
LEFT JOIN invoices i ON i.lead_id = l.id
WHERE l.company_id = $1
  AND l.created_at BETWEEN $2 AND $3
GROUP BY source, segment
```

#### 4.3 Type Updates

Update `LeadSource` in `packages/ai-core/src/crm/leads/types.ts`:
- Add: `mobile_app`, `social_media`, `inbound_call`, `outbound_call`

Add to `RccFilter`:
```typescript
interface RccFilter {
  companyId: string;
  from: string;
  to: string;
  branchId?: string;
  segment?: 'all' | 'chsc' | 'non_chsc' | 'insurance' | 'warranty';
  includeLegacy?: boolean; // default true
}
```

### Phase 2: API Routes

**Base path:** `apps/web/app/api/company/[companyId]/revenue-command-center/`

| Route | Method | Returns | Params |
|---|---|---|---|
| `overview/route.ts` | GET | Tab 1 data | `from, to, segment?, includeLegacy?` |
| `lead-sources/route.ts` | GET | Tab 2 data | `from, to, segment?` |
| `pipeline/route.ts` | GET | Tab 3 data | `from, to, segment?` |
| `leakage/route.ts` | GET | Tab 4 data | `from, to` |
| `ai-engine/route.ts` | GET | Tab 5 data | `from, to` |
| `marketing-spend/route.ts` | GET, POST | Spend CRUD | `from, to, source?` |

### Phase 3: Frontend

**Page:** `apps/web/app/company/[companyId]/revenue-command-center/page.tsx`

Single `"use client"` page with 5 tabs, dark theme, Recharts.

**Filters (global, above tabs):**
- Date range picker (default: current month)
- Customer segment dropdown: All / CHSC / Non-CHSC / Insurance / Warranty
- "Include legacy data" toggle (default: on)

**Tab 1 - Command Center:**
- 5 KPI cards (Total Revenue, RPL, Lead->Sale Rate, CPA, Revenue Leakage)
- Lead Sources donut chart (with "Unknown/Legacy" bucket)
- Live Pipeline funnel (8 stages, drop-off %)
- Agent Revenue Leaderboard (sortable: Revenue / RPL / Conv%)
- Revenue Heatmap (day x hour grid)
- AI Revenue Intelligence signals (top 4)

**Tab 2 - Lead Sources:**
- End-to-end performance table per source (Leads -> Qualified -> Booked -> Showed -> Converted -> Revenue -> RPL -> CPA -> ROI)
- Source summary cards with mini progress bars

**Tab 3 - Pipeline:**
- 8-stage lifecycle funnel visualization
- Stage cards (count, AED value, drop%, leads lost)
- Source-to-Stage conversion matrix

**Tab 4 - Leakage & Fix:**
- 4 KPI cards (Total Leakage, Leads Lost, Biggest Leak, Fastest Fix)
- Stage-by-stage leakage with causes and suggested fixes
- Fix Roadmap (prioritized actions with effort/timeline/AED)

**Tab 5 - AI Engine:**
- 4 KPI cards (Total AI Impact, Active Signals, Avg Confidence, Engines Active)
- Full signal list sorted by recoverable revenue
- 7 engine status cards

### Phase 4: Navigation

Add to `packages/ui/src/layout/sidebarConfig.ts` (company Main section):
```typescript
{ label: "Revenue Command Center", href: "/company/[companyId]/revenue-command-center",
  permissionKeys: ["rcc.dashboard.view"] }
```

---

## 5. Legacy Data Considerations

### 5.1 What Works Seamlessly

| Feature | Why It Works |
|---------|-------------|
| Total Revenue | All invoices (native + legacy) in same `invoices` table |
| Customer count | All customers in same `customers` table |
| Revenue by segment | `customer_type` field populated for legacy customers |
| Insurance company breakdown | `insurance_name` synced from `insurance_data` table |
| Car-in counts | Legacy leads have `checkin_at` populated during migration |
| Estimate values | Legacy estimates migrated with financial fields intact |

### 5.2 What Needs Special Handling

| Feature | Issue | Solution |
|---------|-------|----------|
| Lead source distribution | Legacy leads often have `source = NULL` or `'other'` | Add "Unknown/Legacy" bucket; don't penalize source ROI |
| Call-based stages (Contacted) | No `call_sessions` for legacy leads | Skip "Contacted" stage for legacy; use `first_response_at` as fallback |
| Booking stage | `lead_bookings` table is ERP-only | Legacy leads skip this stage; note as "data gap" |
| Agent leaderboard | Legacy agents not in PIS system | Show ERP advisors only; add footnote about date range |
| Revenue heatmap | Legacy invoice timestamps may be bulk-import times, not actual | Filter by `created_at > migration_date` for accurate heatmap |
| CPA / ROI | No marketing spend data (native or legacy) | `rcc_marketing_spend` starts empty; show "N/A" until populated |

### 5.3 Recommended Date Strategy

```
Pre-migration (legacy):    Revenue + Customer data available
                           Pipeline stages partially available
                           No call data, limited source data

Post-migration (native):   Full pipeline, calls, sources, AI signals
                           Full real-time tracking

Default date range:        Current month (post-migration)
Historical view:           Toggle "Include legacy data" for full history
```

---

## 6. Files to Create / Modify

### New Files (13)

| File Path |
|-----------|
| `packages/ai-core/migrations/184_rcc_marketing_spend.sql` |
| `packages/ai-core/migrations/185_rcc_permissions.sql` |
| `packages/ai-core/src/revenue-command-center/types.ts` |
| `packages/ai-core/src/revenue-command-center/repository.ts` |
| `packages/ai-core/src/revenue-command-center/service.ts` |
| `packages/ai-core/src/revenue-command-center/aiSignalGenerator.ts` |
| `apps/web/app/api/company/[companyId]/revenue-command-center/overview/route.ts` |
| `apps/web/app/api/company/[companyId]/revenue-command-center/lead-sources/route.ts` |
| `apps/web/app/api/company/[companyId]/revenue-command-center/pipeline/route.ts` |
| `apps/web/app/api/company/[companyId]/revenue-command-center/leakage/route.ts` |
| `apps/web/app/api/company/[companyId]/revenue-command-center/ai-engine/route.ts` |
| `apps/web/app/api/company/[companyId]/revenue-command-center/marketing-spend/route.ts` |
| `apps/web/app/company/[companyId]/revenue-command-center/page.tsx` |

### Modified Files (3)

| File | Change |
|------|--------|
| `packages/ai-core/src/crm/leads/types.ts` | Extend `LeadSource` type |
| `packages/ai-core/src/index.ts` | Export new RCC module |
| `packages/ui/src/layout/sidebarConfig.ts` | Add navigation entry |

---

## 7. Existing Code Reuse

| What | File | Reuse For |
|------|------|-----------|
| Funnel queries | `packages/ai-core/src/pis/funnelRepository.ts` | Pipeline stage counting |
| Service pattern | `packages/ai-core/src/pis/service.ts` | Promise.all orchestration |
| AI signals | `packages/ai-core/src/intelligence/orchestratorService.ts` | Engine signal transformation |
| Advisor scores | `pis_advisor_scores` table | Agent leaderboard |
| API pattern | `apps/web/app/api/company/[companyId]/pis/master/route.ts` | Auth + date parsing |
| Segment logic | `packages/ai-core/src/customer-data-center/repository.ts` | CHSC/Insurance segmentation queries |
| Legacy lookups | `migration.legacy_*_map` tables | Historical data enrichment |

---

## 8. Key Formulas

| Metric | Formula |
|--------|---------|
| **Revenue Per Lead (RPL)** | `SUM(invoices.grand_total) / COUNT(DISTINCT leads.id)` |
| **Lead-to-Sale Rate** | `COUNT(invoices with paid_at) / COUNT(leads) * 100` |
| **Cost Per Acquisition (CPA)** | `SUM(marketing_spend) / COUNT(closed_won leads)` |
| **ROI per Source** | `(Revenue - Spend) / Spend * 100` |
| **Revenue Leakage** | `SUM(leads_lost_at_stage * avg_deal_value)` per stage |
| **Average Deal Value** | `SUM(invoices.grand_total) / COUNT(invoices)` |
| **Stage Drop-off %** | `(count_N - count_N+1) / count_N * 100` |
| **CHSC Revenue Share** | `SUM(invoices WHERE customer.type='CHSC') / SUM(all invoices) * 100` |

---

## 9. AI Engine Mapping

| Dashboard Engine | Maps To | Signal Source |
|---|---|---|
| Revenue Leak Detection | E1 (Funnel) + E3 (Revenue) | Leakage signals |
| Source ROI Optimizer | E3 (Revenue) | Source performance |
| Channel Shift Engine | E3 (Revenue) | Channel comparison |
| Booking Drop Analyzer | E1 (Funnel) | Booking drop-offs |
| Upsell Intelligence | E3 (Revenue) | Upsell opportunities |
| Referral Growth Engine | E3 (Revenue) | Referral performance |
| Anomaly Detection | E5 (Anomaly) | Anomaly signals |

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Legacy leads lack source data | Source ROI skewed by "Unknown" bucket | Default to post-migration dates; toggle for legacy |
| Legacy leads skip pipeline stages | Funnel drop-offs inflated | Flag legacy gaps; exclude from leakage calc when toggled |
| CPA/ROI needs marketing spend | Shows N/A until populated | Admin form + CSV import; placeholder UI |
| Legacy invoice timestamps | Heatmap inaccurate for bulk-imported data | Filter heatmap to post-migration only |
| Large data volume (legacy + native) | Slow queries | Date-range indexes; 5-min cache; pagination |

---

## 11. Verification Plan

1. Run migrations 184-185, verify tables in DB
2. Seed `rcc_marketing_spend` with test data
3. Hit each API endpoint with `?from=2026-03-01&to=2026-03-30`
4. Test with `&segment=chsc` and `&segment=insurance` filters
5. Test with `&includeLegacy=false` to verify native-only view
6. Load page at `/company/{id}/revenue-command-center`
7. Verify all 5 tabs render with real data
8. Cross-reference pipeline counts with PIS funnel (`/pis/funnel`)
9. Verify AI signals from engines E1, E3, E5
10. Test segment filter switches CHSC vs Non-CHSC revenue correctly
11. Verify legacy invoices (CG-INV-*) appear in revenue totals
12. Check "Unknown/Legacy" source bucket for pre-migration leads

---

*Document generated: March 30, 2026*
*Module: Revenue Command Center (RCC) for Global ERP + Legacy CarGuru v2*