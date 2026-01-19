import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = (searchParams.get("search") ?? "").trim();
  const sql = getSql();
  const rows = await sql/* sql */ `
    SELECT id, name, cost, type
    FROM products
    ${search ? sql`WHERE name ILIKE ${"%" + search + "%"} OR type ILIKE ${"%" + search + "%"}` : sql``}
    ORDER BY name ASC
    LIMIT 1000
  `;
  return NextResponse.json({ data: rows ?? [] });
}
