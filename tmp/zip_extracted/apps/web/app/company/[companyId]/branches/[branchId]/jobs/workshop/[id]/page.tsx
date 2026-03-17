"use client";

import React, { useEffect, useState } from "react";
import { AppLayout, WorkshopJobForm } from "@repo/ui";

type WorkOrder = {
  id: string;
  estimateId: string;
  customerId?: string | null;
  carId?: string | null;
  status?: string | null;
  meta?: any;
};

type Props = { params: { companyId: string; branchId: string; id: string } };

export default function BranchWorkshopJobDetailPage({ params }: Props) {
  const { companyId, branchId, id } = params;
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);
  const [cars, setCars] = useState<Array<{ id: string; label: string; customerId: string }>>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [woRes, custRes, carRes, empRes] = await Promise.all([
          fetch(`/api/company/${companyId}/branches/${branchId}/jobs/workshop/${id}`),
          fetch(`/api/customers?companyId=${companyId}`),
          fetch(`/api/cars?companyId=${companyId}`),
          fetch(`/api/hr/employees?scope=branch&companyId=${companyId}&branchId=${branchId}`),
        ]);
        if (woRes.ok) {
          const d = await woRes.json();
          setWorkOrder(d.data?.workOrder ?? d.data ?? null);
        }
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
      } catch (err: any) {
        setError(err?.message ?? "Failed to load work order");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [branchId, companyId, id]);

  async function handleSubmit(values: any) {
    const res = await fetch(`/api/company/${companyId}/branches/${branchId}/jobs/workshop/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: values.status,
        queueReason: values.notes,
        branchId,
      }),
    });
    if (!res.ok) throw new Error("Failed to update work order");
    window.location.href = `/company/${companyId}/branches/${branchId}/jobs/workshop`;
  }

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-semibold">Workshop Job</h1>
          <button
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-white/10"
            onClick={() => (window.location.href = `/company/${companyId}/branches/${branchId}/jobs/workshop`)}
          >
            Back
          </button>
        </div>
        {error && <div className="text-sm text-destructive">{error}</div>}
        {loading || !workOrder ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (
          <WorkshopJobForm
            mode="edit"
            customers={customers}
            cars={cars}
            employees={employees}
            initialValues={{
              estimateId: workOrder.estimateId,
              customerId: workOrder.customerId ?? undefined,
              carId: workOrder.carId ?? undefined,
              status: workOrder.status ?? undefined,
              notes: workOrder.meta?.notes ?? "",
            }}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </AppLayout>
  );
}
