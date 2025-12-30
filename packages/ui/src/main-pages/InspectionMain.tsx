"use client";

import React, { useEffect, useState } from "react";
import { MainPageShell } from "./MainPageShell";
import type { Inspection } from "@repo/ai-core/workshop/inspections/types";

type InspectionMainProps = {
  companyId: string;
  companyName?: string;
};

type LoadState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "loaded"; data: T; error: null }
  | { status: "error"; data: null; error: string };

export function InspectionMain({ companyId, companyName }: InspectionMainProps) {
  const [state, setState] = useState<LoadState<Inspection[]>>({
    status: "loading",
    data: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState({ status: "loading", data: null, error: null });
      try {
        const res = await fetch(`/api/company/${companyId}/workshop/inspections?status=in_progress`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const inspections: Inspection[] = json.data ?? [];
        if (!cancelled) {
          setState({ status: "loaded", data: inspections, error: null });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            data: null,
            error: "Failed to load inspections.",
          });
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const scopeLabel = companyName ? `Company: ${companyName}` : "Company workspace";

  const isLoading = state.status === "loading";
  const loadError = state.status === "error" ? state.error : null;
  const inspections = state.status === "loaded" ? state.data : [];

  return (
    <MainPageShell
      title="Inspection Queue"
      subtitle="Cars waiting for or undergoing inspection."
      scopeLabel={scopeLabel}
      primaryAction={
        <a href={`/company/${companyId}/workshop/inspections/new`} className="rounded-md border px-3 py-1 text-sm font-medium">
          New Inspection
        </a>
      }
    >
      {isLoading && <p className="text-sm text-muted-foreground">Loading inspections…</p>}
      {loadError && <p className="text-sm text-destructive">{loadError}</p>}
      {!isLoading && !loadError && (
        <>
          {inspections.length === 0 ? (
            <p className="text-xs text-muted-foreground">No inspections in progress.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                    <th className="py-2 pl-3 pr-4 text-left">Inspection</th>
                    <th className="py-2 px-4 text-left">Status</th>
                    <th className="py-2 px-4 text-left">Overall health</th>
                    <th className="py-2 px-4 text-left">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {inspections.map((insp) => {
                    const href = `/company/${companyId}/workshop/inspections/${insp.id}`;
                    return (
                      <tr key={insp.id} className="border-b last:border-0">
                        <td className="py-2 pl-3 pr-4">
                          <a href={href} className="font-medium text-primary hover:underline">
                            {insp.id.slice(0, 8)}…
                          </a>
                        </td>
                        <td className="py-2 px-4 text-xs capitalize">{insp.status.replace("_", " ")}</td>
                        <td className="py-2 px-4 text-xs">{insp.overallHealth ?? "—"}</td>
                        <td className="py-2 px-4 text-xs text-muted-foreground">
                          {new Date(insp.updatedAt).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </MainPageShell>
  );
}
