import { NextRequest, NextResponse } from "next/server";
import { AiInsights } from "@repo/ai-core";
import type { InsightContext } from "@repo/ai-core";

import { requireAuth } from "@/lib/auth/requireAuth";

export const runtime = "nodejs";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId } = await params;
  const url = new URL(req.url);
  const page = url.searchParams.get("page") ?? "company-dashboard";
  const branchId = url.searchParams.get("branchId") ?? undefined;
  const vendorId = url.searchParams.get("vendorId") ?? undefined;
  const lang = url.searchParams.get("lang") ?? "en";

  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  try {
    let ctx: InsightContext;

    switch (page) {
      case "branch-dashboard":
        if (!branchId) {
          return NextResponse.json({ error: "branchId required for branch-dashboard" }, { status: 400 });
        }
        ctx = { page: "branch-dashboard", companyId, branchId };
        break;
      case "vendor":
        if (!vendorId) {
          return NextResponse.json({ error: "vendorId required for vendor page" }, { status: 400 });
        }
        ctx = { page: "vendor", companyId, vendorId };
        break;
      case "leads":
      case "workshop":
      case "inventory":
      case "accounting":
      case "hr":
      case "call-center":
      case "marketing":
      case "revenue":
      case "analytics":
        ctx = { page, companyId };
        break;
      default:
        ctx = { page: "company-dashboard", companyId };
    }

    const result = await AiInsights.generateInsights(ctx, { lang });

    return NextResponse.json(result);
  } catch (err) {
    console.error(`GET /api/company/${companyId}/ai/insights error:`, err);
    return NextResponse.json(
      {
        insights: [],
        kpis: [],
        summary: null,
        generatedAt: new Date().toISOString(),
        aiUsed: false,
        error: "Failed to generate insights",
      },
      { status: 200 }
    );
  }
}
