# SALES CENTER MODULE
## Complete System Documentation

**Global ERP System**
**Date: March 29, 2026**
**Version: 1.0**

---

## Table of Contents

1. Executive Summary
2. Call Management (Inbound/Outbound)
3. Call History & Recordings
4. Agent Management
5. Agent Dashboard
6. Supervisor Performance Summary
7. Master Performance Dashboard
8. Lead Creation & AI Workflow
9. Data Center & Customer Assignment
10. AI Intelligence Layer
11. Customer List
12. API Reference
13. Configuration & Settings

---

## 1. Executive Summary

The Sales Center module is a comprehensive telephony and CRM platform integrated into the Global ERP system. It provides end-to-end call management, agent performance tracking, AI-powered insights, and automated lead generation.

**Key Capabilities:**
- Yeastar PBX integration via Linkus SDK for browser-based calling
- Real-time call tracking with webhook-driven status updates
- AI-powered call analysis with automatic lead creation
- Agent performance scoring with configurable thresholds
- Inhouse vs Remote team comparison dashboards
- Three AI intelligence engines (e2, e7, e8) generating diagnostic, predictive, and prescriptive signals
- Customer assignment and segmentation (CHSC, Non-CHSC, Insurance)

---

## 2. Call Management (Inbound/Outbound)

### 2.1 Inbound Call Flow
1. Customer dials company number
2. Yeastar PBX routes call to agent extension
3. PBX sends webhook to `POST /api/webhooks/dialer/yeastar`
4. System creates `call_session` record with status `ringing`
5. Agent answers -> PBX sends status update -> status becomes `in_progress`
6. Call ends -> PBX sends CDR webhook -> status becomes `completed` with duration
7. System matches caller number to existing customer (if found)
8. AI workflow evaluates call for lead creation eligibility

### 2.2 Outbound Call Flow
1. Agent clicks call button on customer card (Agent Dashboard) or uses Outbound Dialer
2. Browser Linkus SDK initiates call via PBX
3. System creates `call_session` with direction `outbound`
4. PBX routes call through configured outbound trunk
5. Webhook updates track call progress (ringing -> in_progress -> completed)
6. Call recording is captured and stored

### 2.3 Call Statuses
| Status | Description | Color |
|--------|-------------|-------|
| initiated | Call creation requested | Blue |
| ringing | Ringing on recipient device | Amber |
| in_progress | Call connected and active | Amber |
| completed | Call successfully ended | Green |
| failed | Call failed to connect | Red |
| cancelled | Call cancelled before completion | Red |

### 2.4 Yeastar SDK Integration
- **Connection**: Linkus SDK connects to PBX via `carguru.ras.yeastar.com`
- **Authentication**: API credentials (accessId, accessKey, username, password)
- **Extension Assignment**: Each agent has a PBX extension stored in `users.mobile`
- **Webhook Events**: 30012 (Call End Details Notification), 30020 (uaCSTA Call Report)
- **Auto Answer**: Configurable per integration

---

## 3. Call History & Recordings

### 3.1 Call History Page
**Route**: `/company/{companyId}/call-center/history`

**Features:**
- Direction filter: All / Inbound / Outbound
- KPI bar: Total Calls, Inbound, Outbound, Completed, Missed, Avg Duration, Answer Rate
- Sortable columns: Customer, Direction, From, To, Status, Started, Agent
- Inline notes: Add/edit notes per call with save button
- Recording playback: HTML5 audio player with download
- "Resolve Recording" button to fetch recording from PBX if not yet available

### 3.2 AI Inquiries Tab
Displays calls analyzed by AI for lead generation potential:
- Filters: All / Not Converted / Converted
- Shows: Customer match, verification status, AI analysis confidence, lead type
- Actions: Verify, Analyze (AI), Convert to Lead, Set Lead Type

### 3.3 Call Recordings
- Recordings captured automatically by Yeastar PBX
- Stored with call session reference
- Accessible via authenticated proxy endpoint
- Duration tracking for quality monitoring

---

## 4. Agent Management

