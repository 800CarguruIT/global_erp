"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AppLayout, Card } from "@repo/ui";
import { CarMakeModelSelect } from "@repo/ui/components/common/CarMakeModelSelect";
import { PlateInput, PlateValue } from "@repo/ui/components/common/PlateInput";
import { FileUploader } from "@repo/ui";

type Params = { params: { companyId: string; carId: string } | Promise<{ companyId: string; carId: string }> };

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

export default function CarEditPage({ params }: Params) {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [carId, setCarId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.resolve(params).then((p) => {
      setCompanyId(p?.companyId ?? null);
      setCarId(p?.carId ?? null);
    });
  }, [params]);

  useEffect(() => {
    if (!companyId || !carId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/cars/${carId}?companyId=${companyId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to load car"))))
      .then((data) => {
        if (!data) return;
        const plateRaw = ((data.plate_number as string | undefined) ?? "").trim();
        let plateCode = (data.plate_code as string | undefined) ?? "";
        let plateNumber = (data.plate_number as string | undefined) ?? "";
        if (!plateCode && plateRaw) {
          const match = plateRaw.match(/^([A-Za-z0-9]+)\s+(.+)$/);
          if (match) {
            plateCode = match[1];
            plateNumber = match[2];
          } else {
            plateNumber = plateRaw;
          }
        } else if (plateCode && plateRaw.startsWith(`${plateCode} `)) {
          plateNumber = plateRaw.slice(plateCode.length).trim();
        }
        const locationMode =
          data.plate_location_mode ??
          (data.plate_state && data.plate_city
            ? ("both" as PlateValue["locationMode"])
            : data.plate_state
              ? ("state" as PlateValue["locationMode"])
              : data.plate_city
                ? ("city" as PlateValue["locationMode"])
                : undefined);
        const regExpiry = data.registration_expiry
          ? (data.registration_expiry as string).slice(0, 10)
          : "";
        setForm((prev) => ({
          ...prev,
          carMake: data.make ?? "",
          carModel: data.model ?? "",
          carYear: data.model_year ? String(data.model_year) : "",
          plateCountry: data.plate_country ?? "AE",
          plateLocationMode: locationMode ?? prev.plateLocationMode,
          plateState: data.plate_state ?? prev.plateState,
          plateCity: data.plate_city ?? prev.plateCity,
          plateCode: plateCode ?? "",
          plateNumber: plateNumber ?? "",
          vinNumber: data.vin ?? "",
          tyreSizeFront: data.tyre_size_front ?? "",
          tyreSizeBack: data.tyre_size_back ?? "",
          registrationExpiry: regExpiry,
          registrationCardFileId: data.registration_card_file_id ?? "",
          mileage: data.mileage ? String(data.mileage) : "",
          notes: data.notes ?? "",
        }));
      })
      .catch((err: any) => setError(err?.message ?? "Failed to load car"))
      .finally(() => setLoading(false));
  }, [companyId, carId]);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId || !carId) return;
    setSaving(true);
    setError(null);
    try {
      const plateCombined = [form.plateCode, form.plateNumber].filter(Boolean).join(" ").trim() || null;
      const payload = {
        scope: "company" as const,
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
      const res = await fetch(`/api/cars/${carId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to update car");
      }
      window.location.href = `/company/${companyId}/cars/${carId}`;
    } catch (err: any) {
      setError(err?.message ?? "Failed to update car");
    } finally {
      setSaving(false);
    }
  }

  const labelClass = "text-xs font-semibold text-muted-foreground";
  const inputClass = "w-full rounded-md border bg-background px-3 py-2 text-sm";

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Edit Car</h1>
            <p className="text-sm text-muted-foreground">Update car details.</p>
          </div>
          <Link href={companyId && carId ? `/company/${companyId}/cars/${carId}` : "#"} className="text-sm text-primary hover:underline">
            Back to car
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Card className="space-y-3">
            <div className="text-lg font-semibold">Car</div>
            {error && <div className="text-sm text-destructive">{error}</div>}

            {loading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : (
              <>
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
                />

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className={labelClass}>VIN Number</div>
                    <input
                      className={inputClass}
                      value={form.vinNumber}
                      onChange={(e) => update("vinNumber", e.target.value)}
                      placeholder="VIN"
                    />
                  </div>
                  <div>
                    <div className={labelClass}>VIN Photo</div>
                    <FileUploader
                      fileId={form.vinPhotoFileId}
                      onChange={(id) => update("vinPhotoFileId" as any, id)}
                      accept="image/*"
                    />
                  </div>
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
                  onChange={(v) =>
                    setForm((prev) => ({
                      ...prev,
                      plateCountry: v.country ?? prev.plateCountry,
                      plateLocationMode: v.locationMode,
                      plateState: v.state ?? "",
                      plateCity: v.city ?? "",
                      plateCode: v.series ?? "",
                      plateNumber: v.number ?? "",
                    }))
                  }
                />

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className={labelClass}>Mileage</div>
                    <input
                      className={inputClass}
                      value={form.mileage}
                      onChange={(e) => update("mileage", e.target.value)}
                      placeholder="Odometer"
                    />
                  </div>
                  <div>
                    <div className={labelClass}>Registration Expiry</div>
                    <input
                      type="date"
                      className={inputClass}
                      value={form.registrationExpiry}
                      onChange={(e) => update("registrationExpiry", e.target.value)}
                    />
                  </div>
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

                <div>
                  <div className={labelClass}>Registration card attachment</div>
                  <FileUploader
                    fileId={form.registrationCardFileId}
                    onChange={(id) => update("registrationCardFileId", id ?? "")}
                  />
                </div>

                <div>
                  <div className={labelClass}>Notes</div>
                  <textarea
                    className={`${inputClass} min-h-[80px]`}
                    value={form.notes}
                    onChange={(e) => update("notes", e.target.value)}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save changes"}
                  </button>
                  <Link href={companyId && carId ? `/company/${companyId}/cars/${carId}` : "#"} className="text-sm text-primary hover:underline">
                    Cancel
                  </Link>
                </div>
              </>
            )}
          </Card>
        </form>
      </div>
    </AppLayout>
  );
}
