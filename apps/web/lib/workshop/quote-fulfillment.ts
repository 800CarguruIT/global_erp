import { canUseAi, getOpenAIClientForCompany, getSql, WorkshopProcurement } from "@repo/ai-core";

type QuoteRecommendation = {
  lineItemId: string;
  lineItemName: string;
  quoteId: string;
  vendorId: string | null;
  vendorName: string;
  selectedType: "oe" | "oem" | "aftm" | "used";
  selectedPrice: number;
  selectedQty: number;
  selectedEtd: string;
  heuristicScore: number;
  reason: string;
};

type RecommendResult = {
  recommendations: QuoteRecommendation[];
  summary: string;
};

const QUALITY_BY_TYPE: Record<"oe" | "oem" | "aftm" | "used", number> = {
  oe: 1.0,
  oem: 0.95,
  aftm: 0.78,
  used: 0.6,
};

function parseEtdHours(raw: string): number {
  const value = String(raw ?? "").trim().toLowerCase();
  if (!value) return 72;
  if (value.includes("same day")) return 8;
  const rangeMatch = value.match(/(\d+)\s*-\s*(\d+)\s*day/);
  if (rangeMatch) {
    const a = Number(rangeMatch[1]);
    const b = Number(rangeMatch[2]);
    if (Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0) return ((a + b) / 2) * 24;
  }
  const daysMatch = value.match(/(\d+)\s*day/);
  if (daysMatch) {
    const d = Number(daysMatch[1]);
    if (Number.isFinite(d) && d > 0) return d * 24;
  }
  const hoursMatch = value.match(/(\d+)\s*hour/);
  if (hoursMatch) {
    const h = Number(hoursMatch[1]);
    if (Number.isFinite(h) && h > 0) return h;
  }
  return 72;
}

