"use client";

import React from "react";
import { AppLayout, EmployeeForm } from "@repo/ui";

export default function CompanyEmployeesNewPage({ params }: { params: Promise<{ companyId: string }> }) {
  const [companyId, setCompanyId] = React.useState<string>("");

  React.useEffect(() => {
    let active = true;
    async function unwrap() {
      try {
        const resolved = await params;
        const id = Array.isArray(resolved?.companyId) ? resolved.companyId[0] : resolved?.companyId;
        if (active) setCompanyId(id ?? "");
      } catch {
        if (active) setCompanyId("");
      }
    }
    unwrap();
    return () => {
      active = false;
    };
  }, [params]);

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-semibold">Create Employee</h1>
          <button
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs sm:text-sm transition"
            onClick={() => (window.location.href = `/company/${companyId}/hr/employees`)}
          >
            Back to Employees
          </button>
        </div>
        <EmployeeForm scope={{ type: "company", companyId }} />
      </div>
    </AppLayout>
  );
}
