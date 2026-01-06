import { AppLayout } from "@repo/ui";
import BranchListClient from "./BranchListClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Branch = {
  id: string;
  name: string;
  code: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  is_active: boolean;
};

type BranchListPageProps =
  | { params: { companyId: string } }
  | { params: Promise<{ companyId: string }> };

export default async function BranchListPage({ params }: BranchListPageProps) {
  const resolved = await (params as any);
  const companyId = resolved?.companyId?.toString?.().trim?.();

  if (!companyId) {
    console.error("BranchListPage: companyId param is missing");
    return (
      <AppLayout>
        <div className="p-4 text-sm text-red-400">Company is required.</div>
      </AppLayout>
    );
  }

  let branches: Branch[] = [];

  try {
    const { Branches } = await import("@repo/ai-core");
    branches = await Branches.listBranches(companyId, { activeOnly: false });
  } catch (err) {
    console.error("Failed to load branches from ai-core", err);
    branches = [];
  }

  return (
    <AppLayout>
      <BranchListClient companyId={companyId} branches={branches} />
    </AppLayout>
  );
}
