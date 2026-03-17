"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AppLayout, Card, useTheme } from "@repo/ui";
import { CarMakeModelSelect } from "@repo/ui/components/common/CarMakeModelSelect";
import { PlateInput, PlateValue } from "@repo/ui/components/common/PlateInput";
import { FileUploader } from "@repo/ui";

type Params = { params: { companyId: string } | Promise<{ companyId: string }> };

const EMPTY_FORM = {
  carMake: "",
  carModel: "",
  carYear: "",
  plateCountry: "AE",
  plateLocationMode: undefined as PlateValue["locationMode"],
  plateState: "",
  plateCity: "",
  plateCode: "",
  plateNumber: "",
  vinNumber: "",
  tyreSizeFront: "",
  tyreSizeBack: "",
  registrationExpiry: "",
  registrationCardFileId: "",
  mileage: "",
  notes: "",
};

export default function CarCreatePage({ params }: Params) {
  const { theme } = useTheme();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const plateCombined = [form.plateCode, form.plateNumber].filter(Boolean).join(" ").trim() || null;
      const payload = {
        companyId,
        plateCode: form.plateCode || null,
        plateCountry: form.plateCountry || null,
        plateState: form.plateState || null,
        plateCity: form.plateCity || null,
        plateLocationMode: form.plateLocationMode || null,
        plateNumber: plateCombined,
        vin: form.vinNumber || null,
        make: form.carMake || null,
        model: form.carModel || null,
        modelYear: form.carYear ? Number(form.carYear) : null,
        mileage: form.mileage ? Number(form.mileage) : null,
        tyreSizeFront: form.tyreSizeFront || null,
        tyreSizeBack: form.tyreSizeBack || null,
        registrationExpiry: form.registrationExpiry || null,
        registrationCardFileId: form.registrationCardFileId || null,
        notes: form.notes || null,
      };
      const res = await fetch("/api/cars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to create car");
      }
      const data = await res.json();
      const id = data?.id ?? data?.data?.id;
      if (id) {
        window.location.href = `/company/${companyId}/cars/${id}`;
      } else {
        window.location.href = `/company/${companyId}/cars`;
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to create car");
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
            <h1 className="text-2xl font-semibold">Create Car</h1>
            <p className="text-sm text-muted-foreground">Create a standalone car (not linked to a customer).</p>
          </div>
          <Link href={companyId ? `/company/${companyId}/cars` : "#"} className="text-sm text-primary hover:underline">
            Back to cars
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Card className="space-y-3">
            <div className="text-lg font-semibold">Car</div>
            {error && <div className="text-sm text-destructive">{error}</div>}

            <CarMakeModelSelect
              value={{
                make: form.carMake,
                model: form.carModel,
                year: form.carYear ? Number(form.carYear) : undefined,
              }}
              onChange={(v) => {
                update("carMake", v.make);
                update("carModel", v.model ?? "");
                update("carYear", v.year ? String(v.year) : "");
              }}
              minYear={1900}
            />

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className={labelClass}>VIN Number</div>
                <input className={inputClass} value={form.vinNumber} onChange={(e) => update("vinNumber", e.target.value)} />
              </div>
              <PlateInput
                value={{
                  country: form.plateCountry,
                  locationMode: form.plateLocationMode,
                  state: form.plateState,
                  city: form.plateCity,
                  series: form.plateCode,
                  number: form.plateNumber,
                }}
                onChange={(v) => {
                  update("plateCountry", v.country);
                  update("plateLocationMode", v.locationMode);
                  update("plateState", v.state ?? "");
                  update("plateCity", v.city ?? "");
                  update("plateCode", v.series ?? "");
                  update("plateNumber", v.number ?? "");
                }}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className={labelClass}>Tire Size (Front)</div>
                <input
                  className={inputClass}
                  value={form.tyreSizeFront}
                  onChange={(e) => update("tyreSizeFront", e.target.value)}
                  placeholder="e.g. 235/55R18"
                />
              </div>
              <div>
                <div className={labelClass}>Tire Size (Rear)</div>
                <input
                  className={inputClass}
                  value={form.tyreSizeBack}
                  onChange={(e) => update("tyreSizeBack", e.target.value)}
                  placeholder="e.g. 255/50R18"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className={labelClass}>Registration Expiry</div>
                <input
                  className={inputClass}
                  type="date"
                  value={form.registrationExpiry}
                  onChange={(e) => update("registrationExpiry", e.target.value)}
                />
              </div>
              <div>
                <FileUploader
                  label="Registration Card Attachment"
                  value={form.registrationCardFileId}
                  onChange={(id) => update("registrationCardFileId", id ?? "")}
                  helperText="Upload a copy of the registration card (optional)"
                />
              </div>
            </div>

            <div>
              <div className={labelClass}>Mileage</div>
              <input
                className={inputClass}
                type="number"
                value={form.mileage}
                onChange={(e) => update("mileage", e.target.value)}
                placeholder="Odometer"
              />
            </div>

            <div>
              <div className={labelClass}>Notes</div>
              <textarea
                className={`${inputClass} min-h-[80px]`}
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                placeholder="Additional details"
              />
            </div>
          </Card>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60 hover:opacity-90"
            >
              {saving ? "Saving..." : "Create Car"}
            </button>
            <Link
              href={companyId ? `/company/${companyId}/cars` : "#"}
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
