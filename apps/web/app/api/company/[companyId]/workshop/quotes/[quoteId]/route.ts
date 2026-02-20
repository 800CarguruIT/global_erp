import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";

type Params = { params: Promise<{ companyId: string; quoteId: string }> };

function mapWorkshopQuote(row: any) {
  return {
    id: row.id,
    companyId: row.company_id,
    quoteType: "branch_labor",
    status: row.status,
    estimateId: row.estimate_id,
    workOrderId: null,
    vendorId: null,
    branchId: row.branch_id,
    currency: row.currency,
    totalAmount: Number(row.total_amount ?? 0),
    negotiatedAmount: row.negotiated_amount != null ? Number(row.negotiated_amount) : null,
    quotedAmount: row.quoted_amount != null ? Number(row.quoted_amount) : null,
    acceptedAmount: row.accepted_amount != null ? Number(row.accepted_amount) : null,
    additionalAmount: row.additional_amount != null ? Number(row.additional_amount) : 0,
    validUntil: null,
    createdBy: row.created_by,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    meta: row.meta,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { companyId, quoteId } = await params;
  try {
    const sql = getSql();
    const workshopRows = await sql`
      SELECT *
      FROM workshop_quotes
      WHERE company_id = ${companyId} AND id = ${quoteId}
      LIMIT 1
    `;
    if (!workshopRows.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ data: { quote: mapWorkshopQuote(workshopRows[0]), items: [] } });
  } catch (err) {
    console.error("GET quote failed", err);
    return NextResponse.json({ error: "Failed to load quote" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { companyId, quoteId } = await params;
  try {
    const body = await req.json().catch(() => ({}));
    const sql = getSql();

    const workshopRows = await sql`
      SELECT *
      FROM workshop_quotes
      WHERE company_id = ${companyId} AND id = ${quoteId}
      LIMIT 1
    `;
    if (workshopRows.length) {
      const row = workshopRows[0];
      const workflowAction = String(body.workflowAction ?? "").toLowerCase();
      if (workflowAction) {
        if (!["accepted", "negotiation", "rejected"].includes(workflowAction)) {
          return NextResponse.json({ error: "Invalid workflow action." }, { status: 400 });
        }
        const nextMeta = row.meta && typeof row.meta === "object" ? { ...row.meta } : {};

        if (workflowAction === "negotiation") {
          const negotiatedAmount = Number(body.negotiatedAmount);
          if (!Number.isFinite(negotiatedAmount) || negotiatedAmount <= 0) {
            return NextResponse.json({ error: "Valid negotiatedAmount is required." }, { status: 400 });
          }
          (nextMeta as any).negotiationPreviousAmount = Number(row.total_amount ?? 0);
          (nextMeta as any).negotiatedAmount = negotiatedAmount;
          (nextMeta as any).negotiationNote =
            typeof body.negotiationNote === "string" ? body.negotiationNote.trim() || null : null;
          await sql`
            UPDATE workshop_quotes
            SET status = 'negotiation',
                negotiated_amount = ${negotiatedAmount},
                total_amount = ${negotiatedAmount},
                meta = ${nextMeta},
                updated_at = NOW()
            WHERE id = ${quoteId} AND company_id = ${companyId}
          `;
        }

        if (workflowAction === "accepted") {
          const acceptedAmount = Number(
            row.negotiated_amount ?? row.quoted_amount ?? row.total_amount ?? 0
          );
          await sql`
            UPDATE workshop_quotes
            SET status = 'accepted',
                accepted_amount = ${acceptedAmount},
                total_amount = ${acceptedAmount},
                approved_at = NOW(),
                updated_at = NOW()
            WHERE id = ${quoteId} AND company_id = ${companyId}
          `;
          if (row.job_card_id && row.branch_id) {
            await sql`
              UPDATE leads l
              SET branch_id = ${row.branch_id}
              FROM job_cards jc
              WHERE jc.id = ${row.job_card_id}
                AND l.id = jc.lead_id
            `;
            await sql`
              UPDATE job_cards
              SET status = 'Pending',
                  updated_at = NOW()
              WHERE id = ${row.job_card_id}
            `;
          }
        }

        if (workflowAction === "rejected") {
          (nextMeta as any).rejectionReason =
            typeof body.rejectionReason === "string" ? body.rejectionReason.trim() || null : null;
          await sql`
            UPDATE workshop_quotes
            SET status = 'rejected',
                meta = ${nextMeta},
                updated_at = NOW()
            WHERE id = ${quoteId} AND company_id = ${companyId}
          `;
          if (row.job_card_id && row.branch_id) {
            await sql`
              UPDATE leads l
              SET branch_id = NULL
              FROM job_cards jc
              WHERE jc.id = ${row.job_card_id}
                AND l.id = jc.lead_id
                AND l.branch_id IS NOT DISTINCT FROM ${row.branch_id}
            `;
            await sql`
              UPDATE job_cards
              SET status = 'Re-Assigned',
                  updated_at = NOW()
              WHERE id = ${row.job_card_id}
            `;
          }
        }
      } else {
        const requestedStatus =
          typeof body?.status === "string"
            ? body.status
            : typeof body?.header?.status === "string"
            ? body.header.status
            : "";
        const nextStatus = requestedStatus.toLowerCase();
        const item = Array.isArray(body?.items) ? body.items[0] : body?.item;
        const laborHours = Number(item?.laborHours ?? item?.quantity);
        const laborRate = Number(item?.laborRate ?? item?.unitPrice);
        const computedTotal =
          Number.isFinite(laborHours) && Number.isFinite(laborRate) && laborHours > 0 && laborRate >= 0
            ? laborHours * laborRate
            : null;
        const acceptedFromComputed = Number.isFinite(computedTotal)
          ? Number(computedTotal)
          : null;

        if (["pending", "accepted", "negotiation", "rejected", "cancelled", "verified"].includes(nextStatus)) {
          await sql`
            UPDATE workshop_quotes
            SET status = ${nextStatus},
                total_amount = COALESCE(${computedTotal}, total_amount),
                quoted_amount = COALESCE(${computedTotal}, quoted_amount),
                accepted_amount = CASE
                  WHEN ${nextStatus} = 'accepted'
                    THEN COALESCE(${acceptedFromComputed}, negotiated_amount, quoted_amount, total_amount)
                  ELSE accepted_amount
                END,
                eta_hours = COALESCE(${Number.isFinite(laborHours) ? laborHours : null}, eta_hours),
                meta = CASE
                  WHEN ${Number.isFinite(laborRate)} THEN COALESCE(meta, '{}'::jsonb) || jsonb_build_object('laborRate', ${laborRate})
                  ELSE meta
                END,
                updated_at = NOW()
            WHERE id = ${quoteId} AND company_id = ${companyId}
          `;
        } else if (computedTotal != null || Number.isFinite(laborHours) || Number.isFinite(laborRate)) {
          await sql`
            UPDATE workshop_quotes
            SET total_amount = COALESCE(${computedTotal}, total_amount),
                quoted_amount = COALESCE(${computedTotal}, quoted_amount),
                eta_hours = COALESCE(${Number.isFinite(laborHours) ? laborHours : null}, eta_hours),
                meta = CASE
                  WHEN ${Number.isFinite(laborRate)} THEN COALESCE(meta, '{}'::jsonb) || jsonb_build_object('laborRate', ${laborRate})
                  ELSE meta
                END,
                updated_at = NOW()
            WHERE id = ${quoteId} AND company_id = ${companyId}
          `;
        }
      }

      const refreshedRows = await sql`
        SELECT *
        FROM workshop_quotes
        WHERE company_id = ${companyId} AND id = ${quoteId}
        LIMIT 1
      `;
      return NextResponse.json({ data: { quote: mapWorkshopQuote(refreshedRows[0]), items: [] } });
    }

    return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (err) {
    console.error("PATCH quote failed", err);
    return NextResponse.json({ error: "Failed to update quote" }, { status: 500 });
  }
}
