import { NextRequest, NextResponse } from "next/server";
import { canUseAi, getOpenAIClientForCompany } from "@repo/ai-core";
import { z } from "zod";
import { getPreInspectionFormByToken } from "@/lib/pre-inspection-form";

type Params = { params: { token: string } | Promise<{ token: string }> };

const answerSchema = z.object({
  choice: z.enum(["yes", "no"]),
  details: z.string().optional().nullable(),
});

const requestSchema = z.object({
  question: z.string().min(1).max(1000),
  answers: z.object({
    q1: answerSchema,
    q2: answerSchema,
    q3: answerSchema,
    q4: answerSchema,
    q5: answerSchema,
  }),
});

function isValidPublicToken(token: string): boolean {
  return /^[a-f0-9]{48}$/i.test(String(token ?? "").trim());
}

type ParsedAnswers = z.infer<typeof requestSchema>["answers"];

function buildIssueLines(answers: ParsedAnswers): string[] {
  const labels: Record<keyof ParsedAnswers, string> = {
    q1: "Performance issue",
    q2: "Unusual sound or vibration",
    q3: "Warning light or service alert",
    q4: "Recent incident",
    q5: "Urgent inspection priority",
  };
  const lines: string[] = [];
  for (const key of Object.keys(labels) as Array<keyof ParsedAnswers>) {
    const row = answers[key];
    if (row.choice !== "yes") continue;
    const detail = String(row.details ?? "").trim();
    lines.push(`${labels[key]}${detail ? `: ${detail}` : ""}`);
  }
  return lines;
}

function buildFallbackResult(args: {
  answers: ParsedAnswers;
  question: string;
  customerName: string | null;
  carLabel: string | null;
  carPlate: string | null;
}) {
  const issues = buildIssueLines(args.answers);
  const issueText = issues.length ? issues.join("; ") : "No major issue flagged in initial answers.";
  const assistantReply = issues.length
    ? "Thanks. I captured your key concerns. Please attach short details for any urgent issue and proceed to submit."
    : "Thanks. No critical issue is flagged yet. You can still add any symptom details, then submit the form.";
  const inquirySummary = `Customer ${args.customerName ?? "N/A"} (${args.carLabel ?? "vehicle"} ${
    args.carPlate ? `[${args.carPlate}]` : ""
  }). Initial findings: ${issueText}`;
  const leadSummary = `Pre-inspection intake: ${issueText}`;
  const suggestedFollowUps = [
    "When did the issue start?",
    "Is the issue constant or intermittent?",
    "Can the vehicle be safely driven?",
  ];
  return {
    assistantReply,
    suggestedFollowUps,
    summary: {
      inquiry: inquirySummary,
      lead: leadSummary,
      highlights: issues,
      source: "fallback" as const,
      generatedAt: new Date().toISOString(),
    },
    meta: {
      aiUsed: false,
      reason: "fallback",
      asked: args.question,
    },
  };
}

export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await Promise.resolve(params);
  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }
  if (!isValidPublicToken(token)) {
    return NextResponse.json({ error: "invalid token format" }, { status: 400 });
  }

  const form = await getPreInspectionFormByToken(token);
  if (!form) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }

  const parsed = requestSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.format() }, { status: 400 });
  }

  const fallback = buildFallbackResult({
    answers: parsed.data.answers,
    question: parsed.data.question,
    customerName: form.customerName,
    carLabel: form.carLabel,
    carPlate: form.carPlate,
  });

  const companyId = String(form.form.company_id ?? "").trim();
  if (!companyId) {
    return NextResponse.json(fallback);
  }

  const allowed = await canUseAi("ai.assistant", { companyId }).catch(() => true);
  if (!allowed) {
    return NextResponse.json({
      ...fallback,
      meta: { ...fallback.meta, reason: "ai_disabled" },
    });
  }

  const resolved = await getOpenAIClientForCompany(companyId).catch(() => ({ client: null, source: null }));
  if (!resolved.client) {
    return NextResponse.json({
      ...fallback,
      meta: { ...fallback.meta, reason: "no_client" },
    });
  }

  try {
    const model = process.env.PRE_INSPECTION_ASSIST_MODEL?.trim() || "gpt-4.1-mini";
    const completion = await resolved.client.chat.completions.create({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an automotive pre-inspection intake assistant. Keep output concise, practical, and safe. Return strict JSON only.",
        },
        {
          role: "user",
          content: JSON.stringify({
            context: {
              customerName: form.customerName,
              carLabel: form.carLabel,
              carPlate: form.carPlate,
              appointmentType: form.form.appointment_type,
            },
            question: parsed.data.question,
            answers: parsed.data.answers,
            requiredResponseShape: {
              assistantReply: "string (max 400 chars)",
              suggestedFollowUps: ["string", "string", "string"],
              summary: {
                inquiry: "string (1-2 sentences)",
                lead: "string (1-2 sentences)",
                highlights: ["string"],
              },
            },
          }),
        },
      ],
    });

    const raw = String(completion.choices?.[0]?.message?.content ?? "").trim();
    let parsedJson: any = {};
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      parsedJson = {};
    }

    const assistantReply = String(parsedJson?.assistantReply ?? "").trim() || fallback.assistantReply;
    const suggestedFollowUps = Array.isArray(parsedJson?.suggestedFollowUps)
      ? parsedJson.suggestedFollowUps.map((v: unknown) => String(v ?? "").trim()).filter(Boolean).slice(0, 5)
      : fallback.suggestedFollowUps;
    const inquiry = String(parsedJson?.summary?.inquiry ?? "").trim() || fallback.summary.inquiry;
    const lead = String(parsedJson?.summary?.lead ?? "").trim() || fallback.summary.lead;
    const highlights = Array.isArray(parsedJson?.summary?.highlights)
      ? parsedJson.summary.highlights.map((v: unknown) => String(v ?? "").trim()).filter(Boolean).slice(0, 8)
      : fallback.summary.highlights;

    return NextResponse.json({
      assistantReply,
      suggestedFollowUps,
      summary: {
        inquiry,
        lead,
        highlights,
        source: "assistant",
        generatedAt: new Date().toISOString(),
      },
      meta: {
        aiUsed: true,
        source: resolved.source,
        model,
      },
    });
  } catch {
    return NextResponse.json({
      ...fallback,
      meta: { ...fallback.meta, reason: "assist_error" },
    });
  }
}

