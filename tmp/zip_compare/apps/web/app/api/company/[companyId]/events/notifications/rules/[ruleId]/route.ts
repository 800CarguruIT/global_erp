import { NextRequest, NextResponse } from "next/server";
import { EventAutomation } from "@repo/ai-core";
import { z } from "zod";
import { buildScopeContextFromRoute, requirePermission } from "@/lib/auth/permissions";

export const runtime = "nodejs";

type Params = { params: Promise<{ companyId: string; ruleId: string }> };

const updateRuleSchema = z.object({
  name: z.string().min(1).optional(),
  eventKey: z.string().min(1).optional(),
  channelType: z.enum(["email", "sms", "whatsapp"]).optional(),
  integrationId: z.string().uuid().optional().nullable(),
  recipientPath: z.string().min(1).optional(),
  subjectTemplate: z.string().optional().nullable(),
  bodyTemplate: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().min(0).max(10000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const { companyId, ruleId } = await params;
  const perm = await requirePermission(
    req,
    "marketing.campaigns.view",
    buildScopeContextFromRoute({ companyId }, "company")
  );
  if (perm) return perm;

  try {
    const parsed = updateRuleSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const item = await EventAutomation.updateNotificationRule({
      id: ruleId,
      companyId,
      ...parsed.data,
    });

    return NextResponse.json({ item });
  } catch (error) {
    console.error("PATCH /api/company/[companyId]/events/notifications/rules/[ruleId] error:", error);
    return NextResponse.json({ error: "Failed to update notification rule" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { companyId, ruleId } = await params;
  const perm = await requirePermission(
    req,
    "marketing.campaigns.view",
    buildScopeContextFromRoute({ companyId }, "company")
  );
  if (perm) return perm;

  try {
    const item = await EventAutomation.softDeleteNotificationRule(companyId, ruleId);
    return NextResponse.json({ item });
  } catch (error) {
    console.error("DELETE /api/company/[companyId]/events/notifications/rules/[ruleId] error:", error);
    return NextResponse.json({ error: "Failed to delete notification rule" }, { status: 500 });
  }
}
