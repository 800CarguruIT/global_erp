# Global ERP -- Test Flow Checklist

## Lead Creation to Car Out / Delivery

> Use this checklist alongside the **Test Panel** (`/company/[companyId]/test-panel`) to validate the complete workshop workflow. The AI panel will automatically detect your progress and reflect pass/warning/fail status for each step.

---

## Step 1: Lead Creation

**Main Aim:** Verify that a new workshop lead is created with correct customer, car, booking, and queue data.

### 1A. Lead & Customer Data

| # | Objective | Check |
|---|-----------|-------|
| 1.1 | Create a new lead with type `workshop` | [ ] |
| 1.2 | Customer record is created or linked (name + phone required) | [ ] |
| 1.3 | Car record is created or linked (plate number, make, model, year) | [ ] |
| 1.4 | Customer-car link is established in `customer_car_links` | [ ] |
| 1.5 | Lead status is `open` | [ ] |
| 1.6 | Lead stage is set based on workshop flow (`inspection_queue` or `estimate_pending`) | [ ] |
| 1.7 | `lead_events` audit entry is created with type `lead.created` | [ ] |
| 1.8 | Lead is assigned to correct branch | [ ] |
| 1.9 | Inspection is auto-created if flow is `inspection` | [ ] |
| 1.10 | Validation: lead fails if no customer name/phone/email provided | [ ] |

### 1B. Booking

| # | Objective | Check |
|---|-----------|-------|
| 1.11 | Booking record created in `lead_bookings` table | [ ] |
| 1.12 | Booking kind matches lead type (`workshop_walkin` or `workshop_recovery`) | [ ] |
| 1.13 | `scheduled_at` (appointment date/time) is set | [ ] |
| 1.14 | Booking status is `active` | [ ] |
| 1.15 | Booking priority is set (`low` / `medium` / `high`) | [ ] |
| 1.16 | For recovery booking: `pickup_location` and `dropoff_location` are set | [ ] |
| 1.17 | For walkin booking: workshop visit mode set to `walkin` on lead | [ ] |
| 1.18 | Lead event `lead_booking_saved` is recorded with booking details | [ ] |
| 1.19 | Pre-inspection form request is created (if applicable) | [ ] |
| 1.20 | Recovery request is created (if workshop_recovery booking) | [ ] |
| 1.21 | Only one active booking per lead per booking kind (uniqueness constraint) | [ ] |
| 1.22 | Re-booking (same kind) updates existing booking via UPSERT | [ ] |

### 1C. Pre-Inspection Form

| # | Objective | Check |
|---|-----------|-------|
| 1.23 | Pre-inspection form request created in `pre_inspection_form_requests` | [ ] |
| 1.24 | Form has unique `token` for public access | [ ] |
| 1.25 | Form `appointment_type` matches booking (walkin/recovery) | [ ] |
| 1.26 | Form `status` starts as `pending` | [ ] |
| 1.27 | Form link sent to customer (SMS / WhatsApp / Email) | [ ] |
| 1.28 | Public form page loads at `/pre-inspection/{token}` | [ ] |
| 1.29 | Form shows customer name, phone, car details | [ ] |
| 1.30 | All 8 questions answered (yes/no + details if yes) | [ ] |
| 1.31 | Terms accepted and digital signature captured | [ ] |
| 1.32 | Form submitted successfully (`status` -> `submitted`) | [ ] |
| 1.33 | `submitted_at` timestamp is recorded | [ ] |
| 1.34 | AI summary generated and synced to lead's `agentRemark` | [ ] |

### 1D. Check-In Queue

| # | Objective | Check |
|---|-----------|-------|
| 1.35 | Lead appears in Check-In Queue after form submission | [ ] |
| 1.36 | Queue shows booking type, customer, car, scheduled time | [ ] |
| 1.37 | Employee takes 4 photos (front, left, right, rear) | [ ] |
| 1.38 | Employee takes cluster image | [ ] |
| 1.39 | Employee records 360 video | [ ] |
| 1.40 | Check-in submitted successfully | [ ] |
| 1.41 | Lead status updates to `car_in` | [ ] |
| 1.42 | Lead stage updates to `checkin` | [ ] |
| 1.43 | `checkin_at` timestamp is set | [ ] |
| 1.44 | Media file IDs stored in `workflowRequired` | [ ] |
| 1.45 | Lead event `queue_check_in_completed` logged | [ ] |
| 1.46 | Lead moves from Check-In Queue to Inspection Queue | [ ] |

---

## Step 2: Advisor Assign (Automatic via PIS)

**Main Aim:** Verify that an advisor is automatically assigned after car check-in using PIS scoring.

