import { NextRequest, NextResponse } from "next/server";
import { Accounting } from "@repo/ai-core/server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    return NextResponse.json({ error: "At least one line required" }, { status: 400 });
  }
  const date = body.date ?? new Date().toISOString().slice(0, 10);
  try {
    const entityId = await Accounting.resolveEntityId("global");
    const journal = await Accounting.postJournal({
      entityId,
      date,
      reference: body.reference ?? null,
      description: body.description ?? null,
      journalType: body.journalType ?? "general",
      currency: body.currency ?? "USD",
      lines: body.lines.map((l: any) => ({
        accountId: l.accountId,
        debit: Number(l.debit ?? 0),
        credit: Number(l.credit ?? 0),
        description: l.description ?? null,
      })),
    });
    return NextResponse.json({ data: journal }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/global/accounting/journals error", error);
    return NextResponse.json({ error: error?.message ?? "Failed to create journal" }, { status: 400 });
  }
}
