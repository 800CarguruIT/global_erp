import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core";

type Params = { params: Promise<{ companyId: string }> };

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: Params) {
  const { companyId: rawCompanyId } = await params;
  const companyId = String(rawCompanyId || "").trim();
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  try {
    const sql = getSql();

    const [customerTotals, carTotals] = await Promise.all([
      sql/* sql */ `
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE is_active IS DISTINCT FROM FALSE)::int AS active,
          COUNT(*) FILTER (WHERE is_active = FALSE)::int AS archived
        FROM customers
        WHERE company_id = ${companyId}
      `,
      sql/* sql */ `
        SELECT
          COUNT(*)::int AS total_links,
          COUNT(DISTINCT customer_id)::int AS customers_with_cars,
          COUNT(DISTINCT car_id)::int AS cars
        FROM customer_car_links
        WHERE company_id = ${companyId}
      `,
    ]);

    const totalsRow = (customerTotals as any)?.[0] ?? {};
    const carRow = (carTotals as any)?.[0] ?? {};

    const customers = Number(totalsRow.total ?? 0);
    const active = Number(totalsRow.active ?? 0);
    const archived = Number(totalsRow.archived ?? 0);
    const customersWithCars = Number(carRow.customers_with_cars ?? 0);
    const cars = Number(carRow.cars ?? 0);
    const customersWithoutCars = Math.max(customers - customersWithCars, 0);
    const avgCarsPerCustomer = customers > 0 ? Number((cars / customers).toFixed(2)) : 0;

    return NextResponse.json({
      totals: {
        customers,
        active,
        archived,
        customersWithCars,
        customersWithoutCars,
        cars,
        avgCarsPerCustomer,
      },
    });
  } catch (err) {
    console.error("GET /api/company/[companyId]/customers/summary error", err);
    return NextResponse.json({ totals: null }, { status: 200 });
  }
}
