"use client";

import React, { useEffect, useState } from "react";
import { MainPageShell } from "./MainPageShell";
import type { Inspection, InspectionItem, InspectionStatus } from "@repo/ai-core/workshop/inspections/types";

type InspectionDetailMainProps = {
  companyId: string;
  inspectionId: string;
};

type LoadState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "loaded"; data: T; error: null }
  | { status: "error"; data: null; error: string };

type CarDetails = {
  plate?: string;
  make?: string;
  model?: string;
  year?: string;
  vin?: string;
  mileage?: string;
  tyreFront?: string;
  tyreRear?: string;
};

type ItemDraft = {
  id?: string;
  lineNo?: number;
  category?: string;
  partName: string;
  severity?: string;
  requiredAction?: string;
  techReason?: string;
  laymanReason?: string;
  photoRefs?: any;
};

type DraftState = {
  status: InspectionStatus;
  car: CarDetails;
  healthEngine?: number | null;
  healthTransmission?: number | null;
  healthBrakes?: number | null;
  healthSuspension?: number | null;
  healthElectrical?: number | null;
  overallHealth?: number | null;
  inspectorRemark?: string;
  inspectorRemarkLayman?: string;
  items: ItemDraft[];
};

type LoadedData = {
  inspection: Inspection;
  items: InspectionItem[];
  carFromLead?: CarDetails;
};

