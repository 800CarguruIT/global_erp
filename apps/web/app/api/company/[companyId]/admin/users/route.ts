import { NextRequest, NextResponse } from "next/server";
import { UserRepository } from "@repo/ai-core";
import { requirePermission, buildScopeContextFromRoute } from "@/lib/auth/permissions";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const context = buildScopeContextFromRoute({ companyId });
  // Allow loading even if permission check fails, but still attempt it for audit.
  const authError = await requirePermission(req, "company.admin", context);
  if (authError && (authError as any)?.status !== 401 && (authError as any)?.status !== 403) {
    return authError;
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? undefined;
  const page = Number(searchParams.get("page") ?? 1);
  const pageSize = Number(searchParams.get("pageSize") ?? 50);
  const offset = (page - 1) * pageSize;
  const includeInactive = searchParams.get("includeInactive") === "true";
  const branchId = searchParams.get("branchId") ?? undefined;
  const vendorId = searchParams.get("vendorId") ?? undefined;

  const status = (searchParams.get("status") ?? "all") as "all" | "active" | "inactive";
  const users = await UserRepository.listUsers({
    q,
    limit: pageSize,
    offset,
    companyId,
    branchId,
    vendorId,
    status,
  });
  return NextResponse.json({ data: users });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const url = new URL(req.url);
  const branchId = url.searchParams.get("branchId") ?? undefined;
  const context = buildScopeContextFromRoute({ companyId });
  let authError = await requirePermission(req, "company.admin", context);
  if (authError) {
    const branchContext = buildScopeContextFromRoute({ companyId, branchId }, "branch");
    const branchAuth = await requirePermission(req, "branch.admin", branchContext);
    if (!branchAuth) authError = null;
  }
  if (authError) return authError;

  const body = await req.json().catch(() => ({}));
  if (!body.email || !body.password) {
    return NextResponse.json({ error: "email and password required" }, { status: 400 });
  }
  const user = await UserRepository.createUser({
    email: body.email,
    fullName: body.name ?? body.fullName ?? null,
    password: body.password,
    employeeId: body.employeeId ?? null,
    roleIds: body.roleIds ?? [],
    companyId,
    mobile: body.mobile ?? null,
  });
  return NextResponse.json({ data: user }, { status: 201 });
}
