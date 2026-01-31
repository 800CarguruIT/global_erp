import { NextRequest, NextResponse } from "next/server";
import { getEstimateWithItems } from "@repo/ai-core/workshop/estimates/repository";
import { getSql } from "@repo/ai-core/db";

type Params = { params: Promise<{ companyId: string; vendorId: string; estimateId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId, estimateId } = await params;
  if (!companyId || !estimateId) {
    return NextResponse.json({ error: "companyId and estimateId are required" }, { status: 400 });
  }

  const source = req.nextUrl.searchParams.get("source") ?? "estimate";
  if (source === "inventory") {
    const sql = getSql();
    const rows = await sql`
      SELECT id, part_name, description, quantity, part_type
      FROM inventory_order_request_items
      WHERE request_id = ${estimateId} AND status = 'inquiry'
      ORDER BY line_no ASC
    `;
    const parts = rows.map((row: any) => ({
      id: row.id,
      partName: row.part_name,
      description: row.description ?? null,
      quantity: Number(row.quantity ?? 0),
      partType: row.part_type ?? null,
    }));
    return NextResponse.json({ data: parts });
  }

  const data = await getEstimateWithItems(companyId, estimateId);
  if (!data) {
    return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
  }

  const parts = (data.items ?? [])
    .filter((item) => item.status === "inquiry")
    .map((item) => ({
      id: item.id,
      partName: item.partName,
      description: item.description ?? null,
      quantity: Number(item.quantity ?? 0),
      partType:
        item.type === "aftermarket"
          ? "After Market"
          : item.type === "oem"
          ? "OEM"
          : item.type === "used"
          ? "Used"
          : item.type === "genuine"
          ? "OE"
          : item.type ?? null,
    }));

  return NextResponse.json({ data: parts });
}
