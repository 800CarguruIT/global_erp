import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSql, CallAiPolicy } from "@repo/ai-core";

type Params = { params: Promise<{ companyId: string }> };

const updateSchema = z.object({
  enabled: z.boolean().optional(),
  mode: z.enum(["dry_run", "live"]).optional(),
  timezone: z.string().min(1).optional(),
  businessHours: z
    .object({
      enabled: z.boolean().optional(),
      start: z.string().optional(),
      end: z.string().optional(),
      days: z.array(z.number().int().min(0).max(6)).optional(),
    })
    .optional(),
  restrictions: z
    .object({
      blockUnknownNumbers: z.boolean().optional(),
      blockedPrefixes: z.array(z.string()).optional(),
      allowedPrefixes: z.array(z.string()).optional(),
    })
    .optional(),
  guidance: z
    .object({
      welcomeMessage: z.string().optional(),
      systemPrompt: z.string().optional(),
      escalationKeywords: z.array(z.string()).optional(),
      automationEnabled: z.boolean().optional(),
      simulationMode: z.boolean().optional(),
    })
    .optional(),
});

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId: rawCompanyId } = await params;
  const companyId = String(rawCompanyId || "").trim();
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  const [policy, recentDecisions] = await Promise.all([
    CallAiPolicy.getCompanyCallAiPolicy(companyId),
    (async () => {
      const sql = getSql();
      const rows = await sql<{
        id: string;
        decision: string;
        reason: string;
        mode: string;
        matched_rule: string | null;
        provider_key: string;
        provider_call_id: string;
        from_number: string | null;
        details: Record<string, unknown> | null;
        created_at: string;
      }[]>`
        SELECT
          id,
          decision,
          reason,
          mode,
          matched_rule,
          provider_key,
          provider_call_id,
          from_number,
          details,
          created_at
        FROM call_ai_policy_decisions
        WHERE company_id = ${companyId}
        ORDER BY created_at DESC
        LIMIT 20
      `;
      return rows;
    })(),
  ]);

  return NextResponse.json({
    companyId,
    policy:
      policy ?? {
        companyId,
        enabled: false,
        mode: "dry_run",
        timezone: "Asia/Dubai",
        businessHours: { enabled: false, start: "09:00", end: "18:00", days: [1, 2, 3, 4, 5] },
        restrictions: { blockUnknownNumbers: false, blockedPrefixes: [], allowedPrefixes: [] },
        guidance: {
          welcomeMessage: "",
          systemPrompt: "",
          escalationKeywords: [],
          automationEnabled: false,
          simulationMode: false,
        },
        updatedByUserId: null,
        updatedAt: null,
      },
    recentDecisions,
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { companyId: rawCompanyId } = await params;
  const companyId = String(rawCompanyId || "").trim();
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.format() },
      { status: 400 }
    );
  }

  const body = parsed.data;
  const saved = await CallAiPolicy.upsertCompanyCallAiPolicy({
    companyId,
    enabled: body.enabled ?? false,
    mode: body.mode ?? "dry_run",
    timezone: body.timezone ?? "Asia/Dubai",
    businessHours: body.businessHours ?? { enabled: false, start: "09:00", end: "18:00", days: [1, 2, 3, 4, 5] },
    restrictions:
      body.restrictions ?? { blockUnknownNumbers: false, blockedPrefixes: [], allowedPrefixes: [] },
    guidance:
      body.guidance ?? {
        welcomeMessage: "",
        systemPrompt: "",
        escalationKeywords: [],
        automationEnabled: false,
        simulationMode: false,
      },
    updatedByUserId: null,
  });

  return NextResponse.json({ companyId, policy: saved });
}

export const PUT = PATCH;
