"use client";

import React, { useEffect, useState } from "react";
import { AppLayout, LeadForm } from "@repo/ui";

type Lead = {
  id: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  leadStatus?: string | null;
  source?: string | null;
  agentEmployeeId?: string | null;
};

type Props = { params: { companyId: string; id: string } };

export default function CompanyEditLeadPage({ params }: Props) {
  const { companyId, id } = params;
  const [lead, setLead] = useState<Lead | null>(null);
  const [owners, setOwners] = useState<Array<{ id: string; name: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [leadRes, ownersRes] = await Promise.all([
          fetch(`/api/company/${companyId}/sales/leads/${id}`),
          fetch(`/api/hr/employees?scope=company&companyId=${companyId}`),
        ]);
        if (leadRes.ok) {
          const data = await leadRes.json();
          setLead(data.data ?? data);
        }
        if (ownersRes.ok) {
          const d = await ownersRes.json();
          setOwners((d.data ?? []).map((e: any) => ({ id: e.id, name: e.full_name ?? e.name ?? "Employee" })));
        }
      } catch (err: any) {
        setError(err?.message ?? "Failed to load lead");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [companyId, id]);

  async function handleSubmit(values: any) {
    const res = await fetch(`/api/company/${companyId}/sales/leads/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: values.status,
        source: values.source,
        ownerId: values.ownerId,
      }),
    });
    if (!res.ok) throw new Error("Failed to update lead");
    window.location.href = `/company/${companyId}/sales/my-leads`;
  }

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-semibold">Edit Lead</h1>
          <button
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-white/10"
            onClick={() => (window.location.href = `/company/${companyId}/sales/my-leads`)}
          >
            Back
          </button>
        </div>
        {error && <div className="text-sm text-destructive">{error}</div>}
        {loading || !lead ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (
          <LeadForm
            mode="edit"
            owners={owners}
            initialValues={{
              name: lead.customerName ?? "",
              phone: lead.customerPhone,
              email: lead.customerEmail,
              source: lead.source,
              status: lead.leadStatus,
              ownerId: lead.agentEmployeeId ?? undefined,
            }}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </AppLayout>
  );
}
