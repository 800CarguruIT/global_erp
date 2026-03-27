import { NextRequest, NextResponse } from "next/server";
import { resolveOpenAiConfig } from "@/lib/ai-config";

type Params = { params: Promise<{ companyId: string; inspectionId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));
  const { partName, actionType, priority, category, carMake, carModel, carYear } = body ?? {};

  if (!partName || !actionType || !priority) {
    return NextResponse.json({ data: { description: null } });
  }

  const aiConfig = await resolveOpenAiConfig(companyId);
  if (!aiConfig.apiKey) {
    // Generate a basic description without AI
    const actionLabel = actionType === "replace" ? "Replacement" : actionType === "service" ? "Servicing" : "Repair";
    const priorityLabel = priority === "safety_risk" ? "Safety risk" : priority === "mandatory" ? "Mandatory" : "Recommended";
    return NextResponse.json({
      data: { description: `${actionLabel} of ${partName} is ${priorityLabel.toLowerCase()}. ${category ? `System: ${category}.` : ""}` },
    });
  }

  const carContext = [carMake, carModel, carYear].filter(Boolean).join(" ");
  const actionLabel = actionType === "replace" ? "Replace" : actionType === "service" ? "Service" : "Repair";
  const priorityLabel = priority === "safety_risk" ? "Safety Risk" : priority === "mandatory" ? "Mandatory" : "Recommended";

  const prompt = `Car: ${carContext || "Unknown vehicle"}
Part: ${partName}${category ? ` (${category})` : ""}
Action needed: ${actionLabel}
Priority: ${priorityLabel}

Write a 1-2 sentence professional inspection note for this finding. Explain WHY this action is needed at this priority level in simple terms a car owner would understand. Be specific to the part and car. Do NOT use markdown. Keep it under 40 words.`;

  try {
    const baseUrl = aiConfig.baseUrl ?? "https://api.openai.com";
    const aiRes = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${aiConfig.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: aiConfig.model,
        messages: [
          { role: "system", content: "You are an automotive inspection report writer. Write concise, professional findings for vehicle inspection reports." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 100,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!aiRes.ok) {
      return NextResponse.json({ data: { description: `${actionLabel} ${priorityLabel.toLowerCase()}: ${partName} requires attention.` } });
    }

    const aiJson = await aiRes.json();
    const description = (aiJson?.choices?.[0]?.message?.content ?? "").trim();
    return NextResponse.json({ data: { description: description || `${partName} — ${actionLabel} (${priorityLabel})` } });
  } catch {
    return NextResponse.json({ data: { description: `${partName} — ${actionLabel} (${priorityLabel})` } });
  }
}
