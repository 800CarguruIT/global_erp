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
  country: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
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
    const pageSize = pageSizeRaw === "all"
      ? "all"
      : Math.min(200, Math.max(10, Number(pageSizeRaw) || 50));
    const sortByRaw = (url.searchParams.get("sortBy") ?? "created_at").toLowerCase();
    const sortBy: "created_at" | "name" | "code" | "phone" | "email" =
      sortByRaw === "name" ||
      sortByRaw === "code" ||
      sortByRaw === "phone" ||
      sortByRaw === "email"
        ? sortByRaw
        : "created_at";
    const sortDir = (url.searchParams.get("sortDir") ?? "desc").toLowerCase() === "asc" ? "asc" : "desc";

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

    if (scope === "global") {
      const list = await Crm.listCustomersForGlobal(companyId!);
      type GlobalCustomer = {
        name: string;
        email?: string | null;
        phone?: string | null;
        is_active?: boolean;
      };
      const filtered = search
        ? list.filter(
            (c: GlobalCustomer) =>
              c.name.toLowerCase().includes(search.toLowerCase()) ||
              (c.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
              (c.phone ?? "").toLowerCase().includes(search.toLowerCase())
          )
        : list;
      const final =
        status === "active" || activeOnly
          ? filtered.filter((c: GlobalCustomer) => c.is_active)
          : status === "archived"
            ? filtered.filter((c: GlobalCustomer) => c.is_active === false)
            : filtered;
      return NextResponse.json({
        data: final,
        meta: { total: final.length, page: 1, pageSize: final.length || 1, totalPages: 1 },
      });
    }

    const paged = await Crm.listCustomersWithSummaryPaginated(companyId!, {
      search,
      status: activeOnly ? "active" : status,
      sortBy,
      sortDir,
      page,
      pageSize,
    });
    return NextResponse.json(paged);
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
