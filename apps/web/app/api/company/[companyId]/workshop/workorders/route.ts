import { NextRequest, NextResponse } from "next/server";
import { WorkshopWorkOrders as WorkOrders } from "@repo/ai-core";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const branchId = url.searchParams.get("branchId") ?? undefined;
  try {
    const data = await WorkOrders.listWorkOrdersForCompany(companyId, {
      status: status as any,
      branchId: branchId ?? null,
    });
    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET workorders failed", err);
    return NextResponse.json(
      { error: "Failed to load work orders" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  try {
    const body = await req.json().catch(() => ({}));
    if (!body.estimateId) {
      return NextResponse.json(
        { error: "estimateId is required" },
        { status: 400 },
      );
    }
    const result = await WorkOrders.createWorkOrderFromEstimate(
      companyId,
      body.estimateId,
    );
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    console.error("POST workorder failed", err);
    return NextResponse.json(
      { error: "Failed to create work order" },
      { status: 500 },
    );
  }
}
