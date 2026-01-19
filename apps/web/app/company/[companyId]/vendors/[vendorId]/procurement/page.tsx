"use client";

import { AppLayout, ModulePlaceholder } from "@repo/ui";

type Props = { params: { companyId: string; vendorId: string } };

export default function VendorProcurementPage({ params }: Props) {
  const { companyId, vendorId } = params;
  return (
    <AppLayout>
      <ModulePlaceholder
        title="Procurement"
        description="POs from accepted quotes and delivery tracking to invoicing."
        hint={`Company: ${companyId} · Vendor: ${vendorId}`}
      />
    </AppLayout>
  );
}
