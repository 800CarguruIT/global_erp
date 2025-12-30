import { AppLayout, BranchQuoteDetailMain } from "@repo/ui";

type Props =
  | { params: { companyId: string; quoteId: string } }
  | { params: Promise<{ companyId: string; quoteId: string }> };

export default async function CompanyBranchQuoteDetailPage({ params }: Props) {
  const resolved = await (params as any);
  const companyId = resolved?.companyId?.toString?.();
  const quoteId = resolved?.quoteId?.toString?.();

  if (!companyId || !quoteId) {
    return (
      <AppLayout>
        <div className="p-4 text-sm text-destructive">Company and quote ID are required.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <BranchQuoteDetailMain companyId={companyId} quoteId={quoteId} />
    </AppLayout>
  );
}
