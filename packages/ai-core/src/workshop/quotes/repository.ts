import { getSql } from "../../db";
import type { Quote, QuoteItem } from "./types";

function mapQuoteRow(row: any): Quote {
  return {
    id: row.id,
    companyId: row.company_id,
    quoteType: row.quote_type,
    status: row.status,
    estimateId: row.estimate_id,
    workOrderId: row.work_order_id,
    vendorId: row.vendor_id,
    branchId: row.branch_id,
    currency: row.currency,
    totalAmount: Number(row.total_amount ?? 0),
    quotedAmount: row.quoted_amount != null ? Number(row.quoted_amount) : null,
    acceptedAmount: row.accepted_amount != null ? Number(row.accepted_amount) : null,
    additionalAmount: row.additional_amount != null ? Number(row.additional_amount) : null,
    validUntil: row.valid_until,
    createdBy: row.created_by,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    meta: row.meta,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapQuoteItemRow(row: any): QuoteItem {
  return {
    id: row.id,
    quoteId: row.quote_id,
    lineNo: Number(row.line_no ?? 0),
    estimateItemId: row.estimate_item_id,
    workOrderItemId: row.work_order_item_id,
    name: row.name,
    description: row.description,
    quantity: Number(row.quantity ?? 0),
    unitPrice: Number(row.unit_price ?? 0),
    totalPrice: Number(row.total_price ?? 0),
    partNumber: row.part_number,
    brand: row.brand,
    partType: row.part_type,
    etaDays: row.eta_days != null ? Number(row.eta_days) : null,
    laborHours: row.labor_hours != null ? Number(row.labor_hours) : null,
    laborRate: row.labor_rate != null ? Number(row.labor_rate) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getQuoteWithItems(
  companyId: string,
  quoteId: string
): Promise<{ quote: Quote; items: QuoteItem[] } | null> {
  const sql = getSql();
  const quoteRows = await sql/* sql */ `
    SELECT *
    FROM quotes
    WHERE company_id = ${companyId}
      AND id = ${quoteId}
    LIMIT 1
  `;
  if (!quoteRows.length) return null;

  const itemRows = await sql/* sql */ `
    SELECT *
    FROM quote_items
    WHERE quote_id = ${quoteId}
    ORDER BY line_no ASC, created_at ASC
  `;

  return {
    quote: mapQuoteRow(quoteRows[0]),
    items: itemRows.map(mapQuoteItemRow),
  };
}
