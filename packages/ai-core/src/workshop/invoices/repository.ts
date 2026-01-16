import { getSql } from "../../db";
import { getQualityCheckWithItems } from "../qualityCheck/repository";
import { getEstimateWithItems } from "../estimates/repository";
import { createWorkOrderFromEstimate } from "../workorders/repository";
import type { Invoice, InvoiceItem, InvoiceStatus } from "./types";

function mapInvoiceRow(row: any): Invoice {
  return {
    id: row.id,
    companyId: row.company_id,
    workOrderId: row.work_order_id,
    estimateId: row.estimate_id,
    qualityCheckId: row.quality_check_id,
    inspectionId: row.inspection_id,
    leadId: row.lead_id,
    carId: row.car_id,
    customerId: row.customer_id,
    invoiceNumber: row.invoice_number,
    invoiceDate: row.invoice_date,
    status: row.status,
    paymentMethod: row.payment_method,
    dueDate: row.due_date,
    paidAt: row.paid_at,
    totalSale: Number(row.total_sale),
    totalDiscount: Number(row.total_discount),
    finalAmount: Number(row.final_amount),
    vatRate: Number(row.vat_rate),
    vatAmount: Number(row.vat_amount),
    grandTotal: Number(row.grand_total),
    terms: row.terms,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapItemRow(row: any): InvoiceItem {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    workOrderItemId: row.work_order_item_id,
    estimateItemId: row.estimate_item_id,
    lineNo: row.line_no,
    name: row.name,
    description: row.description,
    quantity: Number(row.quantity),
    rate: Number(row.rate),
    lineSale: Number(row.line_sale),
    lineDiscount: Number(row.line_discount),
    lineFinal: Number(row.line_final),
  };
}

async function nextInvoiceNumber(companyId: string): Promise<string> {
  const sql = getSql();
  const today = new Date();
  const year = today.getFullYear();
  const prefix = `INV-${year}-`;
  const rows = await sql`
    SELECT invoice_number
    FROM invoices
    WHERE company_id = ${companyId} AND invoice_number LIKE ${prefix + "%"}
    ORDER BY invoice_number DESC
    LIMIT 1
  `;
  if (!rows.length) return `${prefix}0001`;
  const lastRow = rows[0];
  const last = (lastRow?.invoice_number as string | undefined) ?? "";
  const numPart = last ? parseInt(last.replace(prefix, "")) || 0 : 0;
  const nextNum = (numPart + 1).toString().padStart(4, "0");
  return `${prefix}${nextNum}`;
}

export async function createInvoiceFromQualityCheck(companyId: string, qcId: string): Promise<{
  invoice: Invoice;
  items: InvoiceItem[];
}> {
  const sql = getSql();
  const qcData = await getQualityCheckWithItems(companyId, qcId);
  if (!qcData) throw new Error("Quality check not found");
  const { qc } = qcData;

  const woId = qc.workOrderId;
  const estimateId = qc.estimateId ?? null;

  const estimate = estimateId ? await getEstimateWithItems(companyId, estimateId) : null;
  const lines = estimate?.items ?? [];

  const invoiceNumber = await nextInvoiceNumber(companyId);
  const vatRate = estimate?.estimate.vatRate ?? 5.0;

  const invRows = await sql`
    INSERT INTO invoices (
      company_id,
      work_order_id,
      estimate_id,
      quality_check_id,
      inspection_id,
      lead_id,
      car_id,
      customer_id,
      invoice_number,
      invoice_date,
      status,
      vat_rate,
      terms,
      notes
    ) VALUES (
      ${companyId},
      ${woId},
      ${estimateId},
      ${qcId},
      ${qc.inspectionId ?? null},
      ${qc.leadId ?? null},
      ${qc.carId ?? null},
      ${qc.customerId ?? null},
      ${invoiceNumber},
      ${new Date().toISOString().slice(0, 10)},
      ${"draft" as InvoiceStatus},
      ${vatRate},
      ${null},
      ${null}
    )
    RETURNING *
  `;
  const invoice = mapInvoiceRow(invRows[0]);

  for (const [idx, line] of lines.entries()) {
    const qty = line.quantity ?? 1;
    const rate = line.sale ?? 0;
    const lineSale = qty * rate;
    const lineDiscount = 0;
    const lineFinal = lineSale - lineDiscount;
    await sql`
      INSERT INTO invoice_items (
        invoice_id,
        work_order_item_id,
        estimate_item_id,
        line_no,
        name,
        description,
        quantity,
        rate,
        line_sale,
        line_discount,
        line_final
      ) VALUES (
        ${invoice.id},
        ${null},
        ${line.id},
        ${line.lineNo ?? idx + 1},
        ${line.partName},
        ${line.description ?? null},
        ${qty},
        ${rate},
        ${lineSale},
        ${lineDiscount},
        ${lineFinal}
      )
    `;
  }

  await recalculateInvoiceTotals(invoice.id);
  const refreshed = await getInvoiceWithItems(companyId, invoice.id);
  return {
    invoice: refreshed?.invoice ?? invoice,
    items: refreshed?.items ?? [],
  };
}

export async function createInvoiceFromEstimate(
  companyId: string,
  estimateId: string
): Promise<{ invoice: Invoice; items: InvoiceItem[] }> {
  const sql = getSql();
  const estimateData = await getEstimateWithItems(companyId, estimateId);
  if (!estimateData) throw new Error("Estimate not found");
  const { estimate, items: lines } = estimateData;

  let workOrderId: string | null = null;
  const woRows = await sql`
    SELECT id
    FROM work_orders
    WHERE company_id = ${companyId} AND estimate_id = ${estimateId}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  if (woRows.length) {
    workOrderId = woRows[0].id;
  } else {
    const created = await createWorkOrderFromEstimate(companyId, estimateId);
    workOrderId = created.workOrder.id;
  }

  const invoiceNumber = await nextInvoiceNumber(companyId);
  const vatRate = estimate.vatRate ?? 5.0;

  const invRows = await sql`
    INSERT INTO invoices (
      company_id,
      work_order_id,
      estimate_id,
      quality_check_id,
      inspection_id,
      lead_id,
      car_id,
      customer_id,
      invoice_number,
      invoice_date,
      status,
      vat_rate,
      terms,
      notes
    ) VALUES (
      ${companyId},
      ${workOrderId},
      ${estimateId},
      ${null},
      ${estimate.inspectionId ?? null},
      ${estimate.leadId ?? null},
      ${estimate.carId ?? null},
      ${estimate.customerId ?? null},
      ${invoiceNumber},
      ${new Date().toISOString().slice(0, 10)},
      ${"draft" as InvoiceStatus},
      ${vatRate},
      ${null},
      ${null}
    )
    RETURNING *
  `;
  const invoice = mapInvoiceRow(invRows[0]);

  for (const [idx, line] of lines.entries()) {
    const qty = line.quantity ?? 1;
    const rate = line.sale ?? 0;
    const lineSale = qty * rate;
    const lineDiscount = 0;
    const lineFinal = lineSale - lineDiscount;
    await sql`
      INSERT INTO invoice_items (
        invoice_id,
        work_order_item_id,
        estimate_item_id,
        line_no,
        name,
        description,
        quantity,
        rate,
        line_sale,
        line_discount,
        line_final
      ) VALUES (
        ${invoice.id},
        ${null},
        ${line.id},
        ${line.lineNo ?? idx + 1},
        ${line.partName},
        ${line.description ?? null},
        ${qty},
        ${rate},
        ${lineSale},
        ${lineDiscount},
        ${lineFinal}
      )
    `;
  }

  await recalculateInvoiceTotals(invoice.id);
  await sql`
    UPDATE estimates
    SET status = 'invoiced',
        invoice_status = 'Invoiced',
        invoice_date = ${new Date().toISOString().slice(0, 10)}
    WHERE id = ${estimateId} AND company_id = ${companyId}
  `;
  const refreshed = await getInvoiceWithItems(companyId, invoice.id);
  return {
    invoice: refreshed?.invoice ?? invoice,
    items: refreshed?.items ?? [],
  };
}

export async function getInvoiceWithItems(
  companyId: string,
  invoiceId: string
): Promise<{ invoice: Invoice; items: InvoiceItem[] } | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM invoices
    WHERE company_id = ${companyId} AND id = ${invoiceId}
    LIMIT 1
  `;
  if (!rows.length) return null;
  const invoice = mapInvoiceRow(rows[0]);
  const items = await getInvoiceItems(invoiceId);
  return { invoice, items };
}

export async function listInvoicesForCompany(
  companyId: string,
  opts: { status?: InvoiceStatus; limit?: number } = {}
): Promise<Invoice[]> {
  const sql = getSql();
  const { status, limit = 100 } = opts;
  const where = status ? sql`company_id = ${companyId} AND status = ${status}` : sql`company_id = ${companyId}`;
  const rows = await sql`
    SELECT * FROM invoices
    WHERE ${where}
    ORDER BY invoice_date DESC, created_at DESC
    LIMIT ${limit}
  `;
  return rows.map(mapInvoiceRow);
}

export async function updateInvoiceHeader(
  companyId: string,
  invoiceId: string,
  patch: Partial<{
    status: InvoiceStatus;
    invoiceDate: string;
    paymentMethod: string | null;
    dueDate: string | null;
    vatRate: number;
    terms: string | null;
    notes: string | null;
  }>
): Promise<void> {
  const sql = getSql();
  const updated = {
    status: patch.status,
    invoice_date: patch.invoiceDate,
    payment_method: patch.paymentMethod,
    due_date: patch.dueDate,
    vat_rate: patch.vatRate,
    terms: patch.terms,
    notes: patch.notes,
  };
  await sql`
    UPDATE invoices
    SET ${sql(updated)}
    WHERE company_id = ${companyId} AND id = ${invoiceId}
  `;
}

export async function replaceInvoiceItems(
  invoiceId: string,
  items: Array<{
    id?: string;
    lineNo?: number;
    name: string;
    description?: string | null;
    quantity: number;
    rate: number;
    lineDiscount: number;
  }>
): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM invoice_items WHERE invoice_id = ${invoiceId}`;
  if (!items.length) {
    await recalculateInvoiceTotals(invoiceId);
    return;
  }

  for (const [idx, item] of items.entries()) {
    const lineSale = (item.quantity ?? 0) * (item.rate ?? 0);
    const lineFinal = lineSale - (item.lineDiscount ?? 0);
    await sql`
      INSERT INTO invoice_items (
        invoice_id,
        work_order_item_id,
        estimate_item_id,
        line_no,
        name,
        description,
        quantity,
        rate,
        line_sale,
        line_discount,
        line_final
      ) VALUES (
        ${invoiceId},
        ${null},
        ${null},
        ${item.lineNo ?? idx + 1},
        ${item.name},
        ${item.description ?? null},
        ${item.quantity ?? 0},
        ${item.rate ?? 0},
        ${lineSale},
        ${item.lineDiscount ?? 0},
        ${lineFinal}
      )
    `;
  }

  await recalculateInvoiceTotals(invoiceId);
}

export async function recalculateInvoiceTotals(invoiceId: string): Promise<void> {
  const sql = getSql();
  const rows = await sql`
    SELECT line_sale, line_discount
    FROM invoice_items
    WHERE invoice_id = ${invoiceId}
  `;

  let totalSale = 0;
  let totalDiscount = 0;
  for (const row of rows) {
    totalSale += Number(row.line_sale ?? 0);
    totalDiscount += Number(row.line_discount ?? 0);
  }

  const invRows = await sql`
    SELECT vat_rate FROM invoices WHERE id = ${invoiceId} LIMIT 1
  `;
  const vatRate =
    invRows.length && invRows[0]?.vat_rate !== undefined ? Number(invRows[0].vat_rate) : 0;

  const finalAmount = totalSale - totalDiscount;
  const vatAmount = finalAmount * (vatRate / 100);
  const grandTotal = finalAmount + vatAmount;

  await sql`
    UPDATE invoices
    SET
      total_sale = ${totalSale},
      total_discount = ${totalDiscount},
      final_amount = ${finalAmount},
      vat_amount = ${vatAmount},
      grand_total = ${grandTotal}
    WHERE id = ${invoiceId}
  `;
}

async function getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT *
    FROM invoice_items
    WHERE invoice_id = ${invoiceId}
    ORDER BY line_no ASC
  `;
  return rows.map(mapItemRow);
}
