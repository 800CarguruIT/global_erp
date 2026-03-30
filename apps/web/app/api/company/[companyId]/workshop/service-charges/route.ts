import { NextRequest, NextResponse } from "next/server";
import { getServiceCharges } from "@repo/ai-core/pis/configRepository";
import { getSql } from "@repo/ai-core/db";

type Ctx = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { companyId } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get("leadId");

  const config = await getServiceCharges(companyId);

  let hasRecoveryPickup = false;
  let hasRecoveryDropoff = false;

  if (leadId) {
    const sql = getSql();
    // Check if recovery was requested
    const [lead] = await sql<any[]>`
      SELECT workshop_visit_mode, recovery_direction, recovery_flow, pickup_from, dropoff_to
      FROM leads WHERE id = ${leadId} AND company_id = ${companyId}
    `;
    const isRecovery = lead?.workshop_visit_mode === "recovery" ||
      lead?.recovery_direction === "pickup" || lead?.recovery_direction === "dropoff" ||
      Boolean(lead?.pickup_from) || Boolean(lead?.dropoff_to);

    if (isRecovery) {
      // Check recovery requests
      const recoveryReqs = await sql<any[]>`
        SELECT type FROM recovery_requests WHERE lead_id = ${leadId}
      `.catch(() => []);
      hasRecoveryPickup = recoveryReqs.some((r: any) => r.type === "pickup") || Boolean(lead?.pickup_from);
      hasRecoveryDropoff = recoveryReqs.some((r: any) => r.type === "dropoff") || Boolean(lead?.dropoff_to);
    }
  }

  return NextResponse.json({
    inspectionFee: config.inspection_fee,
    recoveryPickupFee: hasRecoveryPickup ? config.recovery_pickup_fee : 0,
    recoveryDropoffFee: hasRecoveryDropoff ? config.recovery_dropoff_fee : 0,
    labourCharge: config.labour_charge,
    hasRecoveryPickup,
    hasRecoveryDropoff,
    currency: config.currency,
  });
}
