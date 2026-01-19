"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AppLayout, Card } from "@repo/ui";
import { AttachmentField } from "@repo/ui/components/common/AttachmentField";
import type { FleetStatus, FleetVehicle, FleetVehicleType } from "@repo/ai-core";

type Props =
  | { params: { companyId: string; branchId: string } }
  | { params: Promise<{ companyId: string; branchId: string }> };

type FleetForm = {
  id?: string;
  code: string;
  name: string;
  vehicleType: FleetVehicleType;
  rsaSubType?: "van" | "bike" | "";
  plateNumber?: string;
  make?: string;
  model?: string;
  modelYear?: number | null;
  capacityJobs: number; // retained internally, defaulted to 1
  status: FleetStatus; // retained internally, defaulted to available
  isActive: boolean; // retained internally, defaulted to true
  inventoryType?: "stock" | "tools" | ""; // legacy meta, hidden
  assignedTo?: string;
  recoverySubType?: "regular" | "flatbed" | "covered" | "";
  workshopSubType?: "van" | "bike" | "";
  odometer?: number | null;
  registrationCardFileId?: string | null;
  registrationExpiry?: string | null;
};

const typeOptions: { value: FleetVehicleType; label: string }[] = [
  { value: "rsa", label: "RSA" },
  { value: "recovery", label: "Recovery" },
  { value: "parts", label: "Workshop" },
  { value: "other", label: "Other" },
];
const statusOptions: FleetStatus[] = ["available", "on_job", "maintenance", "out_of_service"];

function parseMeta(notes?: string | null) {
  if (!notes) return {};
  try {
    const obj = JSON.parse(notes);
    if (obj && typeof obj === "object") return obj;
  } catch (_e) {
    // ignore
  }
  return {};
}

function buildNotes(form: FleetForm) {
  const meta: any = {};
  if (form.inventoryType) meta.inventoryType = form.inventoryType;
  if (form.assignedTo) meta.assignedTo = form.assignedTo;
  if (form.recoverySubType) meta.recoverySubType = form.recoverySubType;
  if (form.rsaSubType) meta.rsaSubType = form.rsaSubType;
  if (form.workshopSubType) meta.workshopSubType = form.workshopSubType;
  if (form.odometer) meta.odometer = form.odometer;
  if (form.registrationCardFileId) meta.registrationCardFileId = form.registrationCardFileId;
  if (form.registrationExpiry) meta.registrationExpiry = form.registrationExpiry;
  return Object.keys(meta).length ? JSON.stringify(meta) : null;
}

