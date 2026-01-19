"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AppLayout, Card, useTheme } from "@repo/ui";
import { CarMakeModelSelect } from "@repo/ui/components/common/CarMakeModelSelect";
import { PhoneInput } from "@repo/ui/components/common/PhoneInput";
import type { PhoneValue } from "@repo/ui/components/common/PhoneInput";
import { PlateInput, PlateValue } from "@repo/ui/components/common/PlateInput";

type Params = { params: { companyId: string } | Promise<{ companyId: string }> };

const EMPTY_PHONE: PhoneValue = { dialCode: "+971", nationalNumber: "" };
const EMPTY_PLATE: PlateValue = {
  country: "AE",
  locationMode: undefined,
  state: "",
  city: "",
  series: "",
  number: "",
};

const CAR_TYPE_OPTIONS = ["Regular", "SUV", "Pickup", "Van", "Truck", "Motorcycle", "Other"];

export default function CustomerCreatePage({ params }: Params) {
  const { theme } = useTheme();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: EMPTY_PHONE as PhoneValue,
    whatsappPhone: EMPTY_PHONE as PhoneValue,
    useDifferentWhatsapp: false,
    plate: EMPTY_PLATE as PlateValue,
    carMake: "",
    carModel: "",
    carYear: "",
    carType: "Regular",
    isInsurance: false,
  });

  useEffect(() => {
    Promise.resolve(params).then((p) => setCompanyId(p?.companyId ?? null));
  }, [params]);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        companyId,
        customerType: "individual" as const,
        name: form.name,
        email: form.email || null,
        phone: `${form.phone.dialCode}${form.phone.nationalNumber}`,
        whatsappPhone: form.useDifferentWhatsapp
          ? `${form.whatsappPhone.dialCode}${form.whatsappPhone.nationalNumber}`
          : `${form.phone.dialCode}${form.phone.nationalNumber}`,
      };
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to create customer");
      }
      const data = await res.json();
      const id = data?.id ?? data?.data?.id;
      if (id) {
        const plateText = `${form.plate.series ?? ""} ${form.plate.number ?? ""}`.trim() || null;
        const carRes = await fetch(`/api/customers/${id}/cars?companyId=${companyId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            relationType: "owner",
            isPrimary: true,
            newCar: {
              plateNumber: plateText,
              plateCode: form.plate.series || null,
              plateCountry: form.plate.country || null,
              plateState: form.plate.state || null,
              plateCity: form.plate.city || null,
              plateLocationMode: form.plate.locationMode || null,
              make: form.carMake || null,
              model: form.carModel || null,
              modelYear: form.carYear ? Number(form.carYear) : null,
              bodyType: form.carType || null,
              isInsurance: form.isInsurance,
            },
          }),
        });
        if (!carRes.ok) {
          const carData = await carRes.json().catch(() => ({}));
          throw new Error(carData?.error ?? "Failed to add car");
        }
        window.location.href = `/company/${companyId}/customers/${id}`;
      } else {
        window.location.href = `/company/${companyId}/customers`;
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to create customer");
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
            <h1 className="text-2xl font-semibold">New Customer</h1>
            <p className="text-sm text-muted-foreground">Create a customer using the same fields as lead capture.</p>
          </div>
          <Link
            href={companyId ? `/company/${companyId}/customers` : "#"}
            className="text-sm text-primary hover:underline"
          >
            Back to customers
          </Link>
        </div>

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
          <Card className="space-y-3">
            <div className="text-lg font-semibold">Car</div>
            <div className="space-y-2">
              <div className={labelClass}>Car Plate #</div>
              <PlateInput
                value={form.plate}
                onChange={(val) => update("plate", val)}
              />
            </div>
            <CarMakeModelSelect
              value={{
                make: form.carMake,
                model: form.carModel,
                year: form.carYear ? Number(form.carYear) : undefined,
              }}
              onChange={(val) => {
                update("carMake", val.make);
                update("carModel", val.model ?? "");
                update("carYear", val.year ? String(val.year) : "");
              }}
              minYear={1980}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className={labelClass}>Car Type</div>
                <select
                  className={inputClass}
                  value={form.carType}
                  onChange={(e) => update("carType", e.target.value)}
                >
                  {CAR_TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center">
                <label className="mt-5 inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-100/70 px-3 py-2 text-sm font-semibold text-amber-900">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-amber-500"
                    checked={form.isInsurance}
                    onChange={(e) => update("isInsurance", e.target.checked)}
                  />
                  Insurance Car
                </label>
              </div>
            </div>
          </Card>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60 hover:opacity-90"
            >
              {saving ? "Saving..." : "Create Customer"}
            </button>
            <Link
              href={companyId ? `/company/${companyId}/customers` : "#"}
              className="rounded-md border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
