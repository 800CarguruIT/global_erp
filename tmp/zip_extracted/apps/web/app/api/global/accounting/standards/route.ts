import { NextResponse, NextRequest } from "next/server";
import { Accounting } from "@repo/ai-core/server";

import { requireAuth } from "@/lib/auth/requireAuth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  try {
    const standards = await Accounting.listStandardAccounts();
    const data =
      standards?.map((s: any) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        type: s.type,
      })) ?? [];
    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/global/accounting/standards error", error);
    return NextResponse.json({ data: [] });
  }
}
