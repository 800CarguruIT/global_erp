"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BranchForm,
  BranchFormValues,
} from "@/app/(components)/branches/BranchForm";

export function BranchEditFormWrapper({
  companyId,
  branchId,
  initialValues,
}: {
  companyId: string;
  branchId: string;
  initialValues: BranchFormValues;
}) {
  const router = useRouter();
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState<string | null>(null);
  const clean = (val?: string | null) => {
    const t = val?.toString().trim();
    return t && t.length ? t : undefined;
  };
  const normalizeDate = (value?: string | null) => {
    const v = value?.trim();
    if (!v) return undefined;
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
    const parts = v.split(/[/-]/);
    if (parts.length === 3) {
      const [d, m, y] = parts;
      if (d && m && y) {
        const dt = new Date(`${y}-${m}-${d}`);
        if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
      }
    }
    return v;
  };

  const handleSubmit = async (values: BranchFormValues) => {
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
      tradeLicenseIssue: normalizeDate(values.trade_license_issue),
      tradeLicenseExpiry: normalizeDate(values.trade_license_expiry),
      tradeLicenseFileId: clean(values.trade_license_file_id),
      allowBranchInvoicing: values.allow_branch_invoicing,
      vatCertificateFileId: clean(values.vat_certificate_file_id),
      trnNumber: values.trn_number,
      isActive: values.is_active,
      contacts:
        values.contacts?.map((c) => ({
          name: c.name,
          phoneCode: c.phone_code,
          phoneNumber: c.phone_number,
          email: c.email,
        })) ?? undefined,
      bankAccounts: values.bankAccounts ?? undefined,
    };

    const res = await fetch(`/api/company/${companyId}/branches/${branchId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error("Failed to update branch", await res.text());
      throw new Error("Failed to update branch");
    }

    router.push(`/company/${companyId}/branches`);
  };

  const handleDelete = async () => {
    const res = await fetch(`/api/company/${companyId}/branches/${branchId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      console.error("Failed to delete branch", await res.text());
      throw new Error("Failed to delete branch");
    }
    router.push(`/company/${companyId}/branches`);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/company/${companyId}/profile`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        const company = data?.data?.company ?? data?.data ?? data;
        if (active) setGoogleMapsApiKey(company?.googleMapsApiKey ?? null);
      } catch {
        if (active) setGoogleMapsApiKey(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [companyId]);

  return (
    <BranchForm
      companyId={companyId}
      initialValues={initialValues}
      onSubmit={handleSubmit}
      onDelete={handleDelete}
      googleMapsApiKey={googleMapsApiKey}
    />
  );
}
