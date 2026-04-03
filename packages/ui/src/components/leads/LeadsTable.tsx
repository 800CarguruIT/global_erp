"use client";

import React from "react";
import type { Lead } from "@repo/ai-core/crm/leads/types";
import { LeadTypeBadge, LeadStatusBadge, LeadHealthBadge } from "./LeadBadges";

export type LeadsTableProps = {
  companyId: string;
  leads: Lead[];
  onAssign?: (id: string, lead: Lead) => void;
  onBook?: (id: string, lead: Lead) => void;
  onCarIn?: (id: string, lead: Lead) => void;
  onRequestRecovery?: (id: string, lead: Lead) => void;
  renderActions?: (lead: Lead) => React.ReactNode;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectChange?: (id: string, checked: boolean) => void;
  onRefresh?: () => Promise<void> | void;
  sortKey?: string;
  sortDir?: "asc" | "desc";
  sortLabel?: string;
  onSort?: (key: string) => void;
};

export function LeadsTable({
  companyId,
  leads,
  onAssign,
  onBook,
  onCarIn,
  onRequestRecovery,
  renderActions,
  selectable = false,
  selectedIds,
  onSelectChange,
  onRefresh,
  sortKey,
  sortDir,
  sortLabel,
  onSort,
}: LeadsTableProps) {
  async function handleVisibilityToggle(leadId: string, approved: boolean) {
    await fetch(`/api/company/${companyId}/sales/leads/${leadId}/customer-visibility`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved }),
    });
    if (onRefresh) {
      await onRefresh();
    }
  }

  async function handleUnassignBranch(leadId: string) {
    try {
      const res = await fetch(`/api/company/${companyId}/sales/leads/${leadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId: null }),
      });
      if (!res.ok) throw new Error("Unassign failed");
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err) {
      console.error("Failed to unassign branch", err);
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm border-separate border-spacing-0">
        <thead>
          <tr className="text-left bg-card/40">
            {selectable && (
              <th className="w-10 px-4 py-3 sticky top-0 bg-card/40 backdrop-blur border-b border-border/60 text-xs font-semibold text-muted-foreground" />
            )}
            <th className="px-4 py-3 sticky top-0 bg-card/40 backdrop-blur border-b border-border/60 text-xs font-semibold text-muted-foreground">
              <button
                type="button"
                onClick={() => onSort?.("lead")}
                className="inline-flex items-center gap-2 hover:text-foreground"
              >
                Lead
                {sortKey === "lead" && <span className="text-[10px] text-muted-foreground">{sortLabel}</span>}
              </button>
            </th>
            <th className="px-4 py-3 sticky top-0 bg-card/40 backdrop-blur border-b border-border/60 text-xs font-semibold text-muted-foreground">
              <button
                type="button"
                onClick={() => onSort?.("customer")}
                className="inline-flex items-center gap-2 hover:text-foreground"
              >
                Customer
                {sortKey === "customer" && <span className="text-[10px] text-muted-foreground">{sortLabel}</span>}
              </button>
            </th>
            <th className="px-4 py-3 sticky top-0 bg-card/40 backdrop-blur border-b border-border/60 text-xs font-semibold text-muted-foreground">
              <button
                type="button"
                onClick={() => onSort?.("car")}
                className="inline-flex items-center gap-2 hover:text-foreground"
              >
                Car
                {sortKey === "car" && <span className="text-[10px] text-muted-foreground">{sortLabel}</span>}
              </button>
            </th>
            <th className="px-4 py-3 sticky top-0 bg-card/40 backdrop-blur border-b border-border/60 text-xs font-semibold text-muted-foreground">
              Type / Stage
            </th>
            <th className="px-4 py-3 sticky top-0 bg-card/40 backdrop-blur border-b border-border/60 text-xs font-semibold text-muted-foreground">
              <button
                type="button"
                onClick={() => onSort?.("status")}
                className="inline-flex items-center gap-2 hover:text-foreground"
              >
                Status
                {sortKey === "status" && <span className="text-[10px] text-muted-foreground">{sortLabel}</span>}
              </button>
            </th>
            <th className="px-4 py-3 sticky top-0 bg-card/40 backdrop-blur border-b border-border/60 text-xs font-semibold text-muted-foreground">
              <button
                type="button"
                onClick={() => onSort?.("source")}
                className="inline-flex items-center gap-2 hover:text-foreground"
              >
                Source
                {sortKey === "source" && <span className="text-[10px] text-muted-foreground">{sortLabel}</span>}
              </button>
            </th>
            <th className="px-4 py-3 sticky top-0 bg-card/40 backdrop-blur border-b border-border/60 text-xs font-semibold text-muted-foreground">
              <button
                type="button"
                onClick={() => onSort?.("branch")}
                className="inline-flex items-center gap-2 hover:text-foreground"
              >
                Branch
                {sortKey === "branch" && <span className="text-[10px] text-muted-foreground">{sortLabel}</span>}
              </button>
            </th>
            <th className="px-4 py-3 sticky top-0 bg-card/40 backdrop-blur border-b border-border/60 text-xs font-semibold text-muted-foreground">
              <button
                type="button"
                onClick={() => onSort?.("agent")}
                className="inline-flex items-center gap-2 hover:text-foreground"
              >
                Agent
                {sortKey === "agent" && <span className="text-[10px] text-muted-foreground">{sortLabel}</span>}
              </button>
            </th>
            <th className="px-4 py-3 sticky top-0 bg-card/40 backdrop-blur border-b border-border/60 text-xs font-semibold text-muted-foreground">
              <button
                type="button"
                onClick={() => onSort?.("service")}
                className="inline-flex items-center gap-2 hover:text-foreground"
              >
                Service
                {sortKey === "service" && <span className="text-[10px] text-muted-foreground">{sortLabel}</span>}
              </button>
            </th>
            <th className="px-4 py-3 sticky top-0 bg-card/40 backdrop-blur border-b border-border/60 text-xs font-semibold text-muted-foreground">
              Customer Info
            </th>
            <th className="px-4 py-3 sticky top-0 bg-card/40 backdrop-blur border-b border-border/60 text-xs font-semibold text-muted-foreground">
              <button
                type="button"
                onClick={() => onSort?.("health")}
                className="inline-flex items-center gap-2 hover:text-foreground"
              >
                Health
                {sortKey === "health" && <span className="text-[10px] text-muted-foreground">{sortLabel}</span>}
              </button>
            </th>
            <th className="px-4 py-3 sticky top-0 bg-card/40 backdrop-blur border-b border-border/60 text-xs font-semibold text-muted-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => {
            const detailHref = `/company/${companyId}/leads/${lead.id}`;
            const customerHref = lead.customerId ? `/company/${companyId}/customers/${lead.customerId}` : null;
            const carHref = lead.carId ? `/company/${companyId}/cars/${lead.carId}` : null;
            const leadType = `${lead.leadType ?? ""}`.toLowerCase();
            const canAssign =
              Boolean(onAssign) && (leadType === "rsa" || leadType === "recovery" || leadType === "workshop");
            const canBook = Boolean(onBook) && (leadType === "rsa" || leadType === "recovery" || leadType === "workshop");
            const canCarIn =
              Boolean(onCarIn) &&
              leadType === "workshop" &&
              String(lead.leadStatus ?? "").toLowerCase() !== "car_in";
            const leadStatus = String(lead.leadStatus ?? "").trim().toLowerCase();
            const canRequestRecovery =
              Boolean(onRequestRecovery) &&
              leadType === "rsa" &&
              !["closed", "closed_won", "lost", "done", "completed"].includes(leadStatus);

            return (
              <tr key={lead.id} className="transition hover:bg-muted/30">
                {selectable && (
                  <td className="px-4 py-3 border-b border-border/60 align-top">
                    <input
                      type="checkbox"
                      checked={selectedIds?.has(lead.id) ?? false}
                      onChange={(e) => onSelectChange?.(lead.id, e.target.checked)}
                    />
                  </td>
                )}
                <td className="px-4 py-3 border-b border-border/60">
                  <a href={detailHref} className="font-medium text-primary hover:underline">
                    {lead.id.slice(0, 8)}
                  </a>
                  <div className="text-xs text-muted-foreground">{new Date(lead.createdAt).toLocaleString()}</div>
                </td>
                <td className="px-4 py-3 border-b border-border/60">
                  {lead.customerName ? (
                    customerHref ? (
                      <a href={customerHref} className="text-sm hover:underline">
                        {lead.customerName}
                      </a>
                    ) : (
                      <span className="text-sm">{lead.customerName}</span>
                    )
                  ) : (
                    <span className="text-xs text-muted-foreground">No customer</span>
                  )}
                  {lead.customerPhone && <div className="text-xs text-muted-foreground">{lead.customerPhone}</div>}
                </td>
                <td className="px-4 py-3 border-b border-border/60">
                  {lead.carPlateNumber ? (
                    carHref ? (
                      <a href={carHref} className="hover:underline">
                        <div className="text-sm">
                          {lead.carPlateNumberFull || lead.carPlateNumber}
                        </div>
                        {(lead.carMake || lead.carModel) && (
                          <div className="text-xs text-muted-foreground">
                            {[lead.carMake, lead.carModel].filter(Boolean).join(" ")}
                          </div>
                        )}
                      </a>
                    ) : (
                      <>
                        <div className="text-sm">
                          {lead.carPlateNumberFull || lead.carPlateNumber}
                        </div>
                        {(lead.carMake || lead.carModel) && (
                          <div className="text-xs text-muted-foreground">
                            {[lead.carMake, lead.carModel].filter(Boolean).join(" ")}
                          </div>
                        )}
                      </>
                    )
                  ) : (
                    <span className="text-xs text-muted-foreground">No car</span>
                  )}
                </td>
                <td className="px-4 py-3 border-b border-border/60">
                  <div className="flex flex-col gap-1">
                    <LeadTypeBadge type={lead.leadType as any} />
                    <span className="text-xs text-muted-foreground capitalize">{lead.leadStage.replace(/_/g, " ")}</span>
                  </div>
                </td>
                <td className="px-4 py-3 border-b border-border/60">
                  <LeadStatusBadge status={lead.leadStatus as any} />
                </td>
                <td className="px-4 py-3 border-b border-border/60 text-xs">
                  {lead.source ? (
                    <span className="capitalize">{lead.source.replace(/_/g, " ").replace(/ai /i, "AI ")}</span>
                  ) : (
                    <span className="text-muted-foreground">Unknown</span>
                  )}
                </td>
                <td className="px-4 py-3 border-b border-border/60 text-sm">
                  {lead.branchId ? (
                    <a
                      href={`/company/${companyId}/branches/${lead.branchId}`}
                      className="text-xs text-primary hover:underline"
                    >
                      {lead.branchName || lead.branchId.slice(0, 8)}
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">Unassigned</span>
                  )}
                </td>
                <td className="px-4 py-3 border-b border-border/60 text-sm">
                  {lead.agentName ? (
                    <div className="flex flex-col gap-0.5">
                      <span>{lead.agentName}</span>
                      <span className="text-[11px] text-muted-foreground">Assigned to</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Unassigned</span>
                  )}
                </td>
                <td className="px-4 py-3 border-b border-border/60 text-xs capitalize">
                  {lead.serviceType ? (
                    <div className="flex flex-col gap-0.5">
                      <span>{lead.serviceType.replace("_", " ")}</span>
                      {lead.leadType === "recovery" && (lead.recoveryDirection || lead.recoveryFlow) && (
                        <span className="text-[11px] text-muted-foreground">
                          {lead.recoveryDirection ? `${lead.recoveryDirection}` : ""}{" "}
                          {lead.recoveryFlow ? `(${lead.recoveryFlow.replace(/_/g, " ")})` : ""}
                        </span>
                      )}
                      {lead.pickupFrom ? (
                        <span className="text-[11px] normal-case text-muted-foreground">
                          Location: {lead.pickupFrom}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-muted-foreground">-</span>
                      {lead.pickupFrom ? (
                        <span className="text-[11px] normal-case text-muted-foreground">
                          Location: {lead.pickupFrom}
                        </span>
                      ) : null}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 border-b border-border/60 text-xs">
                  {lead.customerDetailsApproved ? (
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                        Visible
                      </span>
                      <button
                        className="rounded-md border border-border bg-muted/40 px-2 py-1 text-[10px] font-medium text-muted-foreground transition hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20"
                        type="button"
                        onClick={() => handleVisibilityToggle(lead.id, false)}
                      >
                        Hide
                      </button>
                    </div>
                  ) : lead.customerDetailsRequested ? (
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                        Requested
                      </span>
                      <button
                        className="rounded-md border border-border bg-muted/40 px-2 py-1 text-[10px] font-medium text-muted-foreground transition hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/20"
                        type="button"
                        onClick={() => handleVisibilityToggle(lead.id, true)}
                      >
                        Show
                      </button>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-4 py-3 border-b border-border/60">
                  <LeadHealthBadge score={lead.healthScore} />
                </td>
                <td className="px-4 py-3 border-b border-border/60 text-sm">
                  {renderActions ? (
                    renderActions(lead)
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {/* Assign to Tech — RSA only */}
                      {leadType === "rsa" && canAssign ? (
                        <button
                          className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-300 transition hover:bg-sky-500/20"
                          onClick={() => onAssign?.(lead.id, lead)}
                          type="button"
                        >
                          {(lead as any).assignedUserName ? `Tech: ${(lead as any).assignedUserName}` : "Assign to Tech"}
                        </button>
                      ) : null}
                      {(lead as any).bookingId ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              Booked
                            </span>
                            <span className="text-[10px] text-muted-foreground capitalize">
                              {((lead as any).bookingKind ?? "").replace(/_/g, " ")}
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {new Date((lead as any).scheduledAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </div>
                          {(lead as any).bookingPriority && (
                            <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
                              (lead as any).bookingPriority === "high" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                              (lead as any).bookingPriority === "medium" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                              "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"
                            }`}>
                              {(lead as any).bookingPriority}
                            </span>
                          )}
                          {(lead as any).pickupLocation && (
                            <div className="text-[10px] text-muted-foreground truncate max-w-[160px]" title={(lead as any).pickupLocation}>
                              Pickup: {(lead as any).pickupLocation}
                            </div>
                          )}
                          <button
                            className="rounded-md border border-border bg-muted/40 px-2.5 py-1 text-[10px] font-medium text-foreground transition hover:bg-muted"
                            onClick={() => onBook?.(lead.id, lead)}
                            type="button"
                          >
                            Edit Booking
                          </button>
                        </div>
                      ) : canBook ? (
                        <button
                          className="rounded-lg border border-border bg-muted/40 px-4 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
                          onClick={() => onBook?.(lead.id, lead)}
                          type="button"
                        >
                          Book
                        </button>
                      ) : null}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
