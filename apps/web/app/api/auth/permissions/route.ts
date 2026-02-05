import { NextRequest, NextResponse } from "next/server";
import { Rbac, RbacTypes } from "@repo/ai-core";

function normalizeScope(value: string | null): RbacTypes.RoleScope {
  if (value === "company") return "company";
  if (value === "branch") return "branch";
  if (value === "vendor") return "vendor";
  return "global";
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const scope = normalizeScope(url.searchParams.get("scope"));
    const perms = await Rbac.listPermissionsForScope(scope);
    return NextResponse.json({ data: perms });
  } catch (error) {
    console.error("GET /api/auth/permissions error:", error);
    return NextResponse.json({ error: "Failed to load permissions" }, { status: 500 });
  }
}
