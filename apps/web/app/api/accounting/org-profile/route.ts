import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core";

export const runtime = "nodejs";

export async function GET() {
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT id, name, address, email, phone, tax_id, website, currency, created_at, updated_at
      FROM billing_org_profile
      LIMIT 1
    `;
    return NextResponse.json({ data: rows[0] ?? null });
  } catch (error) {
    console.error("GET /api/accounting/org-profile error", error);
    return NextResponse.json({ error: "Failed to load org profile" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const sql = getSql();
    const body = await req.json().catch(() => ({}));
    const profileRows = await sql`SELECT id FROM billing_org_profile LIMIT 1`;
    const id = profileRows[0]?.id;
    if (!id) {
      return NextResponse.json({ error: "Org profile not initialized" }, { status: 500 });
    }
    await sql`
      UPDATE billing_org_profile
      SET
        name = ${body.name ?? null},
        address = ${body.address ?? null},
        email = ${body.email ?? null},
        phone = ${body.phone ?? null},
        tax_id = ${body.taxId ?? null},
        website = ${body.website ?? null},
        currency = ${body.currency ?? "USD"},
        updated_at = now()
      WHERE id = ${id}
    `;
    const updated = await sql`
      SELECT id, name, address, email, phone, tax_id, website, currency, created_at, updated_at
      FROM billing_org_profile WHERE id = ${id} LIMIT 1
    `;
    return NextResponse.json({ data: updated[0] ?? null });
  } catch (error) {
    console.error("PATCH /api/accounting/org-profile error", error);
    return NextResponse.json({ error: "Failed to update org profile" }, { status: 500 });
  }
}
