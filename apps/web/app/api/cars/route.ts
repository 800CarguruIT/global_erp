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
    const statusRaw = (url.searchParams.get("status") ?? "").toLowerCase();
    const status: "active" | "archived" | "all" =
      statusRaw === "active" || statusRaw === "archived" ? statusRaw : "all";
    const activeOnly = url.searchParams.get("activeOnly") === "true";
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
    const pageSizeRaw = (url.searchParams.get("pageSize") ?? "50").trim().toLowerCase();
    const pageSize = pageSizeRaw === "all" ? "all" : Math.min(200, Math.max(10, Number(pageSizeRaw) || 50));
    const sortByRaw = (url.searchParams.get("sortBy") ?? "created_at").toLowerCase();
    const sortBy: "created_at" | "plate_number" | "vin" | "make" | "model_year" | "code" =
      sortByRaw === "plate_number" ||
      sortByRaw === "vin" ||
      sortByRaw === "make" ||
      sortByRaw === "model_year" ||
      sortByRaw === "code"
        ? sortByRaw
        : "created_at";
    const sortDir = (url.searchParams.get("sortDir") ?? "desc").toLowerCase() === "asc" ? "asc" : "desc";

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

    if (scope === "global") {
      const list = await Crm.listCarsForGlobal(companyId ?? "");
      type GlobalCar = {
        code?: string | null;
        plate_number?: string | null;
        make?: string | null;
        model?: string | null;
        vin?: string | null;
        model_year?: number | null;
        is_active?: boolean;
      };
      const filtered = search
        ? list.filter(
            (c: GlobalCar) =>
              (c.code ?? "").toLowerCase().includes(search.toLowerCase()) ||
              (c.plate_number ?? "").toLowerCase().includes(search.toLowerCase()) ||
              (c.make ?? "").toLowerCase().includes(search.toLowerCase()) ||
              (c.model ?? "").toLowerCase().includes(search.toLowerCase())
          )
        : list;
      const final =
        status === "active" || activeOnly
          ? filtered.filter((c: GlobalCar) => c.is_active)
          : status === "archived"
            ? filtered.filter((c: GlobalCar) => c.is_active === false)
            : filtered;
      return NextResponse.json({
        data: final,
        meta: { total: final.length, page: 1, pageSize: final.length || 1, totalPages: 1 },
      });
    }

    const paged = await Crm.listCarsWithSummaryPaginated(companyId!, {
      search,
      status: activeOnly ? "active" : status,
      sortBy,
      sortDir,
      page,
      pageSize,
    });
    return NextResponse.json(paged);
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
