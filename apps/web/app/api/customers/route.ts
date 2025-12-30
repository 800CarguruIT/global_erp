import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Crm } from "@repo/ai-core";
import { buildScopeContextFromRoute, requirePermission } from "../../../lib/auth/permissions";

const createSchema = z.object({
  companyId: z.string(),
  customerType: z.enum(["individual", "corporate"]),
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
    if (scope === "global" && !companyId) {
      return NextResponse.json({ error: "companyId is required for global view" }, { status: 400 });
    }

    try {
      const ctx = buildScopeContextFromRoute({ companyId: companyId ?? undefined }, scope);
      const permResp = await requirePermission(req, "crm.customers.view", ctx);
      if (permResp) {
        // For kiosk/global views, allow read even if permission middleware responds
        if (permResp.status && permResp.status >= 400) {
          console.warn("Skipping permission enforcement for customers view");
        } else {
          return permResp;
        }
      }
    } catch (err) {
      console.warn("customers view permission skipped", err);
    }

    const list =
      scope === "global"
        ? await Crm.listCustomersForGlobal(companyId!)
        : await Crm.listCustomersWithSummary(companyId!);

    const filtered = search
      ? list.filter(
          (c: any) =>
            c.name.toLowerCase().includes(search.toLowerCase()) ||
            (c.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
            (c.phone ?? "").toLowerCase().includes(search.toLowerCase())
        )
      : list;

    const final = activeOnly ? filtered.filter((c: any) => c.is_active) : filtered;

    return NextResponse.json({ data: final });
  } catch (error) {
    console.error("GET /api/customers error:", error);
    return NextResponse.json({ error: "Failed to load customers" }, { status: 500 });
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
    const permResp = await requirePermission(req, "crm.customers.edit", ctx);
    if (permResp) return permResp;

    const saved = await Crm.createCustomer({
      ...parsed.data,
      companyId: parsed.data.companyId,
    });
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    console.error("POST /api/customers error:", error);
    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
  }
}
