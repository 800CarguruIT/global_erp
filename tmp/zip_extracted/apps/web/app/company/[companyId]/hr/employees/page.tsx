"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AppLayout, EmployeeListTable } from "@repo/ui";

export default function CompanyEmployeesPage({ params }: { params: Promise<{ companyId: string }> }) {
  const [companyId, setCompanyId] = useState<string>("");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function unwrapParams() {
      try {
        const resolved = await params;
        const id = Array.isArray(resolved?.companyId) ? resolved.companyId[0] : resolved?.companyId;
        if (active) setCompanyId(id ?? "");
      } catch {
        if (active) setCompanyId("");
      }
    }
    unwrapParams();
    return () => {
      active = false;
    };
  }, [params]);

  async function load() {
    if (!companyId) {
      setError("Company id missing");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/hr/employees?scope=company&companyId=${companyId}`
      );
      if (!res.ok) throw new Error("Failed to load employees");
      const data = await res.json();
      setItems(data.data ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load employees");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [companyId]);

  async function handleDelete(id: string) {
    setError(null);
    try {
      const res = await fetch(
        `/api/hr/employees/${id}?scope=company&companyId=${companyId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete employee");
      load();
    } catch (err: any) {
      setError(err?.message ?? "Failed to delete employee");
    }
  }

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-semibold">Company Employees</h1>
          <button
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs sm:text-sm transition"
            onClick={() =>
              (window.location.href = `/company/${companyId}/hr/employees/new`)
            }
          >
            + New Employee
          </button>
        </div>
        {error && <div className="text-red-400 text-sm">{error}</div>}
        {loading ? (
          <div className="text-sm opacity-70">Loading...</div>
        ) : (
          <EmployeeListTable
            items={items}
            onEdit={(id) =>
              (window.location.href = `/company/${companyId}/hr/employees/${id}`)
            }
            onDelete={handleDelete}
          />
        )}
      </div>
    </AppLayout>
  );
}
