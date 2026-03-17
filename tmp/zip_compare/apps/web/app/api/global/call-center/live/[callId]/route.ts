import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/requireAuth";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: { callId: string } }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  // Placeholder: real-time stream should come from live call audio/ASR pipeline.
  // Returning 204 to avoid serving mock data.
  const callId = params.callId;
  if (!callId) {
    return NextResponse.json({ error: "callId required" }, { status: 400 });
  }
  return new NextResponse(null, { status: 204 });
}
