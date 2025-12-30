import { NextRequest, NextResponse } from "next/server";
import { CallCenter, Crm, Users } from "@repo/ai-core";

type ParamsCtx = { params: Promise<{ companyId: string }> };

async function getCurrentUserId(req: NextRequest): Promise<string | null> {
  return req.headers.get("x-user-id");
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req: NextRequest, ctx: ParamsCtx) {
  const { companyId } = await ctx.params;

  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim() ?? "";
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  const branchId = url.searchParams.get("branchId");

  // Manual lookup: allow without auth so agents can quickly find a record
  if (search) {
    try {
      const matches = await Crm.listCustomers(companyId, { search, activeOnly: true });
      const cars = await Crm.listCars(companyId, { search, activeOnly: true });
      const limited = matches.slice(0, 10);
      const withCars = await Promise.all(
        limited.map(async (customer) => {
          try {
            const detail = await Crm.getCustomerWithCars(customer.id);
            const firstCar = detail?.cars?.[0]?.car;
            return {
              type: "customer",
              id: customer.id,
              name: customer.name ?? "Customer",
              phone: customer.phone ?? null,
              email: customer.email ?? null,
              car: firstCar?.plate_number ?? null,
              carId: firstCar?.id ?? null,
              isActive: customer.is_active,
            };
          } catch {
            return {
              type: "customer",
              id: customer.id,
              name: customer.name ?? "Customer",
              phone: customer.phone ?? null,
              email: customer.email ?? null,
              car: null,
              carId: null,
              isActive: customer.is_active,
            };
          }
        })
      );
      const carOnly = cars
        .filter((car) => !withCars.some((c) => c.car === car.plate_number))
        .slice(0, 10)
        .map((car) => ({
          type: "car",
          id: car.id,
          name: car.make && car.model ? `${car.make} ${car.model}` : car.plate_number ?? "Car",
          phone: null,
          email: null,
          car: car.plate_number ?? null,
          carId: car.id,
          isActive: (car as any).is_active ?? true,
        }))
        .filter((car) => car.isActive !== false);

      return NextResponse.json({ data: [...withCars, ...carOnly] });
    } catch (err) {
      console.error("company call-center lookup failed", err);
      return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
    }
  }

  const userId = await getCurrentUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // basic company access check via linked employee
  try {
    const { employee } = await Users.getUserWithEmployee(userId);
    if (employee && employee.company_id !== companyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } catch (err) {
    // allow if user has no employee link; could be admin—further auth can be added here
    console.warn("Dashboard company access warning:", err);
  }

  const to = parseDate(toStr) ?? new Date();
  const from =
    parseDate(fromStr) ??
    new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000); // default last 30 days
  if (!from || !to) {
    return NextResponse.json({ error: "Invalid or missing from/to" }, { status: 400 });
  }

  try {
    const data = await CallCenter.getDashboardData({
      scope: "company",
      companyId,
      branchId: branchId || null,
      from,
      to,
    });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("GET /api/company/[companyId]/call-center/dashboard error:", error);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
