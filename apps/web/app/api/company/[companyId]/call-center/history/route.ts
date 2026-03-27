import { NextRequest, NextResponse } from "next/server";
import { CallCenter, Crm, Users } from "@repo/ai-core";

type ParamsCtx = { params: Promise<{ companyId: string }> };

function isUsableRecordingUrl(url: string | null | undefined): boolean {
  const normalized = String(url ?? "").trim().toLowerCase();
  return normalized.length > 0 && normalized !== "unknown" && normalized !== "null" && normalized !== "undefined";
}

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

    // Exclude Yeastar ring group "shadow" sessions: inbound legs where the caller is unknown,
    // the destination is a short internal extension, and the call had no duration.
    // These come from Yeastar type 30020 per-extension events (UUID call_id) which can't be
    // merged with the real type 30012 CDR session. Kept only if they somehow have duration.
    const withoutShadows = sessions.filter((s) => {
      if (s.direction !== "inbound") return true;
      const from = String(s.fromNumber ?? "").trim().toLowerCase();
      const fromIsUnknown = !from || from === "unknown" || from === "null";
      if (!fromIsUnknown) return true;
      const to = String(s.toNumber ?? "").trim();
      const toIsShortExtension = /^\d{1,6}$/.test(to);
      if (!toIsShortExtension) return true;
      // Keep if there's any meaningful duration (caller with hidden number who actually spoke)
      const hasDuration = s.durationSeconds != null && s.durationSeconds > 0;
      return hasDuration;
    });

    const filtered = direction ? withoutShadows.filter((s) => s.direction === direction) : withoutShadows;
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

    // For sessions without a linked customer, resolve by phone (handles +971/971 prefix variants)
    const uniqueExternalPhones = Array.from(
      new Set(
        filtered
          .filter((s) => !(s.toEntityType === "customer" && s.toEntityId))
          .map((s) => (s.direction === "outbound" ? s.toNumber : s.fromNumber))
          .filter((p): p is string => Boolean(p) && p.toLowerCase() !== "unknown")
      )
    );
    const phoneCustomerMap = new Map<string, { name: string | null; phone: string | null }>();
    await Promise.all(
      uniqueExternalPhones.map(async (phone) => {
        try {
          const matches = await Crm.listCustomers(companyId, { search: phone });
          if (matches.length > 0) {
            phoneCustomerMap.set(phone, { name: matches[0].name ?? null, phone: (matches[0] as any).phone ?? null });
          }
        } catch {
          // ignore
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
      // If a session is stuck at "in_progress" but has actual duration, the call clearly
      // ended — Yeastar type 30012 CDR used to map "ANSWERED" → "in_progress" (now fixed).
      // Upgrade stale in_progress sessions so history shows them as Completed.
      status: (s.status === "in_progress" || s.status === "ANSWERED") && computedDurationSeconds && computedDurationSeconds > 0
        ? "completed"
        : s.status,
      startedAt: s.startedAt ?? s.createdAt,
      durationSeconds: computedDurationSeconds,
      createdByUserId: s.createdByUserId,
      agent: userMap.get(s.createdByUserId ?? "") ?? null,
      toEntityType: s.toEntityType,
      toEntityId: s.toEntityId,
      customer: (() => {
        if (s.toEntityType === "customer" && s.toEntityId) return customerMap.get(s.toEntityId) ?? null;
        const externalPhone = s.direction === "outbound" ? s.toNumber : s.fromNumber;
        return externalPhone ? phoneCustomerMap.get(externalPhone) ?? null : null;
      })(),
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
