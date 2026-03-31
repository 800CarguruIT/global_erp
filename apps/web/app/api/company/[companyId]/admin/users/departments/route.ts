import { NextRequest, NextResponse } from "next/server";
import { UserRepository } from "@repo/ai-core";
import { requirePermission, buildScopeContextFromRoute } from "@/lib/auth/permissions";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const context = buildScopeContextFromRoute({ companyId });
  const authError = await requirePermission(req, "company.users.view", context);
  if (authError) return authError;

  const departments = await UserRepository.listEmployeeDepartments(companyId);
  return NextResponse.json({ data: departments });
}
