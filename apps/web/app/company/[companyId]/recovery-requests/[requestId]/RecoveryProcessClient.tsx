"use client";

import { useEffect, useMemo, useState } from "react";

type RecoveryRequestData = {
  id: string;
  status?: string | null;
  stage?: string | null;
  createdAt?: string | null;
  pickupLocation?: string | null;
  dropoffLocation?: string | null;
  agentName?: string | null;
  agentPhone?: string | null;
  agentCarPlate?: string | null;
  acceptedAt?: string | null;
  pickupReachedAt?: string | null;
  pickupFromCustomer?: boolean | null;
  pickupTermsSharedAt?: string | null;
  pickupTermsConfirmedAt?: string | null;
  pickupVideo?: string | null;
  pickupRemarks?: string | null;
  pickupCompletedAt?: string | null;
  dropoffReachedAt?: string | null;
  dropoffVideo?: string | null;
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
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const canContinue =
    agentName.trim().length > 0 && agentPhone.trim().length > 0 && carPlate.trim().length > 0;

  const accepted = Boolean(current.acceptedAt);
  const pickupReached = Boolean(current.pickupReachedAt);
  const termsShared = Boolean(current.pickupTermsSharedAt);
  const termsConfirmed = Boolean(current.pickupTermsConfirmedAt);
  const pickupVideoReady = Boolean(current.pickupVideo);
  const pickupDone = Boolean(current.pickupCompletedAt);
  const dropoffReached = Boolean(current.dropoffReachedAt);
  const dropoffVideoReady = Boolean(current.dropoffVideo);
  const dropoffDone = Boolean(current.completedAt);
  const isPickupType = `${current.type ?? ""}`.toLowerCase() === "pickup";

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

  function mapFromApi(row: any): RecoveryRequestData {
    return {
      id: row.id ?? current.id,
      status: row.status ?? null,
      stage: row.stage ?? null,
      createdAt: row.created_at ?? row.createdAt ?? null,
      pickupLocation: row.pickup_location ?? row.pickupLocation ?? null,
      dropoffLocation: row.dropoff_location ?? row.dropoffLocation ?? null,
      agentName: row.agent_name ?? row.agentName ?? null,
      agentPhone: row.agent_phone ?? row.agentPhone ?? null,
      agentCarPlate: row.agent_car_plate ?? row.agentCarPlate ?? null,
      acceptedAt: row.accepted_at ?? row.acceptedAt ?? null,
      pickupReachedAt: row.pickup_reached_at ?? row.pickupReachedAt ?? null,
      pickupFromCustomer: row.pickup_from_customer ?? row.pickupFromCustomer ?? false,
      pickupTermsSharedAt: row.pickup_terms_shared_at ?? row.pickupTermsSharedAt ?? null,
      pickupTermsConfirmedAt: row.pickup_terms_confirmed_at ?? row.pickupTermsConfirmedAt ?? null,
      pickupVideo: row.pickup_video ?? row.pickupVideo ?? null,
      pickupRemarks: row.pickup_remarks ?? row.pickupRemarks ?? null,
      pickupCompletedAt: row.pickup_completed_at ?? row.pickupCompletedAt ?? null,
      dropoffReachedAt: row.dropoff_reached_at ?? row.dropoffReachedAt ?? null,
      dropoffVideo: row.dropoff_video ?? row.dropoffVideo ?? null,
      dropoffRemarks: row.dropoff_remarks ?? row.dropoffRemarks ?? null,
      completedAt: row.completed_at ?? row.completedAt ?? null,
      customerName: row.customer_name ?? row.customerName ?? null,
      customerPhone: row.customer_phone ?? row.customerPhone ?? null,
      carPlateNumber: row.car_plate_number ?? row.carPlateNumber ?? null,
      carMake: row.car_make ?? row.carMake ?? null,
      carModel: row.car_model ?? row.carModel ?? null,
    };
  }

  async function uploadVideo(file: File | null): Promise<string | null> {
    if (!file) return null;
    const form = new FormData();
    form.append("file", file);
    form.append("kind", "video");
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
              {current.pickupLocation && (
                <iframe
                  title="Pickup Location"
                  className="mt-3 h-72 w-full rounded-lg border border-slate-200"
                  loading="lazy"
                  src={`https://www.google.com/maps?q=${encodeURIComponent(
                    current.pickupLocation
                  )}&output=embed`}
                />
              )}
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
                className="rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-60"
                disabled={!accepted || pickupReached}
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
                      setPickupFromCustomer(e.target.checked);
                      await callAction("set_pickup_from_customer", {
                        pickupFromCustomer: e.target.checked,
                      });
                    }}
                  />
                </div>
                {pickupFromCustomer && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 disabled:opacity-60"
                      disabled={!pickupReached || termsShared}
                      onClick={() => callAction("share_terms")}
                    >
                      {termsShared ? "Terms Shared" : saving === "share_terms" ? "Sharing..." : "Share Terms"}
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 disabled:opacity-60"
                      disabled={!termsShared || termsConfirmed}
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
              <input
                type="file"
                accept="video/*"
                onChange={(e) => setPickupFile(e.target.files?.[0] ?? null)}
              />
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
                  (pickupFromCustomer && !termsConfirmed) ||
                  (!pickupFile && !pickupVideoReady)
                }
                onClick={async () => {
                  const fileId = pickupFile ? await uploadVideo(pickupFile) : current.pickupVideo ?? null;
                  await callAction("upload_pickup", {
                    pickupVideo: fileId ?? undefined,
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
                disabled={!pickupVideoReady || pickupDone}
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
              {current.dropoffLocation && (
                <iframe
                  title="Dropoff Location"
                  className="mt-3 h-72 w-full rounded-lg border border-slate-200"
                  loading="lazy"
                  src={`https://www.google.com/maps?q=${encodeURIComponent(
                    current.dropoffLocation
                  )}&output=embed`}
                />
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
                disabled={!pickupDone || dropoffReached}
                onClick={() => callAction("reach_dropoff")}
              >
                {dropoffReached ? "Reached" : saving === "reach_dropoff" ? "Saving..." : "Reach Dropoff"}
              </button>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
              <div className="text-sm font-semibold">Dropoff Evidence</div>
              <input
                type="file"
                accept="video/*"
                onChange={(e) => setDropoffFile(e.target.files?.[0] ?? null)}
              />
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
                disabled={!dropoffReached || (!dropoffFile && !dropoffVideoReady)}
                onClick={async () => {
                  const fileId = dropoffFile ? await uploadVideo(dropoffFile) : current.dropoffVideo ?? null;
                  await callAction("upload_dropoff", {
                    dropoffVideo: fileId ?? undefined,
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
                disabled={!dropoffVideoReady || dropoffDone}
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
