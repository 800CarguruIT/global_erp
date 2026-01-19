"use client";

import { AppLayout, ModulePlaceholder } from "@repo/ui";

type Props = { params: { companyId: string; vendorId: string } };

export default function VendorQuotesPage({ params }: Props) {
  const { companyId, vendorId } = params;
  return (
    <AppLayout>
      <ModulePlaceholder
        title="Vendor Quotes"
        description="Manage Open, Quoted, Approved, Accepted, Completed, Verified quotes for this vendor."
        hint={`Company: ${companyId} · Vendor: ${vendorId}`}
      />
    </AppLayout>
  );
}
