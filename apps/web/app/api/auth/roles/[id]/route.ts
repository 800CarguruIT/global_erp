import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Rbac } from "@repo/ai-core";
import { buildScopeContextFromRoute, requirePermission } from "../../../../../lib/auth/permissions";

const updateSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional().nullable(),
  permissionKeys: z.array(z.string()).optional(),
});

type ParamsCtx = { params: { id: string } } | { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: ParamsCtx) {
  try {
    const { id } = await ctx.params;
    // Cannot infer scope without role; load then allow
    const role = await Rbac.getRoleDetails(id);
    return NextResponse.json(role);
  } catch (error) {
    console.error("GET /api/auth/roles/[id] error:", error);
    return NextResponse.json({ error: "Failed to load role" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: ParamsCtx) {
  try {
    const { id } = await ctx.params;
    const json = await req.json();
    const parsed = updateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    // Load role to build context
    const existing = await Rbac.getRoleDetails(id);
    const permResp = await requirePermission(
      req,
      existing.scope === "global" ? "global.admin" : "company.admin",
      buildScopeContextFromRoute(
        {
          companyId: existing.company_id ?? undefined,
          branchId: existing.branch_id ?? undefined,
          vendorId: existing.vendor_id ?? undefined,
        },
        existing.scope
      )
    );
    if (permResp) return permResp;

    const role = await Rbac.updateRole(id, parsed.data);
    return NextResponse.json(role);
  } catch (error) {
    console.error("PUT /api/auth/roles/[id] error:", error);
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  }
}
