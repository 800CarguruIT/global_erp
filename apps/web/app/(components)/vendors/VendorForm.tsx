"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Controller,
  useFieldArray,
  useForm,
  type Control,
  type ControllerFieldState,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { ReferenceData } from "@repo/ai-core/client";
import { AttachmentField } from "@repo/ui/components/common/AttachmentField";
import { CountrySelect } from "@repo/ui/components/common/CountrySelect";
import { CitySelect } from "@repo/ui/components/common/CitySelect";
import { StateSelect } from "@repo/ui/components/common/StateSelect";
import { PhoneInput, type PhoneValue } from "@repo/ui/components/common/PhoneInput";
import { BankAccountFields, type BankAccount } from "./BankAccountFields";
import { useTheme } from "@repo/ui";

export type BankAccountFormValues = BankAccount;

export type VendorContact = {
  id?: string;
  name: string;
  phoneCountryCode?: string;
  phoneNumber?: string;
  email?: string;
};

export type VendorFormValues = {
  id?: string;
  displayName: string;
  legalName?: string;

  country?: string;
  city?: string;
  stateRegion?: string;
  postalCode?: string;
  addressLine1?: string;
  addressLine2?: string;
  googleLocation?: string;

  phoneCountryCode?: string;
  phoneNumber?: string;
  email?: string;

  tradeLicenseNumber?: string;
  tradeLicenseIssueDate?: string | null;
  tradeLicenseExpiryDate?: string | null;
  tradeLicenseFileId?: string | null;

  taxNumber?: string | null;
  taxCertificateFileId?: string | null;

  isActive?: boolean;

  contacts: VendorContact[];
  bankAccounts: BankAccountFormValues[];
};

export type VendorSubmitPayload = {
  id?: string;
  name: string;
  displayName: string;
  legalName?: string | null;
  phone?: string | null;
  email?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateRegion?: string | null;
  postalCode?: string | null;
  country?: string | null;
  googleLocation?: string | null;
  tradeLicenseNumber?: string | null;
  tradeLicenseIssue?: string | null;
  tradeLicenseExpiry?: string | null;
  tradeLicenseFileId?: string | null;
  taxNumber?: string | null;
  taxCertificateFileId?: string | null;
  isActive?: boolean;
  contacts: Array<{
    id?: string;
    name: string;
    phone?: string | null;
    email?: string | null;
  }>;
  bankAccounts: BankAccountFormValues[];
};

type Props = {
  mode: "create" | "edit";
  companyId: string;
  initialValues?: Partial<VendorFormValues>;
  onSubmit: (payload: VendorSubmitPayload) => Promise<void>;
  redirectTo?: string;
  onDelete?: () => Promise<void>;
};

type FieldContextValue = { error?: string };
const FieldContext = createContext<FieldContextValue>({});

function FormField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
>({
  control,
  name,
  render,
  rules,
}: {
  control: Control<TFieldValues>;
  name: TName;
  rules?: any;
  render: (props: {
    field: ControllerRenderProps<TFieldValues, TName>;
    fieldState: ControllerFieldState;
  }) => React.ReactElement;
}) {
  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={(ctx) => (
        <FieldContext.Provider value={{ error: ctx.fieldState.error?.message }}>
          {render(ctx)}
        </FieldContext.Provider>
      )}
    />
  );
}

function FormItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}

function FormLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-sm font-medium text-foreground">{children}</div>;
}

function FormControl({ children }: { children: React.ReactNode }) {
  return <div className="mt-1">{children}</div>;
}

function FormMessage() {
  const { error } = useContext(FieldContext);
  if (!error) return null;
  return <p className="text-xs text-red-400">{error}</p>;
}

