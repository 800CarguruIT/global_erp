import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient, canUseAi } from "@repo/ai-core";

export async function POST(req: NextRequest) {
  let targetLang: string | undefined;
  let messages: Record<string, string> | undefined;

  try {
    ({ targetLang, messages } = await req.json());
  } catch {
    return NextResponse.json(
      { error: "Missing targetLang or messages", translations: {} },
      { status: 400 }
    );
  }

  const fallbackTranslations = messages ?? {};

  try {
    if (!targetLang || !messages) {
      return NextResponse.json(
        { error: "Missing targetLang or messages", translations: {} },
        { status: 400 }
      );
    }

    // Short-circuit if English (no AI needed)
    if (targetLang === "en") {
      return NextResponse.json({ translations: messages });
    }

    // Policy check; if policy lookup fails in dev, allow but log.
    let allowed = true;
    try {
      allowed = await canUseAi("ai.i18n", {});
    } catch (err) {
      console.error("canUseAi check failed, allowing by default", err);
      allowed = true;
    }

    if (!allowed) {
      return NextResponse.json({ translations: messages, meta: { aiUsed: false, reason: "disabled" } });
    }

    if (!process.env.OPENAI_API_KEY) {
      console.warn("OPENAI_API_KEY missing; returning base messages");
      return NextResponse.json({ translations: messages, meta: { aiUsed: false, reason: "missing-key" } });
    }

    const client = getOpenAIClient();

    const prompt = `
You are a professional localization engine for a global ERP system.
You will receive an object of English UI texts. Translate ONLY the values
into the requested language, keep the keys EXACTLY the same.

Return STRICT JSON only, no explanation, no markdown.

Example input:
{ "hello": "Hello world", "bye": "Goodbye" }

Example output (for Spanish):
{"hello":"Hola mundo","bye":"Adios"}

Target language code: ${targetLang}
Input JSON:
${JSON.stringify(messages)}
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const translations = JSON.parse(raw);

    return NextResponse.json({ translations, meta: { aiUsed: true } });
  } catch (error) {
    console.error("i18n-generate error", error);
    // Fall back to base messages so the UI does not hard-fail in dev.
    return NextResponse.json({ translations: fallbackTranslations, meta: { aiUsed: false, reason: "error" } });
  }
}
