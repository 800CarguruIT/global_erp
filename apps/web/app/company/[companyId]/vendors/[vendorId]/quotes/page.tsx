import { AppLayout } from "@repo/ui";

export default async function VendorQuotesPage({
  params,
}: {
  params: { companyId: string; vendorId: string } | Promise<{ companyId: string; vendorId: string }>;
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
