import { cookies } from "next/headers";
import { AppLayout } from "@repo/ui";
import { BranchLeadsMain } from "@repo/ui/main-pages/BranchLeadsMain";

async function getBranchContext() {
  const cookieStore = await cookies();
  const lastBranchPath = cookieStore.get("last_branch_path")?.value;
  const match = lastBranchPath?.match(/^\/company\/([^/]+)\/branches\/([^/]+)/);
  return {
    companyId: match?.[1] ?? null,
    branchId: match?.[2] ?? null,
  };
}

export default async function BranchLeadsPage() {
  const { companyId, branchId } = await getBranchContext();
  return (
    <AppLayout>
      <BranchLeadsMain companyId={companyId} branchId={branchId} />
    </AppLayout>
  );
}
