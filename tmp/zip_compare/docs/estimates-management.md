# Estimates Management

## Estimate Creation, Line Items, Job Card & Invoice Flow Guide

## Who Should Read This?

- Service Advisors
- Estimation Officers
- Workshop Managers
- Billing Team
- Operations Managers
- Company Administrators

## 1. What Is Estimates Management?

Estimates Management is the process of converting approved inspection findings into a priced service proposal.

An estimate defines:

- Parts required
- Labor required
- Additional charges
- Taxes/discounts (if applicable)
- Expected total service cost

It is the commercial and operational bridge between inspection and execution.

## 2. Where Estimate Creation Starts

Estimate creation starts from an inspection-linked service case.

Common entry path:

Car Dashboard -> Active Lead/Service Case -> Inspection -> Create Estimate

Estimate should never be created without a valid inspection scope.

## 3. Creating an Estimate (Standard Flow)

### Step 1: Open Service Context

- Open car dashboard for the active service case
- Open linked lead/inspection
- Click `Create Estimate`

### Step 2: Add Line Items

Line items should be added by category:

- Parts line items
- Labor line items
- Sublet/external service items (if used)
- Miscellaneous or service fees

For each line item, capture:

- Item name/code
- Quantity
- Unit price
- Tax/discount rule (if applicable)
- Remarks/justification

### Step 3: Review Totals

- Verify subtotal, taxes, discounts, and grand total
- Validate quantities and pricing
- Ensure estimate reflects approved inspection findings

### Step 4: Submit for Approval

- Save as draft or submit directly (based on policy)
- Route to approval stage when required

### Step 5: Approval Outcome

- Approved: eligible for job card creation
- Rejected: return for correction/re-pricing
- Revision requested: update and resubmit

## 4. Line Items Process Rules

Operational rules for line items:

- Mandatory work should be clearly separated from optional work
- Prices should follow approved catalog/rate cards where applicable
- Unauthorized manual overrides should be restricted
- Every change to approved estimate should be versioned/audited

Good line item discipline reduces billing disputes and execution errors.

## 5. Line Item Statuses (Pending, Inquiry, etc.)

Line item statuses track each part/service item inside the estimate.
Status names can vary slightly by setup, but the practical meaning is:

- **Pending:** Item is created but not yet processed for sourcing or approval decision.
- **Inquiry:** Inquiry is raised to vendors or suppliers to collect availability and price.
- **Quoted:** Supplier quote is received and item can move for comparison or approval.
- **Approved:** Item is approved for procurement or execution.
- **Rejected:** Item is not approved due to price, policy, technical reason, or duplicate scope.
- **Ordered:** Purchase order is issued for this item.
- **Partially Received:** Some quantity is received; remaining quantity is still open.
- **Received:** Full required quantity is received into stock.
- **Allocated:** Received stock is reserved for this specific job or estimate.
- **Not Required:** Item was initially considered but removed after review.
- **Cancelled:** Item was cancelled and should not proceed.

Recommended control:

- Move status forward only through approved actions.
- Keep history of status transitions for audit traceability.
- Block billing for items that are not approved/executed.

## 6. Estimate Status Flow (Typical)

Common status pattern:

- Draft
- Pending Approval
- Approved
- Rejected
- Revised
- Converted to Job Card
- Closed

Use consistent statuses across branches for accurate KPI tracking.

## 7. Creating Job Card from Estimate

After estimate approval:

- Click `Create Job Card` from estimate
- Selected/approved line items convert into job tasks and parts requirements
- Job card gets unique reference for workshop execution

Rules:

- Job card creation should be blocked for unapproved estimates
- Scope changes after job creation should require controlled amendment

## 8. Invoice and Related Process

Invoice is typically generated after execution milestones or job completion.

Typical flow:

Inspection -> Estimate Approved -> Job Card Execution -> Invoice Generation -> Payment/Closure

Invoice process should include:

- Pull approved billable items from estimate/job consumption
- Validate completed scope vs billed scope
- Apply taxes/discounts as per approved policy
- Generate final customer invoice

Restrictions:

- Do not invoice unapproved estimate items
- Do not bill items not executed or approved
- Keep invoice-to-estimate traceability for audit

## 9. Procurement Relationship

If estimate includes unavailable parts:

- Procurement request is initiated
- PO and receipt process updates stock
- Job can move to execution after parts availability

Estimate helps forecast required procurement value and timeline.

## 10. Control Points and Restrictions

To keep estimate workflow reliable:

- Estimate must be linked to valid inspection
- Approval required before job card creation
- Approval required for major value changes
- Version history must be preserved
- Role-based access must control pricing edits and approvals

## 11. Validation Checklist

After estimate processing, confirm:

- Line items match inspection findings
- Totals are accurate
- Required approvals are completed
- Job card conversion is correct
- Invoice reflects approved and executed scope
- Audit trail is available end-to-end

## 12. Simple Summary

Estimates Management turns technical findings into controlled financial scope.

Flow:

Car Dashboard -> Inspection -> Create Estimate -> Line Items -> Approval -> Job Card -> Invoice

It ensures service execution and billing remain accurate, approved, and fully traceable.
