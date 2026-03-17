"use client";

import React, { useState } from "react";

export type CarFormValues = {
  make: string;
  model: string;
  year?: number | null;
  vin?: string | null;
  plateNumber?: string | null;
  noPlate?: boolean;
  mileage?: number | null;
  tyreSizeFront?: string | null;
  tyreSizeBack?: string | null;
  registrationExpiry?: string | null;
  registrationCardFileId?: string | null;
  notes?: string | null;
};

export type CarFormProps = {
  mode?: "create" | "edit";
  initialValues?: CarFormValues;
  onSubmit: (values: CarFormValues) => Promise<void> | void;
};

export function CarForm({ mode = "create", initialValues, onSubmit }: CarFormProps) {
  const [values, setValues] = useState<CarFormValues>(
    initialValues ?? { make: "", model: "", noPlate: false }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!values.make.trim() || !values.model.trim()) {
      setError("Make and model are required.");
      return;
    }
    setSaving(true);
    try {
      await onSubmit(values);
      setSuccess("Saved");
    } catch (err: any) {
      setError(err?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label="Make"
          value={values.make}
          onChange={(e) => setValues((v) => ({ ...v, make: e.target.value }))}
          required
        />
        <Input
          label="Model"
          value={values.model}
          onChange={(e) => setValues((v) => ({ ...v, model: e.target.value }))}
          required
        />
        <Input
          label="Year"
          type="number"
          value={values.year ?? ""}
          onChange={(e) => setValues((v) => ({ ...v, year: Number(e.target.value) || null }))}
        />
        <Input
          label="VIN"
          value={values.vin ?? ""}
          onChange={(e) => setValues((v) => ({ ...v, vin: e.target.value }))}
        />
        <Input
          label="Plate number"
          value={values.plateNumber ?? ""}
          disabled={values.noPlate}
          onChange={(e) => setValues((v) => ({ ...v, plateNumber: e.target.value }))}
          placeholder={values.noPlate ? "Will be generated as NOPLATE" : ""}
        />
        <Checkbox
          label="Car is not registered / no plate yet"
          checked={!!values.noPlate}
          onChange={(checked) => setValues((v) => ({ ...v, noPlate: checked, plateNumber: checked ? "" : v.plateNumber }))}
        />
        <Input
          label="Mileage"
          type="number"
          value={values.mileage ?? ""}
          onChange={(e) => setValues((v) => ({ ...v, mileage: Number(e.target.value) || null }))}
        />
        <Input
          label="Tyre size (front)"
          value={values.tyreSizeFront ?? ""}
          onChange={(e) => setValues((v) => ({ ...v, tyreSizeFront: e.target.value }))}
        />
        <Input
          label="Tyre size (back)"
          value={values.tyreSizeBack ?? ""}
          onChange={(e) => setValues((v) => ({ ...v, tyreSizeBack: e.target.value }))}
        />
        <Input
          label="Registration expiry"
          type="date"
          value={values.registrationExpiry ?? ""}
          onChange={(e) => setValues((v) => ({ ...v, registrationExpiry: e.target.value }))}
        />
        <Input
          label="Registration card file ID"
          value={values.registrationCardFileId ?? ""}
          onChange={(e) =>
            setValues((v) => ({ ...v, registrationCardFileId: e.target.value }))
          }
        />
      </div>
      <label className="text-sm space-y-1">
        <span className="text-xs uppercase opacity-70">Notes</span>
        <textarea
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm min-h-[80px]"
          value={values.notes ?? ""}
          onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
        />
      </label>

      {error && <div className="text-red-400 text-sm">{error}</div>}
      {success && <div className="text-green-400 text-sm">{success}</div>}

      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 via-indigo-500 to-fuchsia-500 text-white shadow-lg disabled:opacity-50"
      >
        {saving ? "Saving..." : mode === "edit" ? "Update Car" : "Create Car"}
      </button>
    </form>
  );
}

function Input(
  props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }
) {
  const { label, ...rest } = props;
  return (
    <label className="text-sm space-y-1">
      <span className="text-xs uppercase opacity-70">{label}</span>
      <input
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
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
