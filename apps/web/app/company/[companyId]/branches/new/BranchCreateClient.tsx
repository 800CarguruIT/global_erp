"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  BranchForm,
  BranchFormValues,
} from "../../../../(components)/branches/BranchForm";

export function BranchCreateClient({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (values: BranchFormValues) => {
    setError(null);
    const payload = {
      name: values.name,
      displayName: values.display_name,
      legalName: values.legal_name,
      ownershipType: values.ownership_type,
      branchTypes: values.branch_types,
      serviceTypes: values.service_types,
      phoneCode: values.phone_code,
      phone: values.phone,
      email: values.email,
      addressLine1: values.address_line1,
      addressLine2: values.address_line2,
      city: values.city,
      stateRegion: values.state_region,
      postalCode: values.postal_code,
      country: values.country,
      googleLocation: values.google_location,
      tradeLicenseNumber: values.trade_license_number,
      tradeLicenseIssue: values.trade_license_issue,
      tradeLicenseExpiry: values.trade_license_expiry,
      tradeLicenseFileId: values.trade_license_file_id,
      allowBranchInvoicing: values.allow_branch_invoicing,
      vatCertificateFileId: values.vat_certificate_file_id,
      trnNumber: values.trn_number,
      isActive: values.is_active,
      contacts:
        values.contacts?.map((c) => ({
          name: c.name,
          phoneCode: c.phone_code,
          phoneNumber: c.phone_number,
          email: c.email,
        })) ?? [],
      bankAccounts: values.bankAccounts ?? [],
    };

    const res = await fetch(`/api/company/${companyId}/branches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error || "Failed to create branch.");
      return;
    }

    router.push(`/company/${companyId}/branches`);
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-500/60 bg-red-900/20 p-3 text-sm text-red-100">
          {error}
        </div>
      )}
      <BranchForm
        companyId={companyId}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
