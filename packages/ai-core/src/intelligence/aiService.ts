import { getAnthropicClientForCompany } from "../ai/anthropicClient";
import { getPrompt } from "./promptLoader";
import type { EngineKey, Signal } from "./types";

interface RunEngineParams {
  companyId: string;
  engineKey: EngineKey;
  payload: Record<string, unknown>;
  thresholds: Record<string, unknown>;
}

interface RunEngineResult {
  signals: Signal[];
  tokensUsed: { input: number; output: number };
  latencyMs: number;
}

export async function runEngine(params: RunEngineParams): Promise<RunEngineResult> {
  const { companyId, engineKey, payload, thresholds } = params;

  const { client } = await getAnthropicClientForCompany(companyId);
  if (!client) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const systemPrompt = await getPrompt(engineKey, companyId);

  const userContent = JSON.stringify({
    data_snapshot: payload,
    thresholds_context: thresholds,
  });

  const startMs = Date.now();

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: userContent }],
  });

  const latencyMs = Date.now() - startMs;

  const rawText =
    message.content[0]?.type === "text" ? message.content[0].text : "{}";

  // Strip any accidental markdown fences
  const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

  let parsed: { signals?: unknown[] } = {};
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = {};
  }

  const signals: Signal[] = (Array.isArray(parsed.signals) ? parsed.signals : [])
    .slice(0, 5)
    .map((s: any) => ({
      type: s.type ?? "diagnostic",
      metric: String(s.metric ?? ""),
      observation: String(s.observation ?? ""),
      diagnosis: String(s.diagnosis ?? ""),
      action: String(s.action ?? ""),
      urgency: (["HIGH", "MED", "LOW"].includes(s.urgency) ? s.urgency : "LOW") as Signal["urgency"],
      owner_role: String(s.owner_role ?? ""),
      respond_by_hours: Number(s.respond_by_hours ?? 24),
      confidence: Math.min(1, Math.max(0, Number(s.confidence ?? 0.5))),
      expected_outcome: String(s.expected_outcome ?? ""),
      engine_key: engineKey,
    }));

  return {
    signals,
    tokensUsed: {
      input: message.usage.input_tokens,
      output: message.usage.output_tokens,
    },
    latencyMs,
  };
}
