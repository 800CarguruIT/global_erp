import { NextRequest, NextResponse } from "next/server";
import {
  getInspectionById,
  listInspectionItems,
  listInspectionLineItems,
  replaceInspectionItems,
  updateInspectionPartial,
} from "@repo/ai-core/workshop/inspections/repository";
import type { InspectionItem } from "@repo/ai-core/workshop/inspections/types";
import { getCurrentUserIdFromRequest } from "@/lib/auth/current-user";
import { getSql } from "@repo/ai-core/db";

type Params = { params: Promise<{ companyId: string; inspectionId: string }> };
type VerifyFineInput = { fineCode?: string | null; reason?: string | null; amount?: number | string | null };

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { companyId, inspectionId } = await params;
  const inspection = await getInspectionById(companyId, inspectionId);
  if (!inspection) {
    return new NextResponse("Not found", { status: 404 });
  }
  const items = await listInspectionItems(inspectionId);
  const lineItems = await listInspectionLineItems(inspectionId, { source: "inspection" });
  const sql = getSql();
  const earningsRows = await sql/* sql */ `
    SELECT *
    FROM inspection_earnings
    WHERE company_id = ${companyId} AND inspection_id = ${inspectionId}
    LIMIT 1
  `;
  const fines = await sql/* sql */ `
    SELECT id, fine_code, reason, amount, created_at
    FROM inspection_fines
    WHERE company_id = ${companyId} AND inspection_id = ${inspectionId}
    ORDER BY created_at DESC
  `;
  return NextResponse.json({ data: { inspection, items, lineItems, earnings: earningsRows[0] ?? null, fines } });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { companyId, inspectionId } = await params;
  const body = await req.json().catch(() => ({}));
  const currentUserId = await getCurrentUserIdFromRequest(req);
  const current = await getInspectionById(companyId, inspectionId);
  if (!current) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (body?.action === "verify") {
    try {
      if (current.verifiedAt || (current as any).verified_at) {
        return NextResponse.json({ error: "Inspection is already verified." }, { status: 400 });
      }
      const draft = (current.draftPayload ?? {}) as any;
      const advisorApproved = Boolean(draft?.advisorApproved);
      const customerApproved = Boolean(draft?.customerApproved);
      if (!advisorApproved || !customerApproved) {
        return NextResponse.json(
          { error: "Advisor and customer approvals are required before verify." },
          { status: 400 }
        );
      }
      const isCompleted =
        String(current.status ?? "").toLowerCase() === "completed" || Boolean(current.completeAt);
      if (!isCompleted) {
        return NextResponse.json({ error: "Inspection must be completed before verify." }, { status: 400 });
      }

      const sql = getSql();
      const verifyAt = new Date().toISOString();
      const branchRows = current.branchId
        ? await sql/* sql */ `
            SELECT ownership_type
            FROM branches
            WHERE company_id = ${companyId} AND id = ${current.branchId}
            LIMIT 1
          `
        : [];
      const ownershipType = String(branchRows[0]?.ownership_type ?? "").toLowerCase();
      const isThirdParty = ownershipType === "third_party";

      let earningSnapshot: Record<string, any> | null = null;
      if (isThirdParty) {
        const costRows = await sql/* sql */ `
          SELECT
            COALESCE(wccs.inspection_fixed_amount, 0) AS inspection_fixed_amount,
            COALESCE(NULLIF(wccs.currency, ''), NULLIF(c.currency, ''), 'USD') AS currency,
            COALESCE(wccs.vat_rate, 0) AS vat_rate
          FROM companies c
          LEFT JOIN workshop_company_cost_settings wccs
            ON wccs.company_id = c.id
          WHERE c.id = ${companyId}
          LIMIT 1
        `;
        const cost = costRows[0] as any;
        const fixedAmount = Number(cost?.inspection_fixed_amount ?? 0);
        const currency = String(cost?.currency ?? "USD");
        const vatRate = Number(cost?.vat_rate ?? 0);
        if (!Number.isFinite(fixedAmount) || fixedAmount <= 0) {
          return NextResponse.json(
            { error: "Cost Management is not configured. Set fixed inspection cost first." },
            { status: 400 }
          );
        }

        const inputFines: VerifyFineInput[] = Array.isArray(body?.fines) ? body.fines : [];
        const normalizedFines = inputFines
          .map((fine, index) => ({
            fineCode: fine?.fineCode ? String(fine.fineCode) : `FINE-${Date.now()}-${index + 1}`,
            reason: String(fine?.reason ?? "").trim(),
            amount: Number(fine?.amount ?? 0),
          }))
          .filter((fine) => fine.reason && Number.isFinite(fine.amount) && fine.amount > 0);

        const fineAmount = roundMoney(normalizedFines.reduce((sum, fine) => sum + fine.amount, 0));
        const netBeforeVat = roundMoney(Math.max(fixedAmount - fineAmount, 0));
        const vatAmount = roundMoney(netBeforeVat * (vatRate / 100));
        const totalPayable = roundMoney(netBeforeVat + vatAmount);

        await sql.begin(async (trx) => {
          await trx/* sql */ `
            UPDATE inspections
            SET
              verified_by = ${currentUserId ?? null},
              verified_at = ${verifyAt},
              draft_payload = ${body.draftPayload ?? current.draftPayload ?? null}
            WHERE company_id = ${companyId} AND id = ${inspectionId}
          `;

          await trx/* sql */ `
            INSERT INTO inspection_earnings (
              company_id,
              inspection_id,
              lead_id,
              branch_id,
              gross_amount,
              fine_amount,
              net_before_vat,
              vat_rate,
              vat_amount,
              total_payable,
              currency,
              status,
              verified_by,
              verified_at
            ) VALUES (
              ${companyId},
              ${inspectionId},
              ${current.leadId ?? null},
              ${current.branchId ?? null},
              ${fixedAmount},
              ${fineAmount},
              ${netBeforeVat},
              ${vatRate},
              ${vatAmount},
              ${totalPayable},
              ${currency},
              ${"locked"},
              ${currentUserId ?? null},
              ${verifyAt}
            )
            ON CONFLICT (inspection_id)
            DO UPDATE SET
              gross_amount = EXCLUDED.gross_amount,
              fine_amount = EXCLUDED.fine_amount,
              net_before_vat = EXCLUDED.net_before_vat,
              vat_rate = EXCLUDED.vat_rate,
              vat_amount = EXCLUDED.vat_amount,
              total_payable = EXCLUDED.total_payable,
              currency = EXCLUDED.currency,
              status = EXCLUDED.status,
              verified_by = EXCLUDED.verified_by,
              verified_at = EXCLUDED.verified_at,
              updated_at = now()
          `;

          await trx/* sql */ `
            DELETE FROM inspection_fines
            WHERE company_id = ${companyId} AND inspection_id = ${inspectionId}
          `;
          for (const fine of normalizedFines) {
            await trx/* sql */ `
              INSERT INTO inspection_fines (
                company_id,
                inspection_id,
                fine_code,
                reason,
                amount,
                created_by
              ) VALUES (
                ${companyId},
                ${inspectionId},
                ${fine.fineCode ?? null},
                ${fine.reason},
                ${fine.amount},
                ${currentUserId ?? null}
              )
            `;
          }
        });

        earningSnapshot = {
          grossAmount: fixedAmount,
          fineAmount,
          netBeforeVat,
          vatRate,
          vatAmount,
          totalPayable,
          currency,
          fines: normalizedFines,
        };
      } else {
        await updateInspectionPartial(companyId, inspectionId, {
          verifiedBy: currentUserId ?? null,
          verifiedAt: verifyAt,
          draftPayload: body.draftPayload ?? current.draftPayload ?? null,
        });
      }

      return NextResponse.json({ ok: true, data: { earning: earningSnapshot } });
    } catch (err: any) {
      const message = String(err?.message ?? "");
      if (message.toLowerCase().includes("inspection_earnings") || message.toLowerCase().includes("inspection_fines")) {
        return NextResponse.json(
          { error: "Earnings tables are missing. Please run migration 120_workshop_inspection_earnings.sql." },
          { status: 500 }
        );
      }
      if (message.toLowerCase().includes("workshop_company_cost_settings")) {
        return NextResponse.json(
          { error: "Cost settings table is missing. Please run migration 120_workshop_inspection_earnings.sql." },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: message || "Failed to verify inspection" }, { status: 500 });
    }
  }

  if (body?.action === "cancel") {
    if (current.verifiedAt || (current as any).verified_at) {
      return NextResponse.json({ error: "Verified inspection cannot be cancelled." }, { status: 400 });
    }
    await updateInspectionPartial(companyId, inspectionId, {
      status: "cancelled",
      cancelledBy: currentUserId ?? null,
      cancelledAt: new Date().toISOString(),
      cancelRemarks: body.cancelRemarks ?? body.cancel_remarks ?? null,
      draftPayload: body.draftPayload ?? current.draftPayload ?? null,
    });
    return NextResponse.json({ ok: true });
  }

  if (current.verifiedAt || (current as any).verified_at) {
    return NextResponse.json({ error: "Verified inspection is read-only." }, { status: 400 });
  }

  const patch = {
    status: body.status,
    startAt: body.startAt ?? body.start_at,
    completeAt: body.completeAt ?? body.complete_at,
    verifiedBy: body.verifiedBy ?? body.verified_by,
    verifiedAt: body.verifiedAt ?? body.verified_at,
    cancelledBy: body.cancelledBy ?? body.cancelled_by,
    cancelledAt: body.cancelledAt ?? body.cancelled_at,
    cancelRemarks: body.cancelRemarks ?? body.cancel_remarks,
    healthEngine: body.healthEngine,
    healthTransmission: body.healthTransmission,
    healthBrakes: body.healthBrakes,
    healthSuspension: body.healthSuspension,
    healthElectrical: body.healthElectrical,
    overallHealth: body.overallHealth,
    customerRemark: body.customerRemark,
    agentRemark: body.agentRemark,
    inspectorRemark: body.inspectorRemark,
    inspectorRemarkLayman: body.inspectorRemarkLayman,
    aiSummaryMarkdown: body.aiSummaryMarkdown,
    aiSummaryPlain: body.aiSummaryPlain,
    draftPayload: body.draftPayload,
  };

  await updateInspectionPartial(companyId, inspectionId, patch);

  if (Array.isArray(body.items)) {
    const items: InspectionItem[] = body.items;
    await replaceInspectionItems(
      inspectionId,
      items.map((i, index) => ({
        inspectionId,
        lineNo: (i as any).lineNo ?? index + 1,
        category: i.category ?? null,
        partName: i.partName,
        severity: i.severity ?? null,
        requiredAction: i.requiredAction ?? null,
        techReason: i.techReason ?? null,
        laymanReason: i.laymanReason ?? null,
        photoRefs: i.photoRefs ?? null,
      }))
    );
  }

  return NextResponse.json({ ok: true });
}
