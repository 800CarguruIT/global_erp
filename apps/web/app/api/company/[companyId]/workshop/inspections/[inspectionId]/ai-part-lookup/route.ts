import { NextRequest, NextResponse } from "next/server";
import { getInspectionById } from "@repo/ai-core/workshop/inspections/repository";
import { resolveOpenAiConfig } from "@/lib/ai-config";

type Params = { params: Promise<{ companyId: string; inspectionId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId, inspectionId } = await params;
  const body = await req.json().catch(() => ({}));

  const {
    partName,
    categoryName,
    subcategoryName,
    carMake,
    carModel,
    carYear,
    carEngine,
  } = body ?? {};

  if (!partName) {
    return NextResponse.json({ error: "partName is required" }, { status: 400 });
  }

  const inspection = await getInspectionById(companyId, inspectionId);
  if (!inspection) {
    return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
  }

  const aiConfig = await resolveOpenAiConfig(companyId);
  if (!aiConfig.apiKey) {
    return NextResponse.json({ error: "AI provider not configured. Set OpenAI key in Settings > AI Config." }, { status: 503 });
  }
  const apiKey = aiConfig.apiKey;
  const aiBaseUrl = aiConfig.baseUrl ?? "https://api.openai.com";

  const carContext = [carMake, carModel, carYear, carEngine].filter(Boolean).join(" ");

  const systemPrompt = `You are an automotive parts specialist. Given a car and a part name, provide:
1. The OE (Original Equipment) part number from the vehicle manufacturer
2. 2-3 aftermarket alternatives with brand name and part number
3. Estimated price ranges in USD

Return ONLY valid JSON in this format:
{
  "oePartNumber": "string or null",
  "oeBrand": "string (manufacturer name)",
  "oePriceEstimate": { "min": number, "max": number, "currency": "USD" },
  "alternatives": [
    {
      "brand": "string",
      "partNumber": "string",
      "quality": "OEM" | "Aftermarket" | "Economy",
      "priceEstimate": { "min": number, "max": number, "currency": "USD" }
    }
  ]
}

Use null for any field you cannot determine with reasonable confidence. Do not guess part numbers — only provide them if you are confident they are correct.`;

  const userPrompt = `Car: ${carContext || "Unknown vehicle"}
Category: ${categoryName ?? "N/A"} > ${subcategoryName ?? "N/A"}
Part: ${partName}

Find the OE part number and aftermarket alternatives with pricing.`;

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
        temperature: 0.2,
        max_tokens: 800,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => "");
      return NextResponse.json({ error: `AI request failed: ${aiRes.status}`, detail: errText }, { status: 502 });
    }

    const aiJson = await aiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content ?? "";
    const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json({
      data: {
        oePartNumber: parsed.oePartNumber ?? null,
        oeBrand: parsed.oeBrand ?? null,
        oePriceEstimate: parsed.oePriceEstimate ?? null,
        alternatives: Array.isArray(parsed.alternatives) ? parsed.alternatives : [],
        partName,
        carContext,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "AI lookup failed" }, { status: 500 });
  }
}