| # | Objective | Check |
|---|-----------|-------|
| 2.1 | Auto-assign triggers when `lead_status = car_in` | [ ] |
| 2.2 | PIS queue entry created in `pis_lead_queue` | [ ] |
| 2.3 | Best-scored available advisor is offered the lead | [ ] |
| 2.4 | `offered_at` timestamp and `locked_until` timeout are set | [ ] |
| 2.5 | Lead event `advisor_auto_assigned` is logged | [ ] |
| 2.6 | Advisor receives notification (push / in-app) | [ ] |
| 2.7 | Advisor accepts within accept window | [ ] |
| 2.8 | On accept: `agent_employee_id` and `assigned_user_id` set on lead | [ ] |
| 2.9 | On accept: `assigned_at` timestamp recorded | [ ] |
| 2.10 | Lead event `advisor_accepted` is logged | [ ] |
| 2.11 | On timeout: 5-point penalty applied, cascade to next advisor | [ ] |
| 2.12 | After 5 cascades: escalated to manual queue | [ ] |

---

## Step 3: Inspection

**Main Aim:** Verify that a vehicle inspection is created, items are added, and it can be completed.

| # | Objective | Check |
|---|-----------|-------|
| 3.1 | Inspection exists linked to lead, car, and customer | [ ] |
| 3.2 | Inspection status starts as `pending` | [ ] |
| 3.3 | Inspector and advisor employee IDs are set | [ ] |
| 3.4 | Line items (parts/services) are added to inspection | [ ] |
| 3.5 | Each line item has: product name, quantity, status, approved type | [ ] |
| 3.6 | Media (photos/videos) can be uploaded to inspection | [ ] |
| 3.7 | Draft payload stores detailed inspection data (car media, damage notes) | [ ] |
| 3.8 | Inspection can be marked as `completed` | [ ] |
| 3.9 | Lead stage updates when inspection progresses | [ ] |
| 3.10 | Inspection version history is maintained | [ ] |

---

## Step 4: Estimate

**Main Aim:** Verify that an estimate is generated from the inspection with correct pricing.

| # | Objective | Check |
|---|-----------|-------|
| 4.1 | Estimate is created from inspection (`inspectionId` required) | [ ] |
| 4.2 | Estimate status starts as `draft` | [ ] |
| 4.3 | Estimate items auto-populated from inspection line items | [ ] |
| 4.4 | Each item has: cost, sale price, GP%, quantity | [ ] |
| 4.5 | VAT is calculated (5%) | [ ] |
| 4.6 | Totals are correct (subtotal, VAT, grand total) | [ ] |
| 4.7 | Estimate can be edited (add/remove/modify items) | [ ] |
| 4.8 | Estimate links back to inspection and lead | [ ] |
| 4.9 | Lead stage updates to `estimate_pending` | [ ] |

---

## Step 5: Estimate Approval

**Main Aim:** Verify the customer approval workflow for estimates.

| # | Objective | Check |
|---|-----------|-------|
| 5.1 | Customer approval link is generated (unique token) | [ ] |
| 5.2 | Approval link has 7-day expiry | [ ] |
| 5.3 | Public approval page loads correctly with estimate details | [ ] |
| 5.4 | Customer can select/deselect individual items | [ ] |
| 5.5 | Customer can choose part type per item (OE/OEM/Aftermarket/Used) | [ ] |
| 5.6 | Terms acceptance is required | [ ] |
| 5.7 | Customer signature is captured and required | [ ] |
| 5.8 | On approval: estimate status updates to `approved` | [ ] |
| 5.9 | Approval metadata stored (timestamp, selected items, signature) | [ ] |
| 5.10 | Lead stage updates to `estimate_approved` | [ ] |
| 5.11 | Expired links show proper error message | [ ] |

---

## Step 6: Parts Approval

**Main Aim:** Verify that approved parts are matched with vendor quotes and best options are selected.

| # | Objective | Check |
|---|-----------|-------|
| 6.1 | Part quotes exist for approved estimate items | [ ] |
| 6.2 | Vendor quotes include price variants (OE, OEM, Aftermarket, Used) | [ ] |
| 6.3 | Each quote has ETD (estimated time of delivery) | [ ] |
| 6.4 | System selects optimal vendor based on quality/price/reliability | [ ] |
| 6.5 | Line item status updates to `approved` after parts approval | [ ] |
| 6.6 | Parts that need inquiry are marked with status `inquiry` | [ ] |
| 6.7 | Rejected parts are properly marked and excluded | [ ] |
| 6.8 | All approved parts have a selected vendor assigned | [ ] |

---

## Step 7: Procurement

**Main Aim:** Verify that purchase orders are created, sent to vendors, and goods are received.

| # | Objective | Check |
|---|-----------|-------|
| 7.1 | Purchase order created from approved part quotes | [ ] |
| 7.2 | PO has correct vendor, items, quantities, and unit costs | [ ] |
| 7.3 | PO number is auto-generated (sequential) | [ ] |
| 7.4 | PO status starts as `draft` or `issued` | [ ] |
| 7.5 | PO items match the approved estimate items | [ ] |
| 7.6 | Goods receipt (GRN) can be recorded against PO | [ ] |
| 7.7 | Partial delivery updates PO status to `partially_received` | [ ] |
| 7.8 | Full delivery updates PO status to `received` | [ ] |
| 7.9 | Inventory stock is updated on goods receipt | [ ] |
| 7.10 | Inventory movement record is created | [ ] |
| 7.11 | Accounting journal entry is posted for GRN | [ ] |

