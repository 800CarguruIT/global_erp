import { NextRequest, NextResponse } from "next/server";
import { buildScopeContextFromRoute, requirePermission } from "@/lib/auth/permissions";
import { processPreInspectionBefore24h } from "@/lib/pre-inspection-form";

type Params = { params: Promise<{ companyId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const perm = await requirePermission(
    req,
    "jobs.view",
    buildScopeContextFromRoute({ companyId }, "company")
  );
  if (perm) return perm;

  try {
    const data = await processPreInspectionBefore24h(companyId);
    return NextResponse.json({ data });
  } catch (error) {
    console.error("POST /api/company/[companyId]/pre-inspection/forms/process error:", error);
    return NextResponse.json({ error: "Failed to process pre-inspection reminders" }, { status: 500 });
  }
}

