import { NextRequest, NextResponse } from "next/server";
import { CustomerDataCenter } from "@repo/ai-core/server";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const url = new URL(req.url);

  const agentUserId = url.searchParams.get("agentUserId");
  if (!agentUserId) {
    return NextResponse.json({ error: "agentUserId is required" }, { status: 400 });
  }

  const page = parseInt(url.searchParams.get("page") ?? "1") || 1;
  const pageSize = parseInt(url.searchParams.get("pageSize") ?? "25") || 25;
  const search = url.searchParams.get("search") ?? undefined;
  const segment = url.searchParams.get("segment") ?? undefined;

  const result = await CustomerDataCenter.listCustomerAssignments({
    companyId,
    agentUserId,
    page,
    pageSize,
    search,
    segment: segment as any,
    status: "active",
  });

  return NextResponse.json(result);
}
