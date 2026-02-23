# API Changelog

## Versioning Policy

- Baseline version: `v1`
- Change types:
  - `breaking`: contract or behavior change requiring client update.
  - `non-breaking`: additive or backward-compatible change.
- Each API module doc should include:
  - Version
  - Last updated
  - Endpoint index

## 2026-02-23 - v1 Baseline (non-breaking)

### Added API sections

- App API chapter and module pages
- Mobile API chapter and module pages

### Added shared docs

- `api-common.md`
- `api-common-errors.md`
- `api-status-dictionary.md`

### Added module docs

- Users (App + Mobile)
- Leads (App + Mobile)
- Inspections (App + Mobile)
- Estimates (App + Mobile)
- Job Cards (App + Mobile)
- Inventory (App + Mobile)
- Procurement (App + Mobile)
- Accounting (App + Mobile, availability note for mobile)

### Documentation format improvements

- Request body field tables now include:
  - Type
  - Required
  - Nullable
  - Default
  - Description
- Success schema and error schema are separated.
- Workflow sequence blocks added by module.

## Template for Future Entries

### YYYY-MM-DD - vX.Y.Z (breaking/non-breaking)

- Module: <name>
- Endpoint: <method> <path>
- Change: <summary>
- Impact: <client impact>
- Migration notes: <if breaking>
