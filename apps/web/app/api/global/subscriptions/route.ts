import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSql } from "@repo/ai-core";

const payloadSchema = z.object({
  companyId: z.string().uuid(),
  category: z.enum(["trial", "active", "expiring", "expired", "offboarded"]),
  status: z.string().optional().default("active"),
  amount: z.number().optional().nullable(),
  currency: z.string().optional().default("USD"),
  startedAt: z.string().optional(),
  endsAt: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => ({}));
    const parsed = payloadSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.format() }, { status: 400 });
    }
    const data = parsed.data;
    const sql = getSql();
    const startedAt = data.startedAt && data.startedAt.trim().length > 0 ? data.startedAt : null;
    const endsAt = data.endsAt && data.endsAt.trim().length > 0 ? data.endsAt : null;

    const inserted = await sql<
      {
        id: string;
        company_id: string;
        category: string;
        status: string;
        amount: number | null;
        currency: string | null;
        started_at: string;
        ends_at: string | null;
      }[]
    >`
      INSERT INTO global_subscriptions (
        company_id,
        category,
        status,
        amount,
        currency,
        started_at,
        ends_at
      )
      VALUES (
        ${data.companyId},
        ${data.category},
        ${data.status ?? "active"},
        ${data.amount ?? null},
        ${data.currency ?? "USD"},
        ${startedAt ?? sql`now()`},
        ${endsAt ?? null}
      )
      RETURNING id, company_id, category, status, amount, currency, started_at, ends_at
    `;

    return NextResponse.json({ data: inserted?.[0] ?? null }, { status: 201 });
  } catch (error) {
    console.error("POST /api/global/subscriptions error", error);
    return NextResponse.json({ error: "Failed to create subscription" }, { status: 500 });
  }
}
