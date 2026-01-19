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

    const [carTotals, linkTotals] = await Promise.all([
      sql/* sql */ `
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE is_active IS DISTINCT FROM FALSE)::int AS active,
          COUNT(*) FILTER (WHERE is_active = FALSE)::int AS archived
        FROM cars
        WHERE company_id = ${companyId}
      `,
      sql/* sql */ `
        SELECT
          COUNT(*)::int AS total_links,
          COUNT(DISTINCT car_id)::int AS cars_with_customers,
          COUNT(DISTINCT customer_id)::int AS customers
        FROM customer_car_links
        WHERE company_id = ${companyId}
      `,
    ]);

    const totalsRow = (carTotals as any)?.[0] ?? {};
    const linkRow = (linkTotals as any)?.[0] ?? {};

    const cars = Number(totalsRow.total ?? 0);
    const active = Number(totalsRow.active ?? 0);
    const archived = Number(totalsRow.archived ?? 0);
    const carsWithCustomers = Number(linkRow.cars_with_customers ?? 0);
    const carsWithoutCustomers = Math.max(cars - carsWithCustomers, 0);
    const linkedCustomers = Number(linkRow.customers ?? 0);
    const totalLinks = Number(linkRow.total_links ?? 0);
    const avgCustomersPerCar = cars > 0 ? Number((totalLinks / cars).toFixed(2)) : 0;

    return NextResponse.json({
      totals: {
        cars,
        active,
        archived,
        carsWithCustomers,
        carsWithoutCustomers,
        linkedCustomers,
        avgCustomersPerCar,
      },
    });
  } catch (err) {
    console.error("GET /api/company/[companyId]/cars/summary error", err);
    return NextResponse.json({ totals: null }, { status: 200 });
  }
}
