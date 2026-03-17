import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Rbac } from "@repo/ai-core";
import { buildScopeContextFromRoute, requirePermission } from "@/lib/auth/permissions";

const createSchema = z.object({
  name: z.string().min(1),
  key: z.string().min(1),
  scope: z.enum(["global", "company", "branch", "vendor"]),
  companyId: z.string().optional().nullable(),
  branchId: z.string().optional().nullable(),
  vendorId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  permissionKeys: z.array(z.string()).default([]),
});

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const scope = (url.searchParams.get("scope") ?? "global") as
      | "global"
      | "company"
      | "branch"
      | "vendor";
    const normalizeId = (value: string | null) =>
      value && value !== "undefined" && value !== "null" ? value : undefined;
    const companyId = normalizeId(url.searchParams.get("companyId"));
    const branchId = normalizeId(url.searchParams.get("branchId"));
    const vendorId = normalizeId(url.searchParams.get("vendorId"));

    if (scope !== "global" && !companyId) {
      return NextResponse.json({ data: [] });
    }

    if (scope !== "global") {
      const requiredPerm =
        scope === "branch"
          ? "branch.admin"
          : scope === "vendor"
          ? "vendor.admin"
          : "company.admin";
      const permResp = await requirePermission(
        req,
        requiredPerm,
        buildScopeContextFromRoute({ companyId, branchId, vendorId }, scope)
      );
      if (permResp) return permResp;
    }

    const roles = await Rbac.listRolesForScope({
      scope,
      companyId: companyId ?? undefined,
      branchId: branchId ?? undefined,
      vendorId: vendorId ?? undefined,
    });

    return NextResponse.json({ data: roles });
  } catch (error) {
    console.error("GET /api/auth/roles error:", error);
    return NextResponse.json({ data: [], error: "Failed to load roles" }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const permResp = await requirePermission(
      req,
      parsed.data.scope === "global" ? "global.admin" : "company.admin",
      buildScopeContextFromRoute(
        {
          companyId: parsed.data.companyId ?? undefined,
          branchId: parsed.data.branchId ?? undefined,
          vendorId: parsed.data.vendorId ?? undefined,
        },
        parsed.data.scope
      )
    );
    if (permResp) return permResp;

    const role = await Rbac.createRole(parsed.data);
    return NextResponse.json(role, { status: 201 });
  } catch (error) {
    console.error("POST /api/auth/roles error:", error);
    return NextResponse.json({ error: "Failed to create role" }, { status: 500 });
  }
}
