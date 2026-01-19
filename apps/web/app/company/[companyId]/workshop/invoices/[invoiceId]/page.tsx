import { AppLayout, InvoiceDetailMain } from "@repo/ui";

type Props =
  | { params: { companyId: string; invoiceId: string } }
  | { params: Promise<{ companyId: string; invoiceId: string }> };

export default async function CompanyInvoiceDetailPage({ params }: Props) {
  const resolved = await (params as any);
  const companyId = resolved?.companyId?.toString?.();
  const invoiceId = resolved?.invoiceId?.toString?.();

  if (!companyId || !invoiceId) {
    return (
      <AppLayout>
        <div className="p-4 text-sm text-destructive">Invoice ID is required.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <InvoiceDetailMain companyId={companyId} invoiceId={invoiceId} />
    </AppLayout>
  );
}
