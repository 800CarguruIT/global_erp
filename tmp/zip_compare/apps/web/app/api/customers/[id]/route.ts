import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Crm } from "@repo/ai-core";
import { buildScopeContextFromRoute, requirePermission } from "@/lib/auth/permissions";

const updateSchema = z.object({
  scope: z.enum(["global", "company"]).default("company"),
  companyId: z.string().optional().nullable(),
  customerType: z.enum(["individual", "corporate"]).optional(),
  code: z.string().optional(),
  name: z.string().optional(),
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
  country: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  is_active: z.boolean().optional(), // allow snake_case from callers
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

    const customer = await Crm.getCustomerWithCars(id);
    if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (scope === "company" && companyId && customer.company_id !== companyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(customer);
  } catch (error) {
    console.error("GET /api/customers/[id] error:", error);
    return NextResponse.json({ error: "Failed to load customer" }, { status: 500 });
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
    const isActive = parsed.data.isActive ?? parsed.data.is_active;
    const scopeCtx = buildScopeContextFromRoute({ companyId }, parsed.data.scope);
    const permResp = await requirePermission(req, "crm.customers.edit", scopeCtx);
    if (permResp) return permResp;

    const existing = await Crm.getCustomerWithCars(id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (parsed.data.scope === "company" && companyId && existing.company_id !== companyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated = await Crm.updateCustomerRecord(
      id,
      {
        ...parsed.data,
        isActive,
        companyId: existing.company_id,
      } as any
    );
    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/customers/[id] error:", error);
    return NextResponse.json({ error: "Failed to update customer" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, routeCtx: ParamsCtx) {
  try {
    const { id } = await routeCtx.params;
    const url = new URL(req.url);
    const scope = (url.searchParams.get("scope") ?? "company") as "global" | "company";
    const companyId = url.searchParams.get("companyId") ?? undefined;
    const scopeCtx = buildScopeContextFromRoute({ companyId }, scope);
    const permResp = await requirePermission(req, "crm.customers.edit", scopeCtx);
    if (permResp) return permResp;

    const existing = await Crm.getCustomerWithCars(id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (scope === "company" && companyId && existing.company_id !== companyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await Crm.deactivateCustomer(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/customers/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete customer" }, { status: 500 });
  }
}
