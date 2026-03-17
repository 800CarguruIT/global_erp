import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClientForCompany, canUseAi } from "@repo/ai-core";

import { requireAuth } from "@/lib/auth/requireAuth";

export const runtime = "nodejs";

type Params = { params: Promise<{ companyId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const message = String(body.message ?? "").trim();
    const lang = String(body.lang ?? "en");
    const context = body.context ?? {};
    const history = Array.isArray(body.history) ? body.history.slice(-8) : [];

    if (!message) {
      return NextResponse.json({ reply: "Please type a message." }, { status: 400 });
    }

    const allowed = await canUseAi("ai.assistant", { companyId }).catch(() => true);
    const { client } = await getOpenAIClientForCompany(companyId);

    if (!allowed || !client) {
      return NextResponse.json({
        reply: "AI assistant is not currently enabled for this company. Please check your AI configuration in Settings.",
        aiUsed: false,
      });
    }

    const systemPrompt = `You are an AI business assistant embedded in an automotive workshop ERP system.
You help staff understand their business data, navigate the system, and make better decisions.

CURRENT CONTEXT:
- Company ID: ${companyId}
- Current page: ${context.page ?? "unknown"}
- Branch: ${context.branchId ?? "all branches"}

AVAILABLE DATA SNAPSHOT:
${context.kpis?.length ? `KPIs: ${JSON.stringify(context.kpis)}` : "No KPI data available."}
${context.insights?.length ? `Active Insights: ${JSON.stringify(context.insights)}` : "No active insights."}

RULES:
- Be concise and specific. Use numbers, not vague language.
- If asked about data you have in the snapshot, reference it directly.
- If asked about data you don't have, say so honestly and suggest where to find it.
- Format responses with short paragraphs. Use bullet points sparingly.
- When suggesting actions, be specific: "Follow up on Lead #4521" not "Consider following up on leads."
- Use the ${lang} language for all responses.
- Never fabricate data. Only reference what's in the snapshot.
- You can suggest navigation: "Go to Inventory > Stock to see details."
- Keep responses under 200 words unless the user asks for detail.`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...history.map((h: any) => ({
        role: h.role === "user" ? ("user" as const) : ("assistant" as const),
        content: String(h.content ?? ""),
      })),
      { role: "user" as const, content: message },
    ];

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages,
      temperature: 0.4,
      max_tokens: 800,
    });

    const reply = completion.choices[0]?.message?.content ?? "I couldn't generate a response. Please try again.";

    return NextResponse.json({ reply, aiUsed: true });
  } catch (err) {
    console.error(`POST /api/company/${companyId}/ai/copilot error:`, err);
    return NextResponse.json(
      { reply: "Something went wrong processing your request. Please try again.", aiUsed: false },
      { status: 200 }
    );
  }
}
