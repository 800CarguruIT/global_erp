import { NextRequest, NextResponse } from "next/server";
import { TranslationsService } from "@repo/ai-core";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const sourceTexts: string[] = Array.isArray(body?.sourceTexts) ? body.sourceTexts : [];
    const lang: string = body?.lang || "en";

    if (!sourceTexts.length) {
      return NextResponse.json({ error: "sourceTexts required" }, { status: 400 });
    }

    const translationsEntries = await Promise.all(
      sourceTexts.map(async (text) => {
        const translated = await TranslationsService.getTranslation(text, lang);
        return [text, translated] as const;
      })
    );

    const translations: Record<string, string> = Object.fromEntries(translationsEntries);
    return NextResponse.json({ translations });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: "Translation failed" }, { status: 500 });
  }
}
