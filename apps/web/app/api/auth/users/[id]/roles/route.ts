import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Rbac } from "@repo/ai-core";
import { buildScopeContextFromRoute, requirePermission } from "../../../../../lib/auth/permissions";

const assignSchema = z.object({
  roleIds: z.array(z.string()).default([]),
});

type ParamsCtx = { params: { id: string } } | { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: ParamsCtx) {
  try {
    const { id } = await ctx.params;
    const roles = await Rbac.getUserRolesWithPermissions(id);
    return NextResponse.json({ data: roles });
  } catch (error) {
    console.error("GET /api/auth/users/[id]/roles error:", error);
    return NextResponse.json({ error: "Failed to load user roles" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: ParamsCtx) {
  try {
    const { id } = await ctx.params;
    const json = await req.json();
    const parsed = assignSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    // For assigning roles we require company admin or global admin depending on role scopes.
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

    await Rbac.assignRolesToUser(id, parsed.data.roleIds);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT /api/auth/users/[id]/roles error:", error);
    return NextResponse.json({ error: "Failed to assign roles" }, { status: 500 });
  }
}