export default function BranchFleetPage({ params }: Props) {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [fleet, setFleet] = useState<FleetVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FleetStatus | "any">("any");
  const [filterType, setFilterType] = useState<FleetVehicleType | "any">("any");
  const [form, setForm] = useState<FleetForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve(params).then((p) => {
      setCompanyId(p?.companyId ?? null);
      setBranchId(p?.branchId ?? null);
    });
  }, [params]);

  const filtered = useMemo(
    () =>
      fleet.filter(
        (f) =>
          (filterStatus === "any" || f.status === filterStatus) &&
          (filterType === "any" || f.vehicleType === filterType)
      ),
    [fleet, filterStatus, filterType]
  );

  async function loadFleet() {
    if (!companyId || !branchId) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ branchId });
      const res = await fetch(`/api/company/${companyId}/fleet?${qs.toString()}`);
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setFleet(json?.data ?? json ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load fleet");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFleet();
  }, [companyId, branchId]);

  const resetForm = () =>
    setForm({
      code: "",
      name: "",
      vehicleType: "rsa",
      plateNumber: "",
      make: "",
      model: "",
      modelYear: new Date().getFullYear(),
      capacityJobs: 1,
      status: "available",
      isActive: true,
      inventoryType: "",
      assignedTo: "",
      recoverySubType: "",
      rsaSubType: "",
      workshopSubType: "",
      odometer: null,
      registrationCardFileId: "",
      registrationExpiry: "",
    });

  async function handleSave() {
    if (!companyId || !branchId || !form) return;
    const effectiveCode = form.code.trim() || form.plateNumber?.trim() || `VEH-${Date.now()}`;
    const effectiveName = form.name.trim() || effectiveCode;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        branchId,
        code: effectiveCode,
        name: effectiveName,
        vehicleType: form.vehicleType,
        plateNumber: form.plateNumber?.trim() || null,
        make: form.make?.trim() || null,
        model: form.model?.trim() || null,
        modelYear: form.modelYear ? Number(form.modelYear) : null,
        capacityJobs: Number(form.capacityJobs) || 1,
        status: form.status ?? "available",
        isActive: form.isActive ?? true,
        notes: buildNotes(form),
      };
      const url = form.id ? `/api/company/${companyId}/fleet/${form.id}` : `/api/company/${companyId}/fleet`;
      const method = form.id ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      await loadFleet();
      setForm(null);
    } catch (err: any) {
      setError(err?.message ?? "Failed to save vehicle");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Branch Fleet</h1>
            <p className="text-sm text-muted-foreground">
              Manage branch fleet vehicles, assignments, and availability.
            </p>
          </div>
          <div className="flex gap-2">
            <select
              className="rounded border px-3 py-2 text-sm"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
            >
              <option value="any">All statuses</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <select
              className="rounded border px-3 py-2 text-sm"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
            >
              <option value="any">All types</option>
              {typeOptions.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <button
              className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20"
              onClick={resetForm}
            >
              Add Vehicle
            </button>
          </div>
        </div>

        {error && <div className="text-sm text-destructive">{error}</div>}
        {loading ? <div className="text-sm text-muted-foreground">Loading fleet...</div> : null}

        {!loading && filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground">No vehicles yet.</div>
        ) : null}

        {!loading && filtered.length > 0 ? (
          <Card className="p-3">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="py-2 text-left">Code</th>
                    <th className="py-2 text-left">Name</th>
                    <th className="py-2 text-left">Type</th>
                    <th className="py-2 text-left">Status</th>
                    <th className="py-2 text-left">Plate</th>
                    <th className="py-2 text-left">Make/Model</th>
                    <th className="py-2 text-left">Year</th>
                    <th className="py-2 text-left">Capacity</th>
                    <th className="py-2 text-left">Assigned</th>
                    <th className="py-2 text-left">Odometer</th>
                    <th className="py-2 text-left">Reg. Expiry</th>
                    <th className="py-2 text-left">Reg. Card</th>
                    <th className="py-2 text-left">Notes</th>
                    <th className="py-2 text-left">Actions</th>
                    <th className="py-2 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v) => {
                    const meta = parseMeta(v.notes);
                    let displayType = typeOptions.find((t) => t.value === v.vehicleType)?.label ?? v.vehicleType;
                    if (v.vehicleType === "recovery" && meta?.recoverySubType) {
                      displayType = `Recovery (${meta.recoverySubType})`;
                    } else if (v.vehicleType === "rsa" && meta?.rsaSubType) {
                      displayType = `RSA (${meta.rsaSubType})`;
                    } else if (v.vehicleType === "parts" && meta?.workshopSubType) {
                      displayType = `Workshop (${meta.workshopSubType})`;
                    }
                    return (
                      <tr key={v.id} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-medium">{v.code}</td>
                        <td className="py-2 pr-4">{v.name}</td>
                        <td className="py-2 pr-4">{displayType}</td>
                        <td className="py-2 pr-4 capitalize">{v.status.replace(/_/g, " ")}</td>
                        <td className="py-2 pr-4">{v.plateNumber || "—"}</td>
                        <td className="py-2 pr-4">{[v.make, v.model].filter(Boolean).join(" ") || "—"}</td>
                        <td className="py-2 pr-4">{v.modelYear ?? "—"}</td>
                        <td className="py-2 pr-4">{v.capacityJobs}</td>
                        <td className="py-2 pr-4">{meta.assignedTo || "—"}</td>
                        <td className="py-2 pr-4">{meta.odometer ?? "—"}</td>
                        <td className="py-2 pr-4">{meta.registrationExpiry ?? "—"}</td>
                        <td className="py-2 pr-4">
                          {meta.registrationCardFileId ? (
                            <a
                              className="text-primary hover:underline text-xs"
                              href={`/api/files/${meta.registrationCardFileId}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              View
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-2 pr-4 text-xs text-muted-foreground">
                          {meta.inventoryType || meta.notes || "—"}
                        </td>
                        <td className="py-2 pr-4">
                          <button
                            className="rounded border px-2 py-1 text-xs hover:bg-muted"
                            onClick={() =>
                              setForm({
                                id: v.id,
                                code: v.code,
                                name: v.name,
                                vehicleType: v.vehicleType,
                                plateNumber: v.plateNumber ?? "",
                                make: v.make ?? "",
                                model: v.model ?? "",
                                modelYear: v.modelYear ?? null,
                                capacityJobs: v.capacityJobs,
                                status: v.status,
                                isActive: v.isActive,
                                inventoryType: meta.inventoryType ?? "",
                                assignedTo: meta.assignedTo ?? "",
                                recoverySubType: meta.recoverySubType ?? "",
                                rsaSubType: meta.rsaSubType ?? "",
                                workshopSubType: meta.workshopSubType ?? "",
                                odometer: meta.odometer ?? null,
                                registrationCardFileId: meta.registrationCardFileId ?? "",
                                registrationExpiry: meta.registrationExpiry ?? "",
                              })
                            }
                          >
                            Edit
                          </button>
                          <button
                            className="ml-2 rounded border border-red-500 px-2 py-1 text-xs text-red-500 hover:bg-red-50 disabled:opacity-50"
                            disabled={deletingId === v.id}
                            onClick={async () => {
                              if (!companyId || !confirm("Delete this vehicle?")) return;
                              setDeletingId(v.id);
                              try {
                                const res = await fetch(`/api/company/${companyId}/fleet/${v.id}`, { method: "DELETE" });
                                if (!res.ok) throw new Error(await res.text());
                                await loadFleet();
                              } catch (err: any) {
                                setError(err?.message ?? "Failed to delete vehicle");
                              } finally {
                                setDeletingId(null);
                              }
                            }}
                          >
                            {deletingId === v.id ? "Deleting..." : "Delete"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}

        {form && (
          <Card className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-base font-semibold">{form.id ? "Edit Vehicle" : "Add Vehicle"}</div>
                <div className="text-xs text-muted-foreground">
                  Capture fleet details. Assign technician/driver and inventory type via metadata.
                </div>
              </div>
              <button className="text-sm text-muted-foreground hover:underline" onClick={() => setForm(null)}>
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Code/Name auto-managed; hide from UI */}
              <input type="hidden" value={form.code} readOnly />
              <input type="hidden" value={form.name} readOnly />
              <div>
                <label className="text-sm font-medium">Type</label>
                <select
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  value={form.vehicleType}
                  onChange={(e) => setForm((prev) => prev && { ...prev, vehicleType: e.target.value as FleetVehicleType })}
                >
                  {typeOptions.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              {form.vehicleType === "recovery" && (
                <div>
                  <label className="text-sm font-medium">Recovery subtype</label>
                  <select
                    className="mt-1 w-full rounded border px-3 py-2 text-sm"
                    value={form.recoverySubType}
                    onChange={(e) => setForm((prev) => prev && { ...prev, recoverySubType: e.target.value as any })}
                  >
                    <option value="">Select</option>
                    <option value="regular">Regular</option>
                    <option value="flatbed">Flatbed</option>
                    <option value="covered">Covered</option>
                  </select>
                </div>
              )}
              {form.vehicleType === "rsa" && (
                <div>
                  <label className="text-sm font-medium">RSA subtype</label>
                  <select
                    className="mt-1 w-full rounded border px-3 py-2 text-sm"
                    value={form.rsaSubType}
                    onChange={(e) => setForm((prev) => prev && { ...prev, rsaSubType: e.target.value as any })}
                  >
                    <option value="">Select</option>
                    <option value="van">Van</option>
                    <option value="bike">Bike</option>
                  </select>
                </div>
              )}
              {form.vehicleType === "parts" && (
                <div>
                  <label className="text-sm font-medium">Workshop subtype</label>
                  <select
                    className="mt-1 w-full rounded border px-3 py-2 text-sm"
                    value={form.workshopSubType}
                    onChange={(e) => setForm((prev) => prev && { ...prev, workshopSubType: e.target.value as any })}
                  >
                    <option value="">Select</option>
                    <option value="van">Van</option>
                    <option value="bike">Bike</option>
                  </select>
                </div>
              )}
              <input type="hidden" value={form.status} readOnly />
              <div>
                <label className="text-sm font-medium">Plate number</label>
                <input
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  value={form.plateNumber ?? ""}
                  onChange={(e) => setForm((prev) => prev && { ...prev, plateNumber: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Make</label>
                <input
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  value={form.make ?? ""}
                  onChange={(e) => setForm((prev) => prev && { ...prev, make: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Model</label>
                <input
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  value={form.model ?? ""}
                  onChange={(e) => setForm((prev) => prev && { ...prev, model: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Model year</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  value={form.modelYear ?? ""}
                  onChange={(e) =>
                    setForm((prev) => prev && { ...prev, modelYear: e.target.value ? Number(e.target.value) : null })
                  }
                />
              </div>
              <input type="hidden" value={form.capacityJobs} readOnly />
              <input type="hidden" value={form.isActive ? "true" : "false"} readOnly />
              <input type="hidden" value={form.inventoryType ?? ""} readOnly />
              <div>
                <label className="text-sm font-medium">Odometer</label>
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  value={form.odometer ?? ""}
                  onChange={(e) =>
                    setForm((prev) => prev && { ...prev, odometer: e.target.value ? Number(e.target.value) : null })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Registration card</label>
                <AttachmentField
                  label=""
                  value={form.registrationCardFileId ?? ""}
                  onChange={(val) => setForm((prev) => prev && { ...prev, registrationCardFileId: val })}
                  name="registration_card"
                  uploadUrl="/api/files/upload"
                  uploadFields={{ scope: "company", companyId: companyId ?? undefined }}
                  onUploadComplete={(id) => setForm((prev) => prev && { ...prev, registrationCardFileId: id })}
                  onUploadError={(msg) => setError(msg)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Registration expiry</label>
                <input
                  type="date"
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  value={form.registrationExpiry ?? ""}
                  onChange={(e) => setForm((prev) => prev && { ...prev, registrationExpiry: e.target.value || null })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                disabled={saving || (!form.code.trim() && !form.plateNumber?.trim())}
                onClick={handleSave}
              >
                {saving ? "Saving..." : form.id ? "Save changes" : "Create vehicle"}
              </button>
              <button className="rounded-md border px-4 py-2 text-sm hover:bg-muted" onClick={() => setForm(null)}>
                Cancel
              </button>
            </div>
          </Card>
        )}

        <Card className="p-3">
          <div className="text-sm font-semibold mb-2">Live Usage</div>
          <div className="text-xs text-muted-foreground">
            Detailed bay/job timers for vehicles are not available in this environment.
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
