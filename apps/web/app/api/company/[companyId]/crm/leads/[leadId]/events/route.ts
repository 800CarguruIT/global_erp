import { NextRequest, NextResponse } from "next/server";
import { Leads } from "@repo/ai-core";

type Params = { params: Promise<{ companyId: string; leadId: string }> };

// TODO: add auth/permission checks

export async function GET(_req: NextRequest, { params }: Params) {
  const { companyId, leadId } = await params;
  try {
    const events = await Leads.listLeadEvents(companyId, leadId);
    return NextResponse.json(
      { data: events },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (err) {
    console.error("GET lead events failed", err);
    return NextResponse.json(
      { error: "Failed to load events" },
      { status: 500 },
    );
  }
}