function normalize01(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 1;
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function buildDeliveryNoteNumber() {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const token = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `DN-${yyyy}${mm}${dd}-${token}`;
}

export async function recommendBestPartQuotesForWorkshopQuote(args: {
  companyId: string;
  workshopQuoteId: string;
}): Promise<RecommendResult> {
  const sql = getSql();
  const workshopRows = await sql/* sql */ `
    SELECT id, estimate_id
    FROM workshop_quotes
    WHERE company_id = ${args.companyId}
      AND id = ${args.workshopQuoteId}
    LIMIT 1
  `;
  if (!workshopRows[0]?.estimate_id) {
    return { recommendations: [], summary: "No estimate linked to this workshop quote." };
  }
  const estimateId = String(workshopRows[0].estimate_id);
  const rows = await sql/* sql */ `
    WITH vendor_stats AS (
      SELECT
        pq.vendor_id,
        COUNT(*)::int AS total_quotes,
        SUM(CASE WHEN LOWER(COALESCE(pq.status, '')) IN ('return', 'returned') THEN 1 ELSE 0 END)::int AS return_quotes,
        SUM(CASE WHEN LOWER(COALESCE(pq.status, '')) IN ('received', 'completed') THEN 1 ELSE 0 END)::int AS good_quotes
      FROM part_quotes pq
      WHERE pq.company_id = ${args.companyId}
      GROUP BY pq.vendor_id
    )
    SELECT
      pq.id AS quote_id,
      pq.vendor_id,
      COALESCE(v.name, 'Vendor') AS vendor_name,
      pq.line_item_id,
      COALESCE(li.product_name, 'Part') AS line_item_name,
      COALESCE(NULLIF(li.quantity, 0), 1)::numeric AS required_qty,
      pq.oe, pq.oem, pq.aftm, pq.used,
      pq.oe_qty, pq.oem_qty, pq.aftm_qty, pq.used_qty,
      pq.oe_etd, pq.oem_etd, pq.aftm_etd, pq.used_etd,
      COALESCE(vs.total_quotes, 0) AS vendor_total_quotes,
      COALESCE(vs.return_quotes, 0) AS vendor_return_quotes,
      COALESCE(vs.good_quotes, 0) AS vendor_good_quotes
    FROM part_quotes pq
    INNER JOIN line_items li ON li.id = pq.line_item_id
    LEFT JOIN vendors v ON v.id = pq.vendor_id
    LEFT JOIN vendor_stats vs ON vs.vendor_id = pq.vendor_id
    WHERE pq.company_id = ${args.companyId}
      AND pq.estimate_id = ${estimateId}
      AND pq.line_item_id IS NOT NULL
      AND LOWER(COALESCE(li.status, '')) IN ('approved', 'inquiry', 'pending')
  `;

  type Candidate = {
    lineItemId: string;
    lineItemName: string;
    quoteId: string;
    vendorId: string | null;
    vendorName: string;
    type: "oe" | "oem" | "aftm" | "used";
    price: number;
    qty: number;
    etd: string;
    etdHours: number;
    returnRate: number;
    creditScore: number;
    qualityScore: number;
    score: number;
  };

  const candidatesByLine = new Map<string, Candidate[]>();

  for (const row of rows as any[]) {
    const lineItemId = String(row.line_item_id ?? "").trim();
    if (!lineItemId) continue;
    const requiredQty = Math.max(1, Number(row.required_qty ?? 1));
    const totalQuotes = Math.max(1, Number(row.vendor_total_quotes ?? 0));
    const returnRate = Number(row.vendor_return_quotes ?? 0) / totalQuotes;
    const goodRate = Number(row.vendor_good_quotes ?? 0) / totalQuotes;
    const creditScore = Math.max(0, Math.min(1, 0.35 + goodRate * 0.65));

    const perType: Array<{ type: "oe" | "oem" | "aftm" | "used"; price: number; qty: number; etd: string }> = [
      { type: "oe", price: Number(row.oe ?? 0), qty: Number(row.oe_qty ?? 0), etd: String(row.oe_etd ?? "") },
      { type: "oem", price: Number(row.oem ?? 0), qty: Number(row.oem_qty ?? 0), etd: String(row.oem_etd ?? "") },
      { type: "aftm", price: Number(row.aftm ?? 0), qty: Number(row.aftm_qty ?? 0), etd: String(row.aftm_etd ?? "") },
      { type: "used", price: Number(row.used ?? 0), qty: Number(row.used_qty ?? 0), etd: String(row.used_etd ?? "") },
    ];

    for (const option of perType) {
      if (!Number.isFinite(option.price) || option.price <= 0) continue;
      const optionQty = Number.isFinite(option.qty) && option.qty > 0 ? option.qty : requiredQty;
      if (optionQty < requiredQty) continue;
      const etdHours = parseEtdHours(option.etd);
      const item: Candidate = {
        lineItemId,
        lineItemName: String(row.line_item_name ?? "Part"),
        quoteId: String(row.quote_id),
        vendorId: row.vendor_id ? String(row.vendor_id) : null,
        vendorName: String(row.vendor_name ?? "Vendor"),
        type: option.type,
        price: option.price,
        qty: optionQty,
        etd: option.etd || "Unknown",
        etdHours,
        returnRate,
        creditScore,
        qualityScore: QUALITY_BY_TYPE[option.type],
        score: 0,
      };
      const list = candidatesByLine.get(lineItemId) ?? [];
      list.push(item);
      candidatesByLine.set(lineItemId, list);
    }
  }

  const recommendations: QuoteRecommendation[] = [];
  for (const [lineItemId, list] of candidatesByLine.entries()) {
    if (!list.length) continue;
    const prices = list.map((x) => x.price);
    const hours = list.map((x) => x.etdHours);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const minHours = Math.min(...hours);
    const maxHours = Math.max(...hours);
    for (const item of list) {
      const priceScore = normalize01(item.price, minPrice, maxPrice);
      const speedScore = normalize01(item.etdHours, minHours, maxHours);
      const qualityPenalty = 1 - item.qualityScore;
      const returnPenalty = Math.max(0, Math.min(1, item.returnRate));
      const creditPenalty = 1 - item.creditScore;
      item.score =
        priceScore * 0.4 +
        speedScore * 0.25 +
        qualityPenalty * 0.2 +
        returnPenalty * 0.1 +
        creditPenalty * 0.05;
    }
    const sorted = [...list].sort((a, b) => a.score - b.score);
    const best = sorted[0]!;
    recommendations.push({
      lineItemId,
      lineItemName: best.lineItemName,
      quoteId: best.quoteId,
      vendorId: best.vendorId,
      vendorName: best.vendorName,
      selectedType: best.type,
      selectedPrice: Number(best.price.toFixed(2)),
      selectedQty: Number(best.qty.toFixed(2)),
      selectedEtd: best.etd,
      heuristicScore: Number(best.score.toFixed(4)),
      reason: `Best balance of price, ETA, quality (${best.type.toUpperCase()}), low returns, and vendor reliability.`,
    });
  }

  let finalRecommendations = recommendations;
  try {
    const allowed = await canUseAi("ai.workshop.quote.best_vendor_recommendation" as any, {
      companyId: args.companyId,
    }).catch(() => true);
    if (allowed && recommendations.length > 0) {
      const resolved = await getOpenAIClientForCompany(args.companyId);
      if (resolved?.client) {
        const completion = await resolved.client.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0.1,
          messages: [
            {
              role: "system",
              content:
                "You are a procurement optimizer. Select one best option per line item to balance cost, delivery speed, quality, return risk, and vendor reliability. Return strict JSON only.",
            },
            {
              role: "user",
              content: JSON.stringify({
                task: "Select one recommendation per line item from these heuristic picks. Keep same quoteId unless clearly better rationale.",
                recommendations,
                outputShape: {
                  picks: [
                    {
                      lineItemId: "string",
                      quoteId: "string",
                      selectedType: "oe|oem|aftm|used",
                      reason: "string",
                    },
                  ],
                },
              }),
            },
          ],
        });
        const content = String(completion.choices?.[0]?.message?.content ?? "").trim();
        const firstBrace = content.indexOf("{");
        const lastBrace = content.lastIndexOf("}");
        if (firstBrace >= 0 && lastBrace > firstBrace) {
          const parsed = JSON.parse(content.slice(firstBrace, lastBrace + 1));
          const picks = Array.isArray(parsed?.picks) ? parsed.picks : [];
          const byLine = new Map(recommendations.map((item) => [item.lineItemId, item]));
          for (const pick of picks as any[]) {
            const lineId = String(pick?.lineItemId ?? "").trim();
            const qid = String(pick?.quoteId ?? "").trim();
            const base = byLine.get(lineId);
            if (!base || !qid) continue;
            const match = recommendations.find((x) => x.lineItemId === lineId && x.quoteId === qid);
            if (!match) continue;
            const selectedType = String(pick?.selectedType ?? match.selectedType).toLowerCase();
            if (selectedType === "oe" || selectedType === "oem" || selectedType === "aftm" || selectedType === "used") {
              match.selectedType = selectedType;
            }
            const reason = String(pick?.reason ?? "").trim();
            if (reason) match.reason = reason;
          }
          finalRecommendations = recommendations;
        }
      }
    }
  } catch {
    // fallback to heuristic recommendations
  }

  const summary = finalRecommendations.length
    ? `Recommended ${finalRecommendations.length} line-item quote selections with balanced cost, ETA, quality, return risk, and vendor reliability.`
    : "No part quote recommendations found.";

  return { recommendations: finalRecommendations, summary };
}

