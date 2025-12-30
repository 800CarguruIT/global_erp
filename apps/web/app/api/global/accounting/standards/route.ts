import { NextResponse } from "next/server";
import { Accounting } from "@repo/ai-core/server";

export async function GET() {
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
