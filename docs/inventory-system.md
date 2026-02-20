## Inventory system overview

The `inventory` module lives inside `packages/ai-core/workshop/inventory` and supports every piece of stock tracking: master SKU catalog, location hierarchy, stock aggregation, receiving, requesting, and transfer workflows. The companion UI materializes the workflow across `/apps/web/app/company/[companyId]/inventory/*` and related procurement/vendor pages.

### Core database tables (latest migrations)
- `inventory_locations` – physical locations (warehouse, branch, fleet, other). Trigger updates timestamps and enforces company ownership. Each row is `code`, `name`, `location_type`, optional branch/fleet linkage, and `is_active`. Deleting a location is guarded by stock and movement checks; deactivation is preferred.
- `parts_catalog` – SKU master definition (`part_number`, brand, description, `qr_code`) referenced by stock/transfer tables.
- `inventory_stock` – aggregated on-hand per SKU + location code. Updated by the `trg_apply_inventory_movement` trigger whenever `inventory_movements` receives a row.
- `inventory_movements` – audit trail for every in/out event (receipts, transfers, manual adjustments), including `source_type` and links back to purchase orders/transfers.
- `inventory_transfer_orders` + `inventory_transfer_items` – workflow objects for location-to-location transfers. Statuses are `draft → approved → in_transit → completed` (new migration `114_inventory_transfer_approval.sql` added `approved_at`, `approved_by`, `dispatched_by`). Transfer items capture quantity per `parts_catalog`.
- `inventory_order_requests` (and related migrations) to capture procurement requests.
- Car taxonomy tables (`inventory_car_makes`, `inventory_car_models`, `inventory_model_years`) seeded via `108`/`109` migrations for multi-level product classification.

### APIs that expose the system
Key routes under `/apps/web/app/api/company/[companyId]/workshop/inventory/*`:
1. `/locations` – `GET` loads locations (with `includeInactive` toggle), `POST` adds a location, `PATCH` toggles attributes, `DELETE` removes a location (guarded by stock and movements).
2. `/stock` – aggregates stock rows, joins taxonomy data (type/category/make/model/year), supports filters for location/type/category/make/model/year/search.
3. `/order-requests` – CRUD for inventory request lines (type/category/make/model/year cascades).
4. `/transfers` – `GET` lists transfers, `POST` creates a draft, `PATCH` approves, dispatches, receives (`approveTransfer`, `startTransfer`, `completeTransfer` in the repository). The detail route `/transfers/[transferId]` fetches the transfer with joined user names for timeline display.
5. `/locations` also used by procurement move-to-inventory UI to populate location dropdowns.

Client/UI notes:
- `apps/web/app/company/[companyId]/inventory/stock/page.tsx` shows summary KPI cards, filters, and a tree-like action to request transfers and view stock, plus a modal for creating transfers (with pre-filled source, destination, quantity and creative validation).
- Procurement and vendor flows now pass car taxonomy info (make/model/year) through move-to-inventory forms, and the transfer detail UI demonstrates the sequential approve/dispatch/receive timeline, including printing a QR-backed dispatch note.
- Inventory request creation/modals reuse taxonomy-driven selects, default part types, and part/code display so users can manage SKU master data consistently.

## Product catalog linkage
- The product catalog is stored entirely in `parts_catalog` and referenced from every workflow (procurement, inventory stock, transfers, movements, request lines). The table includes a `qr_code` column generated when missing.
- Use the taxonomy joins in `listStock` and the transfer UI to present part name/code/type/category info without duplicating logic.
- For new requirements, extend `parts_catalog` (or the taxonomy tables) and keep APIs in `/apps/web/app/api/company/[companyId]/workshop/inventory/*` aligned so filters and select options remain consistent.

## Suggested documentation sections to expand
1. **Car taxonomy** – describe migrations `108`/`109`, highlight global seed data, and outline how `inventory_car_makes/models/years` cascade in the UI stack.
2. **Transfer workflow** – spell out the status transitions (draft → approved → in_transit → completed), describe the `approveTransfer`, `startTransfer`, `completeTransfer` helpers, and reference the timeline component in `packages/ui/src/main-pages/InventoryTransferDetailMain.tsx`.
3. **Stock safety nets** – mention triggers (e.g., `apply_inventory_movement`) and manual fallbacks (`packages/ai-core/src/workshop/parts/repository.ts` eventually upserts stock if the trigger is missing) so engineers understand why manual adjustments always maintain aggregates.
4. **API usage** – explain how the frontend consumes each endpoint, including filter expectations (e.g., location, taxonomy, make/model/year) and error handling (e.g., `INSUFFICIENT_STOCK` 409 response during dispatch).
5. **Operational notes** – include the UI-side ability to print dispatch notes with QR codes and reference the `qrcode` package usage in `packages/ui/src/main-pages/InventoryTransferDetailMain.tsx`.

Feel free to extend this doc with screenshots, sequence diagrams, or workflow tables. Let me know if you want me to generate Markdown sections for any of the suggested expansions or keep them in a handbook elsewhere.
