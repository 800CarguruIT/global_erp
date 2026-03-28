"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { AppLayout, EmployeeListTable } from "@repo/ui";

export default function CompanyEmployeesPage({ params }: { params: Promise<{ companyId: string }> }) {
  const [companyId, setCompanyId] = useState<string>("");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterDivision, setFilterDivision] = useState("");

  // Derived unique values for dropdowns
  const employeeTypes = useMemo(() => [...new Set(items.map((e) => e.employee_type).filter(Boolean))].sort(), [items]);
  const departments = useMemo(() => [...new Set(items.map((e) => e.department).filter(Boolean))].sort(), [items]);
  const divisions = useMemo(() => [...new Set(items.map((e) => e.division).filter(Boolean))].sort(), [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items.filter((item) => {
      if (q) {
        const haystack = `${item.auto_code} ${item.full_name} ${item.title ?? ""} ${item.department ?? ""} ${item.division ?? ""} ${item.employee_type}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filterType && item.employee_type !== filterType) return false;
      if (filterDepartment && item.department !== filterDepartment) return false;
      if (filterDivision && item.division !== filterDivision) return false;
      return true;
    });
  }, [items, search, filterType, filterDepartment, filterDivision]);

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

        {/* Filter Box */}
        {!loading && items.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-white/5 p-3">
            <input
              type="text"
              placeholder="Search by name, ID, title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-w-[200px] flex-1 rounded-md bg-white/10 px-3 py-1.5 text-sm outline-none placeholder:opacity-50 focus:ring-1 focus:ring-white/30"
            />
            {employeeTypes.length > 1 && (
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="rounded-md bg-white/10 px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-white/30"
              >
                <option value="">All Types</option>
                {employeeTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )}
            {departments.length > 1 && (
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="rounded-md bg-white/10 px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-white/30"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            )}
            {divisions.length > 1 && (
              <select
                value={filterDivision}
                onChange={(e) => setFilterDivision(e.target.value)}
                className="rounded-md bg-white/10 px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-white/30"
              >
                <option value="">All Divisions</option>
                {divisions.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            )}
            {(search || filterType || filterDepartment || filterDivision) && (
              <button
                onClick={() => { setSearch(""); setFilterType(""); setFilterDepartment(""); setFilterDivision(""); }}
                className="rounded-md bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20 transition"
              >
                Clear
              </button>
            )}
            <span className="text-xs opacity-50">
              {filteredItems.length} of {items.length}
            </span>
          </div>
        )}

        {loading ? (
          <div className="text-sm opacity-70">Loading...</div>
        ) : (
          <EmployeeListTable
            items={filteredItems}
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
