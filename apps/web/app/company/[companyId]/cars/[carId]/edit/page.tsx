"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppLayout, Card, useTheme } from "@repo/ui";
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
  vinPhotoFileId: "",
  tyreSizeFront: "",
  tyreSizeBack: "",
  registrationExpiry: "",
  registrationCardFileId: "",
  mileage: "",
  notes: "",
};

type FormKey = keyof typeof EMPTY_FORM;

type CarMeta = {
  isActive: boolean;
  code: string;
  updatedAt: string;
};

export default function CarEditPage({ params }: Params) {
  const { theme } = useTheme();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [carId, setCarId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [initialSnapshot, setInitialSnapshot] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FormKey, string>>>({});
  const [sectionOpen, setSectionOpen] = useState<Record<string, boolean>>({
    vehicle: true,
    plate: true,
    registration: true,
    files: true,
    notes: true,
  });
  const [meta, setMeta] = useState<CarMeta>({
    isActive: true,
    code: "-",
    updatedAt: "",
  });

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

        const regExpiry = data.registration_expiry ? (data.registration_expiry as string).slice(0, 10) : "";

        const nextForm = {
          carMake: data.make ?? "",
          carModel: data.model ?? "",
          carYear: data.model_year ? String(data.model_year) : "",
          plateCountry: data.plate_country ?? "AE",
          plateLocationMode: locationMode,
          plateState: data.plate_state ?? "",
          plateCity: data.plate_city ?? "",
          plateCode: plateCode ?? "",
          plateNumber: plateNumber ?? "",
          vinNumber: data.vin ?? "",
          vinPhotoFileId: data.vin_photo_file_id ?? "",
          tyreSizeFront: data.tyre_size_front ?? "",
          tyreSizeBack: data.tyre_size_back ?? "",
          registrationExpiry: regExpiry,
          registrationCardFileId: data.registration_card_file_id ?? "",
          mileage: data.mileage ? String(data.mileage) : "",
          notes: data.notes ?? "",
        };

        setForm(nextForm);
        setInitialSnapshot(JSON.stringify(nextForm));
        setMeta({
          isActive: data.is_active !== false,
          code: data.code ?? "-",
          updatedAt: data.updated_at ?? data.created_at ?? "",
        });
      })
      .catch((err: any) => setError(err?.message ?? "Failed to load car"))
      .finally(() => setLoading(false));
  }, [companyId, carId]);

  const isDirty = useMemo(() => {
    if (!initialSnapshot) return false;
    return JSON.stringify(form) !== initialSnapshot;
  }, [form, initialSnapshot]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty || saving) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty, saving]);

  function update<K extends FormKey>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validateForm(): Partial<Record<FormKey, string>> {
    const errs: Partial<Record<FormKey, string>> = {};
    const thisYear = new Date().getFullYear() + 1;

    if (!form.carMake.trim()) errs.carMake = "Make is required.";
    if (!form.carModel.trim()) errs.carModel = "Model is required.";
    if (!form.carYear.trim()) errs.carYear = "Year is required.";
    if (form.carYear.trim()) {
      const n = Number(form.carYear);
      if (!Number.isFinite(n) || n < 1980 || n > thisYear) {
        errs.carYear = `Enter a valid year between 1980 and ${thisYear}.`;
      }
    }

    if (!form.plateNumber.trim()) errs.plateNumber = "Plate number is required.";

    if (form.vinNumber.trim() && form.vinNumber.trim().length < 6) {
      errs.vinNumber = "VIN looks too short.";
    }

    if (form.mileage.trim() && !/^\d+$/.test(form.mileage.trim())) {
      errs.mileage = "Mileage must be numeric.";
    }

    if (form.registrationExpiry.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(form.registrationExpiry.trim())) {
      errs.registrationExpiry = "Use YYYY-MM-DD format.";
    }

    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId || !carId) return;

    const errs = validateForm();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setError("Please fix the highlighted fields.");
      return;
    }

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
        vinPhotoFileId: form.vinPhotoFileId || null,
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

  const labelClass = "mb-1 text-sm font-medium text-foreground";
  const inputClass = `${theme.input} min-h-[44px] text-foreground placeholder:text-muted-foreground`;

  function toggleSection(key: string) {
    setSectionOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function Section({
    id,
    title,
    subtitle,
    children,
  }: {
    id: string;
    title: string;
    subtitle?: string;
    children: React.ReactNode;
  }) {
    const isOpen = sectionOpen[id] ?? true;
    return (
      <section className="overflow-hidden rounded-2xl bg-background/60 shadow-sm">
        <div className="p-3 sm:p-4">
          <button
            type="button"
            onClick={() => toggleSection(id)}
            className="flex min-h-[44px] w-full items-center justify-between gap-3 text-left"
          >
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground sm:text-base">{title}</h2>
              {subtitle ? <p className="text-xs leading-relaxed text-muted-foreground">{subtitle}</p> : null}
            </div>
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/40 bg-muted/40 text-sm text-muted-foreground">
              {isOpen ? "-" : "+"}
            </span>
          </button>
        </div>
        {isOpen ? <div className="border-t border-slate-500/40 p-3 sm:p-4">{children}</div> : null}
      </section>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4 py-3 sm:py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl">Edit Car</h1>
            <p className="text-sm text-muted-foreground">Update car details with clear sections and quick validation.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`inline-flex rounded-full px-2.5 py-1 font-semibold ${
                meta.isActive ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600"
              }`}
            >
              {meta.isActive ? "Active" : "Inactive"}
            </span>
            <span className="inline-flex rounded-full bg-muted/30 px-2.5 py-1 text-muted-foreground">
              Code: {meta.code || "-"}
            </span>
            {meta.updatedAt ? (
              <span className="inline-flex rounded-full bg-muted/30 px-2.5 py-1 text-muted-foreground">
                Updated: {new Date(meta.updatedAt).toLocaleString()}
              </span>
            ) : null}
            <Link
              href={companyId && carId ? `/company/${companyId}/cars/${carId}` : "#"}
              className="inline-flex w-full items-center justify-center rounded-md border border-border/40 bg-transparent px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted/30 sm:w-auto"
            >
              Back to car
            </Link>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pb-24 sm:pb-4">
          <Card className="space-y-4">
            {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}

            {loading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : (
              <>
                <Section id="vehicle" title="Vehicle" subtitle="Core vehicle identity">
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
                  {(fieldErrors.carMake || fieldErrors.carModel || fieldErrors.carYear) && (
                    <div className="mt-2 text-xs text-red-400">
                      {fieldErrors.carMake ?? fieldErrors.carModel ?? fieldErrors.carYear}
                    </div>
                  )}

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <div className={labelClass}>VIN Number</div>
                      <input
                        className={inputClass}
                        value={form.vinNumber}
                        onChange={(e) => update("vinNumber", e.target.value)}
                        placeholder="Enter VIN"
                      />
                      {fieldErrors.vinNumber && <div className="mt-1 text-xs text-red-400">{fieldErrors.vinNumber}</div>}
                    </div>
                    <div>
                      <FileUploader
                        label="VIN Photo"
                        kind="image"
                        value={form.vinPhotoFileId}
                        onChange={(id) => update("vinPhotoFileId", id ?? "")}
                        helperText="Upload VIN/chassis photo"
                        showPreview
                      />
                    </div>
                  </div>
                </Section>

                <Section id="plate" title="Plate" subtitle="Registration and location mapping">
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
                  {fieldErrors.plateNumber && <div className="mt-2 text-xs text-red-400">{fieldErrors.plateNumber}</div>}
                </Section>

                <Section id="registration" title="Registration" subtitle="Dates and technical specifications">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <div className={labelClass}>Mileage</div>
                      <input
                        className={inputClass}
                        value={form.mileage}
                        onChange={(e) => update("mileage", e.target.value)}
                        placeholder="Odometer"
                        inputMode="numeric"
                      />
                      {fieldErrors.mileage && <div className="mt-1 text-xs text-red-400">{fieldErrors.mileage}</div>}
                    </div>
                    <div>
                      <div className={labelClass}>Registration Expiry</div>
                      <input
                        type="date"
                        className={inputClass}
                        value={form.registrationExpiry}
                        onChange={(e) => update("registrationExpiry", e.target.value)}
                      />
                      <div className="mt-1 text-xs text-muted-foreground">Use the calendar to avoid format issues.</div>
                      {fieldErrors.registrationExpiry && (
                        <div className="mt-1 text-xs text-red-400">{fieldErrors.registrationExpiry}</div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
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
                </Section>

                <Section id="files" title="Files" subtitle="Attach registration documents">
                  <FileUploader
                    label="Registration card attachment"
                    kind="any"
                    value={form.registrationCardFileId}
                    onChange={(id) => update("registrationCardFileId", id ?? "")}
                    helperText="Upload registration card copy"
                    showPreview
                  />
                </Section>

                <Section id="notes" title="Notes" subtitle="Optional internal details">
                  <div>
                    <textarea
                      className={`${inputClass} min-h-[96px]`}
                      value={form.notes}
                      onChange={(e) => update("notes", e.target.value)}
                      placeholder="Add optional notes"
                    />
                  </div>
                </Section>

                <div className="sticky bottom-2 z-20 rounded-xl bg-background/95 p-3 shadow-lg backdrop-blur sm:bottom-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs text-muted-foreground">
                      {isDirty ? "You have unsaved changes." : "All changes are saved."}
                    </div>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
                      <button
                        type="submit"
                        className="w-full rounded-md border border-primary/50 bg-transparent px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/10 disabled:opacity-60 sm:w-auto"
                        disabled={saving}
                      >
                        {saving ? "Saving..." : "Save changes"}
                      </button>
                      <Link
                        href={companyId && carId ? `/company/${companyId}/cars/${carId}` : "#"}
                        className="inline-flex w-full items-center justify-center rounded-md bg-muted/50 px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted/70 sm:w-auto"
                      >
                        Cancel
                      </Link>
                    </div>
                  </div>
                </div>
              </>
            )}
          </Card>
        </form>
      </div>
    </AppLayout>
  );
}
