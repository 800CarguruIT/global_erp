import { NextRequest, NextResponse } from "next/server";
import { UserRepository } from "@repo/ai-core";
import { requirePermission, buildScopeContextFromRoute } from "@/lib/auth/permissions";

type Params = { params: Promise<{ id: string }> };

async function ensureAuth(req: NextRequest) {
  const context = buildScopeContextFromRoute({});
  const authError = await requirePermission(req, "global.admin", context);
  if (authError) return authError;
  return null;
}

export async function GET(req: NextRequest, { params }: Params) {
  const authError = await ensureAuth(req);
  if (authError) return authError;

  const { id } = await params;
  const user = await UserRepository.getUserById(id);
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ data: user });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const authError = await ensureAuth(req);
  if (authError) return authError;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const user = await UserRepository.updateUser(id, {
    email: body.email,
    fullName: body.name ?? body.fullName ?? null,
    password: body.password,
    employeeId: body.employeeId ?? null,
    isActive: body.isActive ?? true,
    roleIds: body.roleIds ?? undefined,
  });
  return NextResponse.json({ data: user });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const authError = await ensureAuth(req);
  if (authError) return authError;

  const { id } = await params;
  await UserRepository.softDeleteUser(id);
  return NextResponse.json({ ok: true });
}
