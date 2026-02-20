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

    const [usersRows, poRows, deliveredRows, returnedRows] = await Promise.all([
      sql/* sql */ `
        SELECT r.vendor_id, COUNT(DISTINCT ur.user_id)::int AS cnt
        FROM user_roles ur
        INNER JOIN roles r ON r.id = ur.role_id
        WHERE r.scope = 'vendor' AND r.vendor_id IN (SELECT id FROM vendors WHERE company_id = ${companyId})
        GROUP BY r.vendor_id
      `,
      sql/* sql */ `
        SELECT vendor_id, COUNT(*)::int AS cnt
        FROM purchase_orders
        WHERE company_id = ${companyId}
        GROUP BY vendor_id
      `,
      sql/* sql */ `
        SELECT po.vendor_id, COALESCE(SUM(poi.received_qty),0)::numeric AS qty
        FROM purchase_order_items poi
        INNER JOIN purchase_orders po ON po.id = poi.purchase_order_id
        WHERE po.company_id = ${companyId}
        GROUP BY po.vendor_id
      `,
      sql/* sql */ `
        SELECT po.vendor_id, COALESCE(SUM(poi.received_qty),0)::numeric AS qty
        FROM purchase_order_items poi
        INNER JOIN purchase_orders po ON po.id = poi.purchase_order_id
        WHERE po.company_id = ${companyId} AND poi.status = 'returned'
        GROUP BY po.vendor_id
      `,
    ]);

    const summary: Record<
      string,
      {
        users: number;
        quotes: number;
        pos: number;
        delivered: number;
        returned: number;
      }
    > = {};

    const ensure = (id: string | null | undefined) => {
      const key = id ?? "unknown";
      if (!summary[key]) {
        summary[key] = { users: 0, quotes: 0, pos: 0, delivered: 0, returned: 0 };
      }
      return key;
    };

    (usersRows as any[]).forEach((r) => {
      const key = ensure(r.vendor_id);
      summary[key].users = Number(r.cnt ?? 0);
    });
    (poRows as any[]).forEach((r) => {
      const key = ensure(r.vendor_id);
      summary[key].pos = Number(r.cnt ?? 0);
    });
    (deliveredRows as any[]).forEach((r) => {
      const key = ensure(r.vendor_id);
      summary[key].delivered = Number(r.qty ?? 0);
    });
    (returnedRows as any[]).forEach((r) => {
      const key = ensure(r.vendor_id);
      summary[key].returned = Number(r.qty ?? 0);
    });

    return NextResponse.json({ data: summary });
  } catch (err) {
    console.error("GET /api/company/[companyId]/vendors/summary error", err);
    return NextResponse.json({ data: {} }, { status: 200 });
  }
}
