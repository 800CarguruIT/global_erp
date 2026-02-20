import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const sql = getSql();
  try {
    let rows: any[] = [];
    try {
      rows = await sql/* sql */ `
        SELECT
          c.id AS company_id,
          COALESCE(wccs.inspection_fixed_amount, 0) AS inspection_fixed_amount,
          COALESCE(NULLIF(wccs.currency, ''), NULLIF(c.currency, ''), 'USD') AS currency,
          COALESCE(wccs.vat_rate, 0) AS vat_rate
        FROM companies c
        LEFT JOIN workshop_company_cost_settings wccs
          ON wccs.company_id = c.id
        WHERE c.id = ${companyId}
        LIMIT 1
      `;
    } catch {
      rows = await sql/* sql */ `
        SELECT id AS company_id, COALESCE(NULLIF(currency, ''), 'USD') AS currency
        FROM companies
        WHERE id = ${companyId}
        LIMIT 1
      `;
    }
    if (!rows.length) {
      return NextResponse.json({
        data: {
          companyId,
          inspectionFixedAmount: 0,
          currency: "USD",
          vatRate: 0,
        },
      });
    }
    const row = rows[0] as any;
    return NextResponse.json({
      data: {
        companyId: row.company_id ?? companyId,
        inspectionFixedAmount: Number(row.inspection_fixed_amount ?? 0),
        currency: String(row.currency ?? "USD"),
        vatRate: Number(row.vat_rate ?? 0),
      },
    });
  } catch {
    return NextResponse.json({
      data: {
        companyId,
        inspectionFixedAmount: 0,
        currency: "USD",
        vatRate: 0,
      },
    });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));
  const fixedRaw = Number(body?.inspectionFixedAmount ?? body?.inspection_fixed_amount ?? 0);
  const vatRaw = Number(body?.vatRate ?? body?.vat_rate ?? 0);
  const currencyRaw = String(body?.currency ?? "USD").trim().toUpperCase();

  if (!Number.isFinite(fixedRaw) || fixedRaw < 0) {
    return NextResponse.json({ error: "inspectionFixedAmount must be a non-negative number" }, { status: 400 });
  }
  if (!Number.isFinite(vatRaw) || vatRaw < 0 || vatRaw > 100) {
    return NextResponse.json({ error: "vatRate must be between 0 and 100" }, { status: 400 });
  }
  if (!currencyRaw || currencyRaw.length < 3 || currencyRaw.length > 8) {
    return NextResponse.json({ error: "currency is invalid" }, { status: 400 });
  }

  const sql = getSql();
  try {
    await sql/* sql */ `
      INSERT INTO workshop_company_cost_settings (
        company_id, inspection_fixed_amount, currency, vat_rate
      ) VALUES (
        ${companyId}, ${fixedRaw}, ${currencyRaw}, ${vatRaw}
      )
      ON CONFLICT (company_id)
      DO UPDATE SET
        inspection_fixed_amount = EXCLUDED.inspection_fixed_amount,
        currency = EXCLUDED.currency,
        vat_rate = EXCLUDED.vat_rate,
        updated_at = now()
    `;
  } catch {
    return NextResponse.json(
      { error: "Cost settings table is unavailable. Please run latest migrations." },
      { status: 500 }
    );
  }

  const rows = await sql/* sql */ `
    SELECT
      company_id,
      inspection_fixed_amount,
      currency,
      vat_rate
    FROM workshop_company_cost_settings
    WHERE company_id = ${companyId}
    LIMIT 1
  `;
  const row = rows[0] as any;
  return NextResponse.json({
    data: {
      companyId: row.company_id,
      inspectionFixedAmount: Number(row.inspection_fixed_amount ?? 0),
      currency: String(row.currency ?? "USD"),
      vatRate: Number(row.vat_rate ?? 0),
    },
  });
}