function Checkbox({
  checked,
  onCheckedChange,
}: {
  checked?: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      className="h-4 w-4 accent-blue-500"
      checked={!!checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
    />
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { theme } = useTheme();
  const base = theme.input;
  const extra = props.className ?? "";
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { className, ...rest } = props;
  return <input className={`${base} ${extra}`.trim()} {...rest} />;
}

function combinePhone(code?: string, number?: string) {
  const c = (code ?? "").trim();
  const n = (number ?? "").trim();
  if (!c && !n) return null;
  return [c, n].filter(Boolean).join(" ").trim();
}

function splitPhone(value?: string | null) {
  if (!value) return { phoneCountryCode: "", phoneNumber: "" };
  const parts = value.trim().split(/\s+/);
  const phoneCountryCode = parts.shift() ?? "";
  const phoneNumber = parts.join(" ");
  return { phoneCountryCode, phoneNumber };
}

function optionalString(value?: string | null) {
  if (value === undefined || value === null) return null;
  const trimmed = value.toString().trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDate(value?: string | null) {
  const str = optionalString(value);
  if (!str) return null;

  // ISO-ish string already
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);

  // dd/mm/yyyy (or dd-mm-yyyy)
  const parts = str.split(/[/-]/);
  if (parts.length === 3) {
    const [d, m, y] = parts;
    if (d && m && y) {
      const parsed = new Date(`${y}-${m}-${d}`);
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    }
  }

  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

export function VendorForm({
  mode,
  companyId,
  initialValues,
  onSubmit,
  redirectTo,
  onDelete,
}: Props) {
  const { theme } = useTheme();
  const inputClass = theme.input;
  const cardClass = `${theme.cardBg} ${theme.cardBorder}`;
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const defaults: VendorFormValues = useMemo(() => {
    const phoneParts = splitPhone((initialValues as any)?.phone);
    return {
      id: initialValues?.id,
      displayName: initialValues?.displayName ?? "",
      legalName: initialValues?.legalName ?? "",
      country: initialValues?.country ?? "",
      city: initialValues?.city ?? "",
      stateRegion: initialValues?.stateRegion ?? "",
      postalCode: initialValues?.postalCode ?? "",
      addressLine1: initialValues?.addressLine1 ?? "",
      addressLine2: initialValues?.addressLine2 ?? "",
      googleLocation: initialValues?.googleLocation ?? "",
      phoneCountryCode: initialValues?.phoneCountryCode ?? phoneParts.phoneCountryCode,
      phoneNumber: initialValues?.phoneNumber ?? phoneParts.phoneNumber,
      email: initialValues?.email ?? "",
      tradeLicenseNumber: initialValues?.tradeLicenseNumber ?? "",
      tradeLicenseIssueDate:
        initialValues?.tradeLicenseIssueDate ??
        (initialValues as any)?.tradeLicenseIssue ??
        "",
      tradeLicenseExpiryDate:
        initialValues?.tradeLicenseExpiryDate ??
        (initialValues as any)?.tradeLicenseExpiry ??
        "",
      tradeLicenseFileId: initialValues?.tradeLicenseFileId ?? "",
      taxNumber: initialValues?.taxNumber ?? "",
      taxCertificateFileId: initialValues?.taxCertificateFileId ?? "",
      isActive: initialValues?.isActive ?? true,
      contacts: (initialValues?.contacts ?? []).map((c) => {
        const contactPhone = splitPhone((c as any)?.phone);
        return {
          id: c.id,
          name: c.name ?? "",
          phoneCountryCode: c.phoneCountryCode ?? contactPhone.phoneCountryCode,
          phoneNumber: c.phoneNumber ?? contactPhone.phoneNumber,
          email: c.email ?? "",
        };
      }),
      bankAccounts: initialValues?.bankAccounts ?? [],
    };
  }, [
    initialValues?.addressLine1,
    initialValues?.addressLine2,
    initialValues?.bankAccounts,
    initialValues?.city,
    initialValues?.contacts,
    initialValues?.country,
    initialValues?.displayName,
    initialValues?.email,
    initialValues?.id,
    initialValues?.isActive,
    initialValues?.legalName,
    initialValues?.phoneCountryCode,
    initialValues?.phoneNumber,
    initialValues?.postalCode,
    initialValues?.stateRegion,
    initialValues?.taxCertificateFileId,
    initialValues?.taxNumber,
    initialValues?.tradeLicenseExpiryDate,
    initialValues?.tradeLicenseFileId,
    initialValues?.tradeLicenseIssueDate,
    initialValues?.tradeLicenseNumber,
  ]);

  const form = useForm<VendorFormValues>({
    defaultValues: defaults,
  });

  useEffect(() => {
    form.reset(defaults);
  }, [defaults, form]);

  const countries = useMemo(() => ReferenceData.ReferenceCountries.allCountries, []);
  const selectedCountryCode = form.watch("country");
  const phoneCountryCode = form.watch("phoneCountryCode");
  const selectedCountry = useMemo(
    () => countries.find((c) => c.iso2 === selectedCountryCode),
    [countries, selectedCountryCode]
  );

  const { fields: contactFields, append, remove } = useFieldArray({
    control: form.control,
    name: "contacts",
    keyName: "fieldId",
  });

  const maxContacts = 3;

  const submitHandler = form.handleSubmit(async (values) => {
    console.log("VendorForm submit start", values);
    setError(null);
    const payload: VendorSubmitPayload = {
      id: values.id,
      name: values.displayName.trim(),
      displayName: values.displayName.trim(),
      legalName: optionalString(values.legalName),
      phone: combinePhone(values.phoneCountryCode, values.phoneNumber),
      email: optionalString(values.email),
      addressLine1: optionalString(values.addressLine1),
      addressLine2: optionalString(values.addressLine2),
      city: optionalString(values.city),
      stateRegion: optionalString(values.stateRegion),
      postalCode: optionalString(values.postalCode),
      country: optionalString(values.country),
      googleLocation: optionalString(values.googleLocation),
      tradeLicenseNumber: optionalString(values.tradeLicenseNumber),
      tradeLicenseIssue: normalizeDate(values.tradeLicenseIssueDate),
      tradeLicenseExpiry: normalizeDate(values.tradeLicenseExpiryDate),
      tradeLicenseFileId: optionalString(values.tradeLicenseFileId),
      taxNumber: optionalString(values.taxNumber),
      taxCertificateFileId: optionalString(values.taxCertificateFileId),
      isActive: values.isActive ?? true,
      contacts: (values.contacts ?? []).slice(0, 3).map((c) => ({
        id: c.id,
        name: c.name,
        phone: combinePhone(c.phoneCountryCode, c.phoneNumber),
        email: optionalString(c.email),
      })),
      bankAccounts: values.bankAccounts ?? [],
    };

    try {
      await onSubmit(payload);
      if (redirectTo) router.push(redirectTo);
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Failed to save vendor");
    } finally {
      console.log("VendorForm submit end");
    }
  });

  const handleDelete = async () => {
    if (!onDelete) return;
    setError(null);
    setDeleting(true);
    try {
      await onDelete();
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Failed to delete vendor");
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (!selectedCountry) return;
    if (!form.getValues("phoneCountryCode") && selectedCountry.dialCode) {
      form.setValue("phoneCountryCode", selectedCountry.dialCode);
    }
  }, [form, selectedCountry]);

  return (
    <form className="space-y-6" onSubmit={submitHandler}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="displayName"
          rules={{ required: "Name is required" }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name *</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="legalName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Legal name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="country"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Country</FormLabel>
              <FormControl>
                <CountrySelect
                  value={field.value}
                  onChange={(val) => {
                    field.onChange(val ?? "");
                    form.setValue("stateRegion", undefined as any);
                    form.setValue("city", undefined as any);
                  }}
                  label=""
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="city"
          render={({ field }) => (
            <FormItem>
              <FormLabel>City</FormLabel>
              <FormControl>
                <CitySelect
                  countryIso2={selectedCountryCode || undefined}
                  value={field.value || undefined}
                  onChange={(val) => field.onChange(val ?? "")}
                  label=""
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="stateRegion"
          render={({ field }) => (
            <FormItem>
              <FormLabel>State / Region</FormLabel>
              <FormControl>
                <StateSelect
                  countryIso2={selectedCountryCode || undefined}
                  value={field.value || undefined}
                  onChange={(val) => field.onChange(val ?? "")}
                  label=""
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="postalCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Postal code</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="addressLine1"
          render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormLabel>Address</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="addressLine2"
          render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormLabel>Address line 2 (optional)</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="googleLocation"
          render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormLabel>Google embedded location</FormLabel>
              <FormControl>
                <Input placeholder="https://maps.google.com/..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phoneNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                <PhoneInput
                  countryIso2={selectedCountryCode || undefined}
                  value={
                    {
                      dialCode: phoneCountryCode || selectedCountry?.dialCode || "",
                      nationalNumber: field.value ?? "",
                    } as PhoneValue
                  }
                  onChange={(val) => {
                    form.setValue("phoneCountryCode", val.dialCode);
                    field.onChange(val.nationalNumber);
                  }}
                  label={undefined}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 mt-6">
              <FormControl>
                <Checkbox checked={field.value ?? true} onCheckedChange={field.onChange} />
              </FormControl>
              <FormLabel>Active</FormLabel>
            </FormItem>
          )}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="tradeLicenseNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Trade license number</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="tradeLicenseFileId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Trade license attachment</FormLabel>
              <FormControl>
                <AttachmentField
                  label=""
                  value={field.value ?? ""}
                  onChange={(val) => field.onChange(val)}
                  name="tradeLicenseFile"
                  uploadUrl="/api/files/upload"
                  uploadFields={{ scope: "company", companyId }}
                  onUploadComplete={(id) => field.onChange(id)}
                  onUploadError={(msg) => setError(msg)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="tradeLicenseIssueDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Trade license issue</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="tradeLicenseExpiryDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Trade license expiry</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="taxNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>TRN number</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="taxCertificateFileId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>VAT certificate</FormLabel>
              <FormControl>
                <AttachmentField
                  label=""
                  value={field.value ?? ""}
                  onChange={(val) => field.onChange(val)}
                  name="vatCertificateFile"
                  uploadUrl="/api/files/upload"
                  uploadFields={{ scope: "company", companyId }}
                  onUploadComplete={(id) => field.onChange(id)}
                  onUploadError={(msg) => setError(msg)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <input type="hidden" {...form.register("phoneCountryCode")} />

      <section className="mt-6 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Contacts (max 3)</h3>
          <button
            type="button"
            className="text-sm text-blue-400 hover:underline disabled:opacity-40"
            disabled={contactFields.length >= maxContacts}
            onClick={() =>
              append({ name: "", phoneCountryCode: "", phoneNumber: "", email: "" })
            }
          >
            Add contact
          </button>
        </div>

        {contactFields.length === 0 && (
          <p className="text-sm text-muted-foreground">No contacts yet.</p>
        )}

        <div className="space-y-4">
          {contactFields.map((contact, index) => (
            <div
              key={(contact as any).fieldId ?? contact.id ?? index}
              className={`grid grid-cols-1 md:grid-cols-3 gap-3 rounded-lg p-3 ${cardClass}`}
            >
              <FormField
                control={form.control}
                name={`contacts.${index}.name`}
                rules={{ required: "Contact name is required" }}
                render={({ field }) => (
                  <FormItem className="md:col-span-1">
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`contacts.${index}.phoneNumber`}
                render={({ field }) => (
                  <FormItem className="md:col-span-1">
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <PhoneInput
                        countryIso2={selectedCountryCode || undefined}
                        value={
                          {
                            dialCode:
                              form.getValues(`contacts.${index}.phoneCountryCode`) ||
                              selectedCountry?.dialCode ||
                              "",
                            nationalNumber: field.value ?? "",
                          } as PhoneValue
                        }
                        onChange={(val) => {
                          form.setValue(`contacts.${index}.phoneCountryCode`, val.dialCode);
                          field.onChange(val.nationalNumber);
                        }}
                        label={undefined}
                      />
                    </FormControl>
                    <FormMessage />
                    <input
                      type="hidden"
                      {...form.register(`contacts.${index}.phoneCountryCode` as const)}
                    />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`contacts.${index}.email`}
                render={({ field }) => (
                  <FormItem className="md:col-span-1">
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="md:col-span-3 flex justify-end">
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-red-400"
                  onClick={() => remove(index)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Controller
        control={form.control}
        name="bankAccounts"
        render={({ field }) => (
          <BankAccountFields accounts={field.value ?? []} onChange={field.onChange} />
        )}
      />

      {error && <div className="text-sm text-red-400">{error}</div>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="inline-flex items-center rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          disabled={form.formState.isSubmitting}
        >
          {mode === "edit" ? "Save changes" : "Create vendor"}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/company/${companyId}/vendors`)}
          className="text-sm text-muted-foreground hover:underline"
        >
          Cancel
        </button>
        {onDelete && (
          <button
            type="button"
            disabled={deleting || form.formState.isSubmitting}
            onClick={async () => {
              if (!confirm("Delete this vendor?")) return;
              await handleDelete();
            }}
            className="inline-flex items-center rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        )}
      </div>
    </form>
  );
}
