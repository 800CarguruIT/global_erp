import { NextRequest, NextResponse } from "next/server";
import {
  getInspectionById,
  listInspectionItems,
  listInspectionLineItems,
  updateInspectionPartial,
} from "@repo/ai-core/workshop/inspections/repository";
import { getSql } from "@repo/ai-core/db";
import { resolveOpenAiConfig } from "@/lib/ai-config";

type Params = { params: Promise<{ companyId: string; inspectionId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId, inspectionId } = await params;

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

  // Gather inspection data
  const items = await listInspectionItems(inspectionId);
  const lineItems = await listInspectionLineItems(inspectionId);

  // Get car info
  let carInfo = "";
  if (inspection.carId) {
    const sql = getSql();
    const carRows = await sql`SELECT make, model, model_year, plate_number, vin, mileage FROM cars WHERE id = ${inspection.carId} LIMIT 1`;
    const car = carRows[0];
    if (car) {
      carInfo = `Vehicle: ${[car.make, car.model, car.model_year].filter(Boolean).join(" ")} | Plate: ${car.plate_number ?? "N/A"} | VIN: ${car.vin ?? "N/A"} | Mileage: ${car.mileage ?? "N/A"} km`;
    }
  }

  // Build findings list
  const findingsList = [
    ...items.map((item) =>
      `- ${item.partName} (${item.category ?? "General"}): Severity=${item.severity ?? "unknown"}, Action=${item.requiredAction ?? "N/A"}, Reason=${item.techReason ?? "N/A"}`
    ),
    ...lineItems.map((li) => {
      const severity = (li as any).severityLevel ?? "attention";
      return `- ${li.productName ?? "Unknown part"}: Severity=${severity}, Status=${li.status}${li.aiPartNumber ? `, PartNo=${li.aiPartNumber}` : ""}`;
    }),
  ].join("\n");

  const healthScores = `Engine: ${inspection.healthEngine ?? "N/A"}%, Transmission: ${inspection.healthTransmission ?? "N/A"}%, Brakes: ${inspection.healthBrakes ?? "N/A"}%, Suspension: ${inspection.healthSuspension ?? "N/A"}%, Electrical: ${inspection.healthElectrical ?? "N/A"}%`;

  const systemPrompt = `You are an automotive inspection report writer. Generate two summaries from inspection findings:

1. **Technical Summary** (for mechanics/advisors): Concise markdown with key issues, recommended repairs, and priority order.
2. **Customer Summary** (for car owners): Simple, jargon-free explanation of what was found and what needs attention. Use everyday language.

Also calculate recommended health scores (0-100) for each system based on the findings severity:
- 90-100: Good condition
- 60-89: Needs attention (minor issues)
- 0-59: Needs replacement (critical issues)

Return ONLY valid JSON:
{
  "technicalSummary": "markdown string",
  "customerSummary": "plain text string",
  "healthScores": {
    "engine": number,
    "transmission": number,
    "brakes": number,
    "suspension": number,
    "electrical": number,
    "overall": number
  }
}`;

  const userPrompt = `${carInfo}

Current Health Scores: ${healthScores}
Inspector Remarks: ${inspection.inspectorRemark ?? "None"}

Findings:
${findingsList || "No findings recorded."}

Generate the inspection summary and recommended health scores.`;

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
        max_tokens: 1500,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!aiRes.ok) {
      return NextResponse.json({ error: `AI request failed: ${aiRes.status}` }, { status: 502 });
    }

    const aiJson = await aiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content ?? "";
    const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);

    const healthData = parsed.healthScores ?? {};

    // Update inspection with AI summaries and health scores
    await updateInspectionPartial(companyId, inspectionId, {
      aiSummaryMarkdown: parsed.technicalSummary ?? null,
      aiSummaryPlain: parsed.customerSummary ?? null,
      inspectorRemarkLayman: parsed.customerSummary ?? null,
      healthEngine: typeof healthData.engine === "number" ? healthData.engine : undefined,
      healthTransmission: typeof healthData.transmission === "number" ? healthData.transmission : undefined,
      healthBrakes: typeof healthData.brakes === "number" ? healthData.brakes : undefined,
      healthSuspension: typeof healthData.suspension === "number" ? healthData.suspension : undefined,
      healthElectrical: typeof healthData.electrical === "number" ? healthData.electrical : undefined,
      overallHealth: typeof healthData.overall === "number" ? healthData.overall : undefined,
    });

    return NextResponse.json({
      data: {
        technicalSummary: parsed.technicalSummary ?? null,
        customerSummary: parsed.customerSummary ?? null,
        healthScores: healthData,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "AI summary failed" }, { status: 500 });
  }
}
