import { NextRequest, NextResponse } from "next/server";
import { UserRepository } from "@repo/ai-core";
import { requirePermission, buildScopeContextFromRoute } from "@/lib/auth/permissions";

export async function GET(req: NextRequest) {
  const context = buildScopeContextFromRoute({});
  const authError = await requirePermission(req, "global.admin", context);
  if (authError) {
    // Surface empty list instead of blocking the global view
    return NextResponse.json({ data: [] }, { status: 200 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") ?? undefined;
    const scope = searchParams.get("scope") ?? undefined;
    const globalOnly = scope === "global";
    const page = Number(searchParams.get("page") ?? 1);
    const pageSize = Number(searchParams.get("pageSize") ?? 50);
    const offset = (page - 1) * pageSize;
    const status = (searchParams.get("status") ?? "all") as "all" | "active" | "inactive";

      const users = await UserRepository.listUsers({
        q,
        limit: pageSize,
        offset,
        globalOnly,
        status,
      });
    return NextResponse.json({ data: users });
  } catch (error) {
    console.error("GET /api/admin/users error", error);
    return NextResponse.json({ data: [] }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  const context = buildScopeContextFromRoute({});
  const authError = await requirePermission(req, "global.admin", context);
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
    companyId: body.companyId ?? null,
    mobile: body.mobile ?? null,
  });
  return NextResponse.json({ data: user }, { status: 201 });
}
