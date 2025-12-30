import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Crm } from "@repo/ai-core";
import { buildScopeContextFromRoute, requirePermission } from "../../../../lib/auth/permissions";

const linkSchema = z.object({
  relationType: z.enum(["owner", "driver", "other"]),
  priority: z.number().int().optional(),
  isPrimary: z.boolean().optional(),
  notes: z.string().optional().nullable(),
  existingCustomerId: z.string().optional(),
  newCustomer: z
    .object({
      customerType: z.enum(["individual", "corporate"]).default("individual"),
      code: z.string().optional(),
      name: z.string().min(1),
      firstName: z.string().optional().nullable(),
      lastName: z.string().optional().nullable(),
      dateOfBirth: z.string().optional().nullable(),
      nationalId: z.string().optional().nullable(),
      passportNo: z.string().optional().nullable(),
      legalName: z.string().optional().nullable(),
      tradeLicenseNo: z.string().optional().nullable(),
      taxNumber: z.string().optional().nullable(),
      email: z.string().email().optional().nullable(),
      phone: z.string().optional().nullable(),
      phoneAlt: z.string().optional().nullable(),
      whatsappPhone: z.string().optional().nullable(),
      address: z.string().optional().nullable(),
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
    const permResp = await requirePermission(req, "fleet.cars.view", scopeCtx);
    if (permResp) return permResp;

    const data = await Crm.getCarWithCustomers(id);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(data.customers ?? []);
  } catch (error) {
    console.error("GET /api/cars/[id]/customers error:", error);
    return NextResponse.json({ error: "Failed to load customers" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, routeCtx: ParamsCtx) {
  try {
    const { id } = await routeCtx.params;
    const url = new URL(req.url);
    const companyId = url.searchParams.get("companyId") ?? undefined;
    if (!companyId) return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    const scopeCtx = buildScopeContextFromRoute({ companyId }, "company");
    const permResp = await requirePermission(req, "fleet.cars.edit", scopeCtx);
    if (permResp) return permResp;

    const json = await req.json();
    const parsed = linkSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    let customerId = parsed.data.existingCustomerId ?? null;
    if (!customerId && parsed.data.newCustomer) {
      const cust = await Crm.createCustomer({
        companyId,
        ...parsed.data.newCustomer,
      });
      customerId = cust.id;
    }
    if (!customerId) return NextResponse.json({ error: "customerId or newCustomer required" }, { status: 400 });

    const link = await Crm.linkCustomerToCar({
      companyId,
      customerId,
      carId: id,
      relationType: parsed.data.relationType,
      priority: parsed.data.priority,
      isPrimary: parsed.data.isPrimary,
      notes: parsed.data.notes ?? null,
    });
    return NextResponse.json(link, { status: 201 });
  } catch (error) {
    console.error("POST /api/cars/[id]/customers error:", error);
    return NextResponse.json({ error: "Failed to link customer" }, { status: 500 });
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
    const permResp = await requirePermission(req, "fleet.cars.edit", scopeCtx);
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
    console.error("PATCH /api/cars/[id]/customers error:", error);
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
    const permResp = await requirePermission(req, "fleet.cars.edit", scopeCtx);
    if (permResp) return permResp;

    await Crm.unlinkCustomerFromCar(linkId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/cars/[id]/customers error:", error);
    return NextResponse.json({ error: "Failed to unlink customer" }, { status: 500 });
  }
}
