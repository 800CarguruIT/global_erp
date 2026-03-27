import { NextRequest, NextResponse } from "next/server";
import { listPartCategoryTree } from "@repo/ai-core/workshop/inspections/repository";
import { getSql } from "@repo/ai-core/db";
import { resolveOpenAiConfig } from "@/lib/ai-config";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const { searchParams } = new URL(req.url);
  const make = searchParams.get("make") || undefined;
  const model = searchParams.get("model") || undefined;
  const bodyType = searchParams.get("bodyType") || undefined;

  // If we have a make, check if AI has already seeded car-specific parts
  if (make) {
    await ensureCarSpecificParts(companyId, make, model ?? null, bodyType ?? null);
  }

  const tree = await listPartCategoryTree(companyId, make, bodyType);
  return NextResponse.json({ data: tree });
}

/**
 * Check if AI has seeded parts for this make/model.
 * If not, call AI to generate car-specific parts and store in DB.
 */
async function ensureCarSpecificParts(
  companyId: string,
  make: string,
  model: string | null,
  bodyType: string | null
) {
  const sql = getSql();
  const normalizedMake = make.trim().toUpperCase();
  const normalizedModel = model?.trim() || null;

  // Check cache
  const cached = await sql`
    SELECT id FROM inspection_part_ai_cache
    WHERE car_make = ${normalizedMake}
      AND (car_model = ${normalizedModel} OR (car_model IS NULL AND ${normalizedModel}::text IS NULL))
      AND (company_id = ${companyId} OR company_id IS NULL)
    LIMIT 1
  `;
  if (cached.length > 0) return; // Already seeded

  // Check if AI is available
  const aiConfig = await resolveOpenAiConfig(companyId);
  if (!aiConfig.apiKey) return; // No AI, use default categories

  // Get existing subcategory names to avoid duplicates
  const existingSubs = await sql`
    SELECT sc.name, c.name as category_name
    FROM inspection_part_subcategories sc
    JOIN inspection_part_categories c ON c.id = sc.category_id
    WHERE c.company_id IS NULL OR c.company_id = ${companyId}
  `;
  const existingSubNames = new Set(existingSubs.map((r: any) => `${r.category_name}::${r.name}`.toLowerCase()));

  const carDesc = [normalizedMake, normalizedModel, bodyType].filter(Boolean).join(" ");

  const prompt = `For a ${carDesc} vehicle, list car-specific parts that are unique to this make/model and NOT already covered by standard universal automotive categories.

Focus on parts specific to ${normalizedMake} vehicles that a mechanic would inspect, such as:
- Make-specific electronic systems (iDrive, COMAND, etc.)
- Model-specific suspension types (air suspension, adaptive dampers)
- Unique engine components for this model
- Brand-specific wear items

Return ONLY valid JSON array. Each entry must specify which existing category it belongs to:
[
  {
    "category": "Engine" | "Transmission" | "Brakes" | "Suspension" | "Steering" | "Electrical" | "A/C & Cooling" | "Body & Exterior" | "Interior" | "Exhaust" | "Fuel System" | "Tyres & Wheels",
    "subcategory": "Name of subcategory (new or existing)",
    "parts": ["Part Name 1", "Part Name 2"]
  }
]

Rules:
- Only include parts genuinely specific to ${normalizedMake}${normalizedModel ? ` ${normalizedModel}` : ""}
- Do NOT include universal parts (brake pads, oil filter, etc.) — those already exist
- Maximum 15 entries total
- Keep part names concise and professional`;

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
          { role: "system", content: "You are an automotive parts specialist. Return only valid JSON." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 1200,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!aiRes.ok) return;

    const aiJson = await aiRes.json();
    const content = (aiJson?.choices?.[0]?.message?.content ?? "[]")
      .replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const entries: { category: string; subcategory: string; parts: string[] }[] = JSON.parse(content);
    if (!Array.isArray(entries) || entries.length === 0) return;

    // Get existing categories to map names to IDs
    const categories = await sql`
      SELECT id, name FROM inspection_part_categories
      WHERE company_id IS NULL OR company_id = ${companyId}
    `;
    const catMap = new Map(categories.map((c: any) => [c.name.toLowerCase(), c.id]));

    let partsAdded = 0;

    for (const entry of entries) {
      const catId = catMap.get(entry.category?.toLowerCase());
      if (!catId) continue;

      const subKey = `${entry.category}::${entry.subcategory}`.toLowerCase();
      let subId: string;

      if (existingSubNames.has(subKey)) {
        // Use existing subcategory
        const existingSub = await sql`
          SELECT sc.id FROM inspection_part_subcategories sc
          JOIN inspection_part_categories c ON c.id = sc.category_id
          WHERE LOWER(sc.name) = ${entry.subcategory.toLowerCase()}
            AND c.id = ${catId}
          LIMIT 1
        `;
        if (!existingSub[0]) continue;
        subId = existingSub[0].id;
      } else {
        // Create new subcategory
        const newSub = await sql`
          INSERT INTO inspection_part_subcategories (category_id, name, display_order)
          VALUES (${catId}, ${entry.subcategory}, 99)
          RETURNING id
        `;
        subId = newSub[0].id;
        existingSubNames.add(subKey);
      }

      // Add parts with make filter
      for (const partName of (entry.parts ?? [])) {
        if (!partName?.trim()) continue;
        // Check if part already exists in this subcategory
        const existing = await sql`
          SELECT id FROM inspection_part_definitions
          WHERE subcategory_id = ${subId} AND LOWER(name) = ${partName.trim().toLowerCase()}
          LIMIT 1
        `;
        if (existing.length > 0) continue;

        await sql`
          INSERT INTO inspection_part_definitions (subcategory_id, name, applicable_makes, display_order)
          VALUES (${subId}, ${partName.trim()}, ${sql.array([normalizedMake])}, 99)
        `;
        partsAdded++;
      }
    }

    // Record in cache
    await sql`
      INSERT INTO inspection_part_ai_cache (company_id, car_make, car_model, car_body_type, parts_added)
      VALUES (${companyId}, ${normalizedMake}, ${normalizedModel}, ${bodyType}, ${partsAdded})
      ON CONFLICT (company_id, car_make, car_model) DO UPDATE SET
        parts_added = inspection_part_ai_cache.parts_added + ${partsAdded},
        seeded_at = now()
    `;
  } catch (err) {
    console.error("[part-categories] AI seeding failed:", err);
  }
}
