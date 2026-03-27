"use client";

import React, { useEffect, useState } from "react";
import { MainPageShell } from "./MainPageShell";
import type { Inspection, InspectionItem, InspectionStatus } from "@repo/ai-core/workshop/inspections/types";
import { FileUploader } from "../components/FileUploader";

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
  collectCar?: {
    sourceType: "recovery" | "walkin" | "unknown";
    sourceMedia: Record<string, string>;
    latestReview?: any;
    logs?: Array<{
      id: string;
      source_type: string;
      has_difference: boolean;
      note?: string | null;
      reupload_media?: Record<string, string> | null;
      reviewed_at?: string | null;
    }>;
  };
};

const CATEGORY_ICONS: Record<string, string> = {
  engine: "🔧",
  transmission: "⚙️",
  brakes: "🛑",
  suspension: "🔩",
  steering: "🎯",
  electrical: "⚡",
  ac: "❄️",
  body: "🚗",
  interior: "💺",
  exhaust: "💨",
  fuel: "⛽",
  tyres: "🛞",
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
  const [collectDifferenceDecision, setCollectDifferenceDecision] = useState<"unset" | "no" | "yes">("unset");
  const [collectNote, setCollectNote] = useState("");
  const [collectReuploadMedia, setCollectReuploadMedia] = useState<Record<string, string | null>>({
    video: null,
    front: null,
    rear: null,
    right: null,
    left: null,
    cluster: null,
  });
  const [isSavingCollectStage, setIsSavingCollectStage] = useState(false);
  const [collectStageError, setCollectStageError] = useState<string | null>(null);

  // AI VIN decode state
  const [vinDecoding, setVinDecoding] = useState(false);
  const [vinDecodeResult, setVinDecodeResult] = useState<any>(null);
  const [vinDecodeError, setVinDecodeError] = useState<string | null>(null);
  const [vinBodyType, setVinBodyType] = useState<string | null>(null);

  // Part category picker state
  type PartCategoryTree = { id: string; name: string; icon: string | null; subcategories: { id: string; name: string; parts: { id: string; name: string }[] }[] };
  const [partCategories, setPartCategories] = useState<PartCategoryTree[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(null);
  const [partCatsLoaded, setPartCatsLoaded] = useState(false);

  // AI summary state
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<{ technical: string | null; customer: string | null } | null>(null);

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

        const collectCar = inspJson.data?.collectCar ?? null;

        setLoadState({
          status: "loaded",
          data: { inspection, items, carFromLead, collectCar },
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
        const latestReview = collectCar?.latestReview ?? null;
        if (latestReview?.completed) {
          setCollectDifferenceDecision(latestReview?.hasDifference ? "yes" : "no");
          setCollectNote(String(latestReview?.note ?? ""));
          const uploaded = (latestReview?.reuploadMedia ?? {}) as Record<string, string>;
          setCollectReuploadMedia({
            video: uploaded.video ?? null,
            front: uploaded.front ?? null,
            rear: uploaded.rear ?? null,
            right: uploaded.right ?? null,
            left: uploaded.left ?? null,
            cluster: uploaded.cluster ?? null,
          });
        } else {
          setCollectDifferenceDecision("unset");
          setCollectNote("");
          setCollectReuploadMedia({
            video: null,
            front: null,
            rear: null,
            right: null,
            left: null,
            cluster: null,
          });
        }
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

  // Load part categories
  useEffect(() => {
    if (partCatsLoaded) return;
    const make = draft?.car?.make || undefined;
    fetch(`/api/company/${companyId}/workshop/inspections/part-categories${make ? `?make=${encodeURIComponent(make)}` : ""}`)
      .then((r) => r.json())
      .then((json) => {
        setPartCategories(json.data ?? []);
        setPartCatsLoaded(true);
      })
      .catch(() => setPartCatsLoaded(true));
  }, [companyId, partCatsLoaded, draft?.car?.make]);

  useEffect(() => {
    const collectComplete = collectDifferenceDecision === "no" || collectDifferenceDecision === "yes";
    if (!hasLoaded || !draft || !collectComplete) return;

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
  }, [draft, hasLoaded, companyId, inspectionId, collectDifferenceDecision]);

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
  const collectCarSourceType = loadState.data?.collectCar?.sourceType ?? "unknown";
  const collectCarSourceMedia = loadState.data?.collectCar?.sourceMedia ?? {};
  const collectCarLogs = loadState.data?.collectCar?.logs ?? [];
  const collectStageCompleted = collectDifferenceDecision === "no" || collectDifferenceDecision === "yes";
  const hasAnyReupload =
    Object.values(collectReuploadMedia).some((id) => Boolean(String(id ?? "").trim()));
  const requiresReupload = collectDifferenceDecision === "yes";
  const canSaveCollectStage =
    collectDifferenceDecision !== "unset" && (!requiresReupload || hasAnyReupload);

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
    if (!collectStageCompleted) {
      setCollectStageError("Complete Collect Car stage first.");
      return;
    }
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            status: "completed",
          }
        : prev
    );
  }

  async function saveCollectCarStage() {
    if (!canSaveCollectStage) {
      setCollectStageError("Select difference status and upload recheck media when difference is found.");
      return;
    }
    setCollectStageError(null);
    setIsSavingCollectStage(true);
    try {
      const reuploadMedia =
        collectDifferenceDecision === "yes"
          ? Object.fromEntries(
              Object.entries(collectReuploadMedia).filter(([, value]) => String(value ?? "").trim())
            )
          : {};
      const res = await fetch(`/api/company/${companyId}/workshop/inspections/${inspectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "collect_car_review",
          hasDifference: collectDifferenceDecision === "yes",
          note: collectNote.trim() || null,
          reuploadMedia,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(json?.error ?? "Failed to save Collect Car stage."));
      setLastSavedAt(new Date());
      setCollectStageError(null);
    } catch (err: any) {
      setCollectStageError(err?.message ?? "Failed to save Collect Car stage.");
    } finally {
      setIsSavingCollectStage(false);
    }
  }

  const saveStatusText = saveError ? saveError : isSaving ? "Saving..." : lastSavedAt ? `Saved ${lastSavedAt.toLocaleTimeString()}` : "All changes saved";

  return (
    <MainPageShell
      title="Inspection"
      subtitle="Verify car details and record inspection findings."
      scopeLabel={`Inspection ID: ${inspection.id.slice(0, 8)}…`}
      primaryAction={
        <button
          type="button"
          onClick={markCompleted}
          disabled={!collectStageCompleted}
          className="rounded-md border px-3 py-1 text-sm font-medium disabled:opacity-60"
        >
          Mark Inspection Complete
        </button>
      }
      secondaryActions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!collectStageCompleted}
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
            className="rounded-md border px-3 py-1 text-sm font-medium disabled:opacity-60"
          >
            Create Estimate
          </button>
          <span className="text-xs text-muted-foreground">{saveStatusText}</span>
        </div>
      }
    >
      <div className="space-y-6">
        <section className="space-y-3 rounded-xl border p-4">
          <h2 className="text-sm font-semibold">Collect Car (Stage 1)</h2>
          <p className="text-xs text-muted-foreground">
            Compare intake media with the actual car before inspection starts.
          </p>
          <div className="rounded-md border bg-muted/20 p-3 text-xs">
            <div>
              Source:{" "}
              <span className="font-semibold uppercase">
                {collectCarSourceType === "recovery" ? "Recovery Pickup" : collectCarSourceType === "walkin" ? "Walk-in Check-in" : "Unknown"}
              </span>
            </div>
            <div className="mt-2 grid gap-1">
              {Object.entries(collectCarSourceMedia).length === 0 ? (
                <div className="text-muted-foreground">No source media found.</div>
              ) : (
                Object.entries(collectCarSourceMedia).map(([key, fileId]) => (
                  <a key={key} href={`/api/files/${fileId}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                    View source {key}
                  </a>
                ))
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="collect-diff"
                checked={collectDifferenceDecision === "no"}
                onChange={() => setCollectDifferenceDecision("no")}
              />
              No difference (car matches media)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="collect-diff"
                checked={collectDifferenceDecision === "yes"}
                onChange={() => setCollectDifferenceDecision("yes")}
              />
              Difference found
            </label>
          </div>

          {collectDifferenceDecision === "yes" ? (
            <div className="grid gap-3 md:grid-cols-2">
              <FileUploader label="Recheck Video" kind="video" value={collectReuploadMedia.video} onChange={(id) => setCollectReuploadMedia((prev) => ({ ...prev, video: id }))} />
              <FileUploader label="Recheck Front Image" kind="image" value={collectReuploadMedia.front} onChange={(id) => setCollectReuploadMedia((prev) => ({ ...prev, front: id }))} />
              <FileUploader label="Recheck Rear Image" kind="image" value={collectReuploadMedia.rear} onChange={(id) => setCollectReuploadMedia((prev) => ({ ...prev, rear: id }))} />
              <FileUploader label="Recheck Right Image" kind="image" value={collectReuploadMedia.right} onChange={(id) => setCollectReuploadMedia((prev) => ({ ...prev, right: id }))} />
              <FileUploader label="Recheck Left Image" kind="image" value={collectReuploadMedia.left} onChange={(id) => setCollectReuploadMedia((prev) => ({ ...prev, left: id }))} />
              <FileUploader label="Recheck Cluster Image" kind="image" value={collectReuploadMedia.cluster} onChange={(id) => setCollectReuploadMedia((prev) => ({ ...prev, cluster: id }))} />
            </div>
          ) : null}

          <textarea
            value={collectNote}
            onChange={(e) => setCollectNote(e.target.value)}
            placeholder="Optional note for collect-car verification"
            className="min-h-24 w-full rounded-md border px-3 py-2 text-sm"
          />
          {collectStageError ? <div className="text-xs text-destructive">{collectStageError}</div> : null}
          {collectCarLogs.length > 0 ? (
            <div className="rounded-md border bg-muted/20 p-3 text-xs">
              <div className="font-semibold">Recent Collect Car Logs</div>
              <div className="mt-2 space-y-1">
                {collectCarLogs.slice(0, 3).map((log) => (
                  <div key={log.id}>
                    {log.reviewed_at ? new Date(log.reviewed_at).toLocaleString() : "-"} - {log.has_difference ? "Difference" : "No difference"}
                    {log.note ? ` - ${log.note}` : ""}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <button type="button" onClick={saveCollectCarStage} disabled={isSavingCollectStage || !canSaveCollectStage} className="rounded-md border px-3 py-1 text-sm font-medium disabled:opacity-60">
            {isSavingCollectStage ? "Saving..." : collectStageCompleted ? "Update Collect Car" : "Save Collect Car"}
          </button>
        </section>

        <div className={collectStageCompleted ? "space-y-6" : "space-y-6 pointer-events-none opacity-60"}>
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
            <div className="space-y-1">
              <label className="text-xs font-medium">VIN</label>
              <div className="flex gap-2">
                <input
                  className="w-full rounded border bg-background px-2 py-1 text-sm"
                  value={draft.car.vin ?? ""}
                  onChange={(e) => updateCar("vin", e.target.value)}
                  placeholder="Enter 17-character VIN"
                />
                <button
                  type="button"
                  disabled={!draft.car.vin || draft.car.vin.length !== 17 || vinDecoding}
                  onClick={async () => {
                    setVinDecoding(true);
                    setVinDecodeError(null);
                    try {
                      const res = await fetch(`/api/company/${companyId}/workshop/inspections/${inspection.id}/ai-vin-decode`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ vin: draft.car.vin }),
                      });
                      const json = await res.json();
                      if (!res.ok) throw new Error(json.error ?? "Decode failed");
                      const d = json.data;
                      if (d.make) updateCar("make", d.make);
                      if (d.model) updateCar("model", d.model);
                      if (d.year) updateCar("year", String(d.year));
                      if (d.bodyType) setVinBodyType(d.bodyType);
                      setVinDecodeResult(d);
                    } catch (err: any) {
                      setVinDecodeError(err?.message ?? "VIN decode failed");
                    } finally {
                      setVinDecoding(false);
                    }
                  }}
                  className="whitespace-nowrap rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-60"
                >
                  {vinDecoding ? "Decoding..." : "Decode VIN"}
                </button>
              </div>
              {vinDecodeError && <div className="text-xs text-destructive">{vinDecodeError}</div>}
              {vinDecodeResult && (
                <div className="mt-1 rounded border bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground">
                  AI decoded: {[vinDecodeResult.make, vinDecodeResult.model, vinDecodeResult.year, vinDecodeResult.bodyType, vinDecodeResult.engineType, vinDecodeResult.fuelType].filter(Boolean).join(" · ")}
                  <span className="ml-1 text-[10px]">({vinDecodeResult.source})</span>
                </div>
              )}
            </div>
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

        {/* ===== GUIDED PART SELECTOR ===== */}
        <section className="space-y-3 rounded-xl border p-4">
          <div>
            <h2 className="text-sm font-semibold">Inspection Findings</h2>
            <p className="text-xs text-muted-foreground">
              Select parts by category. Tap a part to add it as a finding.
            </p>
          </div>

          {/* Category Grid (Level 1) */}
          {!selectedCategoryId && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {partCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className="flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition hover:border-primary hover:bg-primary/5"
                >
                  <span className="text-lg">{CATEGORY_ICONS[cat.icon ?? ""] ?? "🔧"}</span>
                  <span className="text-[11px] font-medium leading-tight">{cat.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Sub-category List (Level 2) */}
          {selectedCategoryId && !selectedSubcategoryId && (() => {
            const cat = partCategories.find((c) => c.id === selectedCategoryId);
            return (
              <div className="space-y-2">
                <button type="button" onClick={() => setSelectedCategoryId(null)} className="text-xs text-primary hover:underline">
                  ← Back to categories
                </button>
                <h3 className="text-xs font-semibold">{cat?.name}</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {(cat?.subcategories ?? []).map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setSelectedSubcategoryId(sub.id)}
                      className="rounded-lg border px-3 py-2 text-left text-xs font-medium transition hover:border-primary hover:bg-primary/5"
                    >
                      {sub.name}
                      <span className="ml-1 text-[10px] text-muted-foreground">({sub.parts?.length ?? 0})</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Part Picker (Level 3) */}
          {selectedCategoryId && selectedSubcategoryId && (() => {
            const cat = partCategories.find((c) => c.id === selectedCategoryId);
            const sub = cat?.subcategories?.find((s) => s.id === selectedSubcategoryId);
            return (
              <div className="space-y-2">
                <button type="button" onClick={() => setSelectedSubcategoryId(null)} className="text-xs text-primary hover:underline">
                  ← Back to {cat?.name}
                </button>
                <h3 className="text-xs font-semibold">{sub?.name}</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {(sub?.parts ?? []).map((part) => {
                    const alreadyAdded = draft.items.some((it) => it.partName === part.name);
                    return (
                      <button
                        key={part.id}
                        type="button"
                        disabled={alreadyAdded}
                        onClick={() => {
                          addItem();
                          setDraft((prev) => {
                            if (!prev) return prev;
                            const items = [...prev.items];
                            items[items.length - 1] = {
                              ...items[items.length - 1],
                              partName: part.name,
                              category: cat?.name ?? "",
                              severity: "moderate",
                              requiredAction: "Inspect / Replace",
                            };
                            return { ...prev, items };
                          });
                          // Reset picker to category level
                          setSelectedCategoryId(null);
                          setSelectedSubcategoryId(null);
                        }}
                        className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                          alreadyAdded ? "opacity-40" : "hover:border-primary hover:bg-primary/5"
                        }`}
                      >
                        {alreadyAdded ? "✓ " : "＋ "}{part.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Manual add fallback */}
          <div className="flex items-center gap-2 border-t pt-2">
            <button type="button" onClick={addItem} className="rounded-md border px-2 py-1 text-[11px] font-medium">
              + Add manually
            </button>
            <span className="text-[10px] text-muted-foreground">or select from categories above</span>
          </div>
        </section>

        {/* ===== FINDINGS LIST ===== */}
        <section className="space-y-3 rounded-xl border p-4">
          <h2 className="text-sm font-semibold">Findings ({draft.items.length})</h2>
          {draft.items.length === 0 ? (
            <p className="text-xs text-muted-foreground">No findings added yet. Select parts from the categories above.</p>
          ) : (
            <div className="space-y-2">
              {draft.items.map((item, index) => (
                <div key={index} className="flex items-center gap-2 rounded-lg border p-2">
                  <div className="min-w-0 flex-1">
                    <input
                      className="w-full rounded border-0 bg-transparent px-1 py-0.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                      value={item.partName}
                      onChange={(e) => updateItem(index, { partName: e.target.value })}
                      placeholder="Part name"
                    />
                    {item.category && <span className="ml-1 text-[10px] text-muted-foreground">{item.category}</span>}
                  </div>
                  {/* Severity toggle: 3 color-coded buttons */}
                  <div className="flex gap-1">
                    {(["minor", "moderate", "critical"] as const).map((sev) => (
                      <button
                        key={sev}
                        type="button"
                        onClick={() => updateItem(index, { severity: sev })}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition ${
                          item.severity === sev
                            ? sev === "minor" ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50"
                            : sev === "moderate" ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50"
                            : "bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/50"
                            : "bg-muted/30 text-muted-foreground hover:bg-muted/60"
                        }`}
                      >
                        {sev === "minor" ? "Good" : sev === "moderate" ? "Attention" : "Replace"}
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={() => removeItem(index)} className="rounded p-1 text-muted-foreground hover:text-destructive">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3 rounded-xl border p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Inspector remarks</h2>
              <p className="text-xs text-muted-foreground">
                Technical summary. AI can auto-generate from findings.
              </p>
            </div>
            <button
              type="button"
              disabled={aiSummaryLoading || draft.items.length === 0}
              onClick={async () => {
                setAiSummaryLoading(true);
                try {
                  const res = await fetch(`/api/company/${companyId}/workshop/inspections/${inspection.id}/ai-summary`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                  });
                  const json = await res.json();
                  if (!res.ok) throw new Error(json.error ?? "AI summary failed");
                  const d = json.data;
                  setAiSummary({ technical: d.technicalSummary, customer: d.customerSummary });
                  if (d.technicalSummary) updateRemark(d.technicalSummary);
                } catch {
                  // silent fail
                } finally {
                  setAiSummaryLoading(false);
                }
              }}
              className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-60"
            >
              {aiSummaryLoading ? "Generating..." : "Generate AI Summary"}
            </button>
          </div>
          <textarea
            className="h-32 w-full resize-none rounded border bg-background px-3 py-2 text-sm"
            value={draft.inspectorRemark ?? ""}
            onChange={(e) => updateRemark(e.target.value)}
            placeholder="Describe overall condition and important notes."
          />
          {aiSummary?.customer && (
            <div className="rounded-lg border bg-muted/20 p-3">
              <h3 className="text-xs font-semibold">Customer-Friendly Summary (AI)</h3>
              <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{aiSummary.customer}</p>
            </div>
          )}
        </section>
        </div>
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
