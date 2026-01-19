import { NextRequest, NextResponse } from "next/server";
import { Accounting } from "@repo/ai-core";
import { buildScopeContextFromRoute, requirePermission } from "../../../lib/auth/permissions";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const scope = (url.searchParams.get("scope") ?? "company") as "global" | "company";
    const companyId = url.searchParams.get("companyId") ?? undefined;

    const permResp = await requirePermission(
      req,
      "accounting.view",
      buildScopeContextFromRoute({ companyId }, scope)
    );
    if (permResp) return permResp;

    // For simplicity return one entity for requested scope
    const id = await Accounting.resolveEntityId(scope, companyId);
    return NextResponse.json({ entityId: id });
  } catch (error) {
    console.error("GET /api/accounting/entities error:", error);
    return NextResponse.json({ error: "Failed to load entities" }, { status: 500 });
  }
}
