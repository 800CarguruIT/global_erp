import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Crm } from "@repo/ai-core";
import { buildScopeContextFromRoute, requirePermission } from "@/lib/auth/permissions";

const updateSchema = z.object({
  scope: z.enum(["global", "company"]).default("company"),
  companyId: z.string().optional().nullable(),
  isActive: z.boolean().optional().nullable(),
  is_active: z.boolean().optional().nullable(),
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
  vinPhotoFileId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type ParamsCtx = { params: { id: string } } | { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, routeCtx: ParamsCtx) {
  try {
    const { id } = await routeCtx.params;
    const url = new URL(req.url);
    const scope = (url.searchParams.get("scope") ?? "company") as "global" | "company";
    const companyId = url.searchParams.get("companyId") ?? undefined;
    const scopeCtx = buildScopeContextFromRoute({ companyId }, scope);
    const permResp = await requirePermission(req, "fleet.cars.view", scopeCtx);
    if (permResp) return permResp;

    const car = await Crm.getCarWithCustomers(id);
    if (!car) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (scope === "company" && companyId && car.company_id !== companyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const filteredCustomers = Array.isArray((car as any).customers)
      ? (car as any).customers.filter((c: any) => c?.link?.is_active !== false && c?.customer?.is_active !== false)
      : [];
    return NextResponse.json({ ...car, customers: filteredCustomers });
  } catch (error) {
    console.error("GET /api/cars/[id] error:", error);
    return NextResponse.json({ error: "Failed to load car" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, routeCtx: ParamsCtx) {
  try {
    const { id } = await routeCtx.params;
    const json = await req.json();
    const parsed = updateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.format() },
        { status: 400 }
      );
    }
    const companyId = parsed.data.companyId ?? undefined;
    const scopeCtx = buildScopeContextFromRoute({ companyId }, parsed.data.scope);
    const permResp = await requirePermission(req, "fleet.cars.edit", scopeCtx);
    if (permResp) return permResp;

    const existing = await Crm.getCarWithCustomers(id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (parsed.data.scope === "company" && companyId && existing.company_id !== companyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated = await Crm.updateCarRecord(id, {
      ...parsed.data,
      companyId: existing.company_id,
      isActive: parsed.data.isActive ?? parsed.data.is_active ?? undefined,
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/cars/[id] error:", error);
    return NextResponse.json({ error: "Failed to update car" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, routeCtx: ParamsCtx) {
  try {
    const { id } = await routeCtx.params;
    const url = new URL(req.url);
    const scope = (url.searchParams.get("scope") ?? "company") as "global" | "company";
    const companyId = url.searchParams.get("companyId") ?? undefined;
    const scopeCtx = buildScopeContextFromRoute({ companyId }, scope);
    const permResp = await requirePermission(req, "fleet.cars.edit", scopeCtx);
    if (permResp) return permResp;

    const existing = await Crm.getCarWithCustomers(id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (scope === "company" && companyId && existing.company_id !== companyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await Crm.deactivateCar(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/cars/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete car" }, { status: 500 });
  }
}
