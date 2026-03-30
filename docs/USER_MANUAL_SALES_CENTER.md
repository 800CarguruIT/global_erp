# USER MANUAL — Sales Center
## 800CarGuru Global ERP

**Version:** 1.0 | **Last Updated:** March 30, 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Accessing Sales Center](#accessing-sales-center)
3. [Call History](#call-history)
4. [Customers List](#customers-list)
5. [Data Center](#data-center)
6. [User Extensions](#user-extensions)
7. [Master Performance](#master-performance)
8. [Performance Summary](#performance-summary)
9. [Agent Dashboard](#agent-dashboard)

---

## 1. Overview

The Sales Center is the call center operations hub within the Global ERP. It manages inbound/outbound calls, customer assignments, agent performance tracking, and dialer integrations for the 800CarGuru team.

**Who uses it:**
- Call center agents (inbound/outbound)
- Call center supervisors
- Operations managers

**Sidebar Location:** Main → Sales Center

---

## 2. Accessing Sales Center

1. Log into Global ERP at your company URL
2. In the left sidebar, click **Sales Center** to expand the section
3. You will see 7 sub-pages:
   - Call History
   - Customers List
   - Data Center
   - User Extensions
   - Master Performance
   - Performance Summary
   - Agent Dashboard

**Permissions Required:** `callcenter.view` or specific sub-permissions (see each section below)

---

## 3. Call History

**Path:** Sales Center → Call History
**Permission:** `callcenter.history.view`

### What it shows:
- Complete log of all inbound and outbound calls
- Agent name, customer name, phone numbers
- Call status (completed, failed, cancelled, in_progress)
- Call duration
- Recording playback (if available)

### How to use:
1. **Filter by direction:** Click "All", "Inbound", or "Outbound" tabs at the top
2. **View call details:** Each row shows time, direction, agent, from/to numbers, customer, status, and duration
3. **Play recordings:** Click the play button on calls that have recordings
4. **Add notes:** Click on a call row to expand and add notes about the call
5. **AI Inquiries tab:** Switch to see AI-analyzed call inquiries with verification status

### KPI Bar:
- Total Calls, Inbound, Outbound, Completed, Missed, Avg Duration, Answer Rate

---

## 4. Customers List

**Path:** Sales Center → Customers List
**Permission:** `callcenter.customers.view`

### What it shows:
- All customers in the system
- Customer name, phone, email
- Assignment status (which agent owns the customer)
- Segment (CHSC, Non-CHSC, Insurance, Warranty)

### How to use:
1. **Search:** Type in the search bar to find customers by name, phone, or email
2. **Filter by segment:** Use the segment dropdown
3. **Click to call:** Click the phone icon next to a customer to initiate an outbound call

---

## 5. Data Center

**Path:** Sales Center → Data Center
**Permission:** `callcenter.datacenter.view`

### What it shows:
- Customer assignment management dashboard
- KPI overview (total assigned, contacted, pending)
- Agent performance table with collection metrics

### How to use:

#### Viewing KPIs:
1. Select date range using the date pickers
2. Filter by segment (CHSC, Non-CHSC, Insurance, Warranty, All)
3. KPIs update automatically

#### Auto-Assigning Customers:
1. Click **"Auto Assign"** button
2. Select the agent from the dropdown
3. Enter the number of customers to assign
4. Set percentage split by segment (must total 100%)
5. Click **"Assign"** to distribute

#### Agent Performance Table:
- Shows per-agent: Total Assigned, Total Leads, Total Collection, Total Calls, Answer Rate, Performance Score
- Click column headers to sort

#### Exporting Reports:
- Click **"Export"** → Choose Excel or PDF format

---

## 6. User Extensions

**Path:** Sales Center → User Extensions
**Permission:** `callcenter.extensions.view`

### What it shows:
- List of all agents with their dialer extensions
- Extension number and location (inhouse/remote)

### How to use:
1. Find the agent in the list
2. Enter or modify the **Extension** number (e.g., 1001)
3. Select **Location** (Inhouse or Remote)
4. Click **"Save"** to apply changes

The extension is used for the Linkus dialer integration to route calls to the correct agent.

---

## 7. Master Performance

**Path:** Sales Center → Master Performance
**Permission:** `callcenter.master_performance.view`

### What it shows:
- Executive-level performance dashboard
- Top KPIs: Revenue, Bookings, Calls, Show-up Rate
- Inbound/Outbound metrics with trends
- Team stats by location (Inhouse vs Remote)
- Portfolio metrics with top performers
- Conversion funnel (Calls → Leads → Bookings → Show-ups → Revenue)

### How to use:
1. Set the date range using from/to date pickers
2. Optionally filter by branch
3. Review the KPI cards for overall performance
4. Scroll down for detailed breakdowns by category

---

## 8. Performance Summary

**Path:** Sales Center → Performance Summary
**Permission:** `callcenter.view`

### What it shows:
- Summary view of call center performance
- Agent rankings and scores
- Call volume and quality metrics

### How to use:
1. View the overview dashboard
2. Check agent rankings
3. Review performance trends

---

## 9. Agent Dashboard

**Path:** Sales Center → Agent Dashboard
**Permission:** `callcenter.view`

### What it shows:
- Per-agent view with call history and customer assignments
- KPI cards (Assigned, Contacted, Pending, Total Calls, Answer Rate, Avg Duration)
- Two tabs: Call History and Customers

### How to use:

#### For Supervisors:
1. Select an agent from the dropdown at the top right
2. View their KPIs, call history, and customer list
3. Toggle **AI Coaching** to see AI-generated performance signals

#### For Agents:
1. Dashboard automatically shows your own data
2. Review your call history in the Calls tab
3. Check your assigned customers in the Customers tab
4. Filter customers by segment (All, CHSC, Non-CHSC, Insurance)
5. Click a customer's phone number to initiate a call

#### AI Coaching Panel:
1. Click **"AI Coaching"** button to toggle the AI panel
2. View Diagnostic, Predictive, and Prescriptive signals
3. Signals come from Engine e2 (Agent Performance) and e7 (Coaching)

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Can't see Sales Center | Check that your role has `callcenter.view` permission |
| Call history empty | Verify dialer integration is configured in Settings |
| Extension not saving | Ensure you have `callcenter.extensions.view` permission |
| No customers showing | Contact admin to run customer assignment |

---

**CONFIDENTIAL — 800CARGURU**
