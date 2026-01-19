"use client";

import React, { useEffect, useState } from "react";
import { AppLayout, LeadForm } from "@repo/ui";

type Props = { params: { companyId: string } };

export default function CompanyNewLeadPage({ params }: Props) {
  const { companyId } = params;
  const [owners, setOwners] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    async function loadOwners() {
      try {
        const res = await fetch(`/api/hr/employees?scope=company&companyId=${companyId}`);
        if (!res.ok) return;
        const data = await res.json();
        const mapped = (data.data ?? []).map((e: any) => ({ id: e.id, name: e.full_name ?? e.name ?? "Employee" }));
        setOwners(mapped);
      } catch {
        // ignore
      }
    }
    loadOwners();
  }, [companyId]);

  async function handleSubmit(values: any) {
    const res = await fetch(`/api/company/${companyId}/sales/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: values.name,
        phone: values.phone,
        email: values.email,
        source: values.source,
        status: values.status,
        ownerId: values.ownerId,
      }),
    });
    if (!res.ok) throw new Error("Failed to create lead");
    window.location.href = `/company/${companyId}/sales/my-leads`;
  }

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-semibold">Create Lead</h1>
          <button
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-white/10"
            onClick={() => (window.location.href = `/company/${companyId}/sales/my-leads`)}
          >
            Back
          </button>
        </div>
        <LeadForm mode="create" owners={owners} onSubmit={handleSubmit} />
      </div>
    </AppLayout>
  );
}
