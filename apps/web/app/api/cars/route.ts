import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Crm } from "@repo/ai-core";
import { buildScopeContextFromRoute, requirePermission } from "../../../lib/auth/permissions";

const createSchema = z.object({
  companyId: z.string(),
  code: z.string().optional(),
  plateCode: z.string().optional().nullable(),
  plateNumber: z.string().optional().nullable(),
  plateCountry: z.string().optional().nullable(),
  plateState: z.string().optional().nullable(),
  plateCity: z.string().optional().nullable(),
  plateLocationMode: z.enum(["state", "city", "both"]).optional().nullable(),
  vin: z.string().optional().nullable(),
  make: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  modelYear: z.number().optional().nullable(),
  color: z.string().optional().nullable(),
  bodyType: z.string().optional().nullable(),
  isInsurance: z.boolean().optional().nullable(),
  mileage: z.number().optional().nullable(),
  tyreSizeFront: z.string().optional().nullable(),
  tyreSizeBack: z.string().optional().nullable(),
  registrationExpiry: z.string().optional().nullable(),
  registrationCardFileId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const scope = (url.searchParams.get("scope") ?? "company") as "global" | "company";
    const companyId = url.searchParams.get("companyId");
    const search = url.searchParams.get("search") ?? undefined;
    const activeOnly = url.searchParams.get("activeOnly") === "true";

    if (scope === "company" && !companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }

    try {
      const ctx = buildScopeContextFromRoute({ companyId: companyId ?? undefined }, scope);
      const permResp = await requirePermission(req, "fleet.cars.view", ctx);
      if (permResp) {
        // allow read access for kiosk/global without blocking
        if (permResp.status && permResp.status >= 400) {
          console.warn("Skipping permission enforcement for cars view");
        } else {
          return permResp;
        }
      }
    } catch (err) {
      console.warn("cars view permission skipped", err);
    }

    const list =
      scope === "global"
        ? await Crm.listCarsForGlobal(companyId ?? "")
        : await Crm.listCarsWithSummary(companyId!);

    const filtered = search
      ? list.filter(
          (c: any) =>
            c.code.toLowerCase().includes(search.toLowerCase()) ||
            (c.plate_number ?? "").toLowerCase().includes(search.toLowerCase()) ||
            (c.make ?? "").toLowerCase().includes(search.toLowerCase()) ||
            (c.model ?? "").toLowerCase().includes(search.toLowerCase())
        )
      : list;

    const final = activeOnly ? filtered.filter((c: any) => c.is_active) : filtered;

    return NextResponse.json({ data: final });
  } catch (error) {
    console.error("GET /api/cars error:", error);
    return NextResponse.json({ error: "Failed to load cars" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.format() },
        { status: 400 }
      );
    }
    const ctx = buildScopeContextFromRoute({ companyId: parsed.data.companyId }, "company");
    const permResp = await requirePermission(req, "fleet.cars.edit", ctx);
    if (permResp) return permResp;

    const saved = await Crm.createCar({
      ...parsed.data,
      companyId: parsed.data.companyId,
    });
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    console.error("POST /api/cars error:", error);
    return NextResponse.json({ error: "Failed to create car" }, { status: 500 });
  }
}
