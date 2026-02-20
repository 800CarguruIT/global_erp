import { AppLayout } from "@repo/ui";

export default async function CompanyVendorQuotesPage({
  params,
}: {
  params: { companyId: string } | Promise<{ companyId: string }>;
}) {
  await params;
  return (
    <AppLayout>
      <div className="p-4 text-sm text-muted-foreground">
        Vendor quotes have been removed from the system.
      </div>
    </AppLayout>
  );
}
