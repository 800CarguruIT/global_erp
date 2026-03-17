import { NextRequest, NextResponse } from "next/server";
import { canUseAi, getOpenAIClientForCompany, getSql } from "@repo/ai-core";

import { requireAuth } from "@/lib/auth/requireAuth";

type Params = { params: Promise<{ companyId: string }> };

export const runtime = "nodejs";

type CostType = "oe" | "oem" | "aftm" | "used";

type BodyPayload = {
  estimateId?: string;
  lineItem?: {
    partName?: string;
    description?: string;
    partNumber?: string;
    quantity?: number;
    approvedType?: CostType | null;
    currentCosts?: Partial<Record<CostType, number | null>>;
  };
};

function toNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function avg(values: number[]): number | null {
  if (!values.length) return null;
  return round2(values.reduce((sum, v) => sum + v, 0) / values.length);
}

function normalizeCostMap(value: unknown): Partial<Record<CostType, number>> {
  const input = (value ?? {}) as Record<string, unknown>;
  const normalized: Partial<Record<CostType, number>> = {};
  for (const key of ["oe", "oem", "aftm", "used"] as const) {
    const n = toNumber(input[key]);
    if (n != null && n > 0) normalized[key] = round2(n);
  }
  return normalized;
}

function buildThreshold(
  averages: Partial<Record<CostType, number>>,
  preferredType?: CostType | null
): {
  basisType: CostType;
  basisCost: number;
  minSale: number;
  targetSale: number;
  maxSale: number;
} {
  const pickOrder: CostType[] = preferredType
    ? [preferredType, "oe", "oem", "aftm", "used"].filter(
        (v, idx, arr) => arr.indexOf(v as CostType) === idx
      ) as CostType[]
    : ["oe", "oem", "aftm", "used"];
  let basisType: CostType = "oem";
  let basisCost = 0;
  for (const type of pickOrder) {
    const val = Number(averages[type] ?? 0);
    if (val > 0) {
      basisType = type;
      basisCost = val;
      break;
    }
  }
  const thresholdsByType: Record<CostType, { min: number; target: number; max: number }> = {
    oe: { min: 1.2, target: 1.35, max: 1.6 },
    oem: { min: 1.18, target: 1.3, max: 1.55 },
    aftm: { min: 1.15, target: 1.25, max: 1.45 },
    used: { min: 1.1, target: 1.2, max: 1.35 },
  };
  const ratio = thresholdsByType[basisType];
  return {
    basisType,
    basisCost: round2(basisCost),
    minSale: round2(basisCost * ratio.min),
    targetSale: round2(basisCost * ratio.target),
    maxSale: round2(basisCost * ratio.max),
  };
}

function fallbackFromCurrentCosts(
  currentCosts: Partial<Record<CostType, number>>,
  approvedType?: CostType | null
) {
  const threshold = buildThreshold(currentCosts, approvedType);
  return {
    averages: {
      oe: currentCosts.oe ?? null,
      oem: currentCosts.oem ?? null,
      aftm: currentCosts.aftm ?? null,
      used: currentCosts.used ?? null,
    },
    threshold,
    sampleSize: 0,
    source: "heuristic",
    confidence: "low" as const,
    note: "Fallback pricing used from current row costs.",
  };
}

