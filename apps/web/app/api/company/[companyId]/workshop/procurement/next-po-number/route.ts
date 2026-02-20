import { NextResponse } from "next/server";
import { nextPoNumberPreview } from "@repo/ai-core/workshop/procurement/repository";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { companyId } = await params;
  if (!companyId) {
    return NextResponse.json({ error: "companyId_required" }, { status: 400 });
  }
  try {
    const poNumber = await nextPoNumberPreview(companyId);
    return NextResponse.json({ data: { poNumber } });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "failed_to_generate_po_number" }, { status: 500 });
  }
}
