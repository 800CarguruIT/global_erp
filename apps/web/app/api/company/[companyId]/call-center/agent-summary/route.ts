import { NextRequest, NextResponse } from "next/server";
import { CallCenter } from "@repo/ai-core/server";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const url = new URL(req.url);

  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");

  const to = toParam ? new Date(toParam) : new Date();
  const from = fromParam
    ? new Date(fromParam)
    : (() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
      })();

  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return NextResponse.json({ error: "Invalid date parameters" }, { status: 400 });
  }

  const summary = await CallCenter.getAgentSummary({ companyId, from, to });
  return NextResponse.json(summary);
}
