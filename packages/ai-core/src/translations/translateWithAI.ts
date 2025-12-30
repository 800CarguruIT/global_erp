import { getOpenAIClient } from "../ai/client";
import { canUseAi } from "../ai/policy";
import type OpenAI from "openai";

export async function translateText(source: string, lang: string): Promise<string> {
  if (!lang || lang.toLowerCase() === "en") {
    return source;
  }

  const aiAllowed = await canUseAi("ai.i18n", { companyId: null, platformId: null });
  if (!aiAllowed) {
    return source;
  }

  const client = getOpenAIClient();
  const prompt: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "You are a professional business translator for an ERP system. Maintain concise, formal tone. Preserve business meaning and context."
    },
    {
      role: "user",
      content: `Translate the following text to language code "${lang}" (e.g. 'ar' for Arabic). Respond with translation only.\n\n${source}`
    }
  ];

  const resp = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: prompt,
    temperature: 0.2,
  });

  const translated = resp.choices[0]?.message?.content?.trim();
  if (!translated) {
    return source;
  }
  return translated;
}
