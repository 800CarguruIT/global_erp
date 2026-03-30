# Global ERP - End-to-End Testing Plan

## Lead Creation to Car Delivered (Complete Flow)

> This document outlines the full E2E test plan covering every stage of the business workflow, from initial lead creation through car delivery/out.

---

## Phase 1: Lead Creation & CRM

### 1.1 Lead Creation (All Types)
- [ ] **TC-001**: Create a Workshop lead with full customer info (name, phone, email, company)
- [ ] **TC-002**: Create an RSA (Roadside Assistance) lead with location data
- [ ] **TC-003**: Create a Recovery lead with pickup/dropoff locations
- [ ] **TC-004**: Create a Sales lead from call center (global scope)
- [ ] **TC-005**: Create a lead via mobile API endpoint
- [ ] **TC-006**: Verify lead_events audit trail is created on lead creation
- [ ] **TC-007**: Verify lead auto-assignment to agent/employee works
- [ ] **TC-008**: Verify lead status defaults to `open` and stage to `new`
- [ ] **TC-009**: Verify duplicate lead detection (same phone number)
- [ ] **TC-010**: Verify lead creation with missing required fields returns proper validation errors

### 1.2 Lead Management
- [ ] **TC-011**: Update lead status: `open` -> `processing`
- [ ] **TC-012**: Assign lead to different agent
- [ ] **TC-013**: Add notes/comments to lead
- [ ] **TC-014**: Verify lead events are recorded for every status change
- [ ] **TC-015**: List leads with filters (status, type, date range, branch, agent)
- [ ] **TC-016**: Search leads by customer phone/name
- [ ] **TC-017**: Verify branch-level isolation (branch A cannot see branch B leads)
- [ ] **TC-018**: Verify company-level isolation (company A cannot see company B leads)

### 1.3 Customer & Car Registration
- [ ] **TC-019**: Create new customer during lead creation
- [ ] **TC-020**: Link existing customer to new lead
- [ ] **TC-021**: Register a new car (plate number, make, model, year, VIN, body type)
- [ ] **TC-022**: Link car to customer via customer_car_links
- [ ] **TC-023**: Verify customer code is auto-generated and unique
- [ ] **TC-024**: Verify car plate number uniqueness constraint
- [ ] **TC-025**: View customer 360 profile (leads, cars, estimates, invoices, wallet)

---

## Phase 2: Car Intake & Inspection

### 2.1 Inspection Creation
- [ ] **TC-026**: Create inspection linked to lead, car, customer, and branch
- [ ] **TC-027**: Verify inspection status defaults to `pending`
- [ ] **TC-028**: Create inspection via mobile API
- [ ] **TC-029**: Verify inspection cannot be created without valid lead_id
- [ ] **TC-030**: Verify one car can have multiple inspections (different visits)

### 2.2 Inspection Line Items
- [ ] **TC-031**: Add parts/services line items to inspection
- [ ] **TC-032**: Update line item quantities and conditions
- [ ] **TC-033**: Delete line items from inspection
- [ ] **TC-034**: Upload photos/videos to inspection (inspection_media)
- [ ] **TC-035**: Verify media file type and size validation
- [ ] **TC-036**: AI-suggest parts for inspection (POST ai-suggest-parts)
- [ ] **TC-037**: AI-generate inspection summary (POST ai-summary)

### 2.3 Inspection Workflow
- [ ] **TC-038**: Submit inspection for approval (status: `pending` -> `approved`)
- [ ] **TC-039**: Reject inspection with reason (status: `pending` -> `rejected`)
- [ ] **TC-040**: Complete inspection (status: `approved` -> `completed`)
- [ ] **TC-041**: Verify invalid status transitions are blocked (e.g., `completed` -> `pending`)
- [ ] **TC-042**: Verify inspection version history is maintained
- [ ] **TC-043**: Verify lead status updates when inspection progresses

---

## Phase 3: Estimate & Quotation

