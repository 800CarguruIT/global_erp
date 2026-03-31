import { NextRequest, NextResponse } from "next/server";
import { CallCenter, Crm, Users, getSql } from "@repo/ai-core";

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

    const sql = getSql();

    // Batch fetch users in one query instead of N individual calls
    const uniqueUserIds = Array.from(new Set(filtered.map((s) => s.createdByUserId).filter(Boolean))) as string[];
    const userMap = new Map<string, { name: string | null; email: string | null }>();
    if (uniqueUserIds.length > 0) {
      const userRows = await sql<{ id: string; name: string | null; email: string | null }[]>`
        SELECT id, name, email FROM users WHERE id = ANY(${uniqueUserIds}::uuid[])
      `.catch(() => []);
      for (const u of userRows) userMap.set(u.id, { name: u.name ?? u.email ?? null, email: u.email ?? null });
    }

    // Batch fetch customers by ID in one query
    const uniqueCustomerIds = Array.from(
      new Set(filtered.filter((s) => s.toEntityType === "customer" && s.toEntityId).map((s) => s.toEntityId as string))
    );
    const customerMap = new Map<string, { name: string | null; phone: string | null }>();
    if (uniqueCustomerIds.length > 0) {
      const custRows = await sql<{ id: string; name: string | null; phone: string | null }[]>`
        SELECT id, name, phone FROM customers WHERE id = ANY(${uniqueCustomerIds}::uuid[])
      `.catch(() => []);
      for (const c of custRows) customerMap.set(c.id, { name: c.name ?? null, phone: c.phone ?? null });
    }

    // Batch fetch customers by phone in one query (for sessions without linked customer)
    const uniqueExternalPhones = Array.from(
      new Set(
        filtered
          .filter((s) => !(s.toEntityType === "customer" && s.toEntityId))
          .map((s) => (s.direction === "outbound" ? s.toNumber : s.fromNumber))
          .filter((p): p is string => Boolean(p) && p.toLowerCase() !== "unknown")
      )
    );
    const phoneCustomerMap = new Map<string, { name: string | null; phone: string | null }>();
    if (uniqueExternalPhones.length > 0) {
      const phoneRows = await sql<{ phone: string; name: string | null }[]>`
        SELECT DISTINCT ON (phone) phone, name
        FROM customers
        WHERE company_id = ${companyId}
          AND phone = ANY(${uniqueExternalPhones}::text[])
        ORDER BY phone, updated_at DESC
      `.catch(() => []);
      for (const c of phoneRows) phoneCustomerMap.set(c.phone, { name: c.name ?? null, phone: c.phone });
    }

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
