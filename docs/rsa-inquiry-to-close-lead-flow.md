# RSA Flow: AI Inquiry to Closed Lead

## Who Should Read This?

- Call center agents
- RSA dispatchers
- Service advisors
- Operations managers
- Company admins
- QA/UAT testers

## 1. Scope

This document describes the implemented RSA flow in Global ERP from AI inquiry intake to lead closure, including:

- AI inquiry verification and conversion
- RSA lead assignment with customer location (Google Maps URL)
- RSA field workflow steps (Accept to Close)
- VIN lookup + parts catalog behavior
- Job completion with payment proof, estimate creation, and paid invoice
- Recovery request branching from an RSA lead

## 2. Entry Points

- AI inquiries page:
  - `/company/{companyId}/settings/ai/inquiries`
- RSA leads board:
  - `/company/{companyId}/leads/rsa`
- RSA lead workflow detail:
  - `/company/{companyId}/leads/{leadId}`

## 3. AI Inquiry Stage

### 3.1 Actions available per inquiry

- Verify inquiry (mobile + location)
- Analyze recording (AI)
- Convert to lead
- Set lead type/division (after conversion)
- View transcript in modal

### 3.2 Lock behavior

Once an inquiry is converted and the linked lead is closed/completed, inquiry actions are disabled on the inquiries page (`Lead closed: actions disabled`).

## 4. Conversion to RSA Lead

When converted as RSA, the lead appears in RSA leads queue and can be assigned from:

- `/company/{companyId}/leads/rsa`

Assignment supports:

- User assignment
- Pickup location label
- Google map search/suggestions
- Google Maps URL save (URL-based, not iframe HTML storage)

## 5. RSA Assignment and Location Data

### 5.1 Location data model in flow

- `pickupFrom` stores readable location text.
- `pickupGoogleLocation` stores map URL value.
- Map preview can still render from URL.

### 5.2 Navigation behavior

In Reach step, if an embeddable map is not available, UI shows location details and `Open Navigation`.
For short links, navigation opens the short URL directly.

## 6. RSA Workflow (Multi-Step)

The RSA workflow runs in this order:

1. Accept lead (`accepted`)
2. Start (`enroute`)
3. Reach (`reached`)
4. Pre-Service Form & Signature (`pre_service_signed`)
5. Inspection (`inspection_in_progress`)
6. Start lead job (`job_started`)
7. Complete job (`completed`)
8. Post-Service & Signature (`post_service_signed`)
9. Close lead (`closed`, status `closed_won`)

Each step requires its own confirmations/inputs before moving forward.

## 7. Step Rules and Required Data

### 7.1 Accept / Start / Reach

- Checkbox confirmations are required.
- Reach step shows caller location details and navigation action.

### 7.2 Pre-Service

- Customer must accept terms.
- Customer signature is required.
- Optional notes can be saved.

### 7.3 Inspection

Required checklist includes:

- Front/left/right/rear pictures
- 360 video
- Cluster image
- VIN, make, model, year, plate
- Front tyre size + rear tyre size
- Mileage
- Battery, starter, battery size
- Battery picture
- OBD report picture

Notes:

- Media AI validation is currently disabled in backend toggle for testing.
- Draft autosave runs during inspection step.

### 7.4 Start Lead Job

- Technician confirmation checkbox is required.

### 7.5 Complete Job

Required before submit:

- At least one line item with:
  - Name
  - Picture
  - Quantity > 0
  - Price > 0
- Scrap is optional per item:
  - If enabled, scrap picture is mandatory for that item
  - Optional scrap notes
- Payment proof picture is mandatory
- Payment method captured
- VAT toggle supported (with/without VAT)

### 7.6 Post-Service (Customer-facing checklist)

Required:

- Customer accepts post-service terms
- Customer checklist confirmations:
  - Service completed
  - Car cleaned
  - Work explained
  - Road-test status explained
- Customer signature

### 7.7 Close Lead

Final step marks lead closed in RSA workflow.

## 8. Complete Job Financial Automation

When RSA enters `completed` stage with valid `completeJobPayload`, backend performs:

1. Ensure/create inspection for lead
2. Create estimate from inspection
3. Replace estimate items with approved line items from complete-job step
4. Create invoice from estimate
5. Mark invoice as `paid`
6. Store completion result in workflow data (`estimateId`, `invoiceId`, total)

Result: complete step produces estimate + paid invoice automatically.

## 9. VIN Lookup and Parts Catalog Behavior

Endpoint used by inspection VIN auto-fill:

- `GET /api/company/{companyId}/sales/leads/{leadId}/vin-lookup?vin={VIN}[&carId={sourceCarId}]`

Behavior:

- First checks local VIN catalog cache tables.
- If cache miss: fetches cars from external catalog by VIN.
- Saves all returned cars for the same VIN.
- If multiple cars: returns `requiresCarSelection = true`.
- After user selects car, fetches parts by carId and stores snapshot.
- Next lookups can load from cache.

DB tables used:

- `vin_catalog_cars`
- `vin_catalog_parts`
- `vin_catalog_part_groups`

## 10. Recovery Request from RSA Lead

From RSA leads list, user can create recovery request without converting current RSA lead into recovery directly.

Implemented behavior:

1. Create a new lead with `leadType = recovery`, `division = recovery`
2. Create recovery request linked to the new recovery lead
3. Keep RSA lead separate

Recovery request captures:

- Pickup location
- Dropoff location
- Scheduled datetime
- Remarks optional

Map flow supports:

- Search and suggestions
- Paste Google Maps URL
- Short-link resolve API usage when possible
- Stored map URL values

## 11. Lead Visibility Behavior

- Closed/completed leads are shown in dedicated closed context/tab.
- Active RSA working queue focuses on open items.

## 12. Testing Checklist (UAT)

1. Convert inquiry to RSA lead.
2. Assign user and location from RSA board.
3. Open lead workflow and finish all 9 steps.
4. In inspection, test VIN with:
   - Single matched car
   - Multiple matched cars + select + fetch parts
5. In complete job:
   - Add line items + payment proof
   - Test with VAT on/off
   - Test scrap enabled on one item (must require scrap picture)
6. Submit post-service with customer checklist + signature.
7. Close lead.
8. Verify estimate and invoice are created, and invoice is paid.
9. Verify inquiry actions are disabled after converted lead is closed.