### 4.1 User Extensions Page
**Route**: `/company/{companyId}/integrations/dialer/extensions`

- Assign PBX extension numbers to agents (stored in `users.mobile`)
- Set agent location: **Inhouse** or **Remote** (stored in `users.dialer_location`)
- View all company users with their extension status
- Extension used for call routing and agent identification

### 4.2 Agent Roles & Permissions
| Role | Access Level |
|------|-------------|
| Agent | Own dashboard, assigned customers, make calls |
| Supervisor | Agent reports, Data Center, team KPIs |
| Company Admin | Full access: settings, thresholds, all agents |

### 4.3 Agent Location Tracking
- `inhouse`: Agents working from office
- `remote`: Agents working from home
- Used for team split in Master Dashboard and AI comparison signals
- Default: `inhouse` if not set

---

## 5. Agent Dashboard

**Route**: `/company/{companyId}/call-center/agent-dashboard`

### 5.1 Header
- Agent avatar and name
- Agent selector dropdown (visible to managers/admins only)
- Refresh button
- AI Insights toggle button

### 5.2 KPI Cards (6 metrics)
| KPI | Description | Color Coding |
|-----|-------------|--------------|
| Assigned | Active customers assigned to agent | Blue |
| Contacted | Customers agent has called | Green |
| Pending | Customers awaiting follow-up | Amber |
| Total Calls | All calls made/received | White |
| Answer Rate | Completed / Total calls | Green >= 80%, Amber >= 50%, Red < 50% |
| Avg Duration | Average call length | Gray |

### 5.3 Call History Tab
- Relative timestamps ("just now", "5m ago", "2h ago")
- Direction icons: Inbound (green down arrow), Outbound (blue up arrow)
- Phone numbers in monospace font
- Customer name linked (if matched)
- Status badges with color coding
- Duration in MM:SS format

### 5.4 Customers Tab
- **Search**: Real-time filter by name, phone, email
- **Segment Filter**: All / CHSC / Non-CHSC / Insurance (toggle buttons)
- **Customer Name**: Clickable link to customer dashboard (blue text)
- **Call Button**: Phone icon next to each number - click to dial directly
- **Segment Badge**: Color-coded pill (CHSC: purple, Insurance: blue, Non-CHSC: gray)
- **Assigned Date**: Formatted date

### 5.5 AI Coaching Sidebar (Right Panel)
- Fixed 420px sidebar on desktop (bottom sheet on mobile)
- Engines: e2 (Agent Performance) + e7 (Coaching Intelligence)
- Shows Diagnostic, Predictive, Prescriptive signals
- Auto-refreshes every 5 minutes
- Signal cards with urgency badges (HIGH: red, MED: amber, LOW: green)

### 5.6 Access Control
- Agents see only their own data (locked to own userId)
- Supervisors can view their team's agents
- Admins can select any agent from dropdown

---

## 6. Supervisor Performance Summary

**Route**: `/company/{companyId}/call-center/performance`

### 6.1 Header
- Title: "Sales Center Performance"
- Agent count display
- Date range picker (from/to datetime-local)
- "Today" quick-reset button
- Refresh button
- AI Insights toggle

### 6.2 KPI Cards (6 cards with delta comparison)
| KPI | Icon | Delta | Color Logic |
|-----|------|-------|-------------|
| Total Calls | Phone | vs yesterday % | White |
| Answer Rate | Check | vs yesterday % | Green/Amber/Red thresholds |
| Avg Duration | Clock | vs yesterday % | White |
| Collection | Currency | vs yesterday % | White |
| Appointments | Calendar | vs yesterday % | White |
| CHSC Conv. | Target | Target line | Green if >= target, else Amber |

Delta arrows: Green up arrow for positive, Red down arrow for negative.

### 6.3 Agent Rankings Table
Sorted by performance score (descending):
- **Rank**: Sequential number
- **Agent Name**: Full name or extension
- **Score**: Visual progress bar (0-100) with color gradient
- **Calls / Held / Held% / Miss%**: Call volume metrics
- **Avg Duration**: MM:SS format
- **CHSC Sold / CHSC In / Conv%**: CHSC conversion metrics
- **Non-CHSC / Appt Today / Appt Tmrw**: Additional metrics
- **Collection / Rev/Call**: Revenue metrics
- **Badge**: Performance badge with dot indicator