### 3.1 Estimate Creation
- [ ] **TC-044**: Create estimate from inspection (auto-populated items)
- [ ] **TC-045**: Verify estimate status defaults to `draft`
- [ ] **TC-046**: Verify estimate items match inspection line items
- [ ] **TC-047**: Manually add/edit estimate line items (labor + parts)
- [ ] **TC-048**: Verify cost calculations (unit_price x quantity, totals, tax)

### 3.2 Estimate Approval Flow
- [ ] **TC-049**: Submit estimate for approval (`draft` -> `pending_approval`)
- [ ] **TC-050**: Approve estimate (`pending_approval` -> `approved`)
- [ ] **TC-051**: Reject estimate with reason (`pending_approval` -> `rejected`)
- [ ] **TC-052**: Verify invalid status transitions are blocked
- [ ] **TC-053**: AI market pricing analysis (POST ai-market-pricing)

### 3.3 Quote Generation
- [ ] **TC-054**: Generate quote from estimate (POST estimate/[id]/quote)
- [ ] **TC-055**: Verify quote items match estimate items
- [ ] **TC-056**: Send quote to customer (public estimate approval link)
- [ ] **TC-057**: Customer approves quote via public link
- [ ] **TC-058**: Customer rejects quote via public link

---

## Phase 4: Procurement (If Parts Needed)

### 4.1 Purchase Order Creation
- [ ] **TC-059**: Create purchase order for parts from estimate
- [ ] **TC-060**: Link PO to vendor from data center
- [ ] **TC-061**: Add PO line items with quantities and unit prices
- [ ] **TC-062**: Submit PO for approval
- [ ] **TC-063**: Approve PO

### 4.2 Vendor Interaction
- [ ] **TC-064**: Vendor receives inquiry notification
- [ ] **TC-065**: Vendor submits quote response
- [ ] **TC-066**: Compare vendor quotes
- [ ] **TC-067**: Confirm vendor selection and PO

### 4.3 Goods Receipt
- [ ] **TC-068**: Record goods receipt (GRN) against PO
- [ ] **TC-069**: Verify inventory_stock is updated on receipt
- [ ] **TC-070**: Verify inventory_movements record is created
- [ ] **TC-071**: Handle partial delivery (receive subset of PO items)
- [ ] **TC-072**: Verify PO status updates on full/partial receipt

---

## Phase 5: Inventory Management

### 5.1 Stock Operations
- [ ] **TC-073**: Check current stock levels by location
- [ ] **TC-074**: Transfer stock between locations (branch to branch)
- [ ] **TC-075**: Verify stock deduction when parts used in work order
- [ ] **TC-076**: Verify inventory movement audit trail
- [ ] **TC-077**: Handle stock below minimum threshold alerts

### 5.2 Parts Catalog
- [ ] **TC-078**: Search parts catalog by name/code
- [ ] **TC-079**: Add new part to catalog
- [ ] **TC-080**: Update part pricing in catalog

---

## Phase 6: Work Order Execution

### 6.1 Work Order Creation
- [ ] **TC-081**: Create work order from approved estimate
- [ ] **TC-082**: Verify work order status defaults to `pending`
- [ ] **TC-083**: Verify work order items match estimate items
- [ ] **TC-084**: Assign work order to workshop bay
- [ ] **TC-085**: Assign technician to work order

### 6.2 Work Execution
- [ ] **TC-086**: Start work order (`pending` -> `in_progress`)
- [ ] **TC-087**: Update individual line item progress
- [ ] **TC-088**: Upload work-in-progress photos/videos (work_order_media)
- [ ] **TC-089**: Add notes during execution
- [ ] **TC-090**: Complete work order (`in_progress` -> `completed`)
- [ ] **TC-091**: Verify invalid status transitions blocked
- [ ] **TC-092**: Verify stock is deducted for parts used

---

## Phase 7: Quality Check

