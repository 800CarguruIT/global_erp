import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { callId: string } }) {
  // Placeholder: real-time stream should come from live call audio/ASR pipeline.
  // Returning 204 to avoid serving mock data.
  const callId = params.callId;
  if (!callId) {
    return NextResponse.json({ error: "callId required" }, { status: 400 });
  }
  return new NextResponse(null, { status: 204 });
}
