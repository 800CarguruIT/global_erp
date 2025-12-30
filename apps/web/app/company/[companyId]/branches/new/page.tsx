import Link from "next/link";

import { AppLayout } from "@repo/ui";

import { BranchCreateClient } from "./BranchCreateClient";

type BranchCreatePageProps =
  | { params: { companyId: string } }
  | { params: Promise<{ companyId: string }> };

export default async function BranchCreatePage({ params }: BranchCreatePageProps) {
  const resolved = await (params as any);
  const companyId = resolved?.companyId?.toString?.().trim?.();

  if (!companyId) {
    return (
      <AppLayout>
        <div className="p-4 text-sm text-red-400">Company is required.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Create Branch</h1>
        <Link
          className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
          href={`/company/${companyId}/branches`}
        >
          Back to Branches
        </Link>
      </div>
      <div className="mt-4 rounded-xl border border-border/60 bg-card p-4">
        <BranchCreateClient companyId={companyId} />
      </div>
    </AppLayout>
  );
}
