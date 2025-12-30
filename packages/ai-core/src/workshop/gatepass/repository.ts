import { getSql } from "../../db";
import { getInvoiceWithItems } from "../invoices/repository";
import { lockLead, getLeadById } from "../../crm/leads/repository";
import type { Gatepass, GatepassHandoverType, GatepassStatus } from "./types";

function mapRow(row: any): Gatepass {
  return {
    id: row.id,
    companyId: row.company_id,
    leadId: row.lead_id,
    workOrderId: row.work_order_id,
    invoiceId: row.invoice_id,
    qualityCheckId: row.quality_check_id,
    carId: row.car_id,
    customerId: row.customer_id,
    handoverType: row.handover_type,
    status: row.status,
    invoiceStatusSnapshot: row.invoice_status_snapshot,
    amountDue: Number(row.amount_due),
    paymentOk: row.payment_ok,
    supervisorId: row.supervisor_id,
    supervisorApprovedAt: row.supervisor_approved_at,
    customerSigned: row.customer_signed,
    customerName: row.customer_name,
    customerIdNumber: row.customer_id_number,
    handoverFormRef: row.handover_form_ref,
    customerSignatureRef: row.customer_signature_ref,
    finalVideoRef: row.final_video_ref,
    finalNote: row.final_note,
    recoveryLeadId: row.recovery_lead_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createGatepassFromInvoice(
  companyId: string,
  invoiceId: string,
  handoverType: GatepassHandoverType = "branch"
): Promise<Gatepass> {
  const sql = getSql();
  const invData = await getInvoiceWithItems(companyId, invoiceId);
  if (!invData) throw new Error("Invoice not found");
  const invoice = invData.invoice;

  const existing =
    await sql/* sql */ `SELECT * FROM gatepasses WHERE company_id = ${companyId} AND invoice_id = ${invoiceId} LIMIT 1`;
  if (existing.length) {
    return mapRow(existing[0]);
  }

  const amountDue = invoice.grandTotal ?? 0;

  const rows =
    await sql/* sql */ `
      INSERT INTO gatepasses (
        company_id,
        lead_id,
        work_order_id,
        invoice_id,
        quality_check_id,
        car_id,
        customer_id,
        handover_type,
        status,
        invoice_status_snapshot,
        amount_due,
        payment_ok
      ) VALUES (
        ${companyId},
        ${invoice.leadId ?? null},
        ${invoice.workOrderId},
        ${invoiceId},
        ${invoice.qualityCheckId ?? null},
        ${invoice.carId ?? null},
        ${invoice.customerId ?? null},
        ${handoverType},
        ${"pending" as GatepassStatus},
        ${invoice.status},
        ${amountDue},
        ${invoice.status === "paid"}
      )
      RETURNING *
    `;

  return mapRow(rows[0]);
}

export async function getGatepassWithSummary(
  companyId: string,
  gatepassId: string
): Promise<{ gatepass: Gatepass }> {
  const sql = getSql();
  const rows =
    await sql/* sql */ `SELECT * FROM gatepasses WHERE company_id = ${companyId} AND id = ${gatepassId} LIMIT 1`;
  if (!rows.length) {
    throw new Error("Gatepass not found");
  }
  return { gatepass: mapRow(rows[0]) };
}

export async function listGatepassesForCompany(
  companyId: string,
  opts: { status?: GatepassStatus } = {}
): Promise<Gatepass[]> {
  const sql = getSql();
  const where = opts.status
    ? sql`company_id = ${companyId} AND status = ${opts.status}`
    : sql`company_id = ${companyId}`;
  const rows =
    await sql/* sql */ `SELECT * FROM gatepasses WHERE ${where} ORDER BY created_at DESC`;
  return rows.map(mapRow);
}

export async function updateGatepass(
  companyId: string,
  gatepassId: string,
  patch: Partial<{
    handoverType: GatepassHandoverType;
    status: GatepassStatus;
    paymentOk: boolean;
    supervisorId: string | null;
    supervisorApprovedAt: string | null;
    customerSigned: boolean;
    customerName: string | null;
    customerIdNumber: string | null;
    handoverFormRef: string | null;
    customerSignatureRef: string | null;
    finalVideoRef: string | null;
    finalNote: string | null;
  }>
): Promise<void> {
  const sql = getSql();
  await sql/* sql */ `
    UPDATE gatepasses
    SET ${sql({
      handover_type: patch.handoverType,
      status: patch.status,
      payment_ok: patch.paymentOk,
      supervisor_id: patch.supervisorId,
      supervisor_approved_at: patch.supervisorApprovedAt,
      customer_signed: patch.customerSigned,
      customer_name: patch.customerName,
      customer_id_number: patch.customerIdNumber,
      handover_form_ref: patch.handoverFormRef,
      customer_signature_ref: patch.customerSignatureRef,
      final_video_ref: patch.finalVideoRef,
      final_note: patch.finalNote,
    })}
    WHERE company_id = ${companyId} AND id = ${gatepassId}
  `;
}

export async function approveGatepassPayment(
  companyId: string,
  gatepassId: string,
  supervisorId: string | null
): Promise<void> {
  const sql = getSql();
  await sql/* sql */ `
    UPDATE gatepasses
    SET payment_ok = TRUE,
        supervisor_id = ${supervisorId ?? null},
        supervisor_approved_at = now(),
        status = 'ready'
    WHERE company_id = ${companyId} AND id = ${gatepassId}
  `;
}

export async function releaseGatepassAndCloseLead(
  companyId: string,
  gatepassId: string
): Promise<void> {
  const sql = getSql();
  const rows =
    await sql/* sql */ `SELECT * FROM gatepasses WHERE company_id = ${companyId} AND id = ${gatepassId} LIMIT 1`;
  if (!rows.length) throw new Error("Gatepass not found");
  const gp = mapRow(rows[0]);

  await sql/* sql */ `
    UPDATE gatepasses
    SET status = 'released'
    WHERE company_id = ${companyId} AND id = ${gatepassId}
  `;

  // lock lead
  if (gp.leadId) {
    await lockLead(companyId, gp.leadId);
  }

  // Optional: create recovery lead if dropoff
  if (gp.handoverType === "dropoff_recovery" && gp.leadId) {
    const lead = await getLeadById(companyId, gp.leadId);
    const newIdRows =
      await sql/* sql */ `
        INSERT INTO leads (
          company_id,
          customer_id,
          car_id,
          lead_type,
          lead_status,
          lead_stage,
          source,
          created_at,
          updated_at
        ) VALUES (
          ${companyId},
          ${lead?.customerId ?? null},
          ${lead?.carId ?? null},
          ${"recovery"},
          ${"open"},
          ${"new"},
          ${"workshop_dropoff"},
          now(),
          now()
        )
        RETURNING id
      `;
    const newLeadId = newIdRows[0]?.id as string | undefined;
    if (newLeadId) {
      await sql/* sql */ `
        UPDATE gatepasses
        SET recovery_lead_id = ${newLeadId}
        WHERE id = ${gatepassId}
      `;
    }
  }
}
