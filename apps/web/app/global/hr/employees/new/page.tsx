"use client";

import React from "react";
import { AppLayout, EmployeeForm } from "@repo/ui";

export default function GlobalEmployeesNewPage() {
  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-semibold">Create Global Employee</h1>
          <button
            className="px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-xs sm:text-sm transition"
            onClick={() => (window.location.href = "/global/hr/employees")}
          >
            ← Back to Employees
          </button>
        </div>
        <EmployeeForm scope={{ type: "global" }} />
      </div>
    </AppLayout>
  );
}
