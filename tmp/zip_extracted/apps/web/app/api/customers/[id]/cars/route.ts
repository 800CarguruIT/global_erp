import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Crm } from "@repo/ai-core";
import { buildScopeContextFromRoute, requirePermission } from "@/lib/auth/permissions";

const linkSchema = z.object({
  relationType: z.enum(["owner", "driver", "other"]),
  priority: z.number().int().optional(),
  isPrimary: z.boolean().optional(),
  notes: z.string().optional().nullable(),
  existingCarId: z.string().optional(),
  newCar: z
    .object({
      code: z.string().optional(),
      plateNumber: z.string().optional().nullable(),
      plateCode: z.string().optional().nullable(),
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
    })
    .optional(),
});

type ParamsCtx = { params: { id: string } } | { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, routeCtx: ParamsCtx) {
  try {
    const { id } = await routeCtx.params;
    const url = new URL(req.url);
    const scope = (url.searchParams.get("scope") ?? "company") as "global" | "company";
    const companyId = url.searchParams.get("companyId") ?? undefined;

    const scopeCtx = buildScopeContextFromRoute({ companyId }, scope);
    const permResp = await requirePermission(req, "crm.customers.view", scopeCtx);
    if (permResp) return permResp;

    const data = await Crm.getCustomerWithCars(id);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(data.cars ?? []);
  } catch (error) {
    console.error("GET /api/customers/[id]/cars error:", error);
    return NextResponse.json({ error: "Failed to load cars" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, routeCtx: ParamsCtx) {
  try {
    const { id } = await routeCtx.params;
    const url = new URL(req.url);
    const companyId = url.searchParams.get("companyId") ?? undefined;
    if (!companyId) return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    const scopeCtx = buildScopeContextFromRoute({ companyId }, "company");
    const permResp = await requirePermission(req, "crm.customers.edit", scopeCtx);
    if (permResp) return permResp;

    const json = await req.json();
    const parsed = linkSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    let carId = parsed.data.existingCarId ?? null;
    if (!carId && parsed.data.newCar) {
      const car = await Crm.createCar({
        companyId,
        ...parsed.data.newCar,
      });
      carId = car.id;
    }
    if (!carId) return NextResponse.json({ error: "carId or newCar required" }, { status: 400 });

    const link = await Crm.linkCustomerToCar({
      companyId,
      customerId: id,
      carId,
      relationType: parsed.data.relationType,
      priority: parsed.data.priority,
      isPrimary: parsed.data.isPrimary,
      notes: parsed.data.notes ?? null,
    });
    return NextResponse.json(link, { status: 201 });
  } catch (error) {
    console.error("POST /api/customers/[id]/cars error:", error);
    return NextResponse.json({ error: "Failed to link car" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, routeCtx: ParamsCtx) {
  try {
    await routeCtx.params;
    const url = new URL(req.url);
    const companyId = url.searchParams.get("companyId") ?? undefined;
    const linkId = url.searchParams.get("linkId");
    if (!companyId || !linkId) {
      return NextResponse.json({ error: "companyId and linkId are required" }, { status: 400 });
    }
    const scopeCtx = buildScopeContextFromRoute({ companyId }, "company");
    const permResp = await requirePermission(req, "crm.customers.edit", scopeCtx);
    if (permResp) return permResp;

    const json = await req.json();
    const parsed = linkSchema.partial().safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const updated = await Crm.updateCustomerCarLink(linkId, {
      relationType: parsed.data.relationType,
      priority: parsed.data.priority,
      isPrimary: parsed.data.isPrimary,
      notes: parsed.data.notes ?? null,
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/customers/[id]/cars error:", error);
    return NextResponse.json({ error: "Failed to update link" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, routeCtx: ParamsCtx) {
  try {
    await routeCtx.params;
    const url = new URL(req.url);
    const companyId = url.searchParams.get("companyId") ?? undefined;
    const linkId = url.searchParams.get("linkId");
    if (!companyId || !linkId) {
      return NextResponse.json({ error: "companyId and linkId are required" }, { status: 400 });
    }
    const scopeCtx = buildScopeContextFromRoute({ companyId }, "company");
    const permResp = await requirePermission(req, "crm.customers.edit", scopeCtx);
    if (permResp) return permResp;

    await Crm.unlinkCustomerFromCar(linkId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/customers/[id]/cars error:", error);
    return NextResponse.json({ error: "Failed to unlink car" }, { status: 500 });
  }
}
