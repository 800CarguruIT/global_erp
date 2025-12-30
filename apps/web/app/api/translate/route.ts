import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient, canUseAi } from "@repo/ai-core";

const client = getOpenAIClient();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const targetLang =
      body.targetLang || body.targetLanguage || body.lang || body.language;
    const text = body.text || body.originalText || body.message;

    if (!targetLang || !text) {
      return NextResponse.json(
        { error: "Missing target language or text" },
        { status: 400 }
      );
    }

    const allowed = await canUseAi("ai.i18n", {});
    if (!allowed) {
      return NextResponse.json(
        { error: "AI is disabled by global policy" },
        { status: 403 }
      );
    }

    const prompt = `
Translate the following English text into ${targetLang}.
Return ONLY the translated text. No quotes. No markdown.

TEXT:
${text}
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const translation = completion.choices[0]?.message?.content?.trim() ?? "";

    return NextResponse.json({ translation });
  } catch (error: unknown) {
    // 🔴 Make the real error very visible in the server logs
    console.error("translate API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate translation",
      },
      { status: 500 }
    );
  }
}
