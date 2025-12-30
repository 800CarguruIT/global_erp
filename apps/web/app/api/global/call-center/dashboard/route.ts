import { NextRequest, NextResponse } from "next/server";
import { CallCenter, Company } from "@repo/ai-core";

async function getCurrentUserId(req: NextRequest): Promise<string | null> {
  return req.headers.get("x-user-id");
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const search = url.searchParams.get("search");

  if (search) {
    const term = search.trim().toLowerCase();
    if (!term) return NextResponse.json([]);
    const companies = await Company.listCompanies({ includeInactive: true });
    const results = companies
      .filter((c) => {
        const hay = [
          c.display_name,
          c.legal_name,
          c.trade_license_number,
          c.company_phone,
          c.company_email,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(term);
      })
      .map((c) => ({
        id: c.id,
        name: c.display_name ?? c.legal_name ?? "Company",
        trade_license_number: c.trade_license_number,
        phone: c.company_phone,
        email: c.company_email,
        companyId: c.id,
      }));
    return NextResponse.json(results);
  }

  const userId = await getCurrentUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");

  const from = parseDate(fromStr);
  const to = parseDate(toStr);
  if (!from || !to) {
    return NextResponse.json({ error: "Invalid or missing from/to" }, { status: 400 });
  }

  try {
    const data = await CallCenter.getDashboardData({
      scope: "global",
      companyId: null,
      branchId: null,
      from,
      to,
    });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("GET /api/global/call-center/dashboard error:", error);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
