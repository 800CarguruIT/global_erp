import { NextRequest, NextResponse } from "next/server";
import { receivePoItems } from "@repo/ai-core/workshop/procurement/repository";

import { requireAuth } from "@/lib/auth/requireAuth";

type Params = { params: Promise<{ companyId: string; poId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId, poId } = await params;
  const userId = req.headers.get("x-user-id") || null;
  const body = await req.json().catch(() => ({}));
  if (!Array.isArray(body.items)) {
    return new NextResponse("items required", { status: 400 });
  }
  const result = await receivePoItems(
    companyId,
    poId,
    body.items.map((i: any) => ({
      itemId: i.itemId,
      quantity: i.quantity ?? 0,
      action: String(i.action ?? "received").toLowerCase(),
    })),
    userId
  );
  return NextResponse.json({ data: result });
}
