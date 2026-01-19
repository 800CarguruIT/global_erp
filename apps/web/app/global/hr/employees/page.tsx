"use client";

import React, { useEffect, useState } from "react";
import { AppLayout, EmployeeListTable, useI18n, useTheme } from "@repo/ui";

export default function GlobalEmployeesPage() {
  return (
    <AppLayout>
      <EmployeesContent />
    </AppLayout>
  );
}

function EmployeesContent() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();
  const { theme } = useTheme();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hr/employees?scope=global");
      if (!res.ok) throw new Error(t("hr.employees.loadError"));
      const data = await res.json();
      setItems(data.data ?? []);
    } catch (err: any) {
      setError(err?.message ?? t("hr.employees.loadError"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/hr/employees/${id}?scope=global`, { method: "DELETE" });
      if (!res.ok) throw new Error(t("hr.employees.deleteError"));
      load();
    } catch (err: any) {
      setError(err?.message ?? t("hr.employees.deleteError"));
    }
  }

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold sm:text-2xl">{t("hr.employees.title")}</h1>
        <button
          className={`${theme.input} px-3 py-1.5 text-xs sm:text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 border-0`}
          onClick={() => (window.location.href = "/global/hr/employees/new")}
        >
          {t("hr.employees.new")}
        </button>
      </div>
      {error && <div className="text-sm text-destructive">{error}</div>}
      {loading ? (
        <div className="text-sm opacity-70">{t("hr.employees.loading")}</div>
      ) : (
        <EmployeeListTable
          items={items}
          onEdit={(id) => (window.location.href = `/global/hr/employees/${id}`)}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
