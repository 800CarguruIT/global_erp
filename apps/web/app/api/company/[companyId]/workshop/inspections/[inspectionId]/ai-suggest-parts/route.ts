import { NextRequest, NextResponse } from "next/server";
import { resolveOpenAiConfig } from "@/lib/ai-config";

type Params = { params: Promise<{ companyId: string; inspectionId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));

  const {
    selectedParts,
    carMake,
    carModel,
    carYear,
  } = body ?? {};

  if (!Array.isArray(selectedParts) || selectedParts.length === 0) {
    return NextResponse.json({ data: { suggestions: [] } });
  }

  const aiConfig = await resolveOpenAiConfig(companyId);
  if (!aiConfig.apiKey) {
    return NextResponse.json({ data: { suggestions: [], debug: "No API key configured" } });
  }
  const apiKey = aiConfig.apiKey;
  const aiBaseUrl = aiConfig.baseUrl ?? "https://api.openai.com";

  const carContext = [carMake, carModel, carYear].filter(Boolean).join(" ");
  const partsList = selectedParts.map((p: string) => `- ${p}`).join("\n");

  const systemPrompt = `You are an experienced automotive inspection advisor. When an inspector identifies a faulty part, there are often related parts that are commonly damaged or worn together.

Given a list of parts the inspector has already flagged, suggest 2-5 additional parts that:
1. Are commonly damaged alongside the selected parts
2. Should be inspected as they may need replacement too
3. Are mechanically related (same system, connected components)

Return ONLY valid JSON array:
[
  {
    "name": "Part Name",
    "reason": "Brief reason why this should be checked (1 sentence)",
    "category": "System category (Engine, Brakes, etc.)",
    "likelihood": "high" | "medium"
  }
]

Rules:
- Do NOT suggest parts already in the selected list
- Only suggest parts that are genuinely related, not random
- Keep reasons short and practical
- "high" = very commonly fails together, "medium" = worth checking`;

  const userPrompt = `Car: ${carContext || "Unknown vehicle"}

Inspector has flagged these parts:
${partsList}

What related parts should also be checked?`;

  try {
    const model = aiConfig.model;
    const aiRes = await fetch(`${aiBaseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 600,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!aiRes.ok) {
      const errBody = await aiRes.text().catch(() => "");
      console.error("[ai-suggest-parts] OpenAI error:", aiRes.status, errBody);
      return NextResponse.json({ data: { suggestions: [], debug: `OpenAI ${aiRes.status}` } });
    }

    const aiJson = await aiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content ?? "[]";
    const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);

    const suggestions = Array.isArray(parsed) ? parsed : [];
    return NextResponse.json({ data: { suggestions } });
  } catch (err: any) {
    console.error("[ai-suggest-parts] Error:", err?.message ?? err);
    return NextResponse.json({ data: { suggestions: [], debug: err?.message ?? "unknown error" } });
  }
}
