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

## 13. Premium Inspection Conversion Blueprint

This section converts the premium inspection proposal into an implementation-ready structure for the current RSA/Workshop flow.

### 13.1 Target Step Structure (Inspection Multi-Step)

Use this finalized sequence for inspection workflow:

1. Check-In Verification (Fast Gate)
2. Start Inspection
3. Checks & Notes
4. Vehicle Intelligence (VIN + Specs)
5. Inspection Items (catalog-driven findings/line items)
6. Review & Complete Report

Step goals:

- Step 1 is mandatory before inspector can proceed.
- Step 4 must lock vehicle mapping and parts context.
- Step 5 is optimized for fast issue capture with evidence.
- Step 6 generates premium customer-facing report.

### 13.2 Inspector UI/UX Changes (Fast, Low-Click)

#### A. Step 1: Check-In Verification

Required verify/update fields:

- Check-in photos: front/rear/left/right + 360 video
- VIN
- Tyre size
- Current mileage

Required behavior:

- `Verify` and `Reject` per media item
- If `Reject`, enforce upload of replacement media while preserving old media history
- If visible damage found, allow immediate `Add Damage Evidence` (photo + note)

#### B. Step 3: Checks & Notes

- Keep only essential checks (oil, battery, tyre, OBD) + issue notes
- For checks marked `ISSUE`, show required description and allow multi-photo upload
- Notes/evidence must persist across refresh (autosave + server persistence)

#### C. Step 4: Vehicle Intelligence

Field order:

1. VIN
2. Make
3. Model
4. Year
5. Trim
6. Engine/Drivetrain
7. Tyre size (dropdowns)
8. Mileage

Behavior:

- VIN decode autofills vehicle profile
- If VIN matches multiple cars, enforce selection
- Lock parts catalog to selected VIN/car mapping

#### D. Step 5: Catalog-Driven Inspection Items

Keep line-item flow as:

- Select group first
- Show parts from selected group
- Add one or multiple parts quickly
- Each added issue has:
  - severity
  - evidence photos
  - AI questions/answers
  - recommendation text

### 13.3 Data Model Additions/Normalization

Use current line-items persistence and extend as needed:

- `line_items`
  - `category_key` (group key)
  - `part_number`
  - `severity` (`Safety Risk`, `Mandatory`, `Recommended`, `Optional`)
  - `observed_condition`
  - `why_it_matters`
  - `recommended_action`
  - `evidence_files` (array/json)
  - `ai_questions` (json)
  - `ai_answers` (json)
  - `ai_recommendation`
  - `health_impact_score` (numeric)

Inspection-level draft/report payload:

- `inspection_payload.checkinVerification`
- `inspection_payload.vinVehicleProfile`
- `inspection_payload.categoryHealth`
- `inspection_payload.overallHealth`
- `inspection_payload.reportSummary`

### 13.4 API/Service Responsibilities

#### A. VIN Intelligence

- `GET /api/company/{companyId}/sales/leads/{leadId}/vin-lookup`
- Decode VIN and return exact car profile + parts catalog mapping
- Return confidence + requires selection when multiple matches exist

#### B. Catalog & Suggestions

- `GET /api/company/{companyId}/workshop/inspections/catalog?vin=...`
- `POST /api/company/{companyId}/workshop/inspections/related-suggestions`
  - input: selected issue/part/category
  - output: related items + reason + confidence

#### C. Report Generation

- `POST /api/company/{companyId}/workshop/inspections/{inspectionId}/generate-report`
  - compiles premium report sections
  - groups findings by severity
  - includes layman-friendly explanations

### 13.5 Smart Suggestion Logic (Rule-First + AI Text)

Implement in two layers:

1. Rule engine (mandatory baseline)
- deterministic mapping to avoid misses
- examples:
  - brake pads -> discs, brake fluid, wear sensor
  - uneven tyre wear -> alignment, bearing, suspension arm
  - oil leak -> seals, gaskets, contamination checks

2. AI enhancement (optional)
- generate short plain-language reason
- prioritize suggestions by context/severity/history

Inspector actions:

- Accept all
- Accept single
- Dismiss single

### 13.6 Health Score Logic (Percent-Based)

Scoring outputs:

- Overall health (%)
- Category health (%)

Proposed method:

- Start each category at 100
- Deduct by severity + component criticality + issue count
- Example severity base weights:
  - Safety Risk: -30
  - Mandatory: -15
  - Recommended: -7
  - Optional: -3

Criticality multipliers:

- Brakes/Steering/Suspension/Tyres: 1.4
- Engine/Transmission: 1.2
- Others: 1.0

Clamp:

- category score min 0, max 100
- overall = weighted average of category scores

### 13.7 Premium Customer Report Layout

#### A. Vehicle Overview

- Customer name
- Vehicle details (make/model/year/trim/engine/drivetrain)
- VIN
- Mileage
- Inspection date
- Inspector name
- Key photos

#### B. Overall Health Summary

- Large overall health score
- Category-wise health table

#### C. Priority Summary by Severity

- Safety Risk
- Mandatory
- Recommended
- Optional

#### D. Detailed Findings

For each issue:

- Part/item name
- Category
- Severity
- Observed condition
- Why it matters (plain language)
- Recommended action
- Supporting photos (overview, close-up, optional annotated)

#### E. End-of-Report Summary

- Final grouped decision list by severity
- Clear, scannable "what to do now" summary

### 13.8 Performance and Reliability Rules

- Autosave on field changes and step transitions
- Save on `Next Step` mandatory
- Persist active step and restore on refresh
- Keep UI responsive with optimistic updates where safe
- Block final completion on missing critical evidence

### 13.9 Rollout Plan (Low-Risk)

Phase 1 (workflow hardening):

- Step 1 verification gate
- Step 4 VIN lock and catalog lock
- severity standardization
- autosave + next-step save enforcement

Phase 2 (inspection intelligence):

- catalog-first issue selection
- related suggestions
- evidence-first issue cards
- category/overall health scoring

Phase 3 (premium reporting):

- final report generator
- layman-friendly explanations
- customer-ready PDF/web report layout

### 13.10 UAT Additions for Premium Flow

1. Verify reject/reupload flow preserves old media and saves new media.
2. Validate VIN mismatch prevention and forced car selection when needed.
3. Confirm parts catalog changes when VIN/car selection changes.
4. Validate related suggestion relevance for 5 common scenarios.
5. Confirm health score changes when severity changes.
6. Verify every issue in report includes evidence + plain-language explanation.
7. Validate end-of-report grouped decision summary is complete and scannable.
