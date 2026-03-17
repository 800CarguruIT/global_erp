"use client";

import { useRouter } from "next/navigation";
import {
  VendorForm,
  type VendorFormValues,
  type VendorSubmitPayload,
} from "@/app/(components)/vendors/VendorForm";

export function VendorEditFormWrapper({
  companyId,
  vendorId,
  initialValues,
}: {
  companyId: string;
  vendorId: string;
  initialValues: VendorFormValues;
}) {
  const router = useRouter();
  const uuidOrNull = (val?: string | null) => {
    const str = val?.toString().trim();
    if (!str) return null;
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    return uuidRegex.test(str) ? str : null;
  };

  const handleSubmit = async (values: VendorSubmitPayload) => {
    const body = {
      companyId,
      name: values.name,
      displayName: values.displayName,
      legalName: values.legalName,
      phone: values.phone,
      email: values.email,
      addressLine1: values.addressLine1,
      addressLine2: values.addressLine2,
      city: values.city,
      stateRegion: values.stateRegion,
      postalCode: values.postalCode,
      country: values.country,
      googleLocation: values.googleLocation,
      tradeLicenseNumber: values.tradeLicenseNumber,
      tradeLicenseIssue: values.tradeLicenseIssue,
      tradeLicenseExpiry: values.tradeLicenseExpiry,
      tradeLicenseFileId: values.tradeLicenseFileId,
      taxNumber: values.taxNumber,
      taxCertificateFileId: uuidOrNull(values.taxCertificateFileId),
      tradeLicenseFileId: uuidOrNull(values.tradeLicenseFileId),
      isActive: values.isActive,
      contacts: values.contacts?.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
      })),
      bankAccounts: values.bankAccounts,
    };

    const res = await fetch(`/api/company/${companyId}/vendors/${vendorId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      const msg = `Failed to update vendor (${res.status}): ${text || res.statusText}`;
      console.error(msg);
      throw new Error(msg);
    }

    router.push(`/company/${companyId}/vendors`);
  };

  const handleDelete = async () => {
    const res = await fetch(`/api/company/${companyId}/vendors/${vendorId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const text = await res.text();
      const msg = `Failed to delete vendor (${res.status}): ${text || res.statusText}`;
      console.error(msg);
      throw new Error(msg);
    }
    router.push(`/company/${companyId}/vendors`);
  };

  return (
    <VendorForm
      mode="edit"
      companyId={companyId}
      initialValues={initialValues}
      onSubmit={handleSubmit}
      onDelete={handleDelete}
    />
  );
}
