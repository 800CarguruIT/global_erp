"use client";

import React, { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ReferenceData } from "@repo/ai-core/client";
import { CountrySelect } from "@repo/ui/components/common/CountrySelect";
import { CitySelect } from "@repo/ui/components/common/CitySelect";
import { StateSelect } from "@repo/ui/components/common/StateSelect";
import { PhoneInput, type PhoneValue } from "@repo/ui/components/common/PhoneInput";
import { AttachmentField } from "@repo/ui/components/common/AttachmentField";
import { BankAccountFields } from "@/app/(components)/vendors/BankAccountFields";
import { useTheme } from "@repo/ui";

export type BranchFormValues = {
  name: string;
  display_name?: string | null;
  legal_name?: string | null;
  ownership_type?: "own" | "third_party" | null;
  branch_types?: string[];
  service_types?: string[];
  phone_code?: string | null;
  phone?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state_region?: string | null;
  postal_code?: string | null;
  country?: string | null;
  google_location?: string | null;
  trade_license_number?: string | null;
  trade_license_issue?: string | null;
  trade_license_expiry?: string | null;
  trade_license_file_id?: string | null;
  allow_branch_invoicing?: boolean;
  vat_certificate_file_id?: string | null;
  trn_number?: string | null;
  contacts?: Array<{
    name: string;
    phone_code?: string | null;
    phone_number?: string | null;
    email?: string | null;
  }>;
  bankAccounts?: any[];
  is_active?: boolean;
};

type BranchFormProps = {
  companyId: string;
  initialValues?: BranchFormValues;
  onSubmit: (values: BranchFormValues) => Promise<void>;
  onDelete?: () => Promise<void>;
};