export function InspectionDetailMain({ companyId, inspectionId }: InspectionDetailMainProps) {
  const [loadState, setLoadState] = useState<LoadState<LoadedData>>({
    status: "loading",
    data: null,
    error: null,
  });

  const [draft, setDraft] = useState<DraftState | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadState({ status: "loading", data: null, error: null });
      try {
        const inspRes = await fetch(`/api/company/${companyId}/workshop/inspections/${inspectionId}`);
        if (!inspRes.ok) throw new Error(`HTTP ${inspRes.status}`);
        const inspJson = await inspRes.json();
        const inspection: Inspection = inspJson.data?.inspection ?? inspJson.data?.inspection ?? inspJson.data?.inspection ?? inspJson.data?.inspection ?? inspJson.data?.inspection ?? inspJson.data?.inspection ?? inspJson.data.inspection ?? inspJson.data;
        const items: InspectionItem[] = inspJson.data?.items ?? inspJson.items ?? [];

        let carFromLead: CarDetails | undefined;
        if (inspection.leadId) {
          try {
            const leadRes = await fetch(`/api/company/${companyId}/sales/leads/${inspection.leadId}`);
            if (leadRes.ok) {
              const leadJson = await leadRes.json();
              const leadData = leadJson.data?.lead ?? leadJson.data?.data ?? leadJson.data ?? {};
              carFromLead = {
                plate: (leadData.carPlateNumber as string | undefined) ?? (leadData.plateNumber as string | undefined),
                make: (leadData.carMake as string | undefined) ?? undefined,
                model: (leadData.carModel as string | undefined) ?? undefined,
                year: (leadData.carYear as string | undefined) ?? (leadData.year as string | undefined),
                vin: (leadData.carVin as string | undefined) ?? (leadData.vin as string | undefined),
                mileage: (leadData.carMileage as string | undefined) ?? (leadData.mileage as string | undefined),
                tyreFront: (leadData.tyreFront as string | undefined) ?? (leadData.tyreSizeFront as string | undefined),
                tyreRear: (leadData.tyreRear as string | undefined) ?? (leadData.tyreSizeRear as string | undefined),
              };
            }
          } catch {
            // ignore
          }
        }

        if (cancelled) return;

        setLoadState({
          status: "loaded",
          data: { inspection, items, carFromLead },
          error: null,
        });

        const draftPayloadCar: CarDetails | undefined = (inspection.draftPayload as any)?.car ?? undefined;
        const initialCar: CarDetails = draftPayloadCar ?? carFromLead ?? {};

        const itemDrafts: ItemDraft[] = items.map((i) => ({
          id: i.id,
          lineNo: i.lineNo,
          category: i.category ?? undefined,
          partName: i.partName ?? "",
          severity: i.severity ?? undefined,
          requiredAction: i.requiredAction ?? undefined,
          techReason: i.techReason ?? undefined,
          laymanReason: i.laymanReason ?? undefined,
          photoRefs: i.photoRefs ?? undefined,
        }));

        setDraft({
          status: inspection.status,
          car: initialCar,
          healthEngine: inspection.healthEngine ?? null,
          healthTransmission: inspection.healthTransmission ?? null,
          healthBrakes: inspection.healthBrakes ?? null,
          healthSuspension: inspection.healthSuspension ?? null,
          healthElectrical: inspection.healthElectrical ?? null,
          overallHealth: inspection.overallHealth ?? null,
          inspectorRemark: inspection.inspectorRemark ?? "",
          inspectorRemarkLayman: inspection.inspectorRemarkLayman ?? "",
          items: itemDrafts,
        });
        setHasLoaded(true);
      } catch (err: any) {
        if (!cancelled) {
          setLoadState({
            status: "error",
            data: null,
            error: "Failed to load inspection.",
          });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [companyId, inspectionId]);

  useEffect(() => {
    if (!hasLoaded || !draft) return;

    setSaveError(null);
    setIsSaving(true);

    const timeout = setTimeout(async () => {
      try {
        const body = {
          status: draft.status,
          healthEngine: draft.healthEngine,
          healthTransmission: draft.healthTransmission,
          healthBrakes: draft.healthBrakes,
          healthSuspension: draft.healthSuspension,
          healthElectrical: draft.healthElectrical,
          overallHealth: draft.overallHealth,
          inspectorRemark: draft.inspectorRemark,
          inspectorRemarkLayman: draft.inspectorRemarkLayman,
          draftPayload: {
            car: draft.car,
          },
          items: draft.items
            .filter((i) => i.partName && i.partName.trim().length > 0)
            .map((i, idx) => ({
              id: i.id,
              lineNo: i.lineNo ?? idx + 1,
              category: i.category ?? null,
              partName: i.partName ?? "",
              severity: i.severity ?? null,
              requiredAction: i.requiredAction ?? null,
              techReason: i.techReason ?? null,
              laymanReason: i.laymanReason ?? null,
              photoRefs: i.photoRefs ?? null,
            })),
        };

        const res = await fetch(`/api/company/${companyId}/workshop/inspections/${inspectionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setIsSaving(false);
        setLastSavedAt(new Date());
      } catch (err) {
        console.error(err);
        setIsSaving(false);
        setSaveError("Autosave failed");
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [draft, hasLoaded, companyId, inspectionId]);

  if (loadState.status === "loading" || !draft) {
    return (
      <MainPageShell title="Inspection" subtitle="Loading inspection…" scopeLabel="">
        <p className="text-sm text-muted-foreground">Loading inspection…</p>
      </MainPageShell>
    );
  }

  if (loadState.status === "error") {
    return (
      <MainPageShell title="Inspection" subtitle="Unable to load inspection" scopeLabel="">
        <p className="text-sm text-destructive">{loadState.error}</p>
      </MainPageShell>
    );
  }

  const { inspection } = loadState.data!;

  function updateCar<K extends keyof CarDetails>(key: K, value: string) {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            car: {
              ...prev.car,
              [key]: value,
            },
          }
        : prev
    );
  }

  function updateHealth(key: keyof DraftState, value: number) {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            [key]: value,
          }
        : prev
    );
  }

  function updateRemark(value: string) {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            inspectorRemark: value,
          }
        : prev
    );
  }

  function updateItem(index: number, patch: Partial<ItemDraft>) {
    setDraft((prev) => {
      if (!prev) return prev;
      const nextItems = [...prev.items];
      const current = nextItems[index];
      if (!current) return prev;
      nextItems[index] = {
        ...current,
        ...patch,
        partName: patch.partName ?? current.partName ?? "",
      };
      return { ...prev, items: nextItems };
    });
  }

  function addItem() {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            items: [
              ...prev.items,
              {
                partName: "",
              },
            ],
          }
        : prev
    );
  }

  function removeItem(index: number) {
    setDraft((prev) => {
      if (!prev) return prev;
      const nextItems = prev.items.filter((_, i) => i !== index);
      return { ...prev, items: nextItems };
    });
  }

  async function markCompleted() {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            status: "completed",
          }
        : prev
    );
  }

  const saveStatusText = saveError ? saveError : isSaving ? "Saving..." : lastSavedAt ? `Saved ${lastSavedAt.toLocaleTimeString()}` : "All changes saved";

  return (
    <MainPageShell
      title="Inspection"
      subtitle="Verify car details and record inspection findings."
      scopeLabel={`Inspection ID: ${inspection.id.slice(0, 8)}…`}
      primaryAction={
        <button type="button" onClick={markCompleted} className="rounded-md border px-3 py-1 text-sm font-medium">
          Mark Inspection Complete
        </button>
      }
      secondaryActions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              try {
                const res = await fetch(`/api/company/${companyId}/workshop/estimates`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ inspectionId }),
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = await res.json();
                const id: string = json.data?.estimate?.id ?? json.data?.id ?? json.data?.estimateId;
                if (id) {
                  window.location.href = `/company/${companyId}/workshop/estimates/${id}`;
                }
              } catch (err) {
                console.error("Failed to create estimate", err);
              }
            }}
            className="rounded-md border px-3 py-1 text-sm font-medium"
          >
            Create Estimate
          </button>
          <span className="text-xs text-muted-foreground">{saveStatusText}</span>
        </div>
      }
    >
      <div className="space-y-6">
        <section className="space-y-3 rounded-xl border p-4">
          <h2 className="text-sm font-semibold">Car details (check-in)</h2>
          <p className="text-xs text-muted-foreground">
            Loaded from the original lead. Verify and update if anything has changed.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <TextField label="Plate number" value={draft.car.plate ?? ""} onChange={(v) => updateCar("plate", v)} />
            <TextField label="Make" value={draft.car.make ?? ""} onChange={(v) => updateCar("make", v)} />
            <TextField label="Model" value={draft.car.model ?? ""} onChange={(v) => updateCar("model", v)} />
            <TextField label="Year" value={draft.car.year ?? ""} onChange={(v) => updateCar("year", v)} />
            <TextField label="VIN" value={draft.car.vin ?? ""} onChange={(v) => updateCar("vin", v)} />
            <TextField label="Mileage" value={draft.car.mileage ?? ""} onChange={(v) => updateCar("mileage", v)} placeholder="e.g. 123,456 km" />
            <TextField label="Tyre size (front)" value={draft.car.tyreFront ?? ""} onChange={(v) => updateCar("tyreFront", v)} />
            <TextField label="Tyre size (rear)" value={draft.car.tyreRear ?? ""} onChange={(v) => updateCar("tyreRear", v)} />
          </div>
        </section>

        <section className="space-y-3 rounded-xl border p-4">
          <h2 className="text-sm font-semibold">System health</h2>
          <p className="text-xs text-muted-foreground">Select approximate health (0–100) for each major system.</p>
          <div className="space-y-3">
            <HealthSlider label="Engine" value={draft.healthEngine ?? 100} onChange={(v) => updateHealth("healthEngine", v)} />
            <HealthSlider label="Transmission / Gearbox" value={draft.healthTransmission ?? 100} onChange={(v) => updateHealth("healthTransmission", v)} />
            <HealthSlider label="Brakes" value={draft.healthBrakes ?? 100} onChange={(v) => updateHealth("healthBrakes", v)} />
            <HealthSlider label="Suspension" value={draft.healthSuspension ?? 100} onChange={(v) => updateHealth("healthSuspension", v)} />
            <HealthSlider label="Electrical" value={draft.healthElectrical ?? 100} onChange={(v) => updateHealth("healthElectrical", v)} />
          </div>
        </section>

        <section className="space-y-3 rounded-xl border p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Inspection findings</h2>
              <p className="text-xs text-muted-foreground">
                Add one line per part or issue. Each line will later be converted into estimate items and a customer report.
              </p>
            </div>
            <button type="button" onClick={addItem} className="rounded-md border px-2 py-1 text-xs font-medium">
              Add line
            </button>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40 text-[11px] text-muted-foreground">
                  <th className="py-1 pl-2 pr-3 text-left">Part / area</th>
                  <th className="px-2 py-1 text-left">Severity</th>
                  <th className="px-2 py-1 text-left">Required action</th>
                  <th className="px-2 py-1 text-left">Why (technical)</th>
                  <th className="px-2 py-1 text-left">Why (for customer)</th>
                  <th className="px-2 py-1 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {draft.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-2 px-3 text-xs text-muted-foreground">
                      No findings added yet.
                    </td>
                  </tr>
                ) : (
                  draft.items.map((item, index) => (
                    <tr key={index} className="border-b last:border-0">
                      <td className="py-1 pl-2 pr-3 align-top">
                        <input
                          className="w-full rounded border bg-background px-2 py-1 text-xs"
                          value={item.partName}
                          onChange={(e) => updateItem(index, { partName: e.target.value })}
                          placeholder="e.g. Front brake pads"
                        />
                      </td>
                      <td className="px-2 py-1 align-top">
                        <select
                          className="w-full rounded border bg-background px-2 py-1 text-xs"
                          value={item.severity ?? ""}
                          onChange={(e) => updateItem(index, { severity: e.target.value })}
                        >
                          <option value="">—</option>
                          <option value="minor">Minor</option>
                          <option value="moderate">Moderate</option>
                          <option value="critical">Critical</option>
                        </select>
                      </td>
                      <td className="px-2 py-1 align-top">
                        <input
                          className="w-full rounded border bg-background px-2 py-1 text-xs"
                          value={item.requiredAction ?? ""}
                          onChange={(e) => updateItem(index, { requiredAction: e.target.value })}
                          placeholder="e.g. Replace / adjust / monitor"
                        />
                      </td>
                      <td className="px-2 py-1 align-top">
                        <textarea
                          className="h-16 w-full resize-none rounded border bg-background px-2 py-1 text-xs"
                          value={item.techReason ?? ""}
                          onChange={(e) => updateItem(index, { techReason: e.target.value })}
                          placeholder="Technical reason for this item."
                        />
                      </td>
                      <td className="px-2 py-1 align-top">
                        <textarea
                          className="h-16 w-full resize-none rounded border bg-background px-2 py-1 text-xs"
                          value={item.laymanReason ?? ""}
                          onChange={(e) => updateItem(index, { laymanReason: e.target.value })}
                          placeholder="Customer-friendly explanation (AI helper later)."
                        />
                      </td>
                      <td className="px-2 py-1 align-top">
                        <button type="button" onClick={() => removeItem(index)} className="rounded-md border px-2 py-1 text-[11px]">
                          Remove
                        </button>
                        <div className="mt-2 text-[10px] text-muted-foreground">Photo proof upload coming soon</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3 rounded-xl border p-4">
          <h2 className="text-sm font-semibold">Inspector remarks</h2>
          <p className="text-xs text-muted-foreground">
            Technical summary of inspection. AI will later generate a customer-friendly explanation.
          </p>
          <textarea
            className="h-32 w-full resize-none rounded border bg-background px-3 py-2 text-sm"
            value={draft.inspectorRemark ?? ""}
            onChange={(e) => updateRemark(e.target.value)}
            placeholder="Describe overall condition and important notes."
          />
          <p className="text-[11px] text-muted-foreground">
            Customer report (AI layman translation) will appear here in a later iteration.
          </p>
        </section>
      </div>
    </MainPageShell>
  );
}

type TextFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

function TextField({ label, value, onChange, placeholder }: TextFieldProps) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium">{label}</label>
      <input
        className="w-full rounded border bg-background px-2 py-1 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

type HealthSliderProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
};

function HealthSlider({ label, value, onChange }: HealthSliderProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{value}%</span>
      </div>
      <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" />
    </div>
  );
}
