import { NextRequest, NextResponse } from "next/server";
import { getInspectionById, updateInspectionVinDecode } from "@repo/ai-core/workshop/inspections/repository";
import { decodeVin } from "@/lib/vin-decode";
import { getSql } from "@repo/ai-core/db";
import { resolveOpenAiConfig } from "@/lib/ai-config";

type Params = { params: Promise<{ companyId: string; inspectionId: string }> };

/**
 * POST — Decode only (no save). Returns decoded data for user confirmation.
 * PUT  — Confirm and save decoded data to car + inspection.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { companyId, inspectionId } = await params;
  const body = await req.json().catch(() => ({}));
  const vin = String(body?.vin ?? "").trim().toUpperCase();

  if (!vin || vin.length !== 17) {
    return NextResponse.json({ error: "Valid 17-character VIN is required" }, { status: 400 });
  }

  const inspection = await getInspectionById(companyId, inspectionId);
  if (!inspection) {
    return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
  }

  try {
    const aiConfig = await resolveOpenAiConfig(companyId);
    const result = await decodeVin(vin, {
      apiKey: aiConfig.apiKey ?? undefined,
      baseUrl: aiConfig.baseUrl ?? undefined,
      model: aiConfig.model,
    });

    // Return decoded data WITHOUT saving — user must confirm first
    return NextResponse.json({ data: result });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "VIN decode failed" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { companyId, inspectionId } = await params;
  const body = await req.json().catch(() => ({}));

  const inspection = await getInspectionById(companyId, inspectionId);
  if (!inspection) {
    return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
  }

  const { vin, make, model, year, bodyType, decodeResult } = body ?? {};

  // Save decode result to inspection
  if (decodeResult) {
    await updateInspectionVinDecode(companyId, inspectionId, decodeResult);
  }

  // Update linked car
  if (inspection.carId && (vin || make || model || year)) {
    const sql = getSql();
    await sql`
      UPDATE cars SET
        vin = COALESCE(${vin ?? null}, vin),
        make = COALESCE(${make ?? null}, make),
        model = COALESCE(${model ?? null}, model),
        model_year = COALESCE(${year ? Number(year) : null}, model_year),
        body_type = COALESCE(${bodyType ?? null}, body_type),
        updated_at = now()
      WHERE id = ${inspection.carId} AND company_id = ${companyId}
    `;
  }

  return NextResponse.json({ success: true });
}
