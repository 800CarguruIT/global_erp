import { NextRequest, NextResponse } from "next/server";
import { CallCenter, Crm, Users } from "@repo/ai-core";

import { requireAuth } from "@/lib/auth/requireAuth";

type ParamsCtx = { params: Promise<{ companyId: string }> };

function isUsableRecordingUrl(url: string | null | undefined): boolean {
  const normalized = String(url ?? "").trim().toLowerCase();
  return normalized.length > 0 && normalized !== "unknown" && normalized !== "null" && normalized !== "undefined";
}

export async function GET(req: NextRequest, ctx: ParamsCtx) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

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
    recordings.forEach((r) => {
      if (!isUsableRecordingUrl(r.url)) return;
      recordingMap.set(r.callSessionId, { url: r.url, durationSeconds: r.durationSeconds });
    });

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

    const payload = filtered.map((s) => {
      const computedDurationSeconds =
        s.durationSeconds ??
        (s.startedAt && s.endedAt
          ? Math.max(0, Math.round((s.endedAt.getTime() - s.startedAt.getTime()) / 1000))
          : null);

      return {
      id: s.id,
      providerKey: s.providerKey,
      providerCallId: s.providerCallId,
      direction: s.direction,
      from: s.fromNumber,
      to: s.toNumber,
      status: s.status,
      startedAt: s.startedAt ?? s.createdAt,
      durationSeconds: computedDurationSeconds,
      createdByUserId: s.createdByUserId,
      agent: userMap.get(s.createdByUserId ?? "") ?? null,
      toEntityType: s.toEntityType,
      toEntityId: s.toEntityId,
      customer: s.toEntityType === "customer" && s.toEntityId ? customerMap.get(s.toEntityId) ?? null : null,
      recording: recordingMap.get(s.id) ?? null,
      metadata: s.metadata ?? {},
      };
    });

    return NextResponse.json({ data: payload });
  } catch (err) {
    console.error("call history error", err);
    return NextResponse.json({ error: "Failed to load call history" }, { status: 500 });
  }
}
