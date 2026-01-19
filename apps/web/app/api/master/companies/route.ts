import { NextRequest, NextResponse } from "next/server";
import { Company, getSql } from "@repo/ai-core";

export async function GET(req: NextRequest) {
  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "true";
  const sql = getSql();

  const companies = await sql<
    Array<{
      id: string;
      display_name: string | null;
      legal_name: string | null;
      trade_license_number: string | null;
      owner_name: string | null;
      company_email: string | null;
      company_phone: string | null;
      country: string | null;
      is_active: boolean;
    }>
  >`
    SELECT
      id,
      display_name,
      legal_name,
      trade_license_number,
      owner_name,
      company_email,
      company_phone,
      country,
      is_active
    FROM companies
    ${includeInactive ? sql`` : sql`WHERE is_active = true`}
    ORDER BY display_name NULLS LAST, legal_name NULLS LAST, created_at DESC
  `;

  const branchCounts = await sql<{ company_id: string; cnt: number }[]>`
    SELECT company_id, COUNT(*)::int AS cnt
    FROM branches
    WHERE is_active = true
    GROUP BY company_id
  `;
  const vendorCounts = await sql<{ company_id: string; cnt: number }[]>`
    SELECT company_id, COUNT(*)::int AS cnt
    FROM vendors
    WHERE is_active = true
    GROUP BY company_id
  `;
  const customerCounts = await sql<{ company_id: string; cnt: number }[]>`
    SELECT company_id, COUNT(*)::int AS cnt
    FROM customers
    WHERE is_active = true
    GROUP BY company_id
  `;
  const carCounts = await sql<{ company_id: string; cnt: number }[]>`
    SELECT company_id, COUNT(*)::int AS cnt
    FROM cars
    WHERE is_active = true
    GROUP BY company_id
  `;
  const userCounts = await sql<{ company_id: string; cnt: number }[]>`
    SELECT company_id, COUNT(*)::int AS cnt
    FROM users
    WHERE company_id IS NOT NULL
      AND is_active = true
    GROUP BY company_id
  `;
  const subscriptionTypes = await sql<{ company_id: string | null; category: string | null; ends_at: string | null }[]>`
    SELECT DISTINCT ON (company_id) company_id, category, ends_at
    FROM global_subscriptions
    ORDER BY company_id, started_at DESC NULLS LAST, created_at DESC NULLS LAST
  `;

  const toMap = (rows: any[], key: string, val: string) =>
    rows.reduce<Record<string, number>>((acc, r) => {
      if (r[key]) acc[r[key]] = r[val] ?? 0;
      return acc;
    }, {});

  const branchesMap = toMap(branchCounts, "company_id", "cnt");
  const vendorsMap = toMap(vendorCounts, "company_id", "cnt");
  const customersMap = toMap(customerCounts, "company_id", "cnt");
  const carsMap = toMap(carCounts, "company_id", "cnt");
  const usersMap = toMap(userCounts, "company_id", "cnt");
  const subscriptionMap = subscriptionTypes.reduce<Record<string, { category: string | null; ends_at: string | null }>>(
    (acc, row) => {
      if (row.company_id) acc[row.company_id] = { category: row.category ?? null, ends_at: row.ends_at ?? null };
      return acc;
    },
    {}
  );

  const data = companies.map((c) => ({
    ...c,
    subscription_type: subscriptionMap[c.id]?.category ?? null,
    subscription_ends_at: subscriptionMap[c.id]?.ends_at ?? null,
    branches_count: branchesMap[c.id] ?? 0,
    vendors_count: vendorsMap[c.id] ?? 0,
    customers_count: customersMap[c.id] ?? 0,
    cars_count: carsMap[c.id] ?? 0,
    users_count: usersMap[c.id] ?? 0,
  }));

  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!(Company as any).createCompany) {
    return new NextResponse("Not implemented", { status: 501 });
  }
  const contacts = Array.isArray(body.contacts)
    ? body.contacts.map((c: any, idx: number) => ({
        title: c.title ?? null,
        name: c.name ?? "",
        phone: c.phone ?? null,
        email: c.email ?? null,
        address: c.address ?? null,
        sort_order: idx,
      }))
    : undefined;
  const created = await (Company as any).createCompany(body, contacts);
  return NextResponse.json({ data: created }, { status: 201 });
}
