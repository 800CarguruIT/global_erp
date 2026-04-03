import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClientForCompany } from "@repo/ai-core";

type Params = { params: Promise<{ companyId: string; id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const search = new URL(req.url).searchParams;
  const make = String(search.get("make") ?? "").trim();
  const model = String(search.get("model") ?? "").trim();
  const year = String(search.get("year") ?? "").trim();
  const includeBattery = search.get("includeBattery") === "1";

  if (!make) return NextResponse.json({ sizes: [], batterySizes: [] });

  try {
    const { client } = await getOpenAIClientForCompany(companyId);
    if (!client) return NextResponse.json({ sizes: [], batterySizes: [] });

    const aiModel = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
    const vehicle = [year, make, model].filter(Boolean).join(" ");

    const completion = await client.chat.completions.create({
      model: aiModel,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are an automotive parts specialist. Given a vehicle, return a JSON object with:
- "sizes": array of all factory OEM tyre sizes in standard format (e.g. "225/45R17"). Include all trims and variants. Sort by most common first.
- "batterySizes": array of all compatible battery sizes/group codes (e.g. "55D23L", "35", "24F", "DIN66", "MF75D23L"). Include JIS and BCI group sizes. Sort by most common/recommended first.
Only return valid formats.`,
        },
        { role: "user", content: `Vehicle: ${vehicle}` },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { sizes?: string[]; batterySizes?: string[] };
    const sizes = Array.isArray(parsed.sizes)
      ? parsed.sizes.filter((s) => /^\d{3}\/\d{2}R\d{2}$/.test(String(s).trim()))
      : [];
    const batterySizes = Array.isArray(parsed.batterySizes)
      ? parsed.batterySizes.map((s) => String(s).trim().toUpperCase()).filter(Boolean)
      : [];

    return NextResponse.json({ sizes, batterySizes: includeBattery ? batterySizes : [], make, model, year, source: "ai" });
  } catch (err: any) {
    console.error("[tyre-sizes] AI fetch failed:", err?.message);
    return NextResponse.json({ sizes: [], batterySizes: [] });
  }
}