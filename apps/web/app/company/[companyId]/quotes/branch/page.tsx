import { WorkshopQuotes } from "@repo/ai-core";
import { AppLayout } from "@repo/ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props =
  | { params: { companyId: string }; searchParams?: { status?: string } }
  | { params: Promise<{ companyId: string }>; searchParams?: { status?: string } };

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  quoted: "Quoted",
  approved: "Approved",
  accepted: "Accepted",
  completed: "Completed",
  verified: "Verified",
  cancelled: "Cancelled",
};

export default async function CompanyBranchQuotesPage({ params, searchParams }: Props) {
  const resolved = await (params as any);
  const companyId = resolved?.companyId?.toString?.();
  const status = searchParams?.status?.toString?.() || "all";

  if (!companyId) {
    return (
      <AppLayout>
        <div className="p-4 text-sm text-destructive">Company ID is required.</div>
      </AppLayout>
    );
  }

  let quotes: Awaited<ReturnType<typeof WorkshopQuotes.listQuotesForCompany>> = [];
  try {
    quotes = await WorkshopQuotes.listQuotesForCompany(companyId, {
      type: "branch_labor",
      status: status === "all" ? undefined : (status as any),
    });
  } catch (err) {
    console.error("Failed to load branch quotes", err);
    quotes = [];
  }

  const statuses = ["all", "open", "quoted", "approved", "accepted", "completed", "verified", "cancelled"];

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Branch Quotes</h1>
            <p className="text-sm text-muted-foreground">Prepare and manage branch-level quotations.</p>
          </div>
          <div className="text-xs text-muted-foreground">Company: {companyId.slice(0, 8)}...</div>
        </div>

        <div className="rounded-2xl border bg-card/80">
          <div className="flex items-center gap-3 border-b px-4 py-3">
            <div className="text-sm font-medium">Status</div>
            <div className="flex flex-wrap gap-2">
              {statuses.map((s) => (
                <a
                  key={s}
                  href={s === "all" ? "" : `?status=${s}`}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    status === s ? "border-primary text-primary" : "border-border text-muted-foreground"
                  }`}
                >
                  {STATUS_LABEL[s] ?? "All"}
                </a>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto px-2 pb-4">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-3 text-left">Quote</th>
                  <th className="px-3 py-3 text-left">Branch</th>
                  <th className="px-3 py-3 text-left">Status</th>
                  <th className="px-3 py-3 text-left">Total</th>
                  <th className="px-3 py-3 text-left">Valid until</th>
                  <th className="px-3 py-3 text-left">Updated</th>
                  <th className="px-3 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {quotes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                      No branch quotes yet.
                    </td>
                  </tr>
                ) : (
                  quotes.map((quote) => (
                    <tr key={quote.id} className="border-b last:border-0">
                      <td className="px-3 py-3">
                        <div className="font-semibold">Q-{quote.id.slice(0, 8)}</div>
                        <div className="text-xs text-muted-foreground">
                          Work order {quote.workOrderId ? quote.workOrderId.slice(0, 8) : "-"}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-sm">{quote.branchId ?? "-"}</td>
                      <td className="px-3 py-3">
                        <span className="rounded-full border px-2 py-1 text-xs capitalize">
                          {quote.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm">{quote.totalAmount.toFixed(2)}</td>
                      <td className="px-3 py-3 text-sm">{quote.validUntil ?? "-"}</td>
                      <td className="px-3 py-3 text-sm">{new Date(quote.updatedAt).toLocaleString()}</td>
                      <td className="px-3 py-3 text-right">
                        <a
                          href={`/company/${companyId}/quotes/branch/${quote.id}`}
                          className="rounded-md border px-3 py-1 text-sm hover:bg-muted"
                        >
                          View
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}



