"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppLayout, Card } from "@repo/ui";
import { BranchEditFormWrapper } from "../BranchEditFormWrapper";
import type { BranchFormValues } from "@/app/(components)/branches/BranchForm";

type Props =
  | { params: { companyId: string; branchId: string } }
  | { params: Promise<{ companyId: string; branchId: string }> };

export default function EditBranchPage({ params }: Props) {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [branch, setBranch] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve(params).then((p) => {
      setCompanyId(p?.companyId ?? null);
      setBranchId(p?.branchId ?? null);
    });
  }, [params]);

  useEffect(() => {
    async function load() {
      if (!companyId || !branchId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/company/${companyId}/branches/${branchId}`);
        if (!res.ok) throw new Error("Failed to load branch");
        const data = await res.json();
        const base = data.branch ?? data;
        const contacts = (data.contacts ?? base?.contacts ?? []).map((c: any) => ({
          id: c.id,
          name: c.name ?? "",
          phone_code: c.phone_code ?? c.phoneCode ?? "",
          phone_number: c.phone_number ?? c.phoneNumber ?? "",
          email: c.email ?? "",
        }));
        const bankAccountsRaw =
          data.bankAccounts ?? data.bank_accounts ?? base?.bankAccounts ?? base?.bank_accounts ?? [];
        const bankAccounts = bankAccountsRaw.map((ba: any) => ({
          bankName: ba.bank_name ?? ba.bankName ?? "",
          branchName: ba.branch_name ?? ba.branchName ?? "",
          accountName: ba.account_name ?? ba.accountName ?? "",
          accountNumber: ba.account_number ?? ba.accountNumber ?? "",
          iban: ba.iban ?? "",
          swift: ba.swift ?? "",
          currency: ba.currency ?? "",
          isDefault: ba.is_default ?? ba.isDefault ?? false,
        }));
        const formatDateForInput = (v: any) => {
          if (!v) return null;
          if (v instanceof Date) return v.toISOString().slice(0, 10);

          if (typeof v === "string") {
            const trimmed = v.trim();
            if (!trimmed) return null;
            if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);

            // Support dd/mm/yyyy (or dd-mm-yyyy) formats
            const parts = trimmed.split(/[/-]/);
            if (parts.length === 3) {
              const [d, m, y] = parts;
              if (d?.length && m?.length && y?.length) {
                const iso = new Date(`${y}-${m}-${d}`);
                if (!Number.isNaN(iso.getTime())) return iso.toISOString().slice(0, 10);
              }
            }
            // Fallback: return as-is, but trim to 10 chars to satisfy date input expectations
            return trimmed.slice(0, 10);
          }

          return v.toString().slice(0, 10);
        };

        const tradeLicenseFileId =
          base?.trade_license_file_id ??
          base?.tradeLicenseFileId ??
          base?.trade_license_file?.id ??
          base?.tradeLicenseFile?.id ??
          null;
        const vatCertificateFileId =
          base?.vat_certificate_file_id ??
          base?.vatCertificateFileId ??
          base?.vat_certificate_file?.id ??
          base?.vatCertificateFile?.id ??
          null;

        setBranch({
          ...(base ?? {}),
          trade_license_file_id: tradeLicenseFileId,
          vat_certificate_file_id: vatCertificateFileId,
          contacts,
          bankAccounts,
          trade_license_issue: formatDateForInput(base?.trade_license_issue ?? base?.tradeLicenseIssue),
          trade_license_expiry: formatDateForInput(base?.trade_license_expiry ?? base?.tradeLicenseExpiry),
        });
      } catch (err: any) {
        setError(err?.message ?? "Failed to load branch");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [companyId, branchId]);

  const content = (
    <AppLayout forceScope={companyId ? { scope: "company", companyId } : undefined}>
      <div className="space-y-4 py-4 w-full -mx-4 px-4 lg:-mx-8 lg:px-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold">Edit Branch</h1>
            <p className="text-sm text-muted-foreground">Update branch details.</p>
          </div>
          {companyId && (
            <Link
              href={`/company/${companyId}/branches`}
              className="inline-flex items-center rounded-md border border-slate-200 bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-md transition hover:bg-slate-50 hover:shadow-lg"
            >
              Back to Branches
            </Link>
          )}
        </div>

        {!companyId || !branchId ? (
          <div className="text-sm text-destructive">Company and branch are required.</div>
        ) : loading ? (
          <div className="text-sm text-muted-foreground">Loading branch...</div>
        ) : error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : branch ? (
          <Card className="p-4 space-y-3">
            <div className="text-sm">
              <div className="font-semibold">{branch?.display_name ?? branch?.name ?? "Branch"}</div>
              <div className="text-muted-foreground text-xs">Code: {branch?.code ?? "-"}</div>
            </div>
            <BranchEditFormWrapper
              companyId={companyId}
              branchId={branchId}
              initialValues={
                {
                  name: branch.name ?? "",
                  display_name: branch.display_name ?? null,
                  legal_name: branch.legal_name ?? null,
                  ownership_type: branch.ownership_type ?? null,
                  branch_types: branch.branch_types ?? [],
                  service_types: branch.service_types ?? [],
                  phone_code: branch.phone_code ?? null,
                  phone: branch.phone ?? null,
                  email: branch.email ?? null,
                  address_line1: branch.address_line1 ?? null,
                  address_line2: branch.address_line2 ?? null,
                  city: branch.city ?? null,
                  state_region: branch.state_region ?? null,
                  postal_code: branch.postal_code ?? null,
                  country: branch.country ?? null,
                  google_location: branch.google_location ?? null,
                  trade_license_number: branch.trade_license_number ?? null,
                  trade_license_issue: branch.trade_license_issue ?? null,
                  trade_license_expiry: branch.trade_license_expiry ?? null,
                  trade_license_file_id: branch.trade_license_file_id ?? null,
                  allow_branch_invoicing: branch.allow_branch_invoicing ?? false,
                  vat_certificate_file_id: branch.vat_certificate_file_id ?? null,
                  trn_number: branch.trn_number ?? null,
                  contacts: branch.contacts ?? [],
                  bankAccounts: branch.bankAccounts ?? branch.bank_accounts ?? [],
                  is_active: branch.is_active ?? true,
                  code: branch.code ?? null,
                } as BranchFormValues
              }
            />
          </Card>
        ) : null}
      </div>
    </AppLayout>
  );

  return content;
}
