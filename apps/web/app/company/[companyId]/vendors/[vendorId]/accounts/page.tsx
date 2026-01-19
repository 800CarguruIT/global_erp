"use client";

import { AppLayout, ModulePlaceholder } from "@repo/ui";

type Props = { params: { companyId: string; vendorId: string } };

export default function VendorAccountsPage({ params }: Props) {
  const { companyId, vendorId } = params;
  return (
    <AppLayout>
      <ModulePlaceholder
        title="Accounts"
        description="Accounts payable/receivable and SOA between company and vendor."
        hint={`Company: ${companyId} · Vendor: ${vendorId}`}
      />
    </AppLayout>
  );
}
