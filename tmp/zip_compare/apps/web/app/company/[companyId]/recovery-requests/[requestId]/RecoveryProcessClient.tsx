"use client";

import { useEffect, useMemo, useState } from "react";
import { DropzoneFileInput } from "@repo/ui/components/common/DropzoneFileInput";

type RecoveryRequestData = {
  id: string;
  status?: string | null;
  stage?: string | null;
  createdAt?: string | null;
  pickupLocation?: string | null;
  dropoffLocation?: string | null;
  type?: string | null;
  agentName?: string | null;
  agentPhone?: string | null;
  agentCarPlate?: string | null;
  acceptedAt?: string | null;
  pickupReachedAt?: string | null;
  pickupFromCustomer?: boolean | null;
  pickupTermsSharedAt?: string | null;
  pickupTermsConfirmedAt?: string | null;
  pickupVideo?: string | null;
  pickupFrontImage?: string | null;
  pickupRearImage?: string | null;
  pickupRightImage?: string | null;
  pickupLeftImage?: string | null;
  pickupClusterImage?: string | null;
  pickupRemarks?: string | null;
  pickupCompletedAt?: string | null;
  dropoffReachedAt?: string | null;
  dropoffVideo?: string | null;
  dropoffFrontImage?: string | null;
  dropoffRearImage?: string | null;
  dropoffRightImage?: string | null;
  dropoffLeftImage?: string | null;
  dropoffClusterImage?: string | null;
  dropoffRemarks?: string | null;
  completedAt?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  carPlateNumber?: string | null;
  carMake?: string | null;
  carModel?: string | null;
};

