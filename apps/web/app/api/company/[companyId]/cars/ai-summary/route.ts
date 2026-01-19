import { NextRequest, NextResponse } from "next/server";
import { canUseAi, getOpenAIClient } from "@repo/ai-core";

type Params = { params: Promise<{ companyId: string }> };

export const runtime = "nodejs";

const defaultTotals = {
  cars: 0,
  active: 0,
  archived: 0,
  carsWithCustomers: 0,
  carsWithoutCustomers: 0,
  linkedCustomers: 0,
  avgCustomersPerCar: 0,
};

export async function GET(_req: NextRequest, { params }: Params) {
  const { companyId: rawCompanyId } = await params;
  const companyId = String(rawCompanyId || "").trim();
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  let totals = { ...defaultTotals };

  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL || "http://localhost:3000";
    const summaryUrl = new URL(`/api/company/${companyId}/cars/summary`, base).toString();
    const summaryRes = await fetch(summaryUrl, { cache: "no-store" });
    if (summaryRes.ok) {
      const summaryJson = await summaryRes.json();
      totals = { ...totals, ...(summaryJson?.totals ?? {}) };
    }
  } catch (err) {
    console.error("Failed to load car summary for AI", err);
  }

  try {
    const allowed = await canUseAi("ai.car.summary" as any, { companyId }).catch(() => true);
    const hasKey = Boolean(process.env.OPENAI_API_KEY);

    if (!allowed || !hasKey) {
      return NextResponse.json({
        suggestions: [],
        appreciation: null,
        totals,
        meta: { aiUsed: false, reason: allowed ? "missing-key" : "disabled" },
      });
    }

    const client = getOpenAIClient();
    const prompt = `
You are an AI fleet/CRM assistant. Based on the metrics below, propose 2-4 concise actions and 1 short appreciation.
Metrics:
- Cars: ${totals.cars} (active: ${totals.active}, archived: ${totals.archived})
- Cars with customers / without customers: ${totals.carsWithCustomers} / ${totals.carsWithoutCustomers}
- Linked customers: ${totals.linkedCustomers}
- Average customers per car: ${totals.avgCustomersPerCar}
Return strict JSON: { "actions": ["..."], "appreciation": "..." } using brief, actionable text.
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: { actions?: string[]; appreciation?: string | null } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }

    return NextResponse.json({
      suggestions: parsed.actions ?? [],
      appreciation: parsed.appreciation ?? null,
      totals,
      meta: { aiUsed: true },
    });
  } catch (err) {
    console.error("GET /api/company/[companyId]/cars/ai-summary error", err);
    return NextResponse.json({
      suggestions: [],
      appreciation: null,
      totals,
      meta: { aiUsed: false, reason: "error" },
    });
  }
}