export async function applyRecommendedPartQuotes(args: {
  companyId: string;
  workshopQuoteId: string;
  branchId: string | null;
  approvedByUserId: string | null;
  recommendations: QuoteRecommendation[];
}): Promise<{
  deliveryNotes: Array<{ noteNo: string; vendorId: string | null; quoteIds: string[]; poId: string | null }>;
}> {
  const sql = getSql();
  if (!args.recommendations.length) return { deliveryNotes: [] };
  const destinationName =
    args.branchId
      ? (
          await sql/* sql */ `
            SELECT COALESCE(display_name, name, code) AS branch_name
            FROM branches
            WHERE company_id = ${args.companyId}
              AND id = ${args.branchId}
            LIMIT 1
          `
        )[0]?.branch_name ?? null
      : null;

  const byVendor = new Map<string, QuoteRecommendation[]>();
  for (const rec of args.recommendations) {
    const key = rec.vendorId ?? "no-vendor";
    const list = byVendor.get(key) ?? [];
    list.push(rec);
    byVendor.set(key, list);
  }

  const deliveryNotes: Array<{ noteNo: string; vendorId: string | null; quoteIds: string[]; poId: string | null }> = [];

  for (const [vendorKey, recs] of byVendor.entries()) {
    const noteNo = buildDeliveryNoteNumber();
    const vendorId = vendorKey === "no-vendor" ? null : vendorKey;
    const quoteIds = recs.map((x) => x.quoteId);

    for (const rec of recs) {
      const orderedQtyByType = {
        oe: rec.selectedType === "oe" ? rec.selectedQty : 0,
        oem: rec.selectedType === "oem" ? rec.selectedQty : 0,
        aftm: rec.selectedType === "aftm" ? rec.selectedQty : 0,
        used: rec.selectedType === "used" ? rec.selectedQty : 0,
      };
      try {
        await sql/* sql */ `
          UPDATE part_quotes
          SET
            status = 'Ordered',
            ordered_type = ${rec.selectedType},
            ordered_unit_price = ${rec.selectedPrice},
            ordered_oe_qty = ${orderedQtyByType.oe || null},
            ordered_oem_qty = ${orderedQtyByType.oem || null},
            ordered_aftm_qty = ${orderedQtyByType.aftm || null},
            ordered_used_qty = ${orderedQtyByType.used || null},
            delivery_note_no = ${noteNo},
            delivery_note_status = ${"issued"},
            delivery_note_payload = ${{
              workshopQuoteId: args.workshopQuoteId,
              branchId: args.branchId,
              destinationName,
              destination: "workshop",
              sourceName: rec.vendorName,
              sourceLocation: "Vendor",
              selectedType: rec.selectedType,
              selectedPrice: rec.selectedPrice,
              selectedEtd: rec.selectedEtd,
              reason: rec.reason,
            }},
            updated_at = NOW()
          WHERE company_id = ${args.companyId}
            AND id = ${rec.quoteId}
        `;
      } catch {
        await sql/* sql */ `
          UPDATE part_quotes
          SET
            status = 'Ordered',
            ordered_oe_qty = ${orderedQtyByType.oe || null},
            ordered_oem_qty = ${orderedQtyByType.oem || null},
            ordered_aftm_qty = ${orderedQtyByType.aftm || null},
            ordered_used_qty = ${orderedQtyByType.used || null},
            updated_at = NOW()
          WHERE company_id = ${args.companyId}
            AND id = ${rec.quoteId}
        `;
      }

      try {
        await sql/* sql */ `
          INSERT INTO part_quote_logs (
            company_id,
            part_quote_id,
            delivery_note_no,
            event_type,
            payload,
            created_by
          ) VALUES (
            ${args.companyId},
            ${rec.quoteId},
            ${noteNo},
            ${"delivery_note_issued"},
            ${{
              workshopQuoteId: args.workshopQuoteId,
              selectedType: rec.selectedType,
              selectedPrice: rec.selectedPrice,
              selectedQty: rec.selectedQty,
              selectedEtd: rec.selectedEtd,
            }},
            ${args.approvedByUserId}
          )
        `;
      } catch {
        // log table is optional on older schema
      }
    }

    let poId: string | null = null;
    try {
      const quoteRows = await sql/* sql */ `
        SELECT
          pq.id AS quote_id,
          pq.estimate_item_id,
          pq.line_item_id,
          COALESCE(li.product_name, 'Part') AS part_name,
          COALESCE(li.description, '') AS part_description,
          COALESCE(NULLIF(li.quantity, 0), 1)::numeric AS required_qty,
          li.part_number
        FROM part_quotes pq
        LEFT JOIN line_items li ON li.id = pq.line_item_id
        WHERE pq.company_id = ${args.companyId}
          AND pq.id = ANY(${sql.array(quoteIds)})
      `;
      const items = quoteRows.map((row: any) => {
        const rec = recs.find((x) => x.quoteId === String(row.quote_id));
        return {
          name: String(row.part_name ?? "Part"),
          description: String(row.part_description ?? "").trim() || null,
          quantity: Number(rec?.selectedQty ?? row.required_qty ?? 1),
          unitCost: Number(rec?.selectedPrice ?? 0),
          estimateItemId: row.estimate_item_id ? String(row.estimate_item_id) : null,
          quoteId: String(row.quote_id),
          lineStatus: null,
        };
      });
      const poCreated = await WorkshopProcurement.createManualPo({
        companyId: args.companyId,
        poType: "po",
        vendorId,
        vendorName: recs[0]?.vendorName ?? null,
        currency: "AED",
        createdBy: args.approvedByUserId,
        notes: `AUTO-DN:${noteNo};WORKSHOP_QUOTE:${args.workshopQuoteId};BRANCH:${args.branchId ?? ""}`,
        items,
      });
      poId = poCreated.po.id;
      await WorkshopProcurement.updatePurchaseOrderHeader(args.companyId, poId, {
        status: "issued",
      });
      try {
        await sql/* sql */ `
          INSERT INTO part_quote_logs (
            company_id,
            part_quote_id,
            delivery_note_no,
            event_type,
            payload,
            created_by
          )
          SELECT
            ${args.companyId},
            x.quote_id::uuid,
            ${noteNo},
            ${"po_issued"},
            ${{
              poId,
              workshopQuoteId: args.workshopQuoteId,
            }},
            ${args.approvedByUserId}
          FROM unnest(${sql.array(quoteIds)}) AS x(quote_id)
        `;
      } catch {
        // log table is optional on older schema
      }
    } catch {
      // Keep delivery note and ordered status even if PO creation fails.
    }

    deliveryNotes.push({ noteNo, vendorId, quoteIds, poId });
  }

  return { deliveryNotes };
}
