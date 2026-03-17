import { NextRequest, NextResponse } from "next/server";
import { canUseAi, getOpenAIClientForCompany } from "@repo/ai-core";

import { requireAuth } from "@/lib/auth/requireAuth";

type Params = { params: Promise<{ companyId: string }> };

export const runtime = "nodejs";

type LineItemAiAnswerValue = "" | "yes" | "no" | "na";
type LineItemAiQuestion = { id: string; text: string; critical?: boolean };

const fallbackQuestions: LineItemAiQuestion[] = [
  { id: "q1", text: "Is there visible wear/damage on this part?", critical: true },
  { id: "q2", text: "Does this issue affect safe driving right now?", critical: true },
  { id: "q3", text: "Can this be monitored until next service?", critical: false },
];

function safeArrayQuestions(value: unknown): LineItemAiQuestion[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((q, i) => ({
      id: String((q as any)?.id ?? `q${i + 1}`).trim() || `q${i + 1}`,
      text: String((q as any)?.text ?? "").trim(),
      critical: Boolean((q as any)?.critical),
    }))
    .filter((q) => Boolean(q.text))
    .slice(0, 6);
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId: rawCompanyId } = await params;
  const companyId = String(rawCompanyId || "").trim();
  if (!companyId) return NextResponse.json({ error: "companyId is required" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const context = (body?.context ?? {}) as {
    partName?: string;
    partNumber?: string;
    groupName?: string;
    description?: string;
    status?: string;
  };
  const partName = String(context.partName ?? "").trim();
  const partNumber = String(context.partNumber ?? "").trim();
  const groupName = String(context.groupName ?? "").trim();
  const description = String(context.description ?? "").trim();
  const status = String(context.status ?? "").trim();
  const answers = ((body?.answers ?? null) as Record<string, LineItemAiAnswerValue> | null) ?? null;
  const existingQuestions = safeArrayQuestions(body?.questions);

  if (!partName) return NextResponse.json({ error: "partName is required" }, { status: 400 });

  try {
    const allowed = await canUseAi("ai.workshop.inspection.line_item" as any, { companyId }).catch(() => true);
    const resolved = await getOpenAIClientForCompany(companyId);
    if (!allowed || !resolved.client) {
      return NextResponse.json({
        questions: existingQuestions.length > 0 ? existingQuestions : fallbackQuestions,
        recommendation:
          existingQuestions.length > 0 && answers
            ? "AI is unavailable. Review answers manually and set status based on workshop policy."
            : "",
        meta: { aiUsed: false, reason: allowed ? "missing-key" : "disabled" },
      });
    }

    const prompt = `
You are a workshop inspection AI assistant.
Generate inspection questions and recommendation for this line item:
- Part: ${partName}
- Part Number: ${partNumber || "N/A"}
- Group: ${groupName || "N/A"}
- Description: ${description || "N/A"}
- Current Status: ${status || "N/A"}

${existingQuestions.length > 0 ? `Existing questions: ${JSON.stringify(existingQuestions)}` : "Generate only 3 short and simple workshop questions."}
${answers ? `Inspector answers: ${JSON.stringify(answers)}` : "No answers yet. Keep recommendation empty."}

Return strict JSON only:
{
  "questions": [{ "id": "q1", "text": "...", "critical": true|false }],
  "recommendation": "short practical recommendation based on answers or empty string if answers missing",
  "description": "one-line, plain, workshop-friendly issue description (no markdown)"
}
Rules:
- Questions must be answerable by yes/no/na during inspection.
- Keep question text very simple and clear (single sentence).
- This is one-step question generation. Do not create follow-up or conditional questions.
- Keep recommendation concise, action-oriented, and workshop-friendly.
- Keep description concise and professional (max 120 chars), and do not repeat only part number.
- Never return markdown.
`;

    const completion = await resolved.client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: { questions?: unknown; recommendation?: unknown; description?: unknown } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }

    const questions = safeArrayQuestions(parsed.questions);
    const recommendation = String(parsed.recommendation ?? "").trim();
    const generatedDescription = String(parsed.description ?? "").trim();

    return NextResponse.json({
      questions: questions.length > 0 ? questions : existingQuestions.length > 0 ? existingQuestions : fallbackQuestions,
      recommendation,
      description: generatedDescription,
      meta: { aiUsed: true, source: resolved.source },
    });
  } catch (err) {
    console.error("POST /api/company/[companyId]/workshop/inspections/ai-line-item error", err);
    return NextResponse.json(
      {
        error: "Failed to generate AI line-item questions.",
      },
      { status: 500 }
    );
  }
}
