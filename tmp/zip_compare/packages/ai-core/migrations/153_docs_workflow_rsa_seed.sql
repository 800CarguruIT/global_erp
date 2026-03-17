CREATE EXTENSION IF NOT EXISTS pgcrypto;

WITH upsert_page AS (
  INSERT INTO docs_pages (
    id,
    slug,
    title,
    section,
    excerpt,
    content,
    relative_path,
    source,
    status
  )
  VALUES (
    gen_random_uuid(),
    'rsa-inquiry-to-close-lead-flow',
    'RSA Flow: AI Inquiry to Closed Lead',
    'workflow',
    'Implemented RSA process from AI inquiry through assignment, inspection, complete job, post-service, and lead closure.',
    $$# RSA Flow: AI Inquiry to Closed Lead

## Scope

This guide documents the implemented RSA flow from AI inquiry to closed lead, including:

- AI inquiry verification, analysis, and conversion
- RSA assignment with location URL
- RSA multi-step workflow (accept to close)
- VIN lookup with multi-car selection and parts catalog caching
- Complete-job processing with estimate and paid invoice
- Recovery request branching from RSA lead

## Main Flow

1. AI inquiry is verified and optionally analyzed.
2. Inquiry converts to RSA lead.
3. RSA lead is assigned to user with pickup location/map URL.
4. RSA workflow executes:
   - Accept lead
   - Start
   - Reach
   - Pre-Service Form & Signature
   - Inspection
   - Start lead job
   - Complete job
   - Post-Service & Signature
   - Close lead
5. On complete-job step:
   - Line items + payment proof are required
   - VAT with/without option is supported
   - System auto-creates estimate and invoice, then marks invoice paid
6. Lead is closed and inquiry actions are locked.

## Workflow Notes

- Reach step uses location details + Open Navigation.
- Short map links are supported for navigation.
- If VIN returns multiple cars, user selects one before parts fetch.
- VIN cars/parts/groups are cached in global ERP VIN catalog tables.

## Recovery Branching

From RSA leads, recovery request creates a separate recovery lead + recovery request record (does not convert the existing RSA lead in place).$$,
    'workflow/rsa-inquiry-to-close-lead-flow.md',
    'seed',
    'published'
  )
  ON CONFLICT (slug) DO UPDATE SET
    title = EXCLUDED.title,
    section = EXCLUDED.section,
    excerpt = EXCLUDED.excerpt,
    content = EXCLUDED.content,
    relative_path = EXCLUDED.relative_path,
    source = EXCLUDED.source,
    status = 'published',
    is_deleted = FALSE,
    updated_at = now()
  RETURNING id
),
page_row AS (
  SELECT id FROM upsert_page
  UNION ALL
  SELECT p.id
  FROM docs_pages p
  WHERE p.slug = 'rsa-inquiry-to-close-lead-flow'
  LIMIT 1
),
latest AS (
  SELECT
    v.page_id,
    v.version_no,
    v.version_label
  FROM docs_versions v
  INNER JOIN page_row p ON p.id = v.page_id
  ORDER BY v.version_no DESC
  LIMIT 1
),
new_version AS (
  INSERT INTO docs_versions (
    id,
    page_id,
    version_no,
    version_label,
    change_type,
    title,
    section,
    excerpt,
    content,
    changelog,
    created_by,
    is_published,
    created_at,
    published_at
  )
  SELECT
    gen_random_uuid(),
    p.id,
    COALESCE(l.version_no, 0) + 1,
    CASE
      WHEN l.version_label IS NULL THEN '1.0.0'
      ELSE l.version_label || '-workflow-rsa'
    END,
    CASE
      WHEN l.version_no IS NULL THEN 'major'
      ELSE 'minor'
    END,
    'RSA Flow: AI Inquiry to Closed Lead',
    'workflow',
    'Implemented RSA process from AI inquiry through assignment, inspection, complete job, post-service, and lead closure.',
    $$# RSA Flow: AI Inquiry to Closed Lead

## Scope

This guide documents the implemented RSA flow from AI inquiry to closed lead, including:

- AI inquiry verification, analysis, and conversion
- RSA assignment with location URL
- RSA multi-step workflow (accept to close)
- VIN lookup with multi-car selection and parts catalog caching
- Complete-job processing with estimate and paid invoice
- Recovery request branching from RSA lead

## Main Flow

1. AI inquiry is verified and optionally analyzed.
2. Inquiry converts to RSA lead.
3. RSA lead is assigned to user with pickup location/map URL.
4. RSA workflow executes:
   - Accept lead
   - Start
   - Reach
   - Pre-Service Form & Signature
   - Inspection
   - Start lead job
   - Complete job
   - Post-Service & Signature
   - Close lead
5. On complete-job step:
   - Line items + payment proof are required
   - VAT with/without option is supported
   - System auto-creates estimate and invoice, then marks invoice paid
6. Lead is closed and inquiry actions are locked.

## Workflow Notes

- Reach step uses location details + Open Navigation.
- Short map links are supported for navigation.
- If VIN returns multiple cars, user selects one before parts fetch.
- VIN cars/parts/groups are cached in global ERP VIN catalog tables.

## Recovery Branching

From RSA leads, recovery request creates a separate recovery lead + recovery request record (does not convert the existing RSA lead in place).$$,
    'Seeded workflow RSA documentation',
    'system',
    TRUE,
    now(),
    now()
  FROM page_row p
  LEFT JOIN latest l ON l.page_id = p.id
  RETURNING id, page_id
)
UPDATE docs_pages p
SET
  current_version_id = nv.id,
  section = 'workflow',
  title = 'RSA Flow: AI Inquiry to Closed Lead',
  excerpt = 'Implemented RSA process from AI inquiry through assignment, inspection, complete job, post-service, and lead closure.',
  content = $$# RSA Flow: AI Inquiry to Closed Lead

## Scope

This guide documents the implemented RSA flow from AI inquiry to closed lead, including:

- AI inquiry verification, analysis, and conversion
- RSA assignment with location URL
- RSA multi-step workflow (accept to close)
- VIN lookup with multi-car selection and parts catalog caching
- Complete-job processing with estimate and paid invoice
- Recovery request branching from RSA lead

## Main Flow

1. AI inquiry is verified and optionally analyzed.
2. Inquiry converts to RSA lead.
3. RSA lead is assigned to user with pickup location/map URL.
4. RSA workflow executes:
   - Accept lead
   - Start
   - Reach
   - Pre-Service Form & Signature
   - Inspection
   - Start lead job
   - Complete job
   - Post-Service & Signature
   - Close lead
5. On complete-job step:
   - Line items + payment proof are required
   - VAT with/without option is supported
   - System auto-creates estimate and invoice, then marks invoice paid
6. Lead is closed and inquiry actions are locked.

## Workflow Notes

- Reach step uses location details + Open Navigation.
- Short map links are supported for navigation.
- If VIN returns multiple cars, user selects one before parts fetch.
- VIN cars/parts/groups are cached in global ERP VIN catalog tables.

## Recovery Branching

From RSA leads, recovery request creates a separate recovery lead + recovery request record (does not convert the existing RSA lead in place).$$,
  relative_path = 'workflow/rsa-inquiry-to-close-lead-flow.md',
  status = 'published',
  is_deleted = FALSE,
  updated_at = now()
FROM new_version nv
WHERE p.id = nv.page_id;