function normalizeAiResult(value: unknown): {
  costs: Partial<Record<CostType, number>>;
  threshold?: {
    basisType?: CostType;
    basisCost?: number;
    minSale?: number;
    targetSale?: number;
    maxSale?: number;
  };
  confidence?: "low" | "medium" | "high";
  note?: string;
} {
  const obj = (value ?? {}) as Record<string, unknown>;
  const costs = normalizeCostMap(obj.costs);
  const thresholdRaw = (obj.threshold ?? {}) as Record<string, unknown>;
  const basisType = String(thresholdRaw.basisType ?? "").toLowerCase();
  const threshold =
    basisType === "oe" || basisType === "oem" || basisType === "aftm" || basisType === "used"
      ? {
          basisType: basisType as CostType,
          basisCost: toNumber(thresholdRaw.basisCost) ?? undefined,
          minSale: toNumber(thresholdRaw.minSale) ?? undefined,
          targetSale: toNumber(thresholdRaw.targetSale) ?? undefined,
          maxSale: toNumber(thresholdRaw.maxSale) ?? undefined,
        }
      : undefined;
  const confidence = String(obj.confidence ?? "").toLowerCase();
  return {
    costs,
    threshold,
    confidence:
      confidence === "low" || confidence === "medium" || confidence === "high"
        ? (confidence as "low" | "medium" | "high")
        : undefined,
    note: String(obj.note ?? "").trim() || undefined,
  };
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId: rawCompanyId } = await params;
  const companyId = String(rawCompanyId ?? "").trim();
  if (!companyId) return NextResponse.json({ error: "companyId is required" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as BodyPayload;
  const lineItem = (body?.lineItem ?? {}) as NonNullable<BodyPayload["lineItem"]>;

  const partName = String(lineItem.partName ?? "").trim();
  const description = String(lineItem.description ?? "").trim();
  const partNumber = String(lineItem.partNumber ?? "").trim();
  const quantity = Math.max(1, Number(lineItem.quantity ?? 1) || 1);
  const approvedType = (String(lineItem.approvedType ?? "").toLowerCase() || null) as CostType | null;
  const currentCosts = normalizeCostMap(lineItem.currentCosts);

  if (!partName && !partNumber) {
    return NextResponse.json({ error: "partName or partNumber is required" }, { status: 400 });
  }

  try {
    const sql = getSql();
    const likePartName = `%${(partName || description).trim()}%`;

    const rows = await sql<any[]>/* sql */ `
      SELECT
        pq.oe,
        pq.oem,
        pq.aftm,
        pq.used,
        pq.updated_at
      FROM part_quotes pq
      LEFT JOIN line_items li ON li.id = pq.line_item_id
      LEFT JOIN inventory_order_request_items iori ON iori.id = pq.inventory_request_item_id
      WHERE pq.company_id = ${companyId}
        AND pq.updated_at >= NOW() - INTERVAL '24 months'
        AND (
          (${partName ? sql`LOWER(COALESCE(li.product_name, iori.part_name, '')) LIKE LOWER(${likePartName})` : sql`FALSE`})
          OR (${partNumber ? sql`LOWER(COALESCE(li.product_name, iori.part_name, '')) LIKE LOWER(${`%${partNumber}%`})` : sql`FALSE`})
        )
      ORDER BY pq.updated_at DESC
      LIMIT 250
    `;

    const sampleValues: Record<CostType, number[]> = { oe: [], oem: [], aftm: [], used: [] };
    for (const row of rows) {
      const oe = toNumber(row?.oe);
      const oem = toNumber(row?.oem);
      const aftm = toNumber(row?.aftm);
      const used = toNumber(row?.used);
      if (oe != null && oe > 0) sampleValues.oe.push(oe);
      if (oem != null && oem > 0) sampleValues.oem.push(oem);
      if (aftm != null && aftm > 0) sampleValues.aftm.push(aftm);
      if (used != null && used > 0) sampleValues.used.push(used);
    }

    const dbAverages: Partial<Record<CostType, number>> = {
      oe: avg(sampleValues.oe) ?? undefined,
      oem: avg(sampleValues.oem) ?? undefined,
      aftm: avg(sampleValues.aftm) ?? undefined,
      used: avg(sampleValues.used) ?? undefined,
    };
    const dbSampleSize =
      sampleValues.oe.length + sampleValues.oem.length + sampleValues.aftm.length + sampleValues.used.length;

    const allowed = await canUseAi("ai.workshop.estimates.market_pricing" as any, { companyId }).catch(
      () => true
    );
    const resolved = await getOpenAIClientForCompany(companyId);

    let aiAverages: Partial<Record<CostType, number>> = {};
    let aiThreshold:
      | {
          basisType: CostType;
          basisCost: number;
          minSale: number;
          targetSale: number;
          maxSale: number;
        }
      | null = null;
    let confidence: "low" | "medium" | "high" | null = null;
    let note: string | null = null;

    if (allowed && resolved.client) {
      const prompt = `
You are an automotive parts pricing assistant.
For this part line item, estimate realistic average purchase costs by type and sale-price thresholds.

Context:
- Part name: ${partName || "N/A"}
- Description: ${description || "N/A"}
- Part number: ${partNumber || "N/A"}
- Quantity: ${quantity}
- Current quoted costs: ${JSON.stringify(currentCosts)}
- Company quote averages (last 24 months): ${JSON.stringify(dbAverages)}
- Company quote sample size: ${dbSampleSize}
- Preferred approved type: ${approvedType || "N/A"}
- Currency: AED

Return strict JSON only:
{
  "costs": { "oe": number, "oem": number, "aftm": number, "used": number },
  "threshold": {
    "basisType": "oe|oem|aftm|used",
    "basisCost": number,
    "minSale": number,
    "targetSale": number,
    "maxSale": number
  },
  "confidence": "low|medium|high",
  "note": "one short sentence"
}

Rules:
- Use company quote averages as primary when present.
- Fill missing types with realistic market estimates.
- Keep all numbers positive and in AED.
- Ensure minSale <= targetSale <= maxSale.
- Keep output concise and valid JSON.
`;
      try {
        const completion = await resolved.client.chat.completions.create({
          model: "gpt-4.1-mini",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
        });
        const raw = completion.choices[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(raw);
        const normalized = normalizeAiResult(parsed);
        aiAverages = normalized.costs;
        confidence = normalized.confidence ?? null;
        note = normalized.note ?? null;
        if (normalized.threshold?.basisType) {
          const t = normalized.threshold;
          aiThreshold = {
            basisType: t.basisType,
            basisCost: round2(Number(t.basisCost ?? 0)),
            minSale: round2(Number(t.minSale ?? 0)),
            targetSale: round2(Number(t.targetSale ?? 0)),
            maxSale: round2(Number(t.maxSale ?? 0)),
          };
        }
      } catch {
        aiAverages = {};
      }
    }

    const mergedAverages: Partial<Record<CostType, number>> = {
      oe: aiAverages.oe ?? dbAverages.oe ?? currentCosts.oe,
      oem: aiAverages.oem ?? dbAverages.oem ?? currentCosts.oem,
      aftm: aiAverages.aftm ?? dbAverages.aftm ?? currentCosts.aftm,
      used: aiAverages.used ?? dbAverages.used ?? currentCosts.used,
    };
    const normalizedMerged = normalizeCostMap(mergedAverages);
    const fallbackThreshold = buildThreshold(normalizedMerged, approvedType);
    const threshold = aiThreshold ?? fallbackThreshold;

    const source =
      aiAverages.oe || aiAverages.oem || aiAverages.aftm || aiAverages.used
        ? dbSampleSize > 0
          ? "ai+quotes-db"
          : "ai"
        : dbSampleSize > 0
        ? "quotes-db"
        : "heuristic";

    return NextResponse.json({
      averages: {
        oe: normalizedMerged.oe ?? null,
        oem: normalizedMerged.oem ?? null,
        aftm: normalizedMerged.aftm ?? null,
        used: normalizedMerged.used ?? null,
      },
      threshold,
      sampleSize: dbSampleSize,
      source,
      confidence,
      note,
    });
  } catch (error) {
    console.error("POST /api/company/[companyId]/workshop/estimates/ai-market-pricing error", error);
    return NextResponse.json(fallbackFromCurrentCosts(currentCosts, approvedType), { status: 200 });
  }
}