### 7.1 Quality Check Process
- [ ] **TC-093**: Create quality check linked to work order
- [ ] **TC-094**: Add quality check items (checklist)
- [ ] **TC-095**: Pass quality check (`pending` -> `approved`)
- [ ] **TC-096**: Fail quality check with deficiencies (`pending` -> `rejected`)
- [ ] **TC-097**: Re-do quality check after fixes
- [ ] **TC-098**: Verify work order cannot proceed to invoice without passing QC

---

## Phase 8: Invoicing & Payment

### 8.1 Invoice Generation
- [ ] **TC-099**: Generate invoice from estimate (POST estimate/[id]/invoice)
- [ ] **TC-100**: Verify invoice items match final work order + estimate items
- [ ] **TC-101**: Verify invoice status defaults to `draft`
- [ ] **TC-102**: Issue invoice to customer (`draft` -> `issued`)
- [ ] **TC-103**: Verify invoice amounts (subtotal, tax, discount, total)

### 8.2 Payment
- [ ] **TC-104**: Record full payment (`issued` -> `paid`)
- [ ] **TC-105**: Record partial payment (`issued` -> `partially_paid`)
- [ ] **TC-106**: Handle overdue invoice
- [ ] **TC-107**: Cancel invoice with reason
- [ ] **TC-108**: Verify customer wallet/balance is updated

### 8.3 Accounting Integration
- [ ] **TC-109**: Verify journal entry is auto-created when invoice is issued
- [ ] **TC-110**: Verify journal lines have correct debit/credit entries
- [ ] **TC-111**: Verify accounting accounts are correctly mapped
- [ ] **TC-112**: Check balance sheet reflects the transaction
- [ ] **TC-113**: Check P&L report reflects revenue

---

## Phase 9: Car Delivery (Gatepass)

### 9.1 Gatepass Creation
- [ ] **TC-114**: Create gatepass linked to work order, invoice, quality check, car, customer
- [ ] **TC-115**: Verify gatepass status defaults to `pending`
- [ ] **TC-116**: Set gatepass type: `branch` (workshop handover)
- [ ] **TC-117**: Set gatepass type: `dropoff_recovery` (delivery to customer)
- [ ] **TC-118**: Verify gatepass cannot be created without passed quality check

### 9.2 Delivery Workflow
- [ ] **TC-119**: Supervisor approves gatepass (supervisorApprovedAt timestamp)
- [ ] **TC-120**: Mark gatepass as ready (`pending` -> `ready`)
- [ ] **TC-121**: Customer signs for car (customerSigned flag)
- [ ] **TC-122**: Upload final video documentation (finalVideoRef)
- [ ] **TC-123**: Release car (`ready` -> `released`)
- [ ] **TC-124**: Verify invalid status transitions blocked

### 9.3 Post-Delivery
- [ ] **TC-125**: Verify lead status updates to `closed_won` after car release
- [ ] **TC-126**: Verify lead stage updates to `completed`/`closed`
- [ ] **TC-127**: Verify all lead_events are complete (full audit trail)
- [ ] **TC-128**: Verify car status is updated (no longer in workshop)

---

## Phase 10: RSA & Recovery Flow (Alternate Path)

### 10.1 RSA Lead Flow
- [ ] **TC-129**: Create RSA lead with location coordinates
- [ ] **TC-130**: Assign RSA agent
- [ ] **TC-131**: Agent updates status to en-route
- [ ] **TC-132**: Agent arrives and begins service
- [ ] **TC-133**: Complete RSA service and close lead
- [ ] **TC-134**: Transition RSA lead to Recovery if towing needed

### 10.2 Recovery Flow
- [ ] **TC-135**: Create recovery request from RSA lead transition
- [ ] **TC-136**: Assign recovery driver
- [ ] **TC-137**: Track pickup location and status
- [ ] **TC-138**: Confirm car pickup
- [ ] **TC-139**: Track dropoff to workshop
- [ ] **TC-140**: Confirm car delivery to workshop (leads into Phase 2)

---

## Phase 11: Cross-Cutting Concerns

