"use client";

import React, { useEffect, useState } from "react";
import { AppLayout, EmployeeForm } from "@repo/ui";

export default function CompanyEmployeeEditPage({
  params,
}: {
  params: { companyId: string; id: string };
}) {
  const [initial, setInitial] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setError(null);
      try {
        const res = await fetch(
          `/api/hr/employees/${params.id}?scope=company&companyId=${params.companyId}`
        );
        if (!res.ok) throw new Error("Failed to load employee");
        const data = await res.json();
        const emp = data.data ?? data;
        setInitial({
          ...emp,
          id: emp.id,
          firstName: emp.first_name,
          lastName: emp.last_name,
          fullName: emp.full_name,
          tempAddress: emp.temp_address,
          permAddress: emp.perm_address,
          phonePersonal: emp.phone_personal,
          phoneCompany: emp.phone_company,
          emailPersonal: emp.email_personal,
          emailCompany: emp.email_company,
          docIdNumber: emp.doc_id_number,
          docIdIssue: emp.doc_id_issue,
          docIdExpiry: emp.doc_id_expiry,
          docPassportNumber: emp.doc_passport_number,
          docPassportIssue: emp.doc_passport_issue,
          docPassportExpiry: emp.doc_passport_expiry,
          docIdFileId: emp.doc_id_file_id,
          docPassportFileId: emp.doc_passport_file_id,
          nationality: emp.nationality,
          title: emp.title,
          division: emp.division,
          department: emp.department,
          startDate: emp.start_date,
          dateOfBirth: emp.date_of_birth,
          basicSalary: emp.basic_salary,
          pensionAmount: emp.pension_amount,
          gratuityAmount: emp.gratuity_amount,
          visaRequired: emp.visa_required,
          visaFee: emp.visa_fee,
          immigrationFee: emp.immigration_fee,
          workPermitFee: emp.work_permit_fee,
          adminFee: emp.admin_fee,
          insuranceFee: emp.insurance_fee,
          employeeType: emp.employee_type,
          accommodationType: emp.accommodation_type,
          transportType: emp.transport_type,
          workingDaysPerWeek: emp.working_days_per_week,
          workingHoursPerDay: emp.working_hours_per_day,
          officialDayOff: emp.official_day_off,
          emergencyName: emp.emergency_name,
          emergencyPhone: emp.emergency_phone,
          emergencyEmail: emp.emergency_email,
          emergencyRelation: emp.emergency_relation,
          emergencyAddress: emp.emergency_address,
          imageFileId: emp.image_file_id,
          allowances: emp.allowances?.map((a: any) => ({
            kind: a.kind,
            label: a.label,
            amount: Number(a.amount),
          })),
        });
      } catch (err: any) {
        setError(err?.message ?? "Failed to load employee");
      }
    }
    load();
  }, [params.companyId, params.id]);

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-semibold">Edit Employee</h1>
          <button
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs sm:text-sm transition"
            onClick={() =>
              (window.location.href = `/company/${params.companyId}/hr/employees`)
            }
          >
            ← Back to Employees
          </button>
        </div>
        {error && <div className="text-red-400 text-sm">{error}</div>}
        {initial ? (
          <EmployeeForm
            mode="edit"
            scope={{ type: "company", companyId: params.companyId }}
            initialValues={initial}
          />
        ) : (
          <div className="text-sm opacity-70">Loading...</div>
        )}
      </div>
    </AppLayout>
  );
}

