import { NextResponse, NextRequest } from "next/server";
import { Accounting } from "@repo/ai-core/server";

import { requireAuth } from "@/lib/auth/requireAuth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  try {
    const metrics = await Accounting.getGlobalSummary();
    const entries = await Accounting.listGlobalLedgerEntries({ limit: 20 });

    const metricData =
      metrics?.map((m: any) => ({
        key: m.key ?? m.label ?? "metric",
        label: m.label ?? m.key ?? "Metric",
        value: m.value ?? "0",
        detail: m.detail ?? null,
      })) ?? [];

    const entryData =
      entries?.map((e: any) => ({
        id: e.id ?? crypto.randomUUID(),
        date: e.date ?? e.createdAt ?? new Date().toISOString(),
        description: e.description ?? e.memo ?? "Entry",
        debit: Number(e.debit ?? 0),
        credit: Number(e.credit ?? 0),
        balance: Number(e.balance ?? 0),
      })) ?? [];

    return NextResponse.json({ metrics: metricData, entries: entryData });
  } catch (err) {
    console.error("GET /api/global/accounting/summary error", err);
    return NextResponse.json({ metrics: [], entries: [] }, { status: 200 });
  }
}
