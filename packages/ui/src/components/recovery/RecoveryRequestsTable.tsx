"use client";

import React from "react";

export type RecoveryRequestRow = {
  id: string;
  leadId: string;
  pickupLocation?: string | null;
  dropoffLocation?: string | null;
  type?: string | null;
  status?: string | null;
  stage?: string | null;
  scheduledAt?: string | null;
  assignedTo?: string | null;
  createdAt?: string | null;
  pickupVideo?: string | null;
  dropoffVideo?: string | null;
      pickupRemarks?: string | null;
      dropoffRemarks?: string | null;
      verificationCost?: number | null;
      verificationSale?: number | null;
      verifiedAt?: string | null;
      agentName?: string | null;
      agentPhone?: string | null;
      agentCarPlate?: string | null;
      completedAt?: string | null;
      customerName?: string | null;
  customerPhone?: string | null;
  carPlateNumber?: string | null;
  carMake?: string | null;
  carModel?: string | null;
};

export type RecoveryRequestsTableProps = {
  companyId: string;
  rows: RecoveryRequestRow[];
  onVerified?: () => void;
  showVerifiedDetails?: boolean;
  sortKey?: string;
  sortDir?: "asc" | "desc";
  sortLabel?: string;
  onSort?: (key: string) => void;
};

const statusStyles: Record<string, string> = {
  Pending: "border-amber-500/50 bg-amber-500/10 text-amber-600",
  Cancelled: "border-rose-500/50 bg-rose-500/10 text-rose-600",
  Done: "border-emerald-500/50 bg-emerald-500/10 text-emerald-600",
};

const stageStyles: Record<string, string> = {
  New: "border-slate-300/60 bg-slate-100 text-slate-700",
  Accepted: "border-blue-500/50 bg-blue-500/10 text-blue-600",
  Reached: "border-indigo-500/50 bg-indigo-500/10 text-indigo-600",
  "Picked Up": "border-amber-500/50 bg-amber-500/10 text-amber-600",
  "Dropped Off": "border-emerald-500/50 bg-emerald-500/10 text-emerald-600",
};