export function BranchForm({
  companyId,
  initialValues,
  onSubmit,
  onDelete,
}: BranchFormProps) {
  const { theme } = useTheme();
  const inputClass = theme.input;
  const labelClass = "block text-sm font-medium";
  const cardClass = `${theme.cardBg} ${theme.cardBorder}`;
  const router = useRouter();
  const countries = useMemo(() => ReferenceData.ReferenceCountries.allCountries, []);
  const buildValues = (incoming?: BranchFormValues): BranchFormValues => {
    const base: BranchFormValues = {
      name: "",
      display_name: "",
      legal_name: "",
      ownership_type: "own",
      branch_types: [],
      service_types: [],
      phone_code: "",
      phone: "",
      phoneNumber: "",
      email: "",
      address_line1: "",
      address_line2: "",
      city: "",
      state_region: "",
      postal_code: "",
      country: "",
      google_location: "",
      trade_license_number: "",
      trade_license_issue: "",
      trade_license_expiry: "",
      trade_license_file_id: "",
      allow_branch_invoicing: false,
      vat_certificate_file_id: "",
      trn_number: "",
      contacts: [],
      bankAccounts: [],
      is_active: true,
      ...(incoming ?? {}),
    };

    const serviceMap: string[] = [];
    const allOptions = [
      { id: "RSA_Jumpstart", label: "Jumpstart" },
      { id: "RSA_Battery", label: "Battery" },
      { id: "RSA_Tyre", label: "Tyre" },
      { id: "RSA_Fuel", label: "Fuel" },
      { id: "RSA_Repair", label: "Repair" },
      { id: "Recovery_Regular", label: "Regular" },
      { id: "Recovery_Flatbed", label: "Flatbed" },
      { id: "Recovery_Covered", label: "Covered" },
      { id: "Workshop_Repair", label: "Repair" },
      { id: "Workshop_Tyre", label: "Tyre" },
      { id: "Workshop_BodyShop", label: "BodyShop" },
      { id: "Workshop_Service", label: "Service" },
    ];
    const incomingSet = new Set(base.service_types ?? []);
    allOptions.forEach((opt) => {
      if (incomingSet.has(opt.id) || incomingSet.has(opt.label)) {
        serviceMap.push(opt.id);
      }
    });
    base.service_types = serviceMap;
    return base;
  };

  const [values, setValues] = React.useState<BranchFormValues>(() => buildValues(initialValues));
  useEffect(() => {
    setValues(buildValues(initialValues));
  }, [initialValues]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const selectedCountry = useMemo(
    () => countries.find((c) => c.iso2 === (values.country ?? "")),
    [countries, values.country]
  );

  function splitPhone(value?: string | null): PhoneValue {
    if (!value) return { dialCode: "", nationalNumber: "" };
    const parts = value.trim().split(/\s+/);
    const dialCode = parts.shift() ?? "";
    return { dialCode, nationalNumber: parts.join(" ") };
  }

  function combinePhone(val: PhoneValue) {
    const dial = val.dialCode?.trim() ?? "";
    const num = val.nationalNumber?.trim() ?? "";
    if (!dial && !num) return "";
    return [dial, num].filter(Boolean).join(" ");
  }

  useEffect(() => {
    if (!selectedCountry?.dialCode) return;
    const current = splitPhone(values.phone);
    if (!current.dialCode) {
      setValues((prev) => ({
        ...prev,
        phone: combinePhone({ dialCode: selectedCountry.dialCode, nationalNumber: current.nationalNumber }),
        phone_code: selectedCountry.dialCode,
      }));
    }
  }, [selectedCountry?.dialCode]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    if (name === "display_name") {
      setValues((prev) => ({ ...prev, display_name: value, name: value }));
      return;
    }
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload: BranchFormValues = {
        ...values,
        name: values.name || values.display_name || "",
        phone: values.phone || combinePhone(splitPhone(values.phone)),
        phone_code: values.phone_code,
        contacts: (values.contacts ?? []).slice(0, 3),
        bankAccounts: values.bankAccounts ?? [],
      };
      await onSubmit(payload);
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Failed to save branch");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-6 rounded-xl p-6 shadow ${cardClass}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Name field intentionally removed; internal name syncs with display_name */}
        <div className="md:col-span-2">
          <label className={`${labelClass} mb-1`}>
            Display Name <span className="text-red-400">*</span>
          </label>
          <input
            name="display_name"
            required
            value={values.display_name ?? ""}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
        <div className="md:col-span-2">
          <label className={`${labelClass} mb-1`}>
            Legal Name <span className="text-red-400">*</span>
          </label>
          <input
            name="legal_name"
            required
            value={values.legal_name ?? ""}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
        <div className="space-y-2">
          <span className={labelClass}>Ownership</span>
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={values.ownership_type === "own"}
                onChange={() => setValues((prev) => ({ ...prev, ownership_type: "own" }))}
              />
              Own
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={values.ownership_type === "third_party"}
                onChange={() => setValues((prev) => ({ ...prev, ownership_type: "third_party" }))}
              />
              3rd Party
            </label>
          </div>
        </div>
        <div>
          <label className={`${labelClass} mb-1`}>Branch Types</label>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {["RSA", "Recovery", "Workshop"].map((type) => (
              <label key={type} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={values.branch_types?.includes(type) ?? false}
                  onChange={(e) =>
                    setValues((prev) => {
                      const set = new Set(prev.branch_types ?? []);
                      if (e.target.checked) set.add(type);
                      else set.delete(type);
                      return { ...prev, branch_types: Array.from(set) };
                    })
                  }
                />
                {type}
              </label>
            ))}
          </div>
        </div>
        <div className="md:col-span-2">
          <label className={`${labelClass} mb-1`}>Service Types</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            {values.branch_types?.includes("RSA") && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">RSA</div>
                {[
                  { id: "RSA_Jumpstart", label: "Jumpstart" },
                  { id: "RSA_Battery", label: "Battery" },
                  { id: "RSA_Tyre", label: "Tyre" },
                  { id: "RSA_Fuel", label: "Fuel" },
                  { id: "RSA_Repair", label: "Repair" },
                ].map((svc) => (
                  <label key={svc.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={values.service_types?.includes(svc.id) ?? false}
                      onChange={(e) =>
                        setValues((prev) => {
                          const set = new Set(prev.service_types ?? []);
                          if (e.target.checked) set.add(svc.id);
                          else set.delete(svc.id);
                          return { ...prev, service_types: Array.from(set) };
                        })
                      }
                    />
                    {svc.label}
                  </label>
                ))}
              </div>
            )}
            {values.branch_types?.includes("Recovery") && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Recovery</div>
                {[
                  { id: "Recovery_Regular", label: "Regular" },
                  { id: "Recovery_Flatbed", label: "Flatbed" },
                  { id: "Recovery_Covered", label: "Covered" },
                ].map((svc) => (
                  <label key={svc.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={values.service_types?.includes(svc.id) ?? false}
                      onChange={(e) =>
                        setValues((prev) => {
                          const set = new Set(prev.service_types ?? []);
                          if (e.target.checked) set.add(svc.id);
                          else set.delete(svc.id);
                          return { ...prev, service_types: Array.from(set) };
                        })
                      }
                    />
                    {svc.label}
                  </label>
                ))}
              </div>
            )}
            {values.branch_types?.includes("Workshop") && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Workshop</div>
                {[
                  { id: "Workshop_Repair", label: "Repair" },
                  { id: "Workshop_Tyre", label: "Tyre" },
                  { id: "Workshop_BodyShop", label: "BodyShop" },
                  { id: "Workshop_Service", label: "Service" },
                ].map((svc) => (
                  <label key={svc.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={values.service_types?.includes(svc.id) ?? false}
                      onChange={(e) =>
                        setValues((prev) => {
                          const set = new Set(prev.service_types ?? []);
                          if (e.target.checked) set.add(svc.id);
                          else set.delete(svc.id);
                          return { ...prev, service_types: Array.from(set) };
                        })
                      }
                    />
                    {svc.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        <div>
          <label className="block text-sm text-foreground mb-1">Phone</label>
          <PhoneInput
            countryIso2={values.country || undefined}
            value={splitPhone(values.phone)}
            onChange={(val) =>
              setValues((prev) => ({
                ...prev,
                phone: combinePhone(val),
                phone_code: val.dialCode,
                phoneNumber: val.nationalNumber,
              }))
            }
            label={undefined}
          />
        </div>
        <div>
          <label className="block text-sm text-foreground mb-1">Email</label>
          <input
            name="email"
            type="email"
            value={values.email ?? ""}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm text-foreground mb-1">City</label>
          <CitySelect
            countryIso2={values.country || undefined}
            value={values.city || undefined}
            onChange={(city) => setValues((prev) => ({ ...prev, city: city ?? "" }))}
            label=""
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm text-foreground mb-1">Country</label>
          <CountrySelect
            value={values.country || undefined}
            onChange={(country) =>
              setValues((prev) => ({
                ...prev,
                country: country ?? "",
                state_region: "",
                city: "",
              }))
            }
            label=""
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm text-foreground mb-1">State / Region</label>
          <StateSelect
            countryIso2={values.country || undefined}
            value={values.state_region || undefined}
            onChange={(state) => setValues((prev) => ({ ...prev, state_region: state ?? "" }))}
            label=""
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm text-foreground mb-1">Postal Code</label>
          <input
            name="postal_code"
            value={values.postal_code ?? ""}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm text-foreground mb-1">Address line 1</label>
          <input
            name="address_line1"
            value={values.address_line1 ?? ""}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm text-foreground mb-1">Address line 2</label>
          <input
            name="address_line2"
            value={values.address_line2 ?? ""}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm text-foreground mb-1">Google embedded location</label>
          <input
            name="google_location"
            placeholder="https://maps.google.com/..."
            value={values.google_location ?? ""}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-foreground mb-1">Trade license number</label>
          <input
            name="trade_license_number"
            value={values.trade_license_number ?? ""}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm text-foreground mb-1">Trade license attachment</label>
          <AttachmentField
            label=""
            value={values.trade_license_file_id ?? ""}
            onChange={(val) => setValues((prev) => ({ ...prev, trade_license_file_id: val }))}
            name="trade_license_file"
            uploadUrl="/api/files/upload"
            uploadFields={{ scope: "company", companyId }}
            onUploadComplete={(id) => setValues((prev) => ({ ...prev, trade_license_file_id: id }))}
            onUploadError={(msg) => setError(msg)}
          />
        </div>
        <div>
          <label className="block text-sm text-foreground mb-1">Trade license issue</label>
          <input
            type="date"
            name="trade_license_issue"
            value={values.trade_license_issue ?? ""}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm text-foreground mb-1">Trade license expiry</label>
          <input
            type="date"
            name="trade_license_expiry"
            value={values.trade_license_expiry ?? ""}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-foreground">Allow branch invoicing</label>
          <input
            type="checkbox"
            checked={values.allow_branch_invoicing ?? false}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, allow_branch_invoicing: e.target.checked }))
            }
          />
        </div>
        {values.allow_branch_invoicing && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-foreground mb-1">TRN number</label>
              <input
                name="trn_number"
                value={values.trn_number ?? ""}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm text-foreground mb-1">VAT certificate</label>
          <AttachmentField
            label=""
            value={values.vat_certificate_file_id ?? ""}
            onChange={(val) => setValues((prev) => ({ ...prev, vat_certificate_file_id: val }))}
            name="vat_certificate_file"
            uploadUrl="/api/files/upload"
            uploadFields={{ scope: "company", companyId }}
            onUploadComplete={(id) => setValues((prev) => ({ ...prev, vat_certificate_file_id: id }))}
            onUploadError={(msg) => setError(msg)}
          />
        </div>
          </div>
        )}
      </div>

      <section className="mt-6 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Contacts (max 3)</h3>
          <button
            type="button"
            className="text-sm text-blue-400 hover:underline disabled:opacity-40"
            disabled={(values.contacts?.length ?? 0) >= 3}
            onClick={() =>
              setValues((prev) => ({
                ...prev,
                contacts: [...(prev.contacts ?? []), { name: "", phone_code: "", phone_number: "", email: "" }],
              }))
            }
          >
            Add contact
          </button>
        </div>
        {(values.contacts?.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">No contacts yet.</p>
        )}
        <div className="space-y-4">
          {(values.contacts ?? []).map((c, idx) => (
            <div key={idx} className={`grid grid-cols-1 md:grid-cols-3 gap-3 rounded-lg p-3 ${cardClass}`}>
              <div>
                <label className="block text-sm text-foreground mb-1">Name</label>
                <input
                  className={inputClass}
                  value={c.name}
                  onChange={(e) =>
                    setValues((prev) => {
                      const next = [...(prev.contacts ?? [])];
                      next[idx] = { ...next[idx], name: e.target.value };
                      return { ...prev, contacts: next };
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-sm text-foreground mb-1">Phone</label>
                <PhoneInput
                  countryIso2={values.country || undefined}
                  value={{
                    dialCode: c.phone_code ?? values.phone_code ?? "",
                    nationalNumber: c.phone_number ?? "",
                  }}
                  onChange={(val) =>
                    setValues((prev) => {
                      const next = [...(prev.contacts ?? [])];
                      next[idx] = { ...next[idx], phone_code: val.dialCode, phone_number: val.nationalNumber };
                      return { ...prev, contacts: next };
                    })
                  }
                  label={undefined}
                />
              </div>
              <div>
                <label className="block text-sm text-foreground mb-1">Email</label>
                <input
                  className={inputClass}
                  value={c.email ?? ""}
                  onChange={(e) =>
                    setValues((prev) => {
                      const next = [...(prev.contacts ?? [])];
                      next[idx] = { ...next[idx], email: e.target.value };
                      return { ...prev, contacts: next };
                    })
                  }
                />
              </div>
              <div className="md:col-span-3 flex justify-end">
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-red-400"
                  onClick={() =>
                    setValues((prev) => ({
                      ...prev,
                      contacts: (prev.contacts ?? []).filter((_, i) => i !== idx),
                    }))
                  }
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="space-y-4">
        <h3 className="font-medium">Bank Accounts</h3>
        <BankAccountFields
          accounts={values.bankAccounts ?? []}
          onChange={(accounts) => setValues((prev) => ({ ...prev, bankAccounts: accounts }))}
        />
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={values.is_active ?? true}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, is_active: e.target.checked }))
            }
          />
          Active
        </label>
      </div>

      {error && <div className="text-sm text-red-400">{error}</div>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center rounded bg-primary px-4 py-2 text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/company/${companyId}/branches`)}
          className="inline-flex items-center rounded border border-border px-4 py-2 text-foreground hover:bg-muted"
        >
          Cancel
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={async () => {
              if (!confirm("Delete this branch?")) return;
              setLoading(true);
              setError(null);
              try {
                await onDelete();
                router.push(`/company/${companyId}/branches`);
              } catch (err: any) {
                console.error(err);
                setError(err?.message ?? "Failed to delete branch");
              } finally {
                setLoading(false);
              }
            }}
            className="inline-flex items-center rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
