"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  FileUploader,
  CountrySelect,
  CitySelect,
  PhoneInput,
  StateSelect,
} from "./index";
import { ReferenceData } from "@repo/ai-core/client";
import { useI18n } from "./i18n";
import { useTheme } from "./theme";

export type CompanyFormValues = {
  logoFileId?: string | null;
  displayName?: string | null;
  legalName?: string | null;

  tradeLicense: {
    number?: string | null;
    issue?: string | null;
    expiry?: string | null;
    fileId?: string | null;
  };

  taxSettings: {
    hasVatTax: boolean;
    hasCorporateTax: boolean;
    vatNumber?: string | null;
    vatCertificateFileId?: string | null;
    corporateTaxNumber?: string | null;
    corporateTaxCertificateFileId?: string | null;
  };

  ownerPassport: {
    name?: string | null;
    number?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    issue?: string | null;
    expiry?: string | null;
    fileId?: string | null;
  };

  contacts: Array<{
    title?: string | null;
    name: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
  }>;

  companyDomain?: string | null;
  companyEmail?: string | null;
  companyPhone?: string | null;
  googleLocation?: string | null;
  googleMapsApiKey?: string | null;

  address: {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    stateRegion?: string | null;
    postalCode?: string | null;
    country?: string | null;
  };

  timezone?: string | null;
  currency?: string | null;
};

export type CompanyFormProps = {
  mode: "create" | "edit";
  initialValues?: CompanyFormValues;
  onSubmit: (values: CompanyFormValues) => Promise<void> | void;
};

const MAX_CONTACTS = 3;

function parsePhone(value?: string | null) {
  if (!value) return undefined;
  const parts = value.split(" ");
  const dialCode = parts.shift() ?? "";
  return { dialCode, nationalNumber: parts.join(" ") };
}

