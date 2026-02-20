import { AppLayout } from "@repo/ui";

export default async function CompanyEstimateQuotesPage({
  params,
}: {
  params: { companyId: string } | Promise<{ companyId: string }>;
}) {
  await params;
  return (
    <AppLayout>
      <div className="p-4 text-sm text-muted-foreground">
        Quotes have been removed from the system.
      </div>
    </AppLayout>
  );
}
