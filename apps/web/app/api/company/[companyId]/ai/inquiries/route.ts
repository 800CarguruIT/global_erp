import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { companyId: rawCompanyId } = await params;
  const companyId = String(rawCompanyId || "").trim();
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  const sql = getSql();
  try {
    const rows = await sql<{
      id: string;
      provider_key: string;
      provider_call_id: string;
      from_number: string | null;
      to_number: string | null;
      inquiry_status: string;
      inquiry_summary: string | null;
      conversion_status: string;
      converted_to_lead_id: string | null;
      lead_outcome: string | null;
      outcome_reason: string | null;
      created_at: string;
      updated_at: string;
    }[]>`
      SELECT
        id,
        provider_key,
        provider_call_id,
        from_number,
        to_number,
        inquiry_status,
        inquiry_summary,
        conversion_status,
        converted_to_lead_id,
        lead_outcome,
        outcome_reason,
        created_at,
        updated_at
      FROM call_ai_inquiries
      WHERE company_id = ${companyId}
      ORDER BY created_at DESC
      LIMIT 200
    `;

    return NextResponse.json({ companyId, inquiries: rows });
  } catch (err: any) {
    if (String(err?.code ?? "") === "42P01") {
      return NextResponse.json({
        companyId,
        inquiries: [],
        warning: "call_ai_inquiries table not found. Run migrations.",
      });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load AI inquiries" },
      { status: 500 }
    );
  }
}

