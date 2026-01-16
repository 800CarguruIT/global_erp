import { cookies } from "next/headers";
import { AppLayout, LeadDetailMain } from "@repo/ui";

async function getBranchContext() {
  const cookieStore = await cookies();
  const lastBranchPath = cookieStore.get("last_branch_path")?.value;
  const match = lastBranchPath?.match(/^\/company\/([^/]+)\/branches\/([^/]+)/);
  return {
    companyId: match?.[1] ?? null,
    branchId: match?.[2] ?? null,
  };
}

type BranchLeadDetailPageProps = {
  params: { id?: string } | Promise<{ id?: string }>;
};

export default async function BranchLeadDetailPage({ params }: BranchLeadDetailPageProps) {
  const resolved = await (params as any);
  const leadId = resolved?.id ? String(resolved.id) : null;
  const { companyId, branchId } = await getBranchContext();

  if (!companyId || !branchId || !leadId) {
    return (
      <AppLayout>
        <div className="p-4 text-sm text-red-400">Branch context or lead id missing.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <LeadDetailMain
        companyId={companyId}
        leadId={leadId}
        showDeleteActions={false}
        useSectionCards
        showAcceptAction
        showCheckinAction
        showSaveAction={false}
        timelineMode="status"
        currentBranchId={branchId}
        timelineVariant="centered"
      />
    </AppLayout>
  );
}
