import { AppLayout, JobCardDetailMain } from "@repo/ui";

type Props =
  | {
      params: { companyId: string; jobCardId: string };
      searchParams?: { view?: string; branchId?: string };
    }
  | {
      params: Promise<{ companyId: string; jobCardId: string }>;
      searchParams?: Promise<{ view?: string; branchId?: string }>;
    };

export default async function JobCardDetailPage({ params, searchParams }: Props) {
  const resolved = await (params as any);
  const resolvedSearch = searchParams ? await (searchParams as any) : {};
  const companyId = resolved?.companyId?.toString?.();
  const jobCardId = resolved?.jobCardId?.toString?.();
  const isWorkshopView = String(resolvedSearch?.view ?? "").toLowerCase() === "workshop";
  const workshopBranchId =
    typeof resolvedSearch?.branchId === "string" && resolvedSearch.branchId.trim()
      ? resolvedSearch.branchId.trim()
      : null;

  if (!companyId || !jobCardId) {
    return (
      <AppLayout>
        <div className="p-4 text-sm text-destructive">Job card ID is required.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout hideSidebar={isWorkshopView}>
      <JobCardDetailMain
        companyId={companyId}
        jobCardId={jobCardId}
        workshopBranchId={workshopBranchId}
      />
    </AppLayout>
  );
}
