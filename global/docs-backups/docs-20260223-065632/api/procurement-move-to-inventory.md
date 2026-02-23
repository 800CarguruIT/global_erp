# Move PO Item To Inventory

Owner: Supply Chain + Engineering  
Last Updated: 2026-02-20  
Status: draft

## Summary

Moves a received purchase-order line into inventory for items linked to inventory requests.

## Contract

- Method: `POST`
- URL: `/api/company/[companyId]/workshop/procurement/[poId]/move-to-inventory`
- Auth: company-scoped API (expected authenticated context)

## Request

### Headers

- `Content-Type: application/json`

### Body

```json
{
  "itemId": "8c3ec4f8-4d38-4da4-a26f-2b4e65fcd5a3",
  "quantity": 2,
  "partNumber": "BRK-PAD-8821",
  "partBrand": "Brembo",
  "unit": "pcs",
  "category": "Brake",
  "subcategory": "Pad",
  "partType": "Consumable",
  "makeId": "2ccf4cf4-0f7b-4386-b490-b763334391e0",
  "modelId": "5c53fe9b-e95f-477f-bad9-16eeaf3ff5d7",
  "yearId": "6a08277f-2f2c-442f-8e11-dd84f86ba7f4"
}
```

Notes:

- `itemId` is required.
- `quantity` is optional; if omitted, remaining quantity is used.
- Optional classification fields update the linked inventory request item before movement.

## Response

### Success (`200`)

```json
{
  "data": {
    "movedQty": 2,
    "grnNumber": "GRN-20260220-0007"
  }
}
```

### Errors

- `400` Required input missing (`companyId`, `poId`, `itemId`)
- `400` PO item not found
- `400` PO item not linked to inventory request
- `400` PO item not marked as received
- `400` Quantity resolves to no movable balance

Typical error body/text:

```json
{
  "error": "PO item is not marked as received"
}
```

## Behavioral Rules

1. The route only works for PO lines linked to `inventory_request_item_id`.
2. The route enforces `status = received` on the PO item.
3. Movement quantity is capped at remaining request quantity.
4. On success, line field `moved_to_inventory` is set to `true`.
