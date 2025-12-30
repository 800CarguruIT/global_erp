"use client";

import React from "react";
import type { Lead } from "@repo/ai-core/crm/leads/types";
import { LeadTypeBadge, LeadStatusBadge, LeadHealthBadge } from "./LeadBadges";

export type LeadsTableProps = {
  companyId: string;
  leads: Lead[];
  onAssign?: (id: string, lead: Lead) => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectChange?: (id: string, checked: boolean) => void;
  onRefresh?: () => Promise<void> | void;
};

export function LeadsTable({
  companyId,
  leads,
  onAssign,
  selectable = false,
  selectedIds,
  onSelectChange,
  onRefresh,
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
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            {selectable && <th className="w-10 py-2 pr-2 text-left" />}
            <th className="py-2 pr-4 text-left">Lead</th>
            <th className="py-2 px-4 text-left">Customer</th>
            <th className="py-2 px-4 text-left">Car</th>
            <th className="py-2 px-4 text-left">Type / Stage</th>
            <th className="py-2 px-4 text-left">Status</th>
            <th className="py-2 px-4 text-left">Source</th>
            <th className="py-2 px-4 text-left">Branch</th>
            <th className="py-2 px-4 text-left">Agent</th>
            <th className="py-2 px-4 text-left">Service</th>
            <th className="py-2 px-4 text-left">Customer Info</th>
            <th className="py-2 px-4 text-left">Health</th>
            <th className="py-2 px-4 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => {
            const detailHref = `/company/${companyId}/leads/${lead.id}`;
            const customerHref = lead.customerId ? `/company/${companyId}/customers/${lead.customerId}` : null;
            const carHref = lead.carId ? `/company/${companyId}/cars/${lead.carId}` : null;

            return (
              <tr key={lead.id} className="border-b last:border-0">
                {selectable && (
                  <td className="py-2 pr-2 align-top">
                    <input
                      type="checkbox"
                      checked={selectedIds?.has(lead.id) ?? false}
                      onChange={(e) => onSelectChange?.(lead.id, e.target.checked)}
                    />
                  </td>
                )}
                <td className="py-2 pr-4">
                  <a href={detailHref} className="font-medium text-primary hover:underline">
                    {lead.id.slice(0, 8)}
                  </a>
                  <div className="text-xs text-muted-foreground">{new Date(lead.createdAt).toLocaleString()}</div>
                </td>
                <td className="py-2 px-4">
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
                <td className="py-2 px-4">
                  {lead.carPlateNumber ? (
                    carHref ? (
                      <a href={carHref} className="hover:underline">
                        <div className="text-sm">{lead.carPlateNumber}</div>
                        {lead.carModel && <div className="text-xs text-muted-foreground">{lead.carModel}</div>}
                      </a>
                    ) : (
                      <>
                        <div className="text-sm">{lead.carPlateNumber}</div>
                        {lead.carModel && <div className="text-xs text-muted-foreground">{lead.carModel}</div>}
                      </>
                    )
                  ) : (
                    <span className="text-xs text-muted-foreground">No car</span>
                  )}
                </td>
                <td className="py-2 px-4">
                  <div className="flex flex-col gap-1">
                    <LeadTypeBadge type={lead.leadType as any} />
                    <span className="text-xs text-muted-foreground capitalize">{lead.leadStage.replace(/_/g, " ")}</span>
                  </div>
                </td>
                <td className="py-2 px-4">
                  <LeadStatusBadge status={lead.leadStatus as any} />
                </td>
                <td className="py-2 px-4 text-xs capitalize">
                  {lead.source || <span className="text-muted-foreground">Unknown</span>}
                </td>
                <td className="py-2 px-4 text-sm">
                  {lead.branchId ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs">{lead.branchId.slice(0, 8)}</span>
                      <button
                        className="rounded border px-2 py-1 text-[11px] hover:border-destructive hover:text-destructive"
                        type="button"
                        onClick={() => handleUnassignBranch(lead.id)}
                        aria-label="Unassign branch"
                      >
                        Unassign
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Unassigned</span>
                  )}
                </td>
                <td className="py-2 px-4 text-sm">
                  {lead.agentName || <span className="text-xs text-muted-foreground">Unassigned</span>}
                </td>
                <td className="py-2 px-4 text-xs capitalize">
                  {lead.serviceType ? (
                    <div className="flex flex-col gap-0.5">
                      <span>{lead.serviceType.replace("_", " ")}</span>
                      {lead.leadType === "recovery" && (lead.recoveryDirection || lead.recoveryFlow) && (
                        <span className="text-[11px] text-muted-foreground">
                          {lead.recoveryDirection ? `${lead.recoveryDirection}` : ""}{" "}
                          {lead.recoveryFlow ? `(${lead.recoveryFlow.replace(/_/g, " ")})` : ""}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="py-2 px-4 text-xs">
                  {lead.customerDetailsApproved ? (
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-emerald-500/60 bg-emerald-500/10 px-2 py-1 text-emerald-500">
                        Visible
                      </span>
                      <button
                        className="rounded border px-2 py-1 text-xs hover:border-destructive hover:text-destructive"
                        type="button"
                        onClick={() => handleVisibilityToggle(lead.id, false)}
                      >
                        Hide
                      </button>
                    </div>
                  ) : lead.customerDetailsRequested ? (
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-amber-500/60 bg-amber-500/10 px-2 py-1 text-amber-500">
                        Requested
                      </span>
                      <button
                        className="rounded border px-2 py-1 text-xs hover:border-primary hover:text-primary"
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
                <td className="py-2 px-4">
                  <LeadHealthBadge score={lead.healthScore} />
                </td>
                <td className="py-2 px-4 text-sm">
                  {onAssign &&
                  ((lead.leadType === "rsa" || lead.leadType === "recovery") ||
                    (lead.leadType === "workshop" && lead.leadStage === "inspection_queue")) ? (
                    <button
                      className="rounded border px-2 py-1 text-xs hover:border-primary hover:text-primary"
                      onClick={() => onAssign(lead.id, lead)}
                      type="button"
                    >
                      Assign
                    </button>
                  ) : (
                    <span className="text-muted-foreground text-xs">-</span>
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
