import { AppLayout } from "@repo/ui";

export default async function BranchQuotesPage({
  params,
}: {
  params: { companyId: string; branchId: string } | Promise<{ companyId: string; branchId: string }>;
}) {
  await params;
  return (
    <AppLayout>
      <div className="p-4 text-sm text-muted-foreground">
        Branch quotes have been removed from the system.
      </div>
    </AppLayout>
  );
}
