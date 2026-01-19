import Link from "next/link";
import { AppLayout } from "@repo/ui";

import VendorFormWrapper from "./VendorFormWrapper";

type VendorCreatePageProps = { params: { companyId: string } };

export default async function VendorCreatePage({ params }: VendorCreatePageProps) {
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
      <div className="max-w-5xl mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-semibold">Create Vendor</h1>
          <Link
            href={`/company/${companyId}/vendors`}
            className="text-sm text-primary hover:underline"
          >
            Back to Vendors
          </Link>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <VendorFormWrapper companyId={companyId} />
        </div>
      </div>
    </AppLayout>
  );
}