type Props = {
  companyId: string;
  request: RecoveryRequestData;
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function buildNavigationUrl(rawLocation?: string | null): string | null {
  const value = String(rawLocation ?? "").trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`;
}

export default function RecoveryProcessClient({ request, companyId }: Props) {
  const [current, setCurrent] = useState<RecoveryRequestData>(request);
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [agentName, setAgentName] = useState(request.agentName ?? "");
  const [agentPhone, setAgentPhone] = useState(request.agentPhone ?? "");
  const [carPlate, setCarPlate] = useState(request.agentCarPlate ?? request.carPlateNumber ?? "");
  const [pickupFromCustomer, setPickupFromCustomer] = useState<boolean>(
    request.pickupFromCustomer ?? false
  );
  const [pickupRemarks, setPickupRemarks] = useState(request.pickupRemarks ?? "");
  const [dropoffRemarks, setDropoffRemarks] = useState(request.dropoffRemarks ?? "");
  const [pickupFile, setPickupFile] = useState<File | null>(null);
  const [dropoffFile, setDropoffFile] = useState<File | null>(null);
  const [pickupFrontImageFile, setPickupFrontImageFile] = useState<File | null>(null);
  const [pickupRearImageFile, setPickupRearImageFile] = useState<File | null>(null);
  const [pickupRightImageFile, setPickupRightImageFile] = useState<File | null>(null);
  const [pickupLeftImageFile, setPickupLeftImageFile] = useState<File | null>(null);
  const [pickupClusterImageFile, setPickupClusterImageFile] = useState<File | null>(null);
  const [dropoffFrontImageFile, setDropoffFrontImageFile] = useState<File | null>(null);
  const [dropoffRearImageFile, setDropoffRearImageFile] = useState<File | null>(null);
  const [dropoffRightImageFile, setDropoffRightImageFile] = useState<File | null>(null);
  const [dropoffLeftImageFile, setDropoffLeftImageFile] = useState<File | null>(null);
  const [dropoffClusterImageFile, setDropoffClusterImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [preInspection, setPreInspection] = useState<{
    formId: string;
    status: "pending" | "submitted";
    formUrl: string;
  } | null>(null);
  const [preInspectionLoading, setPreInspectionLoading] = useState(false);
  const [shareBusy, setShareBusy] = useState<Record<string, boolean>>({});

  const canContinue =
    agentName.trim().length > 0 && agentPhone.trim().length > 0 && carPlate.trim().length > 0;

  const accepted = Boolean(current.acceptedAt);
  const pickupReached = Boolean(current.pickupReachedAt);
  const termsShared = Boolean(current.pickupTermsSharedAt);
  const termsConfirmed = Boolean(current.pickupTermsConfirmedAt);
  const pickupVideoReady = Boolean(current.pickupVideo);
  const pickupFrontImageReady = Boolean(current.pickupFrontImage);
  const pickupRearImageReady = Boolean(current.pickupRearImage);
  const pickupRightImageReady = Boolean(current.pickupRightImage);
  const pickupLeftImageReady = Boolean(current.pickupLeftImage);
  const pickupClusterImageReady = Boolean(current.pickupClusterImage);
  const pickupDone = Boolean(current.pickupCompletedAt);
  const dropoffReached = Boolean(current.dropoffReachedAt);
  const dropoffVideoReady = Boolean(current.dropoffVideo);
  const dropoffFrontImageReady = Boolean(current.dropoffFrontImage);
  const dropoffRearImageReady = Boolean(current.dropoffRearImage);
  const dropoffRightImageReady = Boolean(current.dropoffRightImage);
  const dropoffLeftImageReady = Boolean(current.dropoffLeftImage);
  const dropoffClusterImageReady = Boolean(current.dropoffClusterImage);
  const dropoffDone = Boolean(current.completedAt);
  const preInspectionPending = preInspection?.status === "pending";
  const processBlockedByPreInspection = Boolean(preInspectionPending);
  const isPickupType = `${current.type ?? ""}`.toLowerCase() === "pickup";
  const pickupNavUrl = useMemo(() => buildNavigationUrl(current.pickupLocation), [current.pickupLocation]);
  const dropoffNavUrl = useMemo(() => buildNavigationUrl(current.dropoffLocation), [current.dropoffLocation]);

  const carLabel = useMemo(
    () => [current.carMake, current.carModel].filter(Boolean).join(" ") || "Car",
    [current.carMake, current.carModel]
  );

  async function callAction(action: string, payload: Record<string, any> = {}) {
    setSaving(action);
    setMessage(null);
    try {
      const res = await fetch(`/api/public/recovery-requests/${current.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, action, ...payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to update");
      setCurrent((prev) => ({
        ...prev,
        ...mapFromApi(data?.data ?? {}),
      }));
      setMessage("Saved.");
    } catch (err: any) {
      setMessage(err?.message ?? "Update failed.");
    } finally {
      setSaving(null);
    }
  }

  async function loadPreInspectionForm() {
    setPreInspectionLoading(true);
    try {
      const res = await fetch(`/api/company/${companyId}/recovery-requests/${current.id}/form-link`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error ?? "Failed to load pre-inspection form"));
      const row = data?.data ?? null;
      if (!row?.formId) {
        setPreInspection(null);
      } else {
        setPreInspection({
          formId: String(row.formId),
          status: String(row.status ?? "pending") === "submitted" ? "submitted" : "pending",
          formUrl: String(row.formUrl ?? "").trim(),
        });
      }
    } catch {
      setPreInspection(null);
    } finally {
      setPreInspectionLoading(false);
    }
  }

  async function copyPreInspectionForm() {
    const key = "copy";
    setShareBusy((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(`/api/company/${companyId}/recovery-requests/${current.id}/form-link`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error ?? "Failed to load pre-inspection form"));
      const url = String(data?.data?.formUrl ?? preInspection?.formUrl ?? "").trim();
      if (!url) throw new Error("Form URL not found");
      const absolute = url.startsWith("http") ? url : `${window.location.origin}${url}`;
      await navigator.clipboard.writeText(absolute);
      setMessage("Pre-inspection form link copied.");
      await loadPreInspectionForm();
    } catch (err: any) {
      setMessage(err?.message ?? "Failed to copy pre-inspection form link.");
    } finally {
      setShareBusy((prev) => ({ ...prev, [key]: false }));
    }
  }

  async function sharePreInspectionForm(channel: "sms" | "whatsapp" | "email") {
    const key = `share:${channel}`;
    setShareBusy((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(`/api/company/${companyId}/recovery-requests/${current.id}/form-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, reason: "direct", force: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error ?? "Failed to share pre-inspection form"));
      if (data?.data?.sent) {
        setMessage(`Pre-inspection form shared via ${channel}.`);
      } else {
        setMessage(`Share skipped: ${String(data?.data?.skippedReason ?? "unknown_reason")}`);
      }
      await loadPreInspectionForm();
    } catch (err: any) {
      setMessage(err?.message ?? `Failed to share via ${channel}.`);
    } finally {
      setShareBusy((prev) => ({ ...prev, [key]: false }));
    }
  }

  function mapFromApi(row: any): RecoveryRequestData {
    return {
      id: row.id ?? current.id,
      status: row.status ?? null,
      stage: row.stage ?? null,
      createdAt: row.created_at ?? row.createdAt ?? null,
      pickupLocation: row.pickup_location ?? row.pickupLocation ?? null,
      dropoffLocation: row.dropoff_location ?? row.dropoffLocation ?? null,
      type: row.type ?? null,
      agentName: row.agent_name ?? row.agentName ?? null,
      agentPhone: row.agent_phone ?? row.agentPhone ?? null,
      agentCarPlate: row.agent_car_plate ?? row.agentCarPlate ?? null,
      acceptedAt: row.accepted_at ?? row.acceptedAt ?? null,
      pickupReachedAt: row.pickup_reached_at ?? row.pickupReachedAt ?? null,
      pickupFromCustomer: row.pickup_from_customer ?? row.pickupFromCustomer ?? false,
      pickupTermsSharedAt: row.pickup_terms_shared_at ?? row.pickupTermsSharedAt ?? null,
      pickupTermsConfirmedAt: row.pickup_terms_confirmed_at ?? row.pickupTermsConfirmedAt ?? null,
      pickupVideo: row.pickup_video ?? row.pickupVideo ?? null,
      pickupFrontImage: row.pickup_front_image ?? row.pickupFrontImage ?? null,
      pickupRearImage: row.pickup_rear_image ?? row.pickupRearImage ?? null,
      pickupRightImage: row.pickup_right_image ?? row.pickupRightImage ?? null,
      pickupLeftImage: row.pickup_left_image ?? row.pickupLeftImage ?? null,
      pickupClusterImage: row.pickup_cluster_image ?? row.pickupClusterImage ?? null,
      pickupRemarks: row.pickup_remarks ?? row.pickupRemarks ?? null,
      pickupCompletedAt: row.pickup_completed_at ?? row.pickupCompletedAt ?? null,
      dropoffReachedAt: row.dropoff_reached_at ?? row.dropoffReachedAt ?? null,
      dropoffVideo: row.dropoff_video ?? row.dropoffVideo ?? null,
      dropoffFrontImage: row.dropoff_front_image ?? row.dropoffFrontImage ?? null,
      dropoffRearImage: row.dropoff_rear_image ?? row.dropoffRearImage ?? null,
      dropoffRightImage: row.dropoff_right_image ?? row.dropoffRightImage ?? null,
      dropoffLeftImage: row.dropoff_left_image ?? row.dropoffLeftImage ?? null,
      dropoffClusterImage: row.dropoff_cluster_image ?? row.dropoffClusterImage ?? null,
      dropoffRemarks: row.dropoff_remarks ?? row.dropoffRemarks ?? null,
      completedAt: row.completed_at ?? row.completedAt ?? null,
      customerName: row.customer_name ?? row.customerName ?? null,
      customerPhone: row.customer_phone ?? row.customerPhone ?? null,
      carPlateNumber: row.car_plate_number ?? row.carPlateNumber ?? null,
      carMake: row.car_make ?? row.carMake ?? null,
      carModel: row.car_model ?? row.carModel ?? null,
    };
  }

  async function uploadFile(file: File | null, kind: "video" | "image"): Promise<string | null> {
    if (!file) return null;
    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);
    form.append("scope", "company");
    form.append("companyId", companyId);
    const res = await fetch("/api/files/upload", {
      method: "POST",
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error ?? "Upload failed");
    return data?.fileId ?? null;
  }

  useEffect(() => {
    if (current.completedAt) {
      setStep(5);
      return;
    }
    if (current.pickupCompletedAt) {
      setStep(4);
      return;
    }
    if (current.acceptedAt) {
      setStep(3);
      return;
    }
  }, [current.acceptedAt, current.pickupCompletedAt, current.completedAt]);

  useEffect(() => {
    if (!current.acceptedAt) return;
    void loadPreInspectionForm();
  }, [current.id, current.acceptedAt]);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm uppercase tracking-wide text-slate-500">Recovery Request</div>
              <div className="text-2xl font-semibold">#{current.id.slice(0, 8)}</div>
              <div className="text-xs text-slate-500">Created {formatDate(current.createdAt)}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold">
                {current.status ?? "Pending"}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold">
                {current.stage ?? "New"}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-semibold">Customer</div>
            <div className="mt-2 text-base font-semibold">{current.customerName ?? "Unknown"}</div>
            <div className="text-sm text-slate-600">{current.customerPhone ?? "-"}</div>
            <div className="mt-4 text-sm font-semibold">Car</div>
            <div className="text-sm text-slate-700">{current.carPlateNumber ?? "-"}</div>
            <div className="text-xs text-slate-500">{carLabel}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-semibold">Steps</div>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <div className={step === 1 ? "font-semibold text-slate-900" : ""}>1) Agent details</div>
              <div className={step === 2 ? "font-semibold text-slate-900" : ""}>2) Accept request</div>
              <div className={step === 3 ? "font-semibold text-slate-900" : ""}>3) Pickup</div>
              <div className={step === 4 ? "font-semibold text-slate-900" : ""}>4) Dropoff</div>
              <div className={step === 5 ? "font-semibold text-slate-900" : ""}>5) Done</div>
            </div>
            {message && <div className="mt-3 text-xs text-slate-500">{message}</div>}
          </div>
        </div>

        {step === 1 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-semibold">Agent Details</div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600">Name</label>
                <input
                  type="text"
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="Agent name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600">Mobile No</label>
                <input
                  type="text"
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  value={agentPhone}
                  onChange={(e) => setAgentPhone(e.target.value)}
                  placeholder="+971..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600">Car Plate</label>
                <input
                  type="text"
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  value={carPlate}
                  onChange={(e) => setCarPlate(e.target.value)}
                  placeholder="DXB-A-1234"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-60"
                disabled={!canContinue}
                onClick={async () => {
                  await callAction("save_agent", {
                    agentName,
                    agentPhone,
                    agentCarPlate: carPlate,
                  });
                  setStep(2);
                }}
              >
                {saving === "save_agent" ? "Saving..." : "Continue"}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-semibold">Accept Request</div>
            <div className="mt-2 text-sm text-slate-600">
              Accept the recovery request to unlock pickup details.
            </div>
            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                className="rounded-md border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700"
                onClick={() => setStep(1)}
              >
                Back
              </button>
              <button
                type="button"
                className="rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-60"
                disabled={!canContinue || accepted}
                onClick={async () => {
                  await callAction("accept");
                  setStep(3);
                }}
              >
                {accepted ? "Accepted" : saving === "accept" ? "Accepting..." : "Accept Request"}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div>
              <div className="text-sm font-semibold">Pickup Location</div>
              <div className="mt-2 text-sm text-slate-700">{current.pickupLocation ?? "-"}</div>
              {pickupNavUrl && (
                <a
                  href={pickupNavUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50"
                >
                  Navigate Pickup
                </a>
              )}
            </div>
            {processBlockedByPreInspection ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2">
                <div className="text-sm font-semibold text-amber-800">
                  Pre-inspection form is pending. Recovery process is blocked until submission.
                </div>
                {preInspection?.formUrl ? (
                  <a
                    href={preInspection.formUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800 hover:bg-amber-100"
                  >
                    Open Form
                  </a>
                ) : (
                  <div className="text-xs text-amber-700">{preInspectionLoading ? "Loading form..." : "Form link unavailable."}</div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void loadPreInspectionForm()}
                    disabled={preInspectionLoading}
                    className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800 disabled:opacity-60"
                  >
                    {preInspectionLoading ? "Refreshing..." : "Refresh Status"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyPreInspectionForm()}
                    disabled={Boolean(shareBusy["copy"])}
                    className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800 disabled:opacity-60"
                  >
                    {shareBusy["copy"] ? "Copying..." : "Copy"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void sharePreInspectionForm("sms")}
                    disabled={Boolean(shareBusy["share:sms"])}
                    className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800 disabled:opacity-60"
                  >
                    {shareBusy["share:sms"] ? "..." : "SMS"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void sharePreInspectionForm("whatsapp")}
                    disabled={Boolean(shareBusy["share:whatsapp"])}
                    className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800 disabled:opacity-60"
                  >
                    {shareBusy["share:whatsapp"] ? "..." : "WhatsApp"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void sharePreInspectionForm("email")}
                    disabled={Boolean(shareBusy["share:email"])}
                    className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800 disabled:opacity-60"
                  >
                    {shareBusy["share:email"] ? "..." : "Email"}
                  </button>
                </div>
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="rounded-md border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700"
                onClick={() => setStep(2)}
              >
                Back
              </button>
              <button
                type="button"
                className="rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-60"
                disabled={!accepted || pickupReached || processBlockedByPreInspection}
                onClick={async () => {
                  await callAction("reach_pickup");
                }}
              >
                {pickupReached ? "Reached" : saving === "reach_pickup" ? "Saving..." : "Reach Pickup"}
              </button>
            </div>

            {isPickupType && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>Pickup From Customer Location</span>
                  <input
                    type="checkbox"
                    checked={pickupFromCustomer}
                    onChange={async (e) => {
                      if (processBlockedByPreInspection) return;
                      setPickupFromCustomer(e.target.checked);
                      await callAction("set_pickup_from_customer", {
                        pickupFromCustomer: e.target.checked,
                      });
                    }}
                    disabled={processBlockedByPreInspection}
                  />
                </div>
                {pickupFromCustomer && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 disabled:opacity-60"
                      disabled={!pickupReached || termsShared || processBlockedByPreInspection}
                      onClick={() => callAction("share_terms")}
                    >
                      {termsShared ? "Terms Shared" : saving === "share_terms" ? "Sharing..." : "Share Terms"}
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 disabled:opacity-60"
                      disabled={!termsShared || termsConfirmed || processBlockedByPreInspection}
                      onClick={() => callAction("confirm_terms")}
                    >
                      {termsConfirmed ? "Signed" : saving === "confirm_terms" ? "Saving..." : "Customer Signed"}
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
              <div className="text-sm font-semibold">Pickup Evidence</div>
              <DropzoneFileInput
                accept={{ "video/*": [] }}
                onFileSelect={(file) => setPickupFile(file)}
                selectedFileName={pickupFile?.name ?? undefined}
                idleText="Drag and drop a video"
                activeText="Drop video here"
                buttonText="Browse"
              />
              <div className="grid gap-3 md:grid-cols-2">
                <DropzoneFileInput
                  accept={{ "image/*": [] }}
                  onFileSelect={(file) => setPickupFrontImageFile(file)}
                  selectedFileName={pickupFrontImageFile?.name ?? current.pickupFrontImage ?? undefined}
                  idleText="Front image"
                  activeText="Drop front image"
                  buttonText="Browse"
                />
                <DropzoneFileInput
                  accept={{ "image/*": [] }}
                  onFileSelect={(file) => setPickupRearImageFile(file)}
                  selectedFileName={pickupRearImageFile?.name ?? current.pickupRearImage ?? undefined}
                  idleText="Rear image"
                  activeText="Drop rear image"
                  buttonText="Browse"
                />
                <DropzoneFileInput
                  accept={{ "image/*": [] }}
                  onFileSelect={(file) => setPickupRightImageFile(file)}
                  selectedFileName={pickupRightImageFile?.name ?? current.pickupRightImage ?? undefined}
                  idleText="Right image"
                  activeText="Drop right image"
                  buttonText="Browse"
                />
                <DropzoneFileInput
                  accept={{ "image/*": [] }}
                  onFileSelect={(file) => setPickupLeftImageFile(file)}
                  selectedFileName={pickupLeftImageFile?.name ?? current.pickupLeftImage ?? undefined}
                  idleText="Left image"
                  activeText="Drop left image"
                  buttonText="Browse"
                />
                <DropzoneFileInput
                  accept={{ "image/*": [] }}
                  onFileSelect={(file) => setPickupClusterImageFile(file)}
                  selectedFileName={pickupClusterImageFile?.name ?? current.pickupClusterImage ?? undefined}
                  idleText="Cluster image"
                  activeText="Drop cluster image"
                  buttonText="Browse"
                />
              </div>
              <textarea
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                placeholder="Pickup remarks"
                rows={3}
                value={pickupRemarks}
                onChange={(e) => setPickupRemarks(e.target.value)}
              />
              <button
                type="button"
                className="rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-60"
                disabled={
                  !pickupReached ||
                  processBlockedByPreInspection ||
                  (pickupFromCustomer && !termsConfirmed) ||
                  (!pickupFile && !pickupVideoReady) ||
                  (!pickupFrontImageFile && !pickupFrontImageReady) ||
                  (!pickupRearImageFile && !pickupRearImageReady) ||
                  (!pickupRightImageFile && !pickupRightImageReady) ||
                  (!pickupLeftImageFile && !pickupLeftImageReady) ||
                  (!pickupClusterImageFile && !pickupClusterImageReady)
                }
                onClick={async () => {
                  const fileId = pickupFile ? await uploadFile(pickupFile, "video") : current.pickupVideo ?? null;
                  const frontImageId = pickupFrontImageFile
                    ? await uploadFile(pickupFrontImageFile, "image")
                    : current.pickupFrontImage ?? null;
                  const rearImageId = pickupRearImageFile
                    ? await uploadFile(pickupRearImageFile, "image")
                    : current.pickupRearImage ?? null;
                  const rightImageId = pickupRightImageFile
                    ? await uploadFile(pickupRightImageFile, "image")
                    : current.pickupRightImage ?? null;
                  const leftImageId = pickupLeftImageFile
                    ? await uploadFile(pickupLeftImageFile, "image")
                    : current.pickupLeftImage ?? null;
                  const clusterImageId = pickupClusterImageFile
                    ? await uploadFile(pickupClusterImageFile, "image")
                    : current.pickupClusterImage ?? null;
                  await callAction("upload_pickup", {
                    pickupVideo: fileId ?? undefined,
                    pickupFrontImage: frontImageId ?? undefined,
                    pickupRearImage: rearImageId ?? undefined,
                    pickupRightImage: rightImageId ?? undefined,
                    pickupLeftImage: leftImageId ?? undefined,
                    pickupClusterImage: clusterImageId ?? undefined,
                    pickupRemarks,
                  });
                }}
              >
                {saving === "upload_pickup" ? "Saving..." : "Save Pickup Evidence"}
              </button>
              {current.pickupVideo && (
                <a className="text-xs text-primary underline" href={`/api/files/${current.pickupVideo}`}>
                  View pickup video
                </a>
              )}
              <div className="grid gap-1 text-xs text-slate-600">
                {current.pickupFrontImage ? (
                  <a className="text-primary underline" href={`/api/files/${current.pickupFrontImage}`}>View front image</a>
                ) : null}
                {current.pickupRearImage ? (
                  <a className="text-primary underline" href={`/api/files/${current.pickupRearImage}`}>View rear image</a>
                ) : null}
                {current.pickupRightImage ? (
                  <a className="text-primary underline" href={`/api/files/${current.pickupRightImage}`}>View right image</a>
                ) : null}
                {current.pickupLeftImage ? (
                  <a className="text-primary underline" href={`/api/files/${current.pickupLeftImage}`}>View left image</a>
                ) : null}
                {current.pickupClusterImage ? (
                  <a className="text-primary underline" href={`/api/files/${current.pickupClusterImage}`}>View cluster image</a>
                ) : null}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                className="rounded-md border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700"
                onClick={() => setStep(2)}
              >
                Back
              </button>
              <button
                type="button"
                className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-60"
                disabled={
                  processBlockedByPreInspection ||
                  !pickupVideoReady ||
                  !pickupFrontImageReady ||
                  !pickupRearImageReady ||
                  !pickupRightImageReady ||
                  !pickupLeftImageReady ||
                  !pickupClusterImageReady ||
                  pickupDone
                }
                onClick={async () => {
                  await callAction("pickup_done");
                  setStep(4);
                }}
              >
                {pickupDone ? "Picked Up" : saving === "pickup_done" ? "Saving..." : "Car Picked Up"}
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div>
              <div className="text-sm font-semibold">Dropoff Location</div>
              <div className="mt-2 text-sm text-slate-700">{current.dropoffLocation ?? "-"}</div>
              {dropoffNavUrl && (
                <a
                  href={dropoffNavUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50"
                >
                  Navigate Dropoff
                </a>
              )}
            </div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="rounded-md border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700"
                onClick={() => setStep(3)}
              >
                Back
              </button>
              <button
                type="button"
                className="rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-60"
                disabled={!pickupDone || dropoffReached || processBlockedByPreInspection}
                onClick={() => callAction("reach_dropoff")}
              >
                {dropoffReached ? "Reached" : saving === "reach_dropoff" ? "Saving..." : "Reach Dropoff"}
              </button>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
              <div className="text-sm font-semibold">Dropoff Evidence</div>
              <DropzoneFileInput
                accept={{ "video/*": [] }}
                onFileSelect={(file) => setDropoffFile(file)}
                selectedFileName={dropoffFile?.name ?? undefined}
                idleText="Drag and drop a video"
                activeText="Drop video here"
                buttonText="Browse"
              />
              <div className="grid gap-3 md:grid-cols-2">
                <DropzoneFileInput
                  accept={{ "image/*": [] }}
                  onFileSelect={(file) => setDropoffFrontImageFile(file)}
                  selectedFileName={dropoffFrontImageFile?.name ?? current.dropoffFrontImage ?? undefined}
                  idleText="Front image"
                  activeText="Drop front image"
                  buttonText="Browse"
                />
                <DropzoneFileInput
                  accept={{ "image/*": [] }}
                  onFileSelect={(file) => setDropoffRearImageFile(file)}
                  selectedFileName={dropoffRearImageFile?.name ?? current.dropoffRearImage ?? undefined}
                  idleText="Rear image"
                  activeText="Drop rear image"
                  buttonText="Browse"
                />
                <DropzoneFileInput
                  accept={{ "image/*": [] }}
                  onFileSelect={(file) => setDropoffRightImageFile(file)}
                  selectedFileName={dropoffRightImageFile?.name ?? current.dropoffRightImage ?? undefined}
                  idleText="Right image"
                  activeText="Drop right image"
                  buttonText="Browse"
                />
                <DropzoneFileInput
                  accept={{ "image/*": [] }}
                  onFileSelect={(file) => setDropoffLeftImageFile(file)}
                  selectedFileName={dropoffLeftImageFile?.name ?? current.dropoffLeftImage ?? undefined}
                  idleText="Left image"
                  activeText="Drop left image"
                  buttonText="Browse"
                />
                <DropzoneFileInput
                  accept={{ "image/*": [] }}
                  onFileSelect={(file) => setDropoffClusterImageFile(file)}
                  selectedFileName={dropoffClusterImageFile?.name ?? current.dropoffClusterImage ?? undefined}
                  idleText="Cluster image"
                  activeText="Drop cluster image"
                  buttonText="Browse"
                />
              </div>
              <textarea
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                placeholder="Dropoff remarks"
                rows={3}
                value={dropoffRemarks}
                onChange={(e) => setDropoffRemarks(e.target.value)}
              />
              <button
                type="button"
                className="rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-60"
                disabled={
                  !dropoffReached ||
                  processBlockedByPreInspection ||
                  (!dropoffFile && !dropoffVideoReady) ||
                  (!dropoffFrontImageFile && !dropoffFrontImageReady) ||
                  (!dropoffRearImageFile && !dropoffRearImageReady) ||
                  (!dropoffRightImageFile && !dropoffRightImageReady) ||
                  (!dropoffLeftImageFile && !dropoffLeftImageReady) ||
                  (!dropoffClusterImageFile && !dropoffClusterImageReady)
                }
                onClick={async () => {
                  const fileId = dropoffFile ? await uploadFile(dropoffFile, "video") : current.dropoffVideo ?? null;
                  const frontImageId = dropoffFrontImageFile
                    ? await uploadFile(dropoffFrontImageFile, "image")
                    : current.dropoffFrontImage ?? null;
                  const rearImageId = dropoffRearImageFile
                    ? await uploadFile(dropoffRearImageFile, "image")
                    : current.dropoffRearImage ?? null;
                  const rightImageId = dropoffRightImageFile
                    ? await uploadFile(dropoffRightImageFile, "image")
                    : current.dropoffRightImage ?? null;
                  const leftImageId = dropoffLeftImageFile
                    ? await uploadFile(dropoffLeftImageFile, "image")
                    : current.dropoffLeftImage ?? null;
                  const clusterImageId = dropoffClusterImageFile
                    ? await uploadFile(dropoffClusterImageFile, "image")
                    : current.dropoffClusterImage ?? null;
                  await callAction("upload_dropoff", {
                    dropoffVideo: fileId ?? undefined,
                    dropoffFrontImage: frontImageId ?? undefined,
                    dropoffRearImage: rearImageId ?? undefined,
                    dropoffRightImage: rightImageId ?? undefined,
                    dropoffLeftImage: leftImageId ?? undefined,
                    dropoffClusterImage: clusterImageId ?? undefined,
                    dropoffRemarks,
                  });
                }}
              >
                {saving === "upload_dropoff" ? "Saving..." : "Save Dropoff Evidence"}
              </button>
              {current.dropoffVideo && (
                <a className="text-xs text-primary underline" href={`/api/files/${current.dropoffVideo}`}>
                  View dropoff video
                </a>
              )}
              <div className="grid gap-1 text-xs text-slate-600">
                {current.dropoffFrontImage ? (
                  <a className="text-primary underline" href={`/api/files/${current.dropoffFrontImage}`}>View front image</a>
                ) : null}
                {current.dropoffRearImage ? (
                  <a className="text-primary underline" href={`/api/files/${current.dropoffRearImage}`}>View rear image</a>
                ) : null}
                {current.dropoffRightImage ? (
                  <a className="text-primary underline" href={`/api/files/${current.dropoffRightImage}`}>View right image</a>
                ) : null}
                {current.dropoffLeftImage ? (
                  <a className="text-primary underline" href={`/api/files/${current.dropoffLeftImage}`}>View left image</a>
                ) : null}
                {current.dropoffClusterImage ? (
                  <a className="text-primary underline" href={`/api/files/${current.dropoffClusterImage}`}>View cluster image</a>
                ) : null}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                className="rounded-md border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700"
                onClick={() => setStep(3)}
              >
                Back
              </button>
              <button
                type="button"
                className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-60"
                disabled={
                  processBlockedByPreInspection ||
                  !dropoffVideoReady ||
                  !dropoffFrontImageReady ||
                  !dropoffRearImageReady ||
                  !dropoffRightImageReady ||
                  !dropoffLeftImageReady ||
                  !dropoffClusterImageReady ||
                  dropoffDone
                }
                onClick={async () => {
                  await callAction("dropoff_done");
                  setStep(5);
                }}
              >
                {dropoffDone ? "Dropped Off" : saving === "dropoff_done" ? "Saving..." : "Car Dropped Off"}
              </button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-700 shadow-sm">
            <div className="text-lg font-semibold">Recovery Completed</div>
            <div className="text-sm">Thanks! The recovery request is marked as done.</div>
          </div>
        )}
      </div>
    </div>
  );
}
