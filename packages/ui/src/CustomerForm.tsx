"use client";

import React, { useState } from "react";

export type CustomerFormValues = {
  name: string;
  phone: string;
  whatsappPhone?: string | null;
  email?: string | null;
  address?: string | null;
  googleLocation?: string | null;
};

export type CustomerFormProps = {
  mode?: "create" | "edit";
  initialValues?: CustomerFormValues;
  onSubmit: (values: CustomerFormValues) => Promise<void> | void;
};

export function CustomerForm({ mode = "create", initialValues, onSubmit }: CustomerFormProps) {
  const [values, setValues] = useState<CustomerFormValues>(
    initialValues ?? { name: "", phone: "", googleLocation: "" }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!values.name.trim() || !values.phone.trim()) {
      setError("Name and phone are required.");
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
      <Input
        label="Name"
        value={values.name}
        onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
        required
      />
      <Input
        label="Phone"
        value={values.phone}
        onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))}
        required
      />
      <Input
        label="WhatsApp phone"
        value={values.whatsappPhone ?? ""}
        onChange={(e) => setValues((v) => ({ ...v, whatsappPhone: e.target.value }))}
        placeholder="Leave empty to reuse main phone"
      />
      <Input
        label="Email"
        value={values.email ?? ""}
        onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
      />
      <label className="text-sm space-y-1">
        <span className="text-xs uppercase opacity-70">Address</span>
        <textarea
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm min-h-[80px]"
          value={values.address ?? ""}
          onChange={(e) => setValues((v) => ({ ...v, address: e.target.value }))}
        />
      </label>
      <label className="text-sm space-y-1">
        <span className="text-xs uppercase opacity-70">Google embedded location</span>
        <input
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
          placeholder="https://maps.google.com/..."
          value={values.googleLocation ?? ""}
          onChange={(e) => setValues((v) => ({ ...v, googleLocation: e.target.value }))}
        />
      </label>

      {error && <div className="text-red-400 text-sm">{error}</div>}
      {success && <div className="text-green-400 text-sm">{success}</div>}

      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 via-indigo-500 to-fuchsia-500 text-white shadow-lg disabled:opacity-50"
      >
        {saving ? "Saving..." : mode === "edit" ? "Update Customer" : "Create Customer"}
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
