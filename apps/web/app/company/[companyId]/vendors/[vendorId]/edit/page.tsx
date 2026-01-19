"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@repo/ui";
import { VendorEditFormWrapper } from "../VendorEditFormWrapper";
import type { VendorFormValues } from "@/app/(components)/vendors/VendorForm";

type Props =
  | { params: { companyId: string; vendorId: string } }
  | { params: Promise<{ companyId: string; vendorId: string }> };

export default function VendorEditPage({ params }: Props) {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [vendorData, setVendorData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve(params).then((p) => {
      setCompanyId(p?.companyId ?? null);
      setVendorId(p?.vendorId ?? null);
    });
  }, [params]);

  useEffect(() => {
    async function load() {
      if (!companyId || !vendorId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/company/${companyId}/vendors/${vendorId}`);
        if (!res.ok) throw new Error("Failed to load vendor");
        const data = await res.json();
        setVendorData(data);
      } catch (err: any) {
        setError(err?.message ?? "Failed to load vendor");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [companyId, vendorId]);

  const splitPhone = (value?: string | null) => {
    if (!value) return { phoneCountryCode: "", phoneNumber: "" };
    const parts = value.trim().split(/\s+/);
    const phoneCountryCode = parts.shift() ?? "";
    const phoneNumber = parts.join(" ");
    return { phoneCountryCode, phoneNumber };
  };

  const vendor =
    (vendorData as any)?.vendor ??
    (vendorData as any)?.data ??
    (vendorData as any)?.vendor?.vendor ??
    vendorData;
  const contacts =
    (vendorData as any)?.contacts ??
    (vendorData as any)?.vendor?.contacts ??
    vendor?.contacts ??
    [];
  const bankAccounts =
    (vendorData as any)?.bankAccounts ??
    (vendorData as any)?.vendor?.bankAccounts ??
    (vendorData as any)?.vendor?.bank_accounts ??
    vendor?.bankAccounts ??
    vendor?.bank_accounts ??
    [];

  const initialValues: VendorFormValues | null = vendor
    ? {
        id: vendor.id,
        displayName: vendor.display_name ?? vendor.legal_name ?? vendor.name ?? "",
        legalName: vendor.legal_name ?? "",
        email: vendor.email ?? "",
        addressLine1: vendor.address_line1 ?? vendor.addressLine1 ?? "",
        addressLine2: vendor.address_line2 ?? vendor.addressLine2 ?? "",
        city: vendor.city ?? vendor.cityName ?? "",
        stateRegion: vendor.state_region ?? vendor.stateRegion ?? "",
        postalCode: vendor.postal_code ?? vendor.postalCode ?? "",
        country: vendor.country ?? vendor.country_code ?? vendor.countryCode ?? "",
        googleLocation: vendor.google_location ?? "",
        phoneCountryCode: splitPhone(vendor.phone).phoneCountryCode,
        phoneNumber: splitPhone(vendor.phone).phoneNumber,
        tradeLicenseNumber: vendor.trade_license_number ?? "",
        tradeLicenseIssueDate: formatDateForInput(vendor.trade_license_issue ?? vendor.tradeLicenseIssue),
        tradeLicenseExpiryDate: formatDateForInput(vendor.trade_license_expiry ?? vendor.tradeLicenseExpiry),
        tradeLicenseFileId: vendor.trade_license_file_id ?? vendor.tradeLicenseFileId ?? null,
        taxNumber: vendor.tax_number ?? vendor.taxNumber ?? null,
        taxCertificateFileId: vendor.tax_certificate_file_id ?? vendor.taxCertificateFileId ?? null,
        isActive: vendor.is_active ?? true,
        contacts:
          contacts?.map((contact: any) => {
            const contactPhone = splitPhone(contact.phone);
            return {
              id: contact.id,
              name: contact.name ?? "",
              phoneCountryCode: contactPhone.phoneCountryCode,
              phoneNumber: contactPhone.phoneNumber,
              email: contact.email ?? "",
            };
          }) ?? [],
        bankAccounts:
          bankAccounts?.map((account: any) => ({
            bankName: account.bank_name,
            branchName: account.branch_name,
            accountName: account.account_name,
            accountNumber: account.account_number,
            iban: account.iban,
            swift: account.swift,
            currency: account.currency,
            isDefault: account.is_default,
          })) ?? [],
      }
    : null;

  function formatDateForInput(value?: any) {
    if (!value) return "";
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return "";
      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
      const parts = trimmed.split(/[/-]/);
      if (parts.length === 3) {
        const [d, m, y] = parts;
        if (d && m && y) {
          const dt = new Date(`${y}-${m}-${d}`);
          if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
        }
      }
      return trimmed.slice(0, 10);
    }
    return value.toString().slice(0, 10);
  }

  return (
    <AppLayout forceScope={companyId ? { scope: "company", companyId } : undefined}>
      <div className="max-w-5xl mx-auto py-6 space-y-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Edit Vendor</h1>
          <p className="text-sm text-muted-foreground">Update vendor details.</p>
        </div>
        {!companyId || !vendorId ? (
          <div className="text-sm text-destructive">Company and vendor are required.</div>
        ) : loading ? (
          <div className="text-sm text-muted-foreground">Loading vendor...</div>
        ) : error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : initialValues ? (
          <VendorEditFormWrapper companyId={companyId} vendorId={vendorId} initialValues={initialValues} />
        ) : null}
      </div>
    </AppLayout>
  );
}
