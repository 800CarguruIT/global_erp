import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Users, Rbac } from "@repo/ai-core";
import { buildScopeContextFromRoute, requirePermission } from "../../../lib/auth/permissions";

const schema = z.object({
  email: z.string().email(),
  employeeId: z.string().optional().nullable(),
  initialRoleIds: z.array(z.string()).optional().default([]),
});

export async function POST(req: NextRequest) {
  try {
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

    const sql = (await import("@repo/ai-core")).getSql();
    const result = await sql<{ id: string; email: string; employee_id: string | null }[]>`
      INSERT INTO users (email, employee_id)
      VALUES (${parsed.data.email}, ${parsed.data.employeeId ?? null})
      ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
      RETURNING id, email, employee_id
    `;
    const sqlUser = (result as any).rows ? (result as any).rows[0] : result[0];

    if (parsed.data.employeeId) {
      await Users.linkUserToEmployee(sqlUser.id, parsed.data.employeeId);
    }

    if (parsed.data.initialRoleIds?.length) {
      await Rbac.assignRolesToUser(sqlUser.id, parsed.data.initialRoleIds);
    }

    return NextResponse.json({ id: sqlUser.id, email: sqlUser.email });
  } catch (error) {
    console.error("POST /api/auth/users error:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
