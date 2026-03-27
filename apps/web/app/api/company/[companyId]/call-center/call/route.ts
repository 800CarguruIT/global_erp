import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CallCenter, Dialer } from "@repo/ai-core";
import { getCurrentUserIdFromRequest } from "../../../../../../lib/auth/current-user";

type Params = { params: Promise<{ companyId: string }> };

const bodySchema = z.object({
  fromNumber: z.string().min(1).optional(),
  toNumber: z.string().min(1),
  toEntityType: z.enum(["customer", "employee", "vendor", "other"]).optional().nullable(),
  toEntityId: z.string().optional().nullable(),
  providerKey: z.string().min(1).optional(),
});

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const userId = await getCurrentUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.format() }, { status: 400 });
  }

  try {
    let providerKey = parsed.data.providerKey ?? "";
    if (!providerKey) {
      const dialers = await Dialer.listCompanyDialers(companyId);
      const active = dialers.find((d) => d.is_active);
      if (!active) {
        return NextResponse.json({ error: "No active dialer integration found for this company" }, { status: 422 });
      }
      providerKey = active.provider;
    }

    const session = await CallCenter.startOutboundCall({
      scope: "company",
      companyId,
      branchId: null,
      createdByUserId: userId,
      fromNumber: parsed.data.fromNumber || undefined,
      toNumber: parsed.data.toNumber,
      toEntityType: parsed.data.toEntityType ?? null,
      toEntityId: parsed.data.toEntityId ?? null,
      providerKey,
      metadata: {},
    });

    return NextResponse.json(session, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/company call-center call error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed to start call" }, { status: 500 });
  }
}