### 11.1 Authentication & Authorization
- [ ] **TC-141**: Login with valid credentials
- [ ] **TC-142**: Login with invalid credentials returns proper error
- [ ] **TC-143**: Verify session token is created and stored in cookie
- [ ] **TC-144**: Access protected route without token returns 401
- [ ] **TC-145**: Access company resource with wrong companyId returns 403
- [ ] **TC-146**: Verify role-based permissions (admin vs technician vs agent)
- [ ] **TC-147**: Verify branch-level access restrictions
- [ ] **TC-148**: Session expiry and re-authentication

### 11.2 Mobile API Parity
- [ ] **TC-149**: Verify all critical flows work via mobile API endpoints
- [ ] **TC-150**: Mobile lead creation matches web flow
- [ ] **TC-151**: Mobile inspection creation matches web flow
- [ ] **TC-152**: Mobile work order updates work correctly

### 11.3 Integration Tests
- [ ] **TC-153**: Yeastar/PBX webhook receives and processes call events
- [ ] **TC-154**: Push notification delivery on lead assignment
- [ ] **TC-155**: Email notification on estimate approval
- [ ] **TC-156**: WhatsApp/SMS channel integration

### 11.4 Data Integrity Across Flow
- [ ] **TC-157**: Verify complete data chain: Lead -> Inspection -> Estimate -> Work Order -> Invoice -> Gatepass (all linked by IDs)
- [ ] **TC-158**: Verify deleting a parent record handles children properly
- [ ] **TC-159**: Verify concurrent updates don't corrupt data (optimistic locking)
- [ ] **TC-160**: Verify financial totals are consistent across estimate, work order, and invoice

---

## Test Execution Priority

### P0 - Critical Path (Must Test First)
| Priority | Test Cases | Description |
|----------|------------|-------------|
| P0 | TC-001, TC-019, TC-021 | Lead + Customer + Car creation |
| P0 | TC-026, TC-031, TC-038 | Inspection creation and approval |
| P0 | TC-044, TC-049, TC-050 | Estimate creation and approval |
| P0 | TC-081, TC-086, TC-090 | Work order execution |
| P0 | TC-099, TC-102, TC-104 | Invoice and payment |
| P0 | TC-114, TC-119, TC-123 | Gatepass and car release |
| P0 | TC-125, TC-157 | End-to-end data chain verification |

### P1 - High Priority
| Priority | Test Cases | Description |
|----------|------------|-------------|
| P1 | TC-141 to TC-148 | Authentication & Authorization |
| P1 | TC-041, TC-052, TC-091, TC-124 | Status transition validation |
| P1 | TC-017, TC-018, TC-145 | Tenant/branch isolation |
| P1 | TC-059 to TC-072 | Procurement & goods receipt |
| P1 | TC-093 to TC-098 | Quality check flow |

### P2 - Medium Priority
| Priority | Test Cases | Description |
|----------|------------|-------------|
| P2 | TC-009, TC-010, TC-024 | Validation & duplicate checks |
| P2 | TC-073 to TC-080 | Inventory management |
| P2 | TC-109 to TC-113 | Accounting integration |
| P2 | TC-129 to TC-140 | RSA & Recovery flows |
| P2 | TC-149 to TC-152 | Mobile API parity |

### P3 - Lower Priority
| Priority | Test Cases | Description |
|----------|------------|-------------|
| P3 | TC-036, TC-037, TC-053 | AI features |
| P3 | TC-153 to TC-156 | External integrations |
| P3 | TC-158, TC-159 | Edge cases |

---

## Test Environment Requirements

1. **Database**: Fresh PostgreSQL instance seeded with `pnpm db:seed`
2. **Test Data**: At least 1 company, 2 branches, 3 users (admin, supervisor, technician)
3. **External Services**: Mock AI APIs, mock push notification, mock email
4. **Auth**: Test tokens for each user role
5. **Files**: Sample images/videos for media upload tests