### 6.4 Performance Badges
| Badge | Score | Color |
|-------|-------|-------|
| Excellent | >= 85 | Emerald |
| Good | >= 70 | Cyan |
| Average | >= 50 | Amber |
| Needs Improvement | < 50 | Rose |

### 6.5 Performance Score Formula
```
Score = (Held Rate % x 40 + CHSC Conv % x 25 + Rev/Call normalized x 20 + Appointments normalized x 15) / 100
```
All weights configurable via admin settings.

### 6.6 AI Intelligence Sidebar
- Fixed right panel (420px) with e8 engine
- Shows Diagnostic, Predictive, Prescriptive tabs
- Compares inhouse vs remote agent groups
- Signal examples:
  - "Agent X held rate 15pp below average - schedule coaching"
  - "CHSC conversion trending down 20% - review scripts"
  - "Remote team outperforming inhouse by 10% in answer rate"

---

## 7. Master Performance Dashboard

**Route**: `/company/{companyId}/master-dashboard`

### 7.1 Top 5 KPI Cards
| KPI | Format | Comparison |
|-----|--------|------------|
| Total Revenue | AED currency | vs previous period % |
| Total Bookings | Count | vs previous period % |
| Total Calls Handled | Count | vs previous period % |
| Show-Up Rate | Percentage | vs previous period % |
| Total Cancellations | Count | vs previous period % |

### 7.2 Team Performance Summary
Three team rows in table:
- **Inhouse Team**: Office-based agents with KPIs
- **Remote Team**: Remote agents with KPIs
- **Portfolio Team**: Account management metrics

Each row shows: Total Calls, Answer Rate, Bookings, Conversion Rate, Score, Grade (A+ to D)

### 7.3 Inhouse vs Remote Team (Side-by-Side)
Two columns displayed simultaneously for easy comparison:

**Per Team (Inhouse/Remote):**
- 4 KPI cards: Total Calls, Answer Rate, Avg Duration, Abandonment Rate
- Call Trend sparkline chart
- 3 KPI rows with progress bars: Answer Rate, Abandonment, Score
- Status badges: Excellent/Good/Warning/Poor

### 7.4 Conversion Funnel
Visual funnel showing: Total Calls -> Connected -> Leads Created -> Bookings -> Show-Ups -> Revenue
Overall conversion rate displayed.

### 7.5 Portfolio Team Section
- 6 KPI cards: Active Accounts, Monthly Touchpoints, Return Bookings, Return Revenue, Upsell Rate, Retention Rate
- Revenue Breakdown pie chart (Workshop / RSA / Recovery / Other)
- Top Performers table (MTD)
- Needs Attention alerts

### 7.6 AI Intelligence Sidebar
- e8 engine with inhouse vs remote comparison
- Diagnostic signals for held rate gaps
- Predictive signals for collection trajectory
- Prescriptive signals for coaching actions

---

## 8. Lead Creation & AI Workflow

### 8.1 AI-Powered Lead Creation (Automatic)
1. Inbound call received and recorded
2. AI analyzes call recording (OpenAI/Anthropic)
3. Extracts: caller intent, vehicle plate, service type, location
4. Creates `call_ai_inquiry` record with analysis results
5. If `auto_convert_eligible = true` and policy mode is `live`:
   - Automatically creates lead with extracted data
   - Sets `conversion_status = 'converted'`
   - Links to matched customer (if found by phone number)

### 8.2 Manual Lead Creation from CRM
1. Agent views Call History or AI Inquiries tab
2. Clicks "Convert to Lead" on an inquiry
3. System creates lead with pre-populated data:
   - Customer (matched by phone or new)
   - Lead type: RSA / Recovery / Workshop
   - Source: Call inquiry
   - Car plate (if extracted by AI)
