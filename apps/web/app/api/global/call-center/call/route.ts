import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CallCenter } from "@repo/ai-core";

const bodySchema = z.object({
  fromNumber: z.string().min(1),
  toNumber: z.string().min(1),
  toEntityType: z.enum(["customer", "employee", "vendor", "other"]).optional().nullable(),
  toEntityId: z.string().optional().nullable(),
  providerKey: z.string().min(1),
});

async function getCurrentUserId(req: NextRequest): Promise<string | null> {
  return req.headers.get("x-user-id");
}

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.format() }, { status: 400 });
  }

  try {
    const session = await CallCenter.startOutboundCall({
      scope: "global",
      companyId: null,
      branchId: null,
      createdByUserId: userId,
      fromNumber: parsed.data.fromNumber,
      toNumber: parsed.data.toNumber,
      toEntityType: parsed.data.toEntityType ?? null,
      toEntityId: parsed.data.toEntityId ?? null,
      providerKey: parsed.data.providerKey,
      metadata: {},
    });

    return NextResponse.json(session, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/global/call-center/call error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed to start call" }, { status: 500 });
  }
}
