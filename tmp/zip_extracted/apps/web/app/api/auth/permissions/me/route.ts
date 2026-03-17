import { NextRequest, NextResponse } from "next/server";
import { Rbac } from "@repo/ai-core";
import { getCurrentUserIdFromRequest } from "../../../../../lib/auth/current-user";
import { buildScopeContextFromRoute } from "../../../../../lib/auth/permissions";

function normalizeId(value: string | null) {
  if (!value || value === "undefined" || value === "null") return undefined;
  return value;
}

function idsFromBranchCookie(value?: string | null) {
  if (!value) return {};
  const match = value.match(/^\/company\/([^/]+)\/branches\/([^/]+)/);
  return { companyId: match?.[1], branchId: match?.[2] };
}

export async function GET(req: NextRequest) {
  const userId = await getCurrentUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const scope = (url.searchParams.get("scope") ?? "global") as
    | "global"
    | "company"
    | "branch"
    | "vendor";
  let companyId = normalizeId(url.searchParams.get("companyId"));
  let branchId = normalizeId(url.searchParams.get("branchId"));
  const vendorId = normalizeId(url.searchParams.get("vendorId"));

  if (scope === "branch" && (!companyId || !branchId)) {
    const cookieIds = idsFromBranchCookie(req.cookies.get("last_branch_path")?.value);
    companyId = companyId ?? normalizeId(cookieIds.companyId ?? null);
    branchId = branchId ?? normalizeId(cookieIds.branchId ?? null);
  }
  if (scope === "company" && !companyId) {
    const cookieIds = idsFromBranchCookie(req.cookies.get("last_branch_path")?.value);
    companyId = normalizeId(cookieIds.companyId ?? null);
  }

  if (scope !== "global" && !companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  try {
    const perms = await Rbac.getUserPermissionsForScope(
      userId,
      buildScopeContextFromRoute({ companyId, branchId, vendorId }, scope)
    );
    return NextResponse.json({ permissions: perms });
  } catch (error) {
    console.error("GET /api/auth/permissions/me error:", error);
    return NextResponse.json({ error: "Failed to load permissions" }, { status: 500 });
  }
}