function Badge({ label, styles }: { label: string; styles: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold ${styles}`}>
      {label}
    </span>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

export function RecoveryRequestsTable({
  companyId,
  rows,
  onVerified,
  showVerifiedDetails = false,
  sortKey,
  sortDir,
  sortLabel,
  onSort,
}: RecoveryRequestsTableProps) {
  const [verifyRow, setVerifyRow] = React.useState<RecoveryRequestRow | null>(null);
  const [verifyCost, setVerifyCost] = React.useState("80");
  const [verifySale, setVerifySale] = React.useState("0");
  const [verifySaving, setVerifySaving] = React.useState(false);
  const [verifyError, setVerifyError] = React.useState<string | null>(null);

  function openVerify(row: RecoveryRequestRow) {
    setVerifyRow(row);
    setVerifyCost(row.verificationCost != null ? String(row.verificationCost) : "80");
    setVerifySale(row.verificationSale != null ? String(row.verificationSale) : "0");
    setVerifyError(null);
  }

  async function submitVerify() {
    if (!verifyRow) return;
    setVerifySaving(true);
    setVerifyError(null);
    try {
      const res = await fetch(
        `/api/company/${companyId}/recovery-requests/${verifyRow.id}/verify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cost: Number(verifyCost || 0),
            sale: Number(verifySale || 0),
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to verify");
      }
      setVerifyRow(null);
      onVerified?.();
    } catch (err: any) {
      setVerifyError(err?.message ?? "Failed to verify");
    } finally {
      setVerifySaving(false);
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm border-separate border-spacing-0">
        <thead>
          <tr className="text-left bg-muted/20">
            <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
              <button
                type="button"
                onClick={() => onSort?.("created")}
                className="inline-flex items-center gap-2 hover:text-foreground"
              >
                Request
                {sortKey === "created" && <span className="text-[10px] text-muted-foreground">{sortLabel}</span>}
              </button>
            </th>
            <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
              <button
                type="button"
                onClick={() => onSort?.("customer")}
                className="inline-flex items-center gap-2 hover:text-foreground"
              >
                Customer
                {sortKey === "customer" && <span className="text-[10px] text-muted-foreground">{sortLabel}</span>}
              </button>
            </th>
            <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
              <button
                type="button"
                onClick={() => onSort?.("car")}
                className="inline-flex items-center gap-2 hover:text-foreground"
              >
                Car
                {sortKey === "car" && <span className="text-[10px] text-muted-foreground">{sortLabel}</span>}
              </button>
            </th>
            <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
              <button
                type="button"
                onClick={() => onSort?.("type")}
                className="inline-flex items-center gap-2 hover:text-foreground"
              >
                Type / Stage
                {sortKey === "type" && <span className="text-[10px] text-muted-foreground">{sortLabel}</span>}
              </button>
            </th>
            <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
              <button
                type="button"
                onClick={() => onSort?.("status")}
                className="inline-flex items-center gap-2 hover:text-foreground"
              >
                Status
                {sortKey === "status" && <span className="text-[10px] text-muted-foreground">{sortLabel}</span>}
              </button>
            </th>
            <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
              Pickup Location
            </th>
            <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
              Dropoff Location
            </th>
            <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
              App Link
            </th>
            <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
              Assigned
            </th>
            <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const leadHref = row.leadId ? `/company/${companyId}/leads/${row.leadId}` : "#";
            const requestHref = `/company/${companyId}/recovery-requests/${row.id}`;
            const status = row.status ?? "Pending";
            const stage = row.stage ?? "New";
            const statusClass = statusStyles[status] ?? "border-slate-200 bg-white text-slate-700";
            const stageClass = stageStyles[stage] ?? "border-slate-200 bg-white text-slate-700";
            const carLabel = [row.carMake, row.carModel].filter(Boolean).join(" ") || "Car";

            return (
              <tr key={row.id} className="hover:bg-muted/20">
                <td className="px-4 py-3 border-b border-border/30">
                  <a href={leadHref} className="font-medium text-primary hover:underline">
                    {row.id.slice(0, 8)}
                  </a>
                  <div className="text-xs text-muted-foreground">{formatDate(row.createdAt)}</div>
                </td>
                <td className="px-4 py-3 border-b border-border/30">
                  {row.customerName ? (
                    <span className="text-sm">{row.customerName}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">No customer</span>
                  )}
                  {row.customerPhone && <div className="text-xs text-muted-foreground">{row.customerPhone}</div>}
                </td>
                <td className="px-4 py-3 border-b border-border/30">
                  {row.carPlateNumber ? (
                    <>
                      <div className="text-sm">{row.carPlateNumber}</div>
                      <div className="text-xs text-muted-foreground">{carLabel}</div>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">No car</span>
                  )}
                </td>
                <td className="px-4 py-3 border-b border-border/30">
                  <div className="flex flex-col gap-1">
                    <Badge
                      label={(row.type ?? "-").toString().replace(/_/g, " ").toUpperCase()}
                      styles="border-slate-200 bg-white text-slate-700"
                    />
                    <Badge label={stage} styles={stageClass} />
                  </div>
                </td>
                <td className="px-4 py-3 border-b border-border/30">
                  <Badge label={status} styles={statusClass} />
                </td>
                <td className="px-4 py-3 border-b border-border/30">
                  {row.pickupLocation ? (
                    <div className="space-y-1">
                      <div className="max-w-[200px] text-xs font-semibold text-foreground">
                        {row.pickupLocation}
                      </div>
                      <iframe
                        title={`Pickup ${row.id}`}
                        className="h-28 w-48 rounded-md border border-border/40"
                        loading="lazy"
                        src={`https://www.google.com/maps?q=${encodeURIComponent(
                          row.pickupLocation
                        )}&output=embed`}
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-4 py-3 border-b border-border/30">
                  {row.dropoffLocation ? (
                    <div className="space-y-1">
                      <div className="max-w-[200px] text-xs font-semibold text-foreground">
                        {row.dropoffLocation}
                      </div>
                      <iframe
                        title={`Dropoff ${row.id}`}
                        className="h-28 w-48 rounded-md border border-border/40"
                        loading="lazy"
                        src={`https://www.google.com/maps?q=${encodeURIComponent(
                          row.dropoffLocation
                        )}&output=embed`}
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-4 py-3 border-b border-border/30 text-xs">
                  {row.id ? (
                    <div className="space-y-2">
                      <a href={requestHref} className="text-primary hover:underline">
                        Process
                      </a>
                      {row.verifiedAt && showVerifiedDetails && (
                        <div className="space-y-1 text-[11px] text-emerald-700">
                          <div className="font-semibold">Verified details</div>
                          <div>Agent: {row.agentName ?? "-"}</div>
                          <div>Phone: {row.agentPhone ?? "-"}</div>
                          <div>Car: {row.agentCarPlate ?? "-"}</div>
                          <div>Completed: {formatDate(row.completedAt)}</div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-4 py-3 border-b border-border/30 text-xs text-muted-foreground">
                  {row.assignedTo ? row.assignedTo.slice(0, 8) : "-"}
                </td>
                <td className="px-4 py-3 border-b border-border/30 text-sm">
                  {row.leadId ? (
                    <div className="flex flex-col gap-2">
                      <a
                        href={leadHref}
                        className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-primary hover:shadow-md"
                      >
                        View Lead
                      </a>
                      {row.status === "Done" && !row.verifiedAt && (
                        <button
                          type="button"
                          className="rounded-md bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm transition hover:bg-emerald-700"
                          onClick={() => openVerify(row)}
                        >
                          Verify
                        </button>
                      )}
                      {row.verifiedAt && (
                        <span className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-600">
                          Verified
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {verifyRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="text-sm font-semibold text-slate-900">Verify Recovery</div>
              <button
                type="button"
                className="rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600"
                onClick={() => setVerifyRow(null)}
              >
                Close
              </button>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-2 text-xs text-slate-600">
                <div className="text-sm font-semibold text-slate-900">Pickup</div>
                <div>{verifyRow.pickupRemarks || "No remarks"}</div>
                {verifyRow.pickupVideo ? (
                  <a
                    className="text-primary underline"
                    href={`/api/files/${verifyRow.pickupVideo}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View pickup video
                  </a>
                ) : (
                  <span className="text-slate-400">No pickup video</span>
                )}
              </div>
              <div className="space-y-2 text-xs text-slate-600">
                <div className="text-sm font-semibold text-slate-900">Dropoff</div>
                <div>{verifyRow.dropoffRemarks || "No remarks"}</div>
                {verifyRow.dropoffVideo ? (
                  <a
                    className="text-primary underline"
                    href={`/api/files/${verifyRow.dropoffVideo}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View dropoff video
                  </a>
                ) : (
                  <span className="text-slate-400">No dropoff video</span>
                )}
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600">Cost</label>
                <input
                  type="number"
                  className="w-full rounded-lg border-2 border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  value={verifyCost}
                  onChange={(e) => setVerifyCost(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600">Sale</label>
                <input
                  type="number"
                  className="w-full rounded-lg border-2 border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  value={verifySale}
                  onChange={(e) => setVerifySale(e.target.value)}
                />
              </div>
            </div>
            {verifyError && <div className="mt-3 text-xs text-rose-600">{verifyError}</div>}
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-60"
                disabled={verifySaving}
                onClick={submitVerify}
              >
                {verifySaving ? "Saving..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
