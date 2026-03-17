import { NextRequest, NextResponse } from "next/server";
import { Crm, getSql } from "@repo/ai-core";
import { getEstimateWithItems } from "@repo/ai-core/workshop/estimates/repository";

import { requireAuth } from "@/lib/auth/requireAuth";

type Params = { params: Promise<{ companyId: string; estimateId: string }> };

const toText = (value: unknown) => String(value ?? "").trim();

const toVin = (value: unknown) => toText(value).toUpperCase();

const pickMetaVin = (meta: any): string => {
  const candidates = [
    meta?.inspectionVin,
    meta?.inspection_vin,
    meta?.carVin,
    meta?.car_vin,
    meta?.vin,
  ];
  for (const candidate of candidates) {
    const vin = toVin(candidate);
    if (vin) return vin;
  }
  return "";
};

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  try {
    const { companyId, estimateId } = await params;
    if (!companyId || !estimateId) {
      return NextResponse.json({ error: "companyId and estimateId are required" }, { status: 400 });
    }

    const estimateData = await getEstimateWithItems(companyId, estimateId);
    const estimate = estimateData?.estimate;
    if (!estimate) {
      return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
    }

    const searchRaw = toText(req.nextUrl.searchParams.get("search"));
    const searchLike = searchRaw ? `%${searchRaw}%` : "";
    const requestedVin = toVin(req.nextUrl.searchParams.get("vin"));
    const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? 80);
    const limit = Math.max(20, Math.min(Number.isFinite(limitRaw) ? limitRaw : 80, 300));

    let vin = requestedVin || pickMetaVin(estimate.meta ?? {});
    if (!vin && estimate.carId) {
      const car = await Crm.getCarWithCustomers(estimate.carId).catch(() => null);
      vin = toVin((car as any)?.vin);
    }

    if (!vin) {
      return NextResponse.json({ data: [], meta: { vin: null, total: 0, message: "VIN not found on estimate car." } });
    }

    const sql = getSql();
    const rows = await sql<any[]>/* sql */ `
      SELECT
        p.id,
        p.part_name,
        p.part_number,
        COALESCE(
          string_agg(DISTINCT NULLIF(TRIM(g.group_name), ''), ', ' ORDER BY NULLIF(TRIM(g.group_name), '')),
          ''
        ) AS group_names
      FROM vin_catalog_parts p
      LEFT JOIN vin_catalog_part_groups g
        ON g.part_ref_id = p.id
      WHERE p.car_vin = ${vin}
        AND (
          ${searchLike} = ''
          OR p.part_name ILIKE ${searchLike}
          OR p.part_number ILIKE ${searchLike}
          OR g.group_name ILIKE ${searchLike}
        )
      GROUP BY p.id, p.part_name, p.part_number
      ORDER BY
        CASE WHEN p.part_name IS NULL OR TRIM(p.part_name) = '' THEN 1 ELSE 0 END ASC,
        p.part_name ASC NULLS LAST,
        p.part_number ASC NULLS LAST
      LIMIT ${limit}
    `;

    const data = rows.map((row, index) => {
      const partName = toText(row?.part_name);
      const partNumber = toText(row?.part_number);
      const name = partName || partNumber || `VIN Part ${index + 1}`;
      const label = partNumber ? `${name} (${partNumber})` : name;
      return {
        id: toText(row?.id) || `${partNumber || name}-${index}`,
        name,
        label,
        partNumber: partNumber || null,
        type: toText(row?.group_names) || null,
      };
    });

    return NextResponse.json({ data, meta: { vin, total: data.length } });
  } catch (error) {
    console.error("GET /api/company/[companyId]/workshop/estimates/[estimateId]/vin-parts error:", error);
    return NextResponse.json({ error: "Failed to load VIN catalog parts." }, { status: 500 });
  }
}

