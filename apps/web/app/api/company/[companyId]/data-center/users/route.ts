import { NextRequest, NextResponse } from "next/server";
import { UserRepository } from "@repo/ai-core/server";
import { resolveDataCenterAccess } from "@/lib/data-center/access";

type ParamsCtx = { params: Promise<{ companyId: string }> };

type UserListRow = {
  id: string;
  email: string;
  full_name?: string | null;
  is_active: boolean;
  roles?: { id: string; name: string }[];
};

function getCurrentUserId(req: NextRequest): string | null {
  return req.headers.get("x-user-id");
}

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function classifyUserRoles(row: UserListRow): { isSupervisor: boolean; isAgent: boolean } {
  const roleNames = (row.roles ?? []).map((r) => normalize(r.name));
  const isSupervisor = roleNames.some((name) => name.includes("supervisor"));
  const isAgent = roleNames.some((name) => name.includes("agent") || name.includes("call center"));
  return { isSupervisor, isAgent };
}

export async function GET(req: NextRequest, ctx: ParamsCtx) {
  const userId = getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyId } = await ctx.params;
  try {
    await resolveDataCenterAccess(userId, companyId);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const rows = (await UserRepository.listUsers({
      companyId,
      activeOnly: true,
      limit: 500,
      status: "active",
      department: "RSA Sales Department",
    })) as unknown as UserListRow[];

    const options = rows.map((row) => {
      const { isSupervisor, isAgent } = classifyUserRoles(row);
      return {
        id: row.id,
        name: row.full_name ?? row.email ?? row.id,
        email: row.email,
        isSupervisor,
        // treat all department-filtered employees as agents
        isAgent: true,
      };
    });

    const supervisors = options.filter((row) => row.isSupervisor);
    const agents = options.filter((row) => row.isAgent);

    return NextResponse.json({
      data: {
        supervisors,
        agents,
        users: options,
      },
    });
  } catch (error) {
    console.error("GET /api/company/[companyId]/data-center/users error:", error);
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  }
}
