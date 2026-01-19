import { NextRequest, NextResponse } from "next/server";
import { ensurePartCatalogItem } from "@repo/ai-core/workshop/parts/repository";
import { getSql } from "@repo/ai-core/db";

type Params = { params: Promise<{ companyId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId: rawCompanyId } = await params;
  const companyId = String(rawCompanyId || "").trim();
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const partNumber = String(body.partNumber || body.name || "").trim();
  const brand = String(body.brand || "SERVICE").trim();
  const description = body.description ? String(body.description) : null;
  const type = (body.type as "stock" | "service" | undefined) || "stock";
  const locationId = body.locationId ? String(body.locationId) : null;

  if (!partNumber) {
    return NextResponse.json({ error: "partNumber is required" }, { status: 400 });
  }

  try {
    const part = await ensurePartCatalogItem(companyId, partNumber, brand, description);
    // If service, optionally register a zero-stock row at the chosen location so it shows assigned instead of Unassigned.
    if (type === "service") {
      const sql = getSql();
      let locationCode: string | null = null;
      if (locationId) {
        const locRows = await sql/* sql */ `
          SELECT code FROM inventory_locations
          WHERE company_id = ${companyId} AND id = ${locationId}
          LIMIT 1
        `;
        locationCode = locRows[0]?.code ?? null;
      }

      if (locationCode) {
        await sql/* sql */ `
          INSERT INTO inventory_stock (company_id, part_id, location_code, on_hand)
          VALUES (${companyId}, ${part.id}, ${locationCode}, 0)
          ON CONFLICT (company_id, part_id, location_code) DO NOTHING
        `;
      }
    }
    return NextResponse.json({ data: part });
  } catch (err) {
    console.error("inventory/parts create error", err);
    return NextResponse.json({ error: "Failed to create item" }, { status: 500 });
  }
}