4. Agent can also click "Create Lead" from any call in history
5. Redirects to lead creation form with pre-filled phone/customer data

### 8.3 AI Inquiry Analysis
When "Analyze (AI)" is clicked:
- Fetches call recording from PBX
- Sends to AI for transcription and analysis
- Extracts: lead type, request type, plate number, location, caller name, mobile, summary
- Calculates confidence score (0-100%)
- Determines auto-convert eligibility

### 8.4 Call AI Policy
Configurable per company:
- **dry_run mode**: AI analyzes but doesn't auto-convert (logging only)
- **live mode**: AI auto-converts eligible inquiries to leads
- **Business hours**: Restrict AI processing to configured hours
- **Restrictions**: Block unknown numbers, blocked/allowed prefixes
- **Guidance**: Welcome message, system prompt, escalation keywords

---

## 9. Data Center & Customer Assignment

**Route**: `/company/{companyId}/data-center`

### 9.1 Auto-Assign Customers
- Select agent from dropdown (active agents only)
- Set total customers to assign (default: 100)
- Configure distribution percentages:
  | Segment | Description |
  |---------|-------------|
  | CHSC Active | Active CHSC customers |
  | CHSC Inactive | Inactive CHSC customers |
  | Non-CHSC Active | Active non-CHSC customers |
  | Non-CHSC Inactive | Inactive non-CHSC customers |
  | Insurance | Insurance customers |
- Total must equal 100% (live validation)
- "Set Equal (20%)" quick button
- Results show: assigned count per segment

### 9.2 Agent Performance Report
Table showing all agents with:
- Total Assigned, Total Calls, Answered, Failed
- Call Duration, Total Leads, Total Collection
- Answer Rate %, Performance Score, Performance Label

### 9.3 KPIs per Agent
- Assigned Customers, Contacted, Pending
- Total Calls, Answered, Failed
- Answer Rate %, Avg Call Duration

### 9.4 Export
- Excel and PDF export for agent reports
- Filtered by date range and segment

---

## 10. AI Intelligence Layer

### 10.1 Engine Architecture
The system uses Anthropic Claude Sonnet 4.6 with 8 specialized engines:

| Engine | Name | Used In |
|--------|------|---------|
| e1 | Funnel Intelligence | Lead pipeline analysis |
| e2 | Agent Performance | Agent Dashboard sidebar |
| e3 | Revenue Forecasting | Revenue predictions |
| e4 | Churn & Retention | Customer risk scoring |
| e5 | Anomaly Detection | Statistical anomaly alerts |
| e6 | Collections Intelligence | Overdue invoice ranking |
| e7 | Coaching Intelligence | Agent Dashboard sidebar |
| e8 | Sales Center Performance Intelligence | Performance Summary + Master Dashboard |

### 10.2 Signal Types
- **Diagnostic**: Root cause analysis ("Why is held rate dropping?")
- **Predictive**: Trend forecasting ("Collection will decline 15% next week")
- **Prescriptive**: Action recommendations ("Schedule coaching for Agent X within 48h")

### 10.3 Signal Fields
Each signal includes: type, metric, observation, diagnosis, action, urgency (HIGH/MED/LOW), owner_role, respond_by_hours, confidence (0.0-1.0), expected_outcome

### 10.4 e8 Engine: Sales Center Performance Intelligence
**Focus areas:**
- Agents with held rate significantly below company average
- CHSC conversion imbalances
- Agents with high call volume but zero appointments
- Top performers to recognise
- Collection-per-call outliers
- **Inhouse vs Remote comparison**: Flags gaps between groups

**Data payload includes:**
- Per-agent: total_calls, held_calls, held_rate_pct, held_rate_delta_pct, chsc metrics, collection, appointments
- Group summaries: inhouse_summary, remote_summary (agents count, held rate, total calls)

### 10.5 Caching & Refresh
- 5-minute in-memory cache per company/engine
- Configurable refresh interval (1-60 min) per engine
- Cache invalidated on config update

### 10.6 Admin Configuration
**Route**: `/company/{companyId}/settings/call-center/performance`

