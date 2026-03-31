import { NextRequest, NextResponse } from "next/server";
import { UserRepository } from "@repo/ai-core";
import { requirePermission, buildScopeContextFromRoute } from "@/lib/auth/permissions";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const context = buildScopeContextFromRoute({ companyId });
  const authError = await requirePermission(req, "company.users.view", context);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const q          = searchParams.get("q") ?? undefined;
  const status     = (searchParams.get("status") ?? undefined) as "active" | "inactive" | "no_account" | undefined;
  const department = searchParams.get("department") ?? undefined;
  const branchId   = searchParams.get("branchId") ?? undefined;
  const roleId     = searchParams.get("roleId") ?? undefined;
  const pageSize   = Math.min(Math.max(Number(searchParams.get("pageSize") ?? 50), 1), 100);
  const page       = Math.max(Number(searchParams.get("page") ?? 1), 1);
  const offset     = (page - 1) * pageSize;

  const { rows, total } = await UserRepository.listEmployeesWithUserStatus({
    companyId, q, status, department, branchId, roleId, limit: pageSize, offset,
  });

  return NextResponse.json({ data: rows, total, page, pageSize });
}
