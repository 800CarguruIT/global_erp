import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core";

export const dynamic = "force-dynamic";

function normalizePhone(raw: string | null): { raw: string; digits: string } {
  const value = String(raw ?? "").trim();
  return {
    raw: value,
    digits: value.replace(/\D+/g, ""),
  };
}

function unauthorized() {
  return NextResponse.json(
    { errcode: 401, errmsg: "Unauthorized", data: [] },
    { status: 401 }
  );
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const tokenRequired = String(process.env.YEASTAR_CONTACT_QUERY_TOKEN ?? "").trim();
    const tokenProvided = String(url.searchParams.get("token") ?? "").trim();
    if (tokenRequired && tokenProvided !== tokenRequired) {
      return unauthorized();
    }

    const companyId =
      String(url.searchParams.get("companyId") ?? "").trim() ||
      String(process.env.YEASTAR_CONTACT_COMPANY_ID ?? "").trim();
    const companyIdFilter = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      companyId
    )
      ? companyId
      : null;
    const phone = normalizePhone(url.searchParams.get("phone"));
    if (!phone.raw) {
      return NextResponse.json({ errcode: 0, errmsg: "OK", data: [] });
    }

    const sql = getSql();
    const likeRaw = `%${phone.raw}%`;
    const likeDigits = phone.digits ? `%${phone.digits}%` : null;
    const rows = await sql<
      {
        id: string;
        name: string | null;
        phone: string | null;
        email: string | null;
        code: string | null;
        company_id: string | null;
      }[]
    >`
      SELECT id, name, phone, email, code, company_id
      FROM customers
      WHERE (${companyIdFilter} IS NULL OR company_id = ${companyIdFilter})
        AND (
          phone ILIKE ${likeRaw}
          OR (${likeDigits} IS NOT NULL AND regexp_replace(COALESCE(phone, ''), '\D', '', 'g') ILIKE ${likeDigits})
        )
      ORDER BY created_at DESC
      LIMIT 5
    `;

    const items = ((rows as any).rows ?? rows) as Array<{
      id: string;
      name: string | null;
      phone: string | null;
      email: string | null;
      code: string | null;
      company_id: string | null;
    }>;

    return NextResponse.json({
      errcode: 0,
      errmsg: "OK",
      data: items.map((row) => ({
        id: row.id,
        name: row.name ?? "",
        phone: row.phone ?? "",
        mobile: row.phone ?? "",
        email: row.email ?? "",
        code: row.code ?? "",
        company_id: row.company_id ?? "",
      })),
    });
  } catch (err: any) {
    console.error("GET /api/yeastar/search_contact error", err);
    return NextResponse.json(
      {
        errcode: 500,
        errmsg: err?.message ?? "Lookup failed",
        data: [],
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