**Configurable Thresholds:**
| Threshold | Default | Controls |
|-----------|---------|----------|
| badge_excellent_min | 85 | Excellent badge cutoff |
| badge_good_min | 70 | Good badge cutoff |
| badge_average_min | 50 | Average badge cutoff |
| held_rate_green_min | 80 | Green color threshold |
| held_rate_amber_min | 50 | Amber color threshold |
| weight_held_rate | 40 | Score weight % |
| weight_chsc_conversion | 25 | Score weight % |
| weight_revenue_per_call | 20 | Score weight % |
| weight_appointments | 15 | Score weight % |
| target_chsc_loyalty_pct | 40 | KPI target line |
| target_appointment_show_pct | 70 | KPI target |
| target_callback_rate_pct | 85 | KPI target |
| alert_held_rate_gap_pp | 15 | AI alert threshold |

---

## 11. Customer List

**Route**: `/company/{companyId}/call-center/customers-list`

### Tabs
| Tab | Filter | Extra Features |
|-----|--------|---------------|
| CHSC | customer_type = 'CHSC' | - |
| Non-CHSC | All non-CHSC/Insurance types | - |
| Insurance | Insurance type customers | Policy expiry tracking, expiry status filter |

### Features
- Search by name, phone, email, code
- Sort by created_at or name (asc/desc)
- Pagination: 10/25/50/100 per page
- Customer name clickable to profile
- Insurance: Expiry status badges (Active: green, Expire Soon: amber, Expired: red)

---

## 12. API Reference

### Call Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/webhooks/dialer/yeastar` | Yeastar webhook receiver |
| POST | `/api/company/{id}/call-center/call` | Place outbound call |
| GET | `/api/company/{id}/call-center/history` | Call history with filters |
| GET | `/api/company/{id}/call-center/sessions` | Recent call sessions |
| GET | `/api/company/{id}/call-center/active` | Active/live calls |

### Agent & Performance
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/company/{id}/call-center/agent-summary` | Agent performance summary |
| GET | `/api/company/{id}/call-center/agent-dashboard/calls` | Agent's call history |
| GET | `/api/company/{id}/call-center/agent-dashboard/customers` | Agent's assigned customers |
| GET | `/api/company/{id}/master-dashboard` | Master dashboard data |

### Data Center
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/company/{id}/data-center/kpis` | KPIs by segment/agent |
| GET | `/api/company/{id}/data-center/users` | Agent list |
| GET | `/api/company/{id}/data-center/reports/agents` | Agent performance report |
| POST | `/api/company/{id}/data-center/assignments/auto` | Auto-assign customers |

### AI Intelligence
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/company/{id}/intelligence/signals` | Fetch AI signals |
| GET | `/api/company/{id}/intelligence/config` | Get engine configs |
| PATCH | `/api/company/{id}/intelligence/config` | Update thresholds |

### AI Provider Configuration
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/company/{id}/ai/provider` | Get provider configs (OpenAI + Anthropic) |
| POST | `/api/company/{id}/ai/provider` | Save provider config |

---

## 13. Configuration & Settings

### 13.1 AI Provider Setup
**Route**: `/company/{companyId}/settings/ai/config`
- **OpenAI**: Base URL, API Key, Active toggle
- **Anthropic (Claude)**: API Key, Active toggle (required for AI Intelligence engines)
- **Linkus SDK**: PBX Server URL, Default Extension

### 13.2 Performance Thresholds
**Route**: `/company/{companyId}/settings/call-center/performance`
- Badge thresholds, Held rate colors, Score weights (must sum to 100%), KPI targets

### 13.3 AI Intelligence Settings
**Route**: `/company/{companyId}/settings/ai/intelligence`
- Per-engine: Enable/disable, Refresh interval, Custom prompt override, Threshold JSON

### 13.4 Sidebar Navigation
Under "Sales Center" section:
- Call History
- Customers List
- Data Center
- User Extensions
- Master Performance
- Performance Summary
- Agent Dashboard

---

*Document generated: March 29, 2026*
*Global ERP System - Sales Center Module v1.0*
