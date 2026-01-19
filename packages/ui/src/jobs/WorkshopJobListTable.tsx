"use client";

import React from "react";

export interface WorkshopJobListTableProps {
  jobs: Array<{
    id: string;
    jobNumber?: string | null;
    customerName?: string | null;
    carLabel?: string | null;
    status?: string | null;
    assignedEmployeeName?: string | null;
    openedAt?: string | null;
  }>;
  onCreate?: () => void;
  onRowClick?: (id: string) => void;
}

export function WorkshopJobListTable({ jobs, onCreate, onRowClick }: WorkshopJobListTableProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Workshop Jobs</h2>
        {onCreate && (
          <button
            type="button"
            onClick={onCreate}
            className="rounded-md border px-3 py-1 text-sm font-medium hover:bg-white/10"
          >
            New Job
          </button>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
              <th className="py-2 pl-3 pr-4 text-left">Job #</th>
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-left">Car</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Assigned</th>
              <th className="px-3 py-2 text-left">Opened</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-4 text-center text-xs text-muted-foreground">
                  No jobs yet.
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
                <tr
                  key={job.id}
                  className="border-b last:border-0 hover:bg-muted/40 cursor-pointer"
                  onClick={() => onRowClick?.(job.id)}
                >
                  <td className="py-2 pl-3 pr-4">{job.jobNumber ?? job.id.slice(0, 8)}</td>
                  <td className="px-3 py-2 text-sm">{job.customerName ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{job.carLabel ?? "—"}</td>
                  <td className="px-3 py-2 text-xs capitalize">{job.status ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{job.assignedEmployeeName ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {job.openedAt ? new Date(job.openedAt).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
