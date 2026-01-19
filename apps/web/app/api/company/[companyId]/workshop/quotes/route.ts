import { NextRequest, NextResponse } from "next/server";
import { WorkshopQuotes } from "@repo/ai-core";

type Params = { params: Promise<{ companyId: string }> };

// List / Create quotes
export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  try {
    const data = await WorkshopQuotes.listQuotesForCompany(companyId, {
      type: type as any,
      status: status as any,
    });
    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET quotes failed", err);
    return NextResponse.json(
      { error: "Failed to load quotes" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  try {
    const body = await req.json().catch(() => ({}));
    const mode = body.type as "vendor_part" | "branch_labor";
    if (mode === "vendor_part") {
      if (!body.estimateId || !body.vendorId) {
        return NextResponse.json(
          { error: "estimateId and vendorId are required for vendor_part" },
          { status: 400 },
        );
      }
      const data = await WorkshopQuotes.createVendorQuoteForEstimate(
        companyId,
        body.estimateId,
        body.vendorId,
      );
      return NextResponse.json({ data }, { status: 201 });
    }
    if (mode === "branch_labor") {
      if (!body.workOrderId || !body.branchId) {
        return NextResponse.json(
          { error: "workOrderId and branchId are required for branch_labor" },
          { status: 400 },
        );
      }
      const data = await WorkshopQuotes.createBranchLaborQuoteForWorkOrder(
        companyId,
        body.workOrderId,
        body.branchId,
      );
      return NextResponse.json({ data }, { status: 201 });
    }
    return NextResponse.json(
      { error: "Unknown quote type" },
      { status: 400 },
    );
  } catch (err) {
    console.error("POST quotes failed", err);
    return NextResponse.json(
      { error: "Failed to create quote" },
      { status: 500 },
    );
  }
}
