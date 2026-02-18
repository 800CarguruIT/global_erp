import Link from "next/link";
import { AppLayout } from "@repo/ui";
import { getSql } from "@repo/ai-core/db";

type Props =
  | { params: { companyId: string } }
  | { params: Promise<{ companyId: string }> };

type GrnRow = {
  id: string;
  grn_number: string;
  quantity: number;
  created_at: string;
  note: string | null;
  part_name: string | null;
  part_sku: string | null;
  po_id: string | null;
  po_number: string | null;
};

export default async function ProcurementGrnListPage({ params }: Props) {
  const resolved = await (params as Promise<{ companyId: string }>);
  const companyId = resolved?.companyId?.toString?.();

  if (!companyId) {
    return (
      <AppLayout>
        <div className="p-4 text-sm text-destructive">Company ID is required.</div>
      </AppLayout>
    );
  }

  const sql = getSql();
  const hasPoIdColumnRows = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'inventory_movements'
        AND column_name = 'purchase_order_id'
    ) AS exists
  `;
  const hasPoIdColumn = Boolean(hasPoIdColumnRows[0]?.exists);

  const rows = hasPoIdColumn
    ? await sql<GrnRow[]>`
      SELECT
        im.id,
        im.grn_number,
        im.quantity,
        im.created_at,
        im.note,
        pc.description AS part_name,
        pc.sku AS part_sku,
        po.id AS po_id,
        po.po_number
      FROM inventory_movements im
      LEFT JOIN parts_catalog pc ON pc.id = im.part_id
      LEFT JOIN purchase_orders po ON po.id = im.purchase_order_id
      WHERE im.company_id = ${companyId}
        AND im.direction = 'in'
        AND im.source_type = 'receipt'
        AND im.grn_number IS NOT NULL
      ORDER BY im.created_at DESC
      LIMIT 500
    `
    : await sql<GrnRow[]>`
      SELECT
        im.id,
        im.grn_number,
        im.quantity,
        im.created_at,
        im.note,
        pc.description AS part_name,
        pc.sku AS part_sku,
        po.id AS po_id,
        po.po_number
      FROM inventory_movements im
      LEFT JOIN parts_catalog pc ON pc.id = im.part_id
      LEFT JOIN LATERAL (
        SELECT poi.purchase_order_id
        FROM purchase_order_items poi
        WHERE poi.estimate_item_id = im.source_id
           OR poi.inventory_request_item_id = im.source_id
        ORDER BY poi.updated_at DESC
        LIMIT 1
      ) poi_link ON TRUE
      LEFT JOIN purchase_orders po ON po.id = poi_link.purchase_order_id
      WHERE im.company_id = ${companyId}
        AND im.direction = 'in'
        AND im.source_type = 'receipt'
        AND im.grn_number IS NOT NULL
      ORDER BY im.created_at DESC
      LIMIT 500
    `;

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-4 p-4">
        <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Procurement</div>
          <h1 className="text-lg font-semibold text-slate-100">All GRN</h1>
          <p className="text-xs text-slate-300">Latest goods receipt notes for this company.</p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-950/60">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-slate-900/70 text-[11px] uppercase tracking-wide text-slate-300">
                <th className="py-2 pl-3 pr-4 text-left">GRN Number</th>
                <th className="px-4 py-2 text-left">Part</th>
                <th className="px-4 py-2 text-left">Qty</th>
                <th className="px-4 py-2 text-left">PO</th>
                <th className="px-4 py-2 text-left">Received At</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-3 text-center text-xs text-slate-400">
                    No GRN entries found.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-t border-white/5">
                    <td className="py-2 pl-3 pr-4 font-semibold text-emerald-300">{row.grn_number}</td>
                    <td className="px-4 py-2 text-slate-100">
                      {row.part_name || "-"}
                    </td>
                    <td className="px-4 py-2 text-slate-100">{Number(row.quantity ?? 0)}</td>
                    <td className="px-4 py-2 text-slate-200">{row.po_number || "-"}</td>
                    <td className="px-4 py-2 text-slate-300">
                      {row.created_at ? new Date(row.created_at).toLocaleString() : "-"}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        {row.po_id ? (
                          <>
                            <Link
                              href={`/company/${companyId}/workshop/procurement/${row.po_id}`}
                              className="rounded border border-white/15 px-2 py-0.5 text-[11px] text-slate-200 hover:bg-white/10"
                            >
                              Open PO
                            </Link>
                            <a
                              href={`/api/company/${companyId}/workshop/procurement/${row.po_id}/grn/pdf`}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded border border-indigo-400/40 px-2 py-0.5 text-[11px] text-indigo-200 hover:bg-indigo-500/10"
                            >
                              PDF
                            </a>
                          </>
                        ) : (
                          <span className="text-[11px] text-slate-500">No PO link</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
