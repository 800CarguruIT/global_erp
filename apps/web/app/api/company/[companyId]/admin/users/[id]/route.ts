import { NextRequest, NextResponse } from "next/server";
import { UserRepository } from "@repo/ai-core";
import { requirePermission, buildScopeContextFromRoute } from "@/lib/auth/permissions";

type Params = { params: Promise<{ companyId: string; id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId, id } = await params;
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
  const user = await UserRepository.getUserById(id);
  if (!user) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json({ data: user });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { companyId, id } = await params;
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
  const user = await UserRepository.updateUser(id, {
    email: body.email,
    fullName: body.name ?? body.fullName ?? null,
    password: body.password,
    employeeId: body.employeeId ?? null,
    isActive: body.isActive ?? undefined,
    roleIds: body.roleIds ?? undefined,
  });
  return NextResponse.json({ data: user });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { companyId, id } = await params;
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
  await UserRepository.softDeleteUser(id);
  return NextResponse.json({ ok: true });
}
