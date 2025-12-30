"use client";

import React, { useEffect, useState } from "react";
import { AppLayout, LeadListTable } from "@repo/ui";

type Lead = {
  id: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  leadStatus?: string | null;
  source?: string | null;
  agentName?: string | null;
  createdAt?: string | null;
};

type Props = { params: { companyId: string } };

export default function CompanyMyLeadsPage({ params }: Props) {
  const { companyId } = params;
  const [leads, setLeads] = useState<Lead[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/company/${companyId}/sales/leads${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      if (!res.ok) throw new Error("Failed to load leads");
      const data = await res.json();
      setLeads(data.data ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold">Sales – My Leads</h1>
            <p className="text-sm text-muted-foreground">Manage sales leads for this company.</p>
          </div>
          <div className="flex gap-2">
            <input
              className="rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="Search..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button className="rounded-md border px-3 py-2 text-sm" onClick={load}>
              Search
            </button>
          </div>
        </div>

        {error && <div className="text-sm text-destructive">{error}</div>}
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading leads...</div>
        ) : (
          <LeadListTable
            leads={leads.map((l) => ({
              id: l.id,
              name: l.customerName ?? "Lead",
              phone: l.customerPhone,
              email: l.customerEmail,
              status: l.leadStatus,
              source: l.source,
              ownerName: l.agentName ?? undefined,
              createdAt: l.createdAt,
            }))}
            onCreate={() => (window.location.href = `/company/${companyId}/sales/my-leads/new`)}
            onRowClick={(id) => (window.location.href = `/company/${companyId}/sales/my-leads/${id}`)}
          />
        )}
      </div>
    </AppLayout>
  );
}
