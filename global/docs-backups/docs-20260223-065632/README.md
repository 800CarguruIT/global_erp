# Global ERP Documentation

This directory contains technical and operational documentation for the Global ERP system.

## Quick Start

1. Read `architecture/README.md` for system design.
2. Document each feature area in `modules/`.
3. Keep API behavior in `api/`.
4. Track environment and setup steps in `setup/`.
5. Keep production runbooks in `deployment/`.

## Structure

- `architecture/` System context, components, integrations, and data flow
- `modules/` Module-by-module documentation and templates
- `api/` Endpoint contracts and API conventions
- `setup/` Local development and environment setup
- `deployment/` Deployment procedures, rollback, and monitoring
- `troubleshooting/` Common issues and fixes
- `changelog/` Documentation release notes
- `governance/` Standards for doc ownership and update process
- `assets/` Diagrams and images used by docs

## Existing Documents

- `procurement-inquiry-to-inventory-flow.md`

## Documentation Rules

- Every document should include: Owner, Last Updated, Scope.
- Keep examples production-realistic but sanitized.
- Update docs in the same PR as code changes when behavior changes.
