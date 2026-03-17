# Inspections Management

## End-to-End Inspection Flow, Statuses, Conditions & Restrictions Guide

## Who Should Read This?

- Service Advisors
- Inspectors and Technical Supervisors
- Workshop Managers
- Operations Managers
- Company Administrators

## 1. What Is Inspections Management?

Inspections Management is the technical assessment process used to evaluate a vehicle condition before work execution and costing.

It starts after lead intake and car check-in, and ends when inspection findings are finalized for estimate preparation.

This process ensures:

- Correct diagnosis
- Transparent repair scope
- Controlled approval flow
- Reliable estimate accuracy

## 2. Where Inspection Starts

Inspection begins from an active lead and linked car profile.

Typical entry points:

- Lead detail page
- Car dashboard linked to active service case
- Branch workshop intake queue

The inspection must always be linked to:

- Customer
- Car
- Lead/service request
- Branch/team

## 2.1 Create Inspection from Car Dashboard

Primary path:

`Cars -> Open Car Dashboard -> Active Service Case -> Create Inspection`

Step-by-step:

- Open `Cars`
- Select the target vehicle
- Open `Car Dashboard`
- Open the active lead/service request
- Click `Create Inspection`
- Select inspection template/type (if available)
- Set initial priority and notes
- Save

After save:

- Inspection reference is generated
- Status starts as `Draft` or `In Progress` (based on your setup)
- Inspection appears in operational queues for assignment and tracking

## 3. Inspection Flow (Start to End)

### Step 1: Create Inspection

- Open the active lead or car service context
- Click `Create Inspection`
- Select inspection type/template (if configured)
- Assign inspector/technician
- Save draft

### Step 1.1: Assign Inspection

Assignment can be done during creation or after creation from the inspection detail.

Typical assignment fields:

- Assigned inspector/technician
- Branch or bay context
- Target date/time (if scheduling is enabled)
- Priority level

Assignment rules:

- Assignee must have valid inspection permissions
- Assignee should belong to the correct operational branch
- Reassignment should keep history for audit visibility

### Step 2: Perform Physical/Technical Check

- Record visible and technical findings
- Capture issue categories
- Add notes, media, and observations (if supported)
- Identify required actions and parts

### Step 3: Classify Findings

- Mark each finding by severity/priority
- Distinguish mandatory vs optional work
- Flag safety-critical issues

### Step 4: Finalize Inspection Findings

- Inspector submits findings
- Supervisor/authorized role reviews (if policy requires)
- Lock inspection for estimate stage

### Step 5: Handover to Estimate

- Approved findings become input for estimate line items
- Repair scope is transferred to costing workflow

## 3.1 Verify Inspection in Operations Dashboard

After creation/assignment, verify from `Operations Dashboard`:

- Inspection is visible in the expected queue
- Assigned user/team is correct
- Current status is correct (`Draft`, `In Progress`, `Pending Review`, etc.)
- Priority and branch context are correct
- Aging/SLA indicators are visible (if enabled)

Recommended operational checks:

- New inspections should appear in today's workload
- Reassigned inspections should move to new assignee queue
- Completed inspections should exit active execution queue
- Pending review inspections should appear in supervisor queue

## 4. Inspection Status Flow (Typical)

Status names can vary, but common pattern is:

- Draft
- In Progress
- Pending Review
- Approved
- Rejected / Needs Rework
- Converted to Estimate
- Closed

Use one consistent status pattern across branches to keep reporting clean.

## 5. Conditions and Business Rules

Typical conditions enforced in operations:

- Inspection requires linked lead and car
- Inspection cannot be finalized without required mandatory fields
- Safety-critical findings must be explicitly marked
- Estimate should not be generated from incomplete inspection
- Rework loop must be tracked when findings are rejected

## 6. Restrictions (Operational Control)

Recommended restrictions:

- Only authorized roles can approve or reopen finalized inspections
- Closed/finalized inspections should be read-only for standard users
- Deletion of completed inspections should be blocked
- Inspection timestamps and actor trail must remain auditable
- One active primary inspection per service cycle (unless policy allows multiple)

These controls prevent manipulation and preserve technical traceability.

## 7. Relationship with Other Modules

Inspection connects directly with:

- Leads Management
- Cars Management
- Estimates
- Job Cards
- Procurement (indirect via required parts)
- Billing (via approved job scope)

Inspection quality directly impacts estimate accuracy and job execution quality.

## 8. Validation Checklist

After completing inspection, confirm:

- Customer, car, and lead linkage is correct
- Inspection was created from the correct car dashboard service context
- Assignment is visible and accurate in operations dashboard
- Findings are complete and technically clear
- Required parts and labor scope are captured
- Correct status is set
- Approval/review trail is recorded
- Estimate can be generated without missing data

## 9. Simple Summary

Inspections Management is the technical gate between intake and costing.

Flow:

Create Inspection -> Perform Checks -> Classify Findings -> Review/Approve -> Convert to Estimate

It ensures service work starts with a controlled and auditable technical assessment.
