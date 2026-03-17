"use client";

import { useRouter } from "next/navigation";
import {
  VendorForm,
  type VendorSubmitPayload,
} from "@/app/(components)/vendors/VendorForm";

export default function VendorFormWrapper({
  companyId,
}: {
  companyId: string;
}) {
  const router = useRouter();

  const handleSubmit = async (values: VendorSubmitPayload) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
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
      taxCertificateFileId: values.taxCertificateFileId,
      isActive: values.isActive,
      contacts: values.contacts?.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
      })),
      bankAccounts: values.bankAccounts,
    };

    try {
      const res = await fetch(`/api/company/${companyId}/vendors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        const msg = `Failed to create vendor (${res.status}): ${text || res.statusText}`;
        console.error(msg);
        throw new Error(msg);
      }

      router.push(`/company/${companyId}/vendors`);
    } catch (err: any) {
      if (err?.name === "AbortError") {
        throw new Error("Vendor creation timed out. Please try again.");
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  };

  return (
    <VendorForm
      mode="create"
      companyId={companyId}
      onSubmit={handleSubmit}
    />
  );
}
