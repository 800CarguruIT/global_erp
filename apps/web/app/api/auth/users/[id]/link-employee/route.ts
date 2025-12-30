import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Users } from "@repo/ai-core";
import { buildScopeContextFromRoute, requirePermission } from "../../../../../lib/auth/permissions";

const schema = z.object({
  employeeId: z.string(),
});

type ParamsCtx = { params: { id: string } } | { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: ParamsCtx) {
  try {
    const { id } = await ctx.params;
    const json = await req.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const url = new URL(req.url);
    const scope = (url.searchParams.get("scope") ?? "global") as
      | "global"
      | "company"
      | "branch"
      | "vendor";
    const companyId = url.searchParams.get("companyId") ?? undefined;
    const branchId = url.searchParams.get("branchId") ?? undefined;
    const vendorId = url.searchParams.get("vendorId") ?? undefined;
    const permResp = await requirePermission(
      req,
      scope === "global" ? "global.admin" : "company.admin",
      buildScopeContextFromRoute({ companyId, branchId, vendorId }, scope)
    );
    if (permResp) return permResp;

    await Users.linkUserToEmployee(id, parsed.data.employeeId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/auth/users/[id]/link-employee error:", error);
    return NextResponse.json({ error: "Failed to link user" }, { status: 500 });
  }
}
