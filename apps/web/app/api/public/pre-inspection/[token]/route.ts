import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Leads, getSql } from "@repo/ai-core";
import {
  getPreInspectionFormByToken,
  submitPreInspectionFormByToken,
} from "@/lib/pre-inspection-form";

type Params = { params: { token: string } | Promise<{ token: string }> };

const submitSchema = z.object({
  termsAccepted: z.boolean(),
  signatureDataUrl: z.string().min(20),
  aiSummary: z
    .object({
      inquiry: z.string().optional().nullable(),
      lead: z.string().optional().nullable(),
      highlights: z.array(z.string()).optional(),
      source: z.enum(["assistant", "fallback"]).optional(),
      generatedAt: z.string().optional(),
    })
    .nullish(),
  answers: z.object({
    q1: z.object({ choice: z.enum(["yes", "no"]), details: z.string().optional().nullable() }),
    q2: z.object({ choice: z.enum(["yes", "no"]), details: z.string().optional().nullable() }),
    q3: z.object({ choice: z.enum(["yes", "no"]), details: z.string().optional().nullable() }),
    q4: z.object({ choice: z.enum(["yes", "no"]), details: z.string().optional().nullable() }),
    q5: z.object({ choice: z.enum(["yes", "no"]), details: z.string().optional().nullable() }),
  }),
});

function validateYesNeedsDetails(answers: Record<string, any>): string | null {
  for (const key of ["q1", "q2", "q3", "q4", "q5"]) {
    const answer = answers?.[key];
    if (!answer) return `${key} is required`;
    if (answer.choice === "yes" && !String(answer.details ?? "").trim()) {
      return `${key} details are required when answer is yes`;
    }
  }
  return null;
}

async function syncAiSummaryToLeadAndInquiry(args: {
  companyId: string;
  leadId: string;
  summaryText: string;
  aiSummary: Record<string, unknown> | null;
}) {
  const summaryText = String(args.summaryText ?? "").trim();
  if (!summaryText) return;

  const lead = await Leads.getLeadById(args.companyId, args.leadId).catch(() => null);
  if (lead) {
    const marker = "AI pre-inspection summary:";
    const currentRemark = String(lead.agentRemark ?? "").trim();
    const mergedRemark = currentRemark.includes(marker)
      ? currentRemark
      : [currentRemark, `${marker}\n${summaryText}`].filter(Boolean).join("\n\n");
    await Leads.updateLeadPartial(args.companyId, args.leadId, {
      agentRemark: mergedRemark,
    }).catch(() => undefined);
  }

  const sql = getSql();
  const payload = {
    preInspectionAiSummary: {
      ...(args.aiSummary ?? {}),
      leadSummary: summaryText,
      syncedAt: new Date().toISOString(),
    },
  };
  await sql`
    UPDATE call_ai_inquiries
    SET
      inquiry_summary = COALESCE(NULLIF(${summaryText}, ''), inquiry_summary),
      ai_payload = COALESCE(ai_payload, '{}'::jsonb) || ${payload as any}::jsonb,
      updated_at = now()
    WHERE id = (
      SELECT id
      FROM call_ai_inquiries
      WHERE company_id = ${args.companyId}
        AND converted_to_lead_id = ${args.leadId}
      ORDER BY created_at DESC
      LIMIT 1
    )
  `.catch(() => undefined);
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await Promise.resolve(params);
  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }
  const data = await getPreInspectionFormByToken(token);
  if (!data) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await Promise.resolve(params);
  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }
  const parsed = submitSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.format() }, { status: 400 });
  }
  if (!parsed.data.termsAccepted) {
    return NextResponse.json({ error: "You must accept terms before submit" }, { status: 400 });
  }
  const signature = String(parsed.data.signatureDataUrl ?? "").trim();
  if (!/^data:image\/png;base64,/.test(signature)) {
    return NextResponse.json({ error: "Please add your signature before submitting." }, { status: 400 });
  }
  const detailValidation = validateYesNeedsDetails(parsed.data.answers as any);
  if (detailValidation) {
    return NextResponse.json({ error: detailValidation }, { status: 400 });
  }

  try {
    const resolved = await getPreInspectionFormByToken(token);
    const aiSummary = parsed.data.aiSummary ?? null;
    const aiSummaryLeadText = String(aiSummary?.lead ?? aiSummary?.inquiry ?? "").trim();
    const form = await submitPreInspectionFormByToken({
      token,
      termsAccepted: parsed.data.termsAccepted,
      answers: {
        ...(parsed.data.answers as any),
        __meta: {
          signatureDataUrl: signature,
          signedAt: new Date().toISOString(),
          aiSummary: aiSummary ?? null,
        },
      },
    });
    if (resolved?.form?.company_id && resolved?.form?.lead_id && aiSummaryLeadText) {
      await syncAiSummaryToLeadAndInquiry({
        companyId: String(resolved.form.company_id),
        leadId: String(resolved.form.lead_id),
        summaryText: aiSummaryLeadText,
        aiSummary: (aiSummary as Record<string, unknown>) ?? null,
      });
    }
    return NextResponse.json({ data: form });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to submit form" }, { status: 400 });
  }
}
