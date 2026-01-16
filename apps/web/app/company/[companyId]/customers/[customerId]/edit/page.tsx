"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AppLayout, Card, useTheme } from "@repo/ui";
import { PhoneInput } from "@repo/ui/components/common/PhoneInput";
import type { PhoneValue } from "@repo/ui/components/common/PhoneInput";

type Params = {
  params:
    | { companyId: string; customerId: string }
    | Promise<{ companyId: string; customerId: string }>;
};

const EMPTY_PHONE: PhoneValue = { dialCode: "+971", nationalNumber: "" };

function parsePhone(value?: string | null): PhoneValue {
  if (!value) return { ...EMPTY_PHONE };
  const trimmed = value.trim();
  if (!trimmed) return { ...EMPTY_PHONE };
  const match = trimmed.match(/^(\+\d{1,4})(.*)$/);
  if (match) {
    return {
      dialCode: match[1],
      nationalNumber: match[2].replace(/\D/g, ""),
    };
  }
  return { dialCode: "+971", nationalNumber: trimmed.replace(/\D/g, "") };
}

export default function CustomerEditPage({ params }: Params) {
  const { theme } = useTheme();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: EMPTY_PHONE as PhoneValue,
    whatsappPhone: EMPTY_PHONE as PhoneValue,
    useDifferentWhatsapp: false,
    address: "",
    country: "",
    city: "",
  });

  useEffect(() => {
    Promise.resolve(params).then((p) => {
      setCompanyId(p?.companyId ?? null);
      setCustomerId(p?.customerId ?? null);
    });
  }, [params]);

  useEffect(() => {
    if (!companyId || !customerId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/customers/${customerId}?companyId=${companyId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to load customer"))))
      .then((data) => {
        setForm({
          name: data?.name ?? "",
          email: data?.email ?? "",
          phone: parsePhone(data?.phone),
          whatsappPhone: parsePhone(data?.whatsapp_phone ?? data?.whatsappPhone),
          useDifferentWhatsapp: Boolean(data?.whatsapp_phone && data?.whatsapp_phone !== data?.phone),
          address: data?.address ?? "",
          country: data?.country ?? "",
          city: data?.city ?? "",
        });
      })
      .catch((err: any) => setError(err?.message ?? "Failed to load customer"))
      .finally(() => setLoading(false));
  }, [companyId, customerId]);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId || !customerId) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        scope: "company" as const,
        companyId,
        name: form.name,
        email: form.email || null,
        phone: `${form.phone.dialCode}${form.phone.nationalNumber}`,
        whatsappPhone: form.useDifferentWhatsapp
          ? `${form.whatsappPhone.dialCode}${form.whatsappPhone.nationalNumber}`
          : `${form.phone.dialCode}${form.phone.nationalNumber}`,
        address: form.address || null,
        country: form.country || null,
        city: form.city || null,
      };
      const res = await fetch(`/api/customers/${customerId}?companyId=${companyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to update customer");
      }
      window.location.href = `/company/${companyId}/customers/${customerId}`;
    } catch (err: any) {
      setError(err?.message ?? "Failed to update customer");
    } finally {
      setSaving(false);
    }
  }

  const labelClass = "text-xs font-semibold text-muted-foreground";
  const inputClass = theme.input;

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Edit Customer</h1>
            <p className="text-sm text-muted-foreground">Update customer contact details.</p>
          </div>
          <Link
            href={companyId ? `/company/${companyId}/customers/${customerId ?? ""}` : "#"}
            className="text-sm text-primary hover:underline"
          >
            Back to customer
          </Link>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Card className="space-y-3">
              <div className="text-lg font-semibold">Customer</div>
              {error && <div className="text-sm text-destructive">{error}</div>}
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <div className={labelClass}>Customer Name</div>
                  <input
                    className={inputClass}
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <div className={labelClass}>Phone</div>
                  <PhoneInput
                    value={form.phone}
                    onChange={(val) => update("phone", val ?? EMPTY_PHONE)}
                    countryIso2="AE"
                  />
                </div>
                <div className="md:col-span-2">
                  <div className={labelClass}>Email</div>
                  <input
                    className={inputClass}
                    type="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <div className={labelClass}>Country</div>
                  <input
                    className={inputClass}
                    value={form.country}
                    onChange={(e) => update("country", e.target.value)}
                  />
                </div>
                <div>
                  <div className={labelClass}>City</div>
                  <input
                    className={inputClass}
                    value={form.city}
                    onChange={(e) => update("city", e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <div className={labelClass}>Address</div>
                  <input
                    className={inputClass}
                    value={form.address}
                    onChange={(e) => update("address", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    id="useDifferentWhatsapp"
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={form.useDifferentWhatsapp}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setForm((prev) => ({
                        ...prev,
                        useDifferentWhatsapp: checked,
                        whatsappPhone: checked ? prev.whatsappPhone : prev.phone,
                      }));
                    }}
                  />
                  <span className="text-foreground">WhatsApp number is different from phone</span>
                </label>
                {form.useDifferentWhatsapp && (
                  <div>
                    <PhoneInput
                      label="WhatsApp (optional)"
                      value={form.whatsappPhone}
                      onChange={(val) => update("whatsappPhone", val ?? EMPTY_PHONE)}
                      countryIso2="AE"
                    />
                    <div className="text-xs text-muted-foreground">Leave unchecked to reuse main phone</div>
                  </div>
                )}
              </div>
            </Card>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60 hover:opacity-90"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <Link
                href={companyId ? `/company/${companyId}/customers/${customerId ?? ""}` : "#"}
                className="rounded-md border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
              >
                Cancel
              </Link>
            </div>
          </form>
        )}
      </div>
    </AppLayout>
  );
}
