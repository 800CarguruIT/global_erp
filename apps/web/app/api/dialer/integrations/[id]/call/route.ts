import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Dialer, DialerTypes } from "@repo/ai-core";

const bodySchema = z.object({
  to: z.string().min(1, "to is required"),
  from: z.string().min(1).optional().nullable(),
  callerId: z.string().min(1).optional().nullable(),
  customPayload: z.unknown().optional(),
});

type ParamsCtx = { params: { id: string } } | { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: ParamsCtx) {
  try {
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const scope = url.searchParams.get("scope") ?? "company";
    const companyId = url.searchParams.get("companyId");

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const integration = await Dialer.getDialerById(id);
    if (!integration) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!integration.is_active) {
      return NextResponse.json(
        { error: "Integration is inactive" },
        { status: 400 }
      );
    }

    if (scope === "global") {
      if (!integration.is_global) {
        return NextResponse.json(
          { error: "Integration is not global" },
          { status: 403 }
        );
      }
    } else {
      if (!companyId) {
        return NextResponse.json(
          { error: "companyId is required for company scope" },
          { status: 400 }
        );
      }
      if (integration.is_global) {
        return NextResponse.json(
          { error: "Company scope cannot use global integration" },
          { status: 403 }
        );
      }
      if (integration.company_id !== companyId) {
        return NextResponse.json(
          { error: "Integration does not belong to this company" },
          { status: 403 }
        );
      }
    }

    const input: DialerTypes.PlaceCallInput = {
      to: parsed.data.to,
      from: parsed.data.from ?? undefined,
      callerId: parsed.data.callerId ?? undefined,
      customPayload: parsed.data.customPayload,
    };

    const data = await Dialer.placeCallWithIntegrationId(id, input);
    const success = data.success !== false;

    return NextResponse.json({
      success,
      data,
      integrationId: id,
    }, { status: success ? 200 : 502 });
  } catch (error: unknown) {
    console.error("POST /api/dialer/integrations/[id]/call error:", error);
    return NextResponse.json(
      { error: "Failed to place call" },
      { status: 500 }
    );
  }
}
