import { NextRequest, NextResponse } from "next/server";
import { CallCenter, Dialer } from "@repo/ai-core";

type DialerWebhookUpdate = {
  providerKey: string;
  providerCallId: string;
  status: string;
  startedAt?: Date;
  endedAt?: Date;
  durationSeconds?: number;
  recordingUrl?: string;
  recordingId?: string;
  recordingDurationSeconds?: number;
  rawPayload?: unknown;
};

export const dynamic = "force-dynamic";

type ParamsCtx =
  | { params: { providerKey: string } }
  | { params: Promise<{ providerKey: string }> };

async function parsePayload(req: NextRequest): Promise<any> {
  const contentType = req.headers.get("content-type") || "";
  const text = await req.text().catch(() => "");
  if (!text) return {};
  try {
    if (contentType.includes("application/x-www-form-urlencoded")) {
      return Object.fromEntries(new URLSearchParams(text));
    }
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function handle(providerKey: string, req: NextRequest) {
  const headers = Object.fromEntries(req.headers.entries());
  const payload = await parsePayload(req);

  // Maintain legacy integration event behavior
  await Dialer.handleDialerWebhook(providerKey, payload, headers);

  // Map payload to CallCenter update (Twilio-style fallback)
  const providerCallId =
    payload.CallSid || payload.call_sid || payload.callId || payload.id || payload.call_id || null;
  if (!providerCallId) return;

  const status = payload.CallStatus || payload.call_status || payload.status;
  const startStr = payload.StartTime || payload.start_time;
  const endStr = payload.EndTime || payload.end_time;
  const startedAt = startStr ? new Date(startStr) : undefined;
  const endedAt = endStr ? new Date(endStr) : undefined;
  const durationRaw = payload.CallDuration ?? payload.duration;
  const durationSeconds = durationRaw !== undefined ? Number(durationRaw) : undefined;
  const recordingUrl = payload.RecordingUrl || payload.recording_url;
  const recordingId = payload.RecordingSid || payload.recording_id;
  const recordingDurationSeconds =
    payload.RecordingDuration !== undefined ? Number(payload.RecordingDuration) : undefined;

  const update: DialerWebhookUpdate = {
    providerKey,
    providerCallId,
    status: status ?? "",
    startedAt: startedAt && !Number.isNaN(startedAt.getTime()) ? startedAt : undefined,
    endedAt: endedAt && !Number.isNaN(endedAt.getTime()) ? endedAt : undefined,
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : undefined,
    recordingUrl: recordingUrl ?? undefined,
    recordingId: recordingId ?? undefined,
    recordingDurationSeconds: Number.isFinite(recordingDurationSeconds)
      ? recordingDurationSeconds
      : undefined,
    rawPayload: payload,
  };

  await CallCenter.handleDialerWebhookUpdate(update);
}

export async function POST(req: NextRequest, ctx: ParamsCtx) {
  try {
    const { providerKey } = await ctx.params;
    await handle(providerKey, req);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Dialer webhook error", err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function GET(req: NextRequest, ctx: ParamsCtx) {
  return POST(req, ctx);
}
