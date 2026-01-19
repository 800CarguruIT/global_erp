import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core";

type Params = { params: Promise<{ companyId: string }> };

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: Params) {
  const { companyId: rawCompanyId } = await params;
  const companyId = String(rawCompanyId || "").trim();
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  try {
    const sql = getSql();
    const rows = await sql<{
      id: string;
      name: string;
      status: string;
      company_id: string | null;
      starts_at: string | null;
      created_at: string;
    }[]>`
      SELECT id, name, status, company_id, starts_at, created_at
      FROM campaigns
      WHERE scope = 'company' AND company_id = ${companyId}
      ORDER BY created_at DESC
    `;
    const items = rows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      companyId: row.company_id,
      startsAt: row.starts_at,
      createdAt: row.created_at,
    }));
    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET /api/company/[companyId]/marketing/campaigns error:", error);
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId: rawCompanyId } = await params;
  const companyId = String(rawCompanyId || "").trim();
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  const payload = await req.json().catch(() => ({}));
  const name = String(payload?.name ?? "").trim();
  const status = String(payload?.status ?? "draft").trim() || "draft";
  const startsAtRaw = String(payload?.startsAt ?? "").trim();
  const startsAt = startsAtRaw ? new Date(startsAtRaw) : null;
  const startsAtValue =
    startsAt && !Number.isNaN(startsAt.getTime()) ? startsAt : null;
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const sql = getSql();
    const rows = await sql<{
      id: string;
      name: string;
      status: string;
      starts_at: string | null;
      created_at: string;
    }[]>`
      INSERT INTO campaigns (name, status, scope, company_id, starts_at)
      VALUES (${name}, ${status}, 'company', ${companyId}, ${startsAtValue})
      RETURNING id, name, status, starts_at, created_at
    `;
    const row = rows[0];
    if (!row) {
      return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
    }
    return NextResponse.json({
      item: {
        id: row.id,
        name: row.name,
        status: row.status,
        startsAt: row.starts_at,
        createdAt: row.created_at,
      },
    });
  } catch (error) {
    console.error("POST /api/company/[companyId]/marketing/campaigns error:", error);
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
  }
}
