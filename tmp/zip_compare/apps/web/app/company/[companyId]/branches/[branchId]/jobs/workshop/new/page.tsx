"use client";

import React, { useEffect, useState } from "react";
import { AppLayout, WorkshopJobForm } from "@repo/ui";

type Props = { params: { companyId: string; branchId: string } };

export default function BranchWorkshopJobNewPage({ params }: Props) {
  const { companyId, branchId } = params;
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);
  const [cars, setCars] = useState<Array<{ id: string; label: string; customerId: string }>>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    async function load() {
      try {
        const [custRes, carRes, empRes] = await Promise.all([
          fetch(`/api/customers?companyId=${companyId}`),
          fetch(`/api/cars?companyId=${companyId}`),
          fetch(`/api/hr/employees?scope=branch&companyId=${companyId}&branchId=${branchId}`),
        ]);
        if (custRes.ok) {
          const d = await custRes.json();
          setCustomers((d.data ?? []).map((c: any) => ({ id: c.id, name: c.name })));
        }
        if (carRes.ok) {
          const d = await carRes.json();
          setCars(
            (d.data ?? []).map((c: any) => ({
              id: c.id,
              label: `${c.plate_number ?? c.plateNumber ?? ""} ${c.make ?? ""} ${c.model ?? ""}`.trim(),
              customerId: c.customer_id ?? c.customerId ?? "",
            }))
          );
        }
        if (empRes.ok) {
          const d = await empRes.json();
          setEmployees((d.data ?? []).map((e: any) => ({ id: e.id, name: e.full_name ?? e.name ?? "Employee" })));
        }
      } catch {
        // ignore
      }
    }
    load();
  }, [branchId, companyId]);

  async function handleSubmit(values: any) {
    const res = await fetch(`/api/company/${companyId}/branches/${branchId}/jobs/workshop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        estimateId: values.estimateId,
      }),
    });
    if (!res.ok) throw new Error("Failed to create work order");
    window.location.href = `/company/${companyId}/branches/${branchId}/jobs/workshop`;
  }

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-semibold">New Workshop Job</h1>
          <button
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-white/10"
            onClick={() => (window.location.href = `/company/${companyId}/branches/${branchId}/jobs/workshop`)}
          >
            Back
          </button>
        </div>
        <WorkshopJobForm
          mode="create"
          customers={customers}
          cars={cars}
          employees={employees}
          onSubmit={handleSubmit}
        />
      </div>
    </AppLayout>
  );
}