export function CompanyForm({ mode, initialValues, onSubmit }: CompanyFormProps) {
  const normalizedInitial: CompanyFormValues =
    initialValues
      ? {
          ...initialValues,
          contacts: (initialValues.contacts ?? []).map((c) => ({
            title: c.title ?? null,
            name: c.name ?? "",
            phone: c.phone ?? null,
            email: c.email ?? null,
            address: c.address ?? null,
          })),
        }
      : {
          tradeLicense: {},
          taxSettings: { hasVatTax: false, hasCorporateTax: false },
          ownerPassport: {},
          contacts: [],
          address: {},
          googleLocation: "",
          googleMapsApiKey: "",
        };

  const [values, setValues] = useState<CompanyFormValues>(normalizedInitial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const { t } = useI18n();
  const { theme } = useTheme();
  const countries = useMemo(() => ReferenceData.ReferenceCountries.allCountries, []);
  const selectedCountry = countries.find((c) => c.iso2 === values.address.country);

  useEffect(() => {
    if (!selectedCountry) {
      return;
    }
    if (!values.currency && selectedCountry.currency) {
      update("currency", selectedCountry.currency);
    }
    if (!values.timezone && selectedCountry.timezone) {
      update("timezone", selectedCountry.timezone);
    }
    if (!values.companyPhone && selectedCountry.dialCode) {
      update("companyPhone", selectedCountry.dialCode);
    }
  }, [selectedCountry?.iso2]);

  function update<K extends keyof CompanyFormValues>(key: K, value: CompanyFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const contactRequiredMessage = "At least one contact person is required.";

  const hasContact = useMemo(() => {
    const contacts = values.contacts ?? [];
    return contacts.some(
      (contact) =>
        Boolean(contact.name?.trim()) ||
        Boolean(contact.phone?.trim()) ||
        Boolean(contact.email?.trim())
    );
  }, [values.contacts]);

  function collectValidationErrors() {
    const errors: string[] = [];
    const checkRequired = (value: string | null | undefined, label: string | undefined) => {
      if (!label) return;
      if (!(value?.toString().trim())) {
        errors.push(`${label} is required.`);
      }
    };

    checkRequired(values.displayName, t("companyForm.displayName"));
    checkRequired(values.legalName, t("companyForm.legalName"));
    checkRequired(values.companyDomain, t("companyForm.domain"));
    checkRequired(values.address.line1, t("companyForm.address"));
    checkRequired(values.address.city, t("companyForm.city"));
    checkRequired(values.address.stateRegion, t("companyForm.stateRegion"));
    checkRequired(values.address.country, t("companyForm.country"));
    checkRequired(values.companyPhone, t("companyForm.companyPhone"));
    checkRequired(values.companyEmail, t("companyForm.companyEmail"));
    checkRequired(values.tradeLicense.number, t("companyForm.tradeNumber"));
    checkRequired(values.tradeLicense.issue, t("companyForm.issueDate"));
    checkRequired(values.tradeLicense.expiry, t("companyForm.expiryDate"));
    checkRequired(values.ownerPassport.name, t("companyForm.ownerName"));
    checkRequired(values.ownerPassport.phone, t("companyForm.ownerPhone"));
    checkRequired(values.ownerPassport.email, t("companyForm.ownerEmail"));
    checkRequired(values.ownerPassport.address, t("companyForm.ownerAddress"));

    const contacts = values.contacts ?? [];
    const hasContact = contacts.some(
      (contact) =>
        Boolean(contact.name?.trim()) ||
        Boolean(contact.phone?.trim()) ||
        Boolean(contact.email?.trim())
    );
    if (!hasContact) {
      errors.push(contactRequiredMessage);
    }

    return errors;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validation = collectValidationErrors();
    if (validation.length > 0) {
      setValidationErrors(validation);
      return;
    }
    setValidationErrors([]);
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      await onSubmit(values);
      setSuccess(t("companies.save.success"));
    } catch (err: any) {
      setError(err?.message ?? t("companies.save.error"));
    } finally {
      setSaving(false);
    }
  }

  const showContactWarning = !hasContact && validationErrors.includes(contactRequiredMessage);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {validationErrors.length > 0 && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-700 space-y-1">
          {validationErrors.map((message) => (
            <div key={message}>{message}</div>
          ))}
        </div>
      )}
      <Section title={t("companyForm.section.basic")}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label={t("companyForm.displayName")}
            value={values.displayName ?? ""}
            onChange={(e) => update("displayName", e.target.value)}
            required
          />
          <Input
            label={t("companyForm.legalName")}
            value={values.legalName ?? ""}
            onChange={(e) => update("legalName", e.target.value)}
            required
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Input
            label={t("companyForm.domain")}
            value={values.companyDomain ?? ""}
            onChange={(e) => update("companyDomain", e.target.value)}
            required
          />
          <FileUploader
            label={t("companyForm.logo")}
            kind="image"
            value={values.logoFileId ?? ""}
            onChange={(v) => update("logoFileId", v)}
          />
        </div>
      </Section>

      <Section title={t("companyForm.section.location")}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CountrySelect
            required
            value={values.address.country ?? undefined}
            onChange={(country) =>
              update("address", {
                ...values.address,
                country,
                stateRegion: undefined,
                city: undefined,
              })
            }
            label={t("companyForm.country")}
            placeholder={t("companyForm.country")}
          />
          <CitySelect
            required
            countryIso2={values.address.country ?? undefined}
            value={values.address.city ?? undefined}
            onChange={(city) => update("address", { ...values.address, city })}
            label={t("companyForm.city")}
            placeholder={t("companyForm.city")}
            placeholderDisabled={t("companyForm.countryFirst")}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <StateSelect
            required
            countryIso2={values.address.country ?? undefined}
            value={values.address.stateRegion ?? undefined}
            onChange={(state?: string) =>
              update("address", { ...values.address, stateRegion: state ?? "" })
            }
            label={t("companyForm.stateRegion")}
            placeholder={t("companyForm.stateRegion")}
            placeholderDisabled={t("companyForm.countryFirst")}
          />
          <Input
            label={t("companyForm.postalCode")}
            value={values.address.postalCode ?? ""}
            onChange={(e) =>
              update("address", { ...values.address, postalCode: e.target.value })
            }
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Input
            label={t("companyForm.timezone")}
            value={values.timezone ?? ""}
            onChange={(e) => update("timezone", e.target.value)}
            placeholder={t("companyForm.timezone.placeholder")}
          />
          <Input
            label={t("companyForm.currency")}
            value={values.currency ?? ""}
            onChange={(e) => update("currency", e.target.value)}
            placeholder={t("companyForm.currency.placeholder")}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <PhoneInput
            countryIso2={values.address.country ?? undefined}
            value={parsePhone(values.companyPhone)}
            onChange={(p) => update("companyPhone", `${p.dialCode} ${p.nationalNumber}`.trim())}
            label={t("companyForm.companyPhone")}
          />
          <Input
            label={t("companyForm.companyEmail")}
            value={values.companyEmail ?? ""}
            onChange={(e) => update("companyEmail", e.target.value)}
            required
          />
        </div>
        <div className="mt-4 space-y-2">
          <Input
            label={t("companyForm.address")}
            value={values.address.line1 ?? ""}
            onChange={(e) =>
              update("address", { ...values.address, line1: e.target.value })
            }
            required
          />
          <Input
            label={t("companyForm.address2")}
            value={values.address.line2 ?? ""}
            onChange={(e) =>
              update("address", { ...values.address, line2: e.target.value })
            }
          />
          <Input
            label="Google embedded location"
            placeholder="https://maps.google.com/..."
            value={values.googleLocation ?? ""}
            onChange={(e) => update("googleLocation", e.target.value)}
          />
          <Input
            label="Google Maps API key"
            type="password"
            placeholder="AIza..."
            value={values.googleMapsApiKey ?? ""}
            onChange={(e) => update("googleMapsApiKey", e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {t("companyForm.address.hint")}
          </p>
        </div>
      </Section>

      <Section title={t("companyForm.section.trade")}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label={t("companyForm.tradeNumber")}
            value={values.tradeLicense.number ?? ""}
            onChange={(e) =>
              update("tradeLicense", { ...values.tradeLicense, number: e.target.value })
            }
            required
          />
          <FileUploader
            label={t("companyForm.tradeFile")}
            value={values.tradeLicense.fileId ?? ""}
            onChange={(v) => update("tradeLicense", { ...values.tradeLicense, fileId: v })}
            hint={t("companyForm.tradeFile.hint")}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Input
            label={t("companyForm.issueDate")}
            type="date"
            value={values.tradeLicense.issue ?? ""}
            onChange={(e) =>
              update("tradeLicense", { ...values.tradeLicense, issue: e.target.value })
            }
            required
          />
          <Input
            label={t("companyForm.expiryDate")}
            type="date"
            value={values.tradeLicense.expiry ?? ""}
            onChange={(e) =>
              update("tradeLicense", { ...values.tradeLicense, expiry: e.target.value })
            }
            required
          />
        </div>
      </Section>

      <Section title={t("companyForm.section.tax")}>
        <div className="flex flex-col md:flex-row gap-4">
          <Checkbox
            label={t("companyForm.tax.hasVat")}
            checked={values.taxSettings.hasVatTax}
            onChange={(checked) =>
              update("taxSettings", { ...values.taxSettings, hasVatTax: checked })
            }
          />
          <Checkbox
            label={t("companyForm.tax.hasCorporate")}
            checked={values.taxSettings.hasCorporateTax}
            onChange={(checked) =>
              update("taxSettings", { ...values.taxSettings, hasCorporateTax: checked })
            }
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {values.taxSettings.hasVatTax && (
            <>
              <Input
                label={t("companyForm.vatNumber")}
                value={values.taxSettings.vatNumber ?? ""}
                onChange={(e) =>
                  update("taxSettings", { ...values.taxSettings, vatNumber: e.target.value })
                }
              />
              <FileUploader
                label={t("companyForm.vatCertificate")}
                value={values.taxSettings.vatCertificateFileId ?? ""}
                onChange={(v) =>
                  update("taxSettings", {
                    ...values.taxSettings,
                    vatCertificateFileId: v,
                  })
                }
                hint={t("companyForm.vatCertificate")}
              />
            </>
          )}
          {values.taxSettings.hasCorporateTax && (
            <>
              <Input
                label={t("companyForm.corporateTaxNumber")}
                value={values.taxSettings.corporateTaxNumber ?? ""}
                onChange={(e) =>
                  update("taxSettings", {
                    ...values.taxSettings,
                    corporateTaxNumber: e.target.value,
                  })
                }
              />
              <FileUploader
                label={t("companyForm.corporateTaxCertificate")}
                value={values.taxSettings.corporateTaxCertificateFileId ?? ""}
                onChange={(v) =>
                  update("taxSettings", {
                    ...values.taxSettings,
                    corporateTaxCertificateFileId: v,
                  })
                }
                hint={t("companyForm.corporateTaxCertificate")}
              />
            </>
          )}
        </div>
      </Section>

      <Section title={t("companyForm.section.owner")}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label={t("companyForm.ownerName")}
            value={values.ownerPassport.name ?? ""}
            onChange={(e) =>
              update("ownerPassport", { ...values.ownerPassport, name: e.target.value })
            }
            required
          />
          <FileUploader
            label={t("companyForm.ownerPassportFile")}
            value={values.ownerPassport.fileId ?? ""}
            onChange={(v) => update("ownerPassport", { ...values.ownerPassport, fileId: v })}
            hint={t("companyForm.ownerPassportFile")}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <PhoneInput
            countryIso2={values.address.country ?? undefined}
            value={parsePhone(values.ownerPassport.phone)}
            onChange={(p) =>
              update("ownerPassport", {
                ...values.ownerPassport,
                phone: `${p.dialCode} ${p.nationalNumber}`.trim(),
              })
            }
            label={t("companyForm.ownerPhone")}
          />
          <Input
            label={t("companyForm.ownerEmail")}
            value={values.ownerPassport.email ?? ""}
            onChange={(e) =>
              update("ownerPassport", { ...values.ownerPassport, email: e.target.value })
            }
            required
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Input
            label={t("companyForm.ownerPassportNumber")}
            value={values.ownerPassport.number ?? ""}
            onChange={(e) =>
              update("ownerPassport", { ...values.ownerPassport, number: e.target.value })
            }
          />
          <Input
            label={t("companyForm.ownerIssue")}
            type="date"
            value={values.ownerPassport.issue ?? ""}
            onChange={(e) =>
              update("ownerPassport", { ...values.ownerPassport, issue: e.target.value })
            }
          />
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label={t("companyForm.ownerExpiry")}
            type="date"
            value={values.ownerPassport.expiry ?? ""}
            onChange={(e) =>
              update("ownerPassport", { ...values.ownerPassport, expiry: e.target.value })
            }
          />
        </div>
        <div className="mt-4">
          <Input
            label={t("companyForm.ownerAddress")}
            value={values.ownerPassport.address ?? ""}
            onChange={(e) =>
              update("ownerPassport", { ...values.ownerPassport, address: e.target.value })
            }
            required
          />
        </div>
      </Section>

      <Section title={t("companyForm.section.contacts")}>
        <div className="space-y-3">
          {showContactWarning && (
            <div className="rounded-lg border border-red-400/50 bg-red-400/10 px-3 py-2 text-sm text-red-700">
              {contactRequiredMessage}
            </div>
          )}
          {(values.contacts ?? []).slice(0, MAX_CONTACTS).map((c, idx) => (
            <div key={idx} className={`rounded-xl ${theme.cardBorder} ${theme.surfaceSubtle} p-3 space-y-3`}>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Input
                  label={t("companyForm.contactTitle")}
                  value={c.title ?? ""}
                  onChange={(e) =>
                    setValues((prev) => {
                      const next = [...(prev.contacts ?? [])];
                      const base = next[idx] ?? { name: "" };
                      next[idx] = { ...base, title: e.target.value };
                      return { ...prev, contacts: next };
                    })
                  }
                />
                <Input
                  label={t("companyForm.contactName")}
                  value={c.name}
                  onChange={(e) =>
                    setValues((prev) => {
                      const next = [...(prev.contacts ?? [])];
                      const base = next[idx] ?? { name: "" };
                      next[idx] = { ...base, name: e.target.value };
                      return { ...prev, contacts: next };
                    })
                  }
                />
                <div className="md:col-span-2">
                  <PhoneInput
                    countryIso2={values.address.country ?? undefined}
                    value={parsePhone(c.phone)}
                    onChange={(p) =>
                      setValues((prev) => {
                        const next = [...(prev.contacts ?? [])];
                        const base = next[idx] ?? { name: "" };
                        next[idx] = { ...base, phone: `${p.dialCode} ${p.nationalNumber}`.trim() };
                        return { ...prev, contacts: next };
                      })
                    }
                    label={t("companyForm.contactPhone")}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <Input
                  label={t("companyForm.contactEmail")}
                  value={c.email ?? ""}
                  onChange={(e) =>
                    setValues((prev) => {
                      const next = [...(prev.contacts ?? [])];
                      const base = next[idx] ?? { name: "" };
                      next[idx] = { ...base, email: e.target.value };
                      return { ...prev, contacts: next };
                    })
                  }
                />
              </div>
              <div className="grid grid-cols-1 gap-3">
                <Input
                  label={t("companyForm.contactAddress")}
                  value={c.address ?? ""}
                  onChange={(e) =>
                    setValues((prev) => {
                      const next = [...(prev.contacts ?? [])];
                      const base = next[idx] ?? { name: "" };
                      next[idx] = { ...base, address: e.target.value };
                      return { ...prev, contacts: next };
                    })
                  }
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-xs px-3 py-2 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-100"
                  onClick={() =>
                    setValues((prev) => ({
                      ...prev,
                      contacts: (prev.contacts ?? []).filter((_, i) => i !== idx),
                    }))
                  }
                >
                  {t("companyForm.contact.remove")}
                </button>
              </div>
            </div>
          ))}
          {(values.contacts ?? []).length < MAX_CONTACTS && (
            <div className="flex justify-end">
              <button
                type="button"
                className="text-xs px-3 py-2 rounded-md bg-white/10 hover:bg-white/20"
                onClick={() =>
                  setValues((prev) => ({
                    ...prev,
                    contacts: [...(prev.contacts ?? []), { name: "" }],
                  }))
                }
              >
                + {t("companyForm.contact.add")}
              </button>
            </div>
          )}
        </div>
      </Section>

      {error && <div className="text-red-400 text-sm">{error}</div>}
      {success && <div className="text-green-400 text-sm">{success}</div>}

      <button
        type="submit"
        disabled={saving}
        className={`px-4 py-2 rounded-xl border shadow-sm disabled:opacity-50 transition ${theme.surfaceSubtle} ${theme.cardBorder} ${theme.appText} hover:border-primary/60`}
      >
        {saving
          ? t("companies.save.saving")
          : mode === "edit"
          ? t("companies.save.update")
          : t("companies.save.create")}
      </button>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <div className={`rounded-2xl ${theme.cardBorder} ${theme.cardBg} p-4 md:p-6 space-y-4`}>
      <h3 className="text-base font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function Input(
  props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }
) {
  const { label, className, ...rest } = props;
  const { theme } = useTheme();
  return (
    <label className="text-sm space-y-1 w-full">
      <span className="text-xs uppercase opacity-70">{label}</span>
      <input
        className={`${theme.input} ${className ?? ""}`}
        {...rest}
      />
    </label>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-sky-500"
      />
      <span>{label}</span>
    </label>
  );
}
