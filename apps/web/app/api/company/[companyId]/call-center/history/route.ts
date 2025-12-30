import { NextRequest, NextResponse } from "next/server";
import { CallCenter, Crm, Users } from "@repo/ai-core";

type ParamsCtx = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, ctx: ParamsCtx) {
  const { companyId } = await ctx.params;
  const url = new URL(req.url);
  const direction = url.searchParams.get("direction") as "inbound" | "outbound" | null;
  const limit = Number(url.searchParams.get("limit") ?? 200);

  try {
    const sessions = await CallCenter.listRecentCalls({
      scope: "company",
      companyId,
      limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 500) : 200,
    });

    const filtered = direction ? sessions.filter((s) => s.direction === direction) : sessions;
    const sessionIds = filtered.map((s) => s.id);
    const recordings = await CallCenter.listRecordingsForSessions(sessionIds);
    const recordingMap = new Map<string, { url: string; durationSeconds: number | null }>();
    recordings.forEach((r) => recordingMap.set(r.callSessionId, { url: r.url, durationSeconds: r.durationSeconds }));

    const uniqueUserIds = Array.from(new Set(filtered.map((s) => s.createdByUserId).filter(Boolean)));
    const userMap = new Map<string, { name: string | null; email: string | null }>();
    await Promise.all(
      uniqueUserIds.map(async (id) => {
        try {
          const { user } = await Users.getUserWithEmployee(id);
          userMap.set(id, { name: user?.name ?? user?.email ?? null, email: user?.email ?? null });
        } catch {
          userMap.set(id, { name: null, email: null });
        }
      })
    );

    const uniqueCustomerIds = Array.from(
      new Set(
        filtered
          .filter((s) => s.toEntityType === "customer" && s.toEntityId)
          .map((s) => s.toEntityId as string)
      )
    );
    const customerMap = new Map<string, { name: string | null; phone: string | null }>();
    await Promise.all(
      uniqueCustomerIds.map(async (id) => {
        try {
          const customer = await Crm.getCustomerById(id);
          customerMap.set(id, { name: customer?.name ?? null, phone: (customer as any)?.phone ?? null });
        } catch {
          customerMap.set(id, { name: null, phone: null });
        }
      })
    );

    const payload = filtered.map((s) => ({
      id: s.id,
      direction: s.direction,
      from: s.fromNumber,
      to: s.toNumber,
      status: s.status,
      startedAt: s.startedAt ?? s.createdAt,
      durationSeconds: s.durationSeconds,
      createdByUserId: s.createdByUserId,
      agent: userMap.get(s.createdByUserId ?? "") ?? null,
      toEntityType: s.toEntityType,
      toEntityId: s.toEntityId,
      customer: s.toEntityType === "customer" && s.toEntityId ? customerMap.get(s.toEntityId) ?? null : null,
      recording: recordingMap.get(s.id) ?? null,
      metadata: s.metadata ?? {},
    }));

    return NextResponse.json({ data: payload });
  } catch (err) {
    console.error("call history error", err);
    return NextResponse.json({ error: "Failed to load call history" }, { status: 500 });
  }
}
