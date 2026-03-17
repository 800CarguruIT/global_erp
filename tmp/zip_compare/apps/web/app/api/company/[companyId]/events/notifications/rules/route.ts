import { NextRequest, NextResponse } from "next/server";
import { EventAutomation } from "@repo/ai-core";
import { z } from "zod";
import { buildScopeContextFromRoute, requirePermission } from "@/lib/auth/permissions";

export const runtime = "nodejs";

type Params = { params: Promise<{ companyId: string }> };

const createRuleSchema = z.object({
  name: z.string().min(1),
  eventKey: z.string().min(1),
  channelType: z.enum(["email", "sms", "whatsapp"]),
  integrationId: z.string().uuid().optional().nullable(),
  recipientPath: z.string().min(1),
  subjectTemplate: z.string().optional().nullable(),
  bodyTemplate: z.string().min(1),
  isActive: z.boolean().optional(),
  priority: z.number().int().min(0).max(10000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const perm = await requirePermission(
    req,
    "marketing.campaigns.view",
    buildScopeContextFromRoute({ companyId }, "company")
  );
  if (perm) return perm;

  try {
    const rules = await EventAutomation.listNotificationRules(companyId);
    return NextResponse.json({ items: rules });
  } catch (error) {
    console.error("GET /api/company/[companyId]/events/notifications/rules error:", error);
    return NextResponse.json({ error: "Failed to load notification rules" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const perm = await requirePermission(
    req,
    "marketing.campaigns.view",
    buildScopeContextFromRoute({ companyId }, "company")
  );
  if (perm) return perm;

  try {
    const parsed = createRuleSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const rule = await EventAutomation.createNotificationRule({
      companyId,
      ...parsed.data,
    });

    return NextResponse.json({ item: rule }, { status: 201 });
  } catch (error) {
    console.error("POST /api/company/[companyId]/events/notifications/rules error:", error);
    return NextResponse.json({ error: "Failed to create notification rule" }, { status: 500 });
  }
}
