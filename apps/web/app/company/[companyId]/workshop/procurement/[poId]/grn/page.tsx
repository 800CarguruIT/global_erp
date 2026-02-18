import { AppLayout } from "@repo/ui";
import { getSql } from "@repo/ai-core/db";
import { getPurchaseOrderWithItems } from "@repo/ai-core/workshop/procurement/repository";

type Props =
  | { params: { companyId: string; poId: string } }
  | { params: Promise<{ companyId: string; poId: string }> };

export default async function ProcurementGrnPage({ params }: Props) {
  const resolved = await (params as Promise<{ companyId: string; poId: string }>);
  const companyId = resolved?.companyId?.toString?.();
  const poId = resolved?.poId?.toString?.();

  if (!companyId || !poId) {
    return (
      <AppLayout>
        <div className="p-4 text-sm text-destructive">Company ID and PO ID are required.</div>
      </AppLayout>
    );
  }

  const sql = getSql();
  const [company] = await sql<{ display_name: string | null; legal_name: string | null }[]>`
    SELECT display_name, legal_name
    FROM companies
    WHERE id = ${companyId}
    LIMIT 1
  `;
  const companyName = company?.display_name || company?.legal_name || "Company";

  const data = await getPurchaseOrderWithItems(companyId, poId);
  if (!data) {
    return (
      <AppLayout>
        <div className="p-4 text-sm text-destructive">PO not found.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl space-y-4 p-4">
        <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">GRN View</div>
              <h1 className="text-lg font-semibold text-slate-100">Goods Receipt Notes</h1>
              <p className="text-xs text-slate-300">{companyName}</p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`/api/company/${companyId}/workshop/procurement/${poId}/grn/pdf`}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-200 hover:bg-cyan-500/20"
              >
                Open PDF
              </a>
            </div>
          </div>
          <div className="mt-3 grid gap-2 text-xs text-slate-300 md:grid-cols-4">
            <div>
              <span className="text-slate-500">PO Number:</span> {data.po.poNumber}
            </div>
            <div>
              <span className="text-slate-500">Status:</span> {data.po.status}
            </div>
            <div>
              <span className="text-slate-500">Created:</span>{" "}
              {data.po.createdAt ? new Date(data.po.createdAt).toLocaleString() : "-"}
            </div>
            <div>
              <span className="text-slate-500">Total GRNs:</span> {(data.grns ?? []).length}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-950/60">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-slate-900/70 text-[11px] uppercase tracking-wide text-slate-300">
                <th className="py-2 pl-3 pr-4 text-left">GRN Number</th>
                <th className="px-4 py-2 text-left">Part</th>
                <th className="px-4 py-2 text-left">Qty</th>
                <th className="px-4 py-2 text-left">Received At</th>
              </tr>
            </thead>
            <tbody>
              {(data.grns ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-3 text-center text-xs text-slate-400">
                    No GRN entries found.
                  </td>
                </tr>
              ) : (
                (data.grns ?? []).map((grn) => (
                  <tr key={grn.id} className="border-t border-white/5">
                    <td className="py-2 pl-3 pr-4 font-semibold text-emerald-300">{grn.grnNumber}</td>
                    <td className="px-4 py-2 text-slate-100">
                      {grn.partName}
                    </td>
                    <td className="px-4 py-2 text-slate-100">{grn.quantity}</td>
                    <td className="px-4 py-2 text-slate-300">
                      {grn.createdAt ? new Date(grn.createdAt).toLocaleString() : "-"}
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