---

## Step 8: Job Card

**Main Aim:** Verify that the job card is created, work execution is tracked, and all stages are completed.

| # | Objective | Check |
|---|-----------|-------|
| 8.1 | Job card created from estimate | [ ] |
| 8.2 | Job card status starts as `Pending` | [ ] |
| 8.3 | Line items are linked to job card | [ ] |
| 8.4 | **Collect Car** stage completed (car media verified/replaced) | [ ] |
| 8.5 | **Pre-Work Check** completed (mileage, plate, make, model, year) | [ ] |
| 8.6 | Quote is verified/accepted before work starts | [ ] |
| 8.7 | At least one part is received before work starts | [ ] |
| 8.8 | Job card can be started (`Pending` -> `Started`) | [ ] |
| 8.9 | Working video is uploaded during execution | [ ] |
| 8.10 | Job card can be completed (`Started` -> `Completed`) | [ ] |
| 8.11 | **Final Inspection** completed (test drive, cluster warning, tyre check, computer reset) | [ ] |
| 8.12 | Completion evidence is uploaded | [ ] |

---

## Step 9: Quality Check

**Main Aim:** Verify that quality inspection is performed and all work items pass QC.

| # | Objective | Check |
|---|-----------|-------|
| 9.1 | Quality check created from work order | [ ] |
| 9.2 | QC status starts as `queue` | [ ] |
| 9.3 | QC items auto-created (one per work order item) | [ ] |
| 9.4 | QC can be started (`queue` -> `in_process`) | [ ] |
| 9.5 | Each QC item can be marked `ok` or `issue` | [ ] |
| 9.6 | QC video is uploaded | [ ] |
| 9.7 | Test drive status is recorded | [ ] |
| 9.8 | Car wash status is recorded | [ ] |
| 9.9 | QC passes (`in_process` -> `completed`) when all items are `ok` | [ ] |
| 9.10 | Failed QC (`failed`) triggers rework cycle | [ ] |
| 9.11 | QC remarks are recorded | [ ] |

---

## Step 10: Car Wash

**Main Aim:** Verify car wash documentation is completed before delivery.

| # | Objective | Check |
|---|-----------|-------|
| 10.1 | Car wash action triggered on job card (`action: "car_wash"`) | [ ] |
| 10.2 | All 5 media files uploaded (front, rear, right, left, video) | [ ] |
| 10.3 | Car wash notes are recorded (if any) | [ ] |
| 10.4 | `final_inspection_car_wash` flag set to `true` on job card | [ ] |
| 10.5 | Car wash can only be done after final inspection | [ ] |
| 10.6 | Car wash media is viewable in job card details | [ ] |

---

## Step 11: Car Out / Delivery

**Main Aim:** Verify the complete car handover process including payment, approval, signature, and lead closure.

| # | Objective | Check |
|---|-----------|-------|
| 11.1 | Invoice is created from estimate/job card | [ ] |
| 11.2 | Invoice amounts match estimate totals | [ ] |
| 11.3 | Gatepass created from invoice | [ ] |
| 11.4 | Gatepass status starts as `pending` | [ ] |
| 11.5 | Handover type is set (`branch` or `dropoff_recovery`) | [ ] |
| 11.6 | Payment is verified (`paymentOk = true`) | [ ] |
| 11.7 | Supervisor approves gatepass (`supervisorApprovedAt` set) | [ ] |
| 11.8 | Customer signs for the car (`customerSigned = true`) | [ ] |
| 11.9 | Customer signature file is captured (`customerSignatureRef`) | [ ] |
| 11.10 | Final car-out video is recorded (`finalVideoRef`) | [ ] |
| 11.11 | Gatepass released (`pending` -> `ready` -> `released`) | [ ] |
| 11.12 | Lead status updates to `closed` / `closed_won` | [ ] |
| 11.13 | Lead `closed_at` timestamp is set | [ ] |
| 11.14 | All lead events form a complete audit trail | [ ] |

---

## Summary

| Step | Name | Key Entity | Success Criteria |
|------|------|-----------|-----------------|
| 1 | Lead Creation | `leads`, `lead_bookings`, `pre_inspection_form_requests` | Lead exists, booking active, form submitted, car checked in |
| 2 | Advisor Assign (Auto) | `pis_lead_queue`, `leads` | PIS offers to best advisor, accepted, `agent_employee_id` set |
| 3 | Inspection | `inspections` | Status `completed`, has line items |
| 4 | Estimate | `estimates` | Status `draft`, items with pricing |
| 5 | Estimate Approval | `estimates` | Status `approved`, customer signed |
| 6 | Parts Approval | `part_quotes` | Approved parts have vendors selected |
| 7 | Procurement | `purchase_orders` | PO `received`, inventory updated |
| 8 | Job Card | `job_cards` | Status `Completed`, all stages done |
| 9 | Quality Check | `quality_checks` | Status `completed`, all items `ok` |
| 10 | Car Wash | `job_cards` | `car_wash = true`, media uploaded |
| 11 | Car Out / Delivery | `gatepasses` | Status `released`, lead closed |
