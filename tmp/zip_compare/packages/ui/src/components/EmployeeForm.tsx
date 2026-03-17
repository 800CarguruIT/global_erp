"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "./Card";
import { useTheme } from "../theme";
import { ReferenceCountries } from "@repo/ai-core/reference-data";

export type EmployeeScope = "global" | "company" | "branch" | "vendor";

export type EmployeeAllowanceInput = {
  kind: string;
  label?: string | null;
  amount: number;
};

export type EmployeeFormValues = {
  id?: string;
  auto_code?: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  tempAddress?: string | null;
  permAddress?: string | null;
  currentLocation?: string | null;
  phonePersonal?: string | null;
  phoneCompany?: string | null;
  phonePersonalCode?: string | null;
  phoneCompanyCode?: string | null;
  emailPersonal?: string | null;
  emailCompany?: string | null;
  docIdNumber?: string | null;
  docIdIssue?: string | null;
  docIdExpiry?: string | null;
  docPassportNumber?: string | null;
  docPassportIssue?: string | null;
  docPassportExpiry?: string | null;
  docIdFileId?: string | null;
  docPassportFileId?: string | null;
  nationality?: string | null;
  title?: string | null;
  division?: string | null;
  department?: string | null;
  startDate?: string | null;
  dateOfBirth?: string | null;
  basicSalary: number;
  pensionAmount?: number;
  gratuityAmount?: number;
  visaRequired?: boolean;
  visaFee?: number;
  immigrationFee?: number;
  workPermitFee?: number;
  adminFee?: number;
  insuranceFee?: number;
  employeeType?: string;
  accommodationType?: string;
  transportType?: string;
  workingDaysPerWeek?: number | null;
  workingHoursPerDay?: number | null;
  officialDayOff?: string | null;
  emergencyName?: string | null;
  emergencyPhone?: string | null;
  emergencyPhoneCode?: string | null;
  emergencyEmail?: string | null;
  emergencyRelation?: string | null;
  emergencyAddress?: string | null;
  imageFileId?: string | null;
  allowances?: EmployeeAllowanceInput[];
};

type ScopeContext = {
  type: EmployeeScope;
  companyId?: string;
  branchId?: string;
  vendorId?: string;
};

type Props = {
  mode?: "create" | "edit";
  initialValues?: EmployeeFormValues;
  scope: ScopeContext;
  onSaved?: (data: any) => void;
};

function numberOr(value: any, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeUuidLike(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  // Accept UUID v4-style strings; otherwise drop to null to avoid DB uuid errors.
  const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
  return uuidPattern.test(trimmed) ? trimmed : null;
}

export function EmployeeForm({ mode = "create", initialValues, scope, onSaved }: Props) {
  const { theme } = useTheme();
  const [values, setValues] = useState<EmployeeFormValues>({
    firstName: "",
    lastName: "",
    fullName: "",
    basicSalary: 0,
    visaRequired: false,
    employeeType: "full_time",
    accommodationType: "self",
    transportType: "self",
    allowances: (initialValues?.allowances ?? []).map((a) => ({
      kind: a.kind ?? "housing",
      label: a.label ?? "",
      amount: Number.isFinite(Number(a.amount)) ? Number(a.amount) : 0,
    })),
    ...initialValues,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const idFileInputRef = useRef<HTMLInputElement | null>(null);
  const passportFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (initialValues) {
      setValues((prev) => ({ ...prev, ...initialValues }));
    }
  }, [initialValues]);

  const allowancesTotal = useMemo(
    () => (values.allowances ?? []).reduce((sum, a) => sum + numberOr(a.amount), 0),
    [values.allowances]
  );

  const phoneCodes = useMemo(() => {
    const unique = new Set<string>();
    (ReferenceCountries?.allCountries ?? []).forEach((c) => {
      if (c.dialCode) unique.add(c.dialCode);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, []);

  const govFeeTotal = useMemo(() => {
    if (!values.visaRequired) return 0;
    return (
      numberOr(values.visaFee) +
      numberOr(values.immigrationFee) +
      numberOr(values.workPermitFee) +
      numberOr(values.adminFee) +
      numberOr(values.insuranceFee)
    );
  }, [values]);

  const grandTotal = useMemo(
    () => numberOr(values.basicSalary) + allowancesTotal + govFeeTotal,
    [allowancesTotal, govFeeTotal, values.basicSalary]
  );

  function updateValue<K extends keyof EmployeeFormValues>(key: K, value: EmployeeFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function updateAllowance(idx: number, patch: Partial<EmployeeAllowanceInput>) {
    setValues((prev) => {
      const next = [...(prev.allowances ?? [])];
      const base: EmployeeAllowanceInput =
        next[idx] ?? {
          kind: "housing",
          amount: 0,
          label: "",
        };
      next[idx] = { ...base, ...patch };
      return { ...prev, allowances: next };
    });
  }

  function removeAllowance(idx: number) {
    setValues((prev) => {
      const next = [...(prev.allowances ?? [])];
      next.splice(idx, 1);
      return { ...prev, allowances: next };
    });
  }

  function splitNameParts(full: string): { firstName: string; lastName: string } {
    const parts = (full || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { firstName: "", lastName: "" };
    if (parts.length === 1) return { firstName: parts[0], lastName: "" };
    const firstName = parts.slice(0, parts.length - 1).join(" ");
    const lastName = parts[parts.length - 1];
    return { firstName, lastName };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const { firstName, lastName } = splitNameParts(values.fullName || "");
      const payload = {
        scope: scope.type,
        companyId: scope.companyId ?? null,
        branchId: scope.branchId ?? null,
        vendorId: scope.vendorId ?? null,
        firstName,
        lastName,
        fullName: values.fullName ?? "",
        tempAddress: values.tempAddress ?? null,
        permAddress: values.permAddress ?? null,
        currentLocation: values.currentLocation ?? null,
        phonePersonal: values.phonePersonal ?? null,
        phoneCompany: values.phoneCompany ?? null,
        emailPersonal: values.emailPersonal ?? null,
        emailCompany: values.emailCompany ?? null,
        docIdNumber: values.docIdNumber ?? null,
        docIdIssue: values.docIdIssue ?? null,
        docIdExpiry: values.docIdExpiry ?? null,
        docPassportNumber: values.docPassportNumber ?? null,
        docPassportIssue: values.docPassportIssue ?? null,
        docPassportExpiry: values.docPassportExpiry ?? null,
        docIdFileId: normalizeUuidLike(values.docIdFileId),
        docPassportFileId: normalizeUuidLike(values.docPassportFileId),
        nationality: values.nationality ?? null,
        title: values.title ?? null,
        division: values.division ?? null,
        department: values.department ?? null,
        startDate: values.startDate ?? null,
        dateOfBirth: values.dateOfBirth ?? null,
        basicSalary: numberOr(values.basicSalary, 0),
        pensionAmount: numberOr(values.pensionAmount, 0),
        gratuityAmount: numberOr(values.gratuityAmount, 0),
        visaRequired: !!values.visaRequired,
        visaFee: numberOr(values.visaFee, 0),
        immigrationFee: numberOr(values.immigrationFee, 0),
        workPermitFee: numberOr(values.workPermitFee, 0),
        adminFee: numberOr(values.adminFee, 0),
        insuranceFee: numberOr(values.insuranceFee, 0),
        employeeType: values.employeeType ?? "full_time",
        accommodationType: values.accommodationType ?? "self",
        transportType: values.transportType ?? "self",
        workingDaysPerWeek: values.workingDaysPerWeek ?? null,
        workingHoursPerDay: values.workingHoursPerDay ?? null,
        officialDayOff: values.officialDayOff ?? null,
        emergencyName: values.emergencyName ?? null,
        emergencyPhone: values.emergencyPhone ?? null,
        emergencyEmail: values.emergencyEmail ?? null,
        emergencyRelation: values.emergencyRelation ?? null,
        emergencyAddress: values.emergencyAddress ?? null,
        imageFileId: normalizeUuidLike(values.imageFileId),
        allowances: (values.allowances ?? []).slice(0, 5),
      };

      const url =
        mode === "edit" && values.id
          ? `/api/hr/employees/${values.id}`
          : "/api/hr/employees";
      const res = await fetch(url, {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save employee");
      }
      const data = await res.json();
      setSuccess("Employee saved");
      onSaved?.(data);
    } catch (err: any) {
      setError(err?.message ?? "Failed to save employee");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = `${theme.inputBg} ${theme.inputBorder} ${theme.inputText} ${theme.inputPlaceholder} rounded-lg px-3 py-2 w-full text-sm`;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card title="Identity">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs uppercase opacity-70">Image attachment</label>
            <div className="flex gap-2">
              <input
                className={`${inputClass} flex-1`}
                value={values.imageFileId ?? ""}
                onChange={(e) => updateValue("imageFileId", e.target.value)}
                placeholder="Upload or paste file id / URL"
              />
              <button
                type="button"
                className="px-3 py-2 rounded-lg border border-white/20 text-xs hover:border-white/40"
                onClick={() => fileInputRef.current?.click()}
              >
                Upload
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    updateValue("imageFileId", file.name);
                  }
                }}
              />
            </div>
            {values.imageFileId && (
              <div className="text-[11px] opacity-70 mt-1">Selected: {values.imageFileId}</div>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs uppercase opacity-70">Full name</label>
            <input
              className={inputClass}
              value={values.fullName ?? ""}
              onChange={(e) => updateValue("fullName", e.target.value)}
              placeholder="Employee full name"
              required
            />
          </div>
          <div>
            <label className="text-xs uppercase opacity-70">Position</label>
            <select
              className={inputClass}
              value={values.title ?? ""}
              onChange={(e) => updateValue("title", e.target.value)}
            >
              <option value="">Select position</option>
              <option value="manager">Manager</option>
              <option value="supervisor">Supervisor</option>
              <option value="advisor">Service Advisor</option>
              <option value="technician">Technician</option>
              <option value="driver">Driver</option>
              <option value="dispatcher">Dispatcher</option>
              <option value="accountant">Accountant</option>
              <option value="hr">HR</option>
              <option value="sales">Sales</option>
              <option value="support">Support</option>
              <option value="admin">Admin</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-xs uppercase opacity-70">Division</label>
            <select
              className={inputClass}
              value={values.division ?? ""}
              onChange={(e) => updateValue("division", e.target.value)}
            >
              <option value="">Select division</option>
              <option value="operations">Operations</option>
              <option value="sales">Sales</option>
              <option value="support">Support</option>
              <option value="marketing">Marketing</option>
              <option value="finance">Finance</option>
              <option value="hr">HR</option>
              <option value="it">IT</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-xs uppercase opacity-70">Department</label>
            <select
              className={inputClass}
              value={values.department ?? ""}
              onChange={(e) => updateValue("department", e.target.value)}
            >
              <option value="">Select department</option>
              <option value="workshop">Workshop</option>
              <option value="field">Field Service</option>
              <option value="call_center">Call Center</option>
              <option value="admin">Admin</option>
              <option value="procurement">Procurement</option>
              <option value="logistics">Logistics</option>
              <option value="quality">Quality</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-xs uppercase opacity-70">Nationality</label>
            <select
              className={inputClass}
              value={values.nationality ?? ""}
              onChange={(e) => updateValue("nationality", e.target.value)}
            >
              <option value="">Select nationality</option>
              <option value="AE">United Arab Emirates</option>
              <option value="SA">Saudi Arabia</option>
              <option value="OM">Oman</option>
              <option value="QA">Qatar</option>
              <option value="KW">Kuwait</option>
              <option value="BH">Bahrain</option>
              <option value="PK">Pakistan</option>
              <option value="IN">India</option>
              <option value="BD">Bangladesh</option>
              <option value="PH">Philippines</option>
              <option value="EG">Egypt</option>
              <option value="JO">Jordan</option>
              <option value="LB">Lebanon</option>
              <option value="US">United States</option>
              <option value="GB">United Kingdom</option>
              <option value="CA">Canada</option>
              <option value="FR">France</option>
              <option value="DE">Germany</option>
              <option value="CN">China</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-xs uppercase opacity-70">Date of birth</label>
            <input
              type="date"
              className={inputClass}
              value={values.dateOfBirth ?? ""}
              onChange={(e) => updateValue("dateOfBirth", e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs uppercase opacity-70">Start date</label>
            <input
              type="date"
              className={inputClass}
              value={values.startDate ?? ""}
              onChange={(e) => updateValue("startDate", e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs uppercase opacity-70">Employee type</label>
            <select
              className={inputClass}
              value={values.employeeType ?? "full_time"}
              onChange={(e) => updateValue("employeeType", e.target.value)}
            >
              <option value="full_time">Full time</option>
              <option value="part_time">Part time</option>
              <option value="probation">Probation</option>
            </select>
          </div>
          <div>
            <label className="text-xs uppercase opacity-70">Working days per week</label>
            <select
              className={inputClass}
              value={values.workingDaysPerWeek ?? ""}
              onChange={(e) => updateValue("workingDaysPerWeek", Number(e.target.value))}
            >
              <option value="">Select</option>
              <option value={5}>5</option>
              <option value={6}>6</option>
              <option value={7}>7</option>
            </select>
          </div>
          <div>
            <label className="text-xs uppercase opacity-70">Working hours per day</label>
            <select
              className={inputClass}
              value={values.workingHoursPerDay ?? ""}
              onChange={(e) => updateValue("workingHoursPerDay", Number(e.target.value))}
            >
              <option value="">Select</option>
              <option value={6}>6</option>
              <option value={8}>8</option>
              <option value={9}>9</option>
              <option value={10}>10</option>
              <option value={12}>12</option>
            </select>
          </div>
          <div>
            <label className="text-xs uppercase opacity-70">Official day off</label>
            <select
              className={inputClass}
              value={values.officialDayOff ?? ""}
              onChange={(e) => updateValue("officialDayOff", e.target.value)}
            >
              <option value="">Select</option>
              <option value="sunday">Sunday</option>
              <option value="monday">Monday</option>
              <option value="tuesday">Tuesday</option>
              <option value="wednesday">Wednesday</option>
              <option value="thursday">Thursday</option>
              <option value="friday">Friday</option>
              <option value="saturday">Saturday</option>
            </select>
          </div>
        </div>
      </Card>

      <Card title="Contact & Addresses">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs uppercase opacity-70">Personal phone</label>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <input
                  className={inputClass}
                  list="phone-codes-personal"
                  placeholder="Code"
                  value={values.phonePersonalCode ?? ""}
                  onChange={(e) => updateValue("phonePersonalCode", e.target.value)}
                />
                <datalist id="phone-codes-personal">
                  {phoneCodes.map((code) => (
                    <option key={code} value={code} />
                  ))}
                </datalist>
              </div>
              <input
                className={`${inputClass} col-span-2`}
                placeholder="Phone number"
                value={values.phonePersonal ?? ""}
                onChange={(e) => updateValue("phonePersonal", e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-xs uppercase opacity-70">Company phone</label>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <input
                  className={inputClass}
                  list="phone-codes-company"
                  placeholder="Code"
                  value={values.phoneCompanyCode ?? ""}
                  onChange={(e) => updateValue("phoneCompanyCode", e.target.value)}
                />
                <datalist id="phone-codes-company">
                  {phoneCodes.map((code) => (
                    <option key={code} value={code} />
                  ))}
                </datalist>
              </div>
              <input
                className={`${inputClass} col-span-2`}
                placeholder="Phone number"
                value={values.phoneCompany ?? ""}
                onChange={(e) => updateValue("phoneCompany", e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-xs uppercase opacity-70">Personal email</label>
            <input
              className={inputClass}
              value={values.emailPersonal ?? ""}
              onChange={(e) => updateValue("emailPersonal", e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs uppercase opacity-70">Company email</label>
            <input
              className={inputClass}
              value={values.emailCompany ?? ""}
              onChange={(e) => updateValue("emailCompany", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs uppercase opacity-70">Temporary address</label>
            <textarea
              className={`${inputClass} min-h-[80px]`}
              value={values.tempAddress ?? ""}
              onChange={(e) => updateValue("tempAddress", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs uppercase opacity-70">Permanent address</label>
            <textarea
              className={`${inputClass} min-h-[80px]`}
              value={values.permAddress ?? ""}
              onChange={(e) => updateValue("permAddress", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs uppercase opacity-70">Current location (Google Maps link / address)</label>
            <input
              className={inputClass}
              value={values.currentLocation ?? ""}
              onChange={(e) => updateValue("currentLocation", e.target.value)}
              placeholder="Paste embedded map link or address"
            />
            <div className="text-xs opacity-70 mt-1">
              Stored for dispatching and location-aware workflows.
            </div>
          </div>
        </div>
      </Card>

      <Card title="Documents">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs uppercase opacity-70">ID number</label>
            <input
              className={inputClass}
              value={values.docIdNumber ?? ""}
              onChange={(e) => updateValue("docIdNumber", e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs uppercase opacity-70">ID issue date</label>
            <input
              type="date"
              className={inputClass}
              value={values.docIdIssue ?? ""}
              onChange={(e) => updateValue("docIdIssue", e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs uppercase opacity-70">ID expiry</label>
            <input
              type="date"
              className={inputClass}
              value={values.docIdExpiry ?? ""}
              onChange={(e) => updateValue("docIdExpiry", e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs uppercase opacity-70">ID file ID / URL</label>
            <div className="flex gap-2">
              <input
                className={`${inputClass} flex-1`}
                value={values.docIdFileId ?? ""}
                onChange={(e) => updateValue("docIdFileId", e.target.value)}
                placeholder="Upload or paste file id / URL"
              />
              <button
                type="button"
                className="px-3 py-2 rounded-lg border border-white/20 text-xs hover:border-white/40"
                onClick={() => idFileInputRef.current?.click()}
              >
                Upload
              </button>
              <input
                ref={idFileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) updateValue("docIdFileId", file.name);
                }}
              />
            </div>
          </div>
          <div>
            <label className="text-xs uppercase opacity-70">Passport number</label>
            <input
              className={inputClass}
              value={values.docPassportNumber ?? ""}
              onChange={(e) => updateValue("docPassportNumber", e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs uppercase opacity-70">Passport issue</label>
            <input
              type="date"
              className={inputClass}
              value={values.docPassportIssue ?? ""}
              onChange={(e) => updateValue("docPassportIssue", e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs uppercase opacity-70">Passport expiry</label>
            <input
              type="date"
              className={inputClass}
              value={values.docPassportExpiry ?? ""}
              onChange={(e) => updateValue("docPassportExpiry", e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs uppercase opacity-70">Passport file ID / URL</label>
            <div className="flex gap-2">
              <input
                className={`${inputClass} flex-1`}
                value={values.docPassportFileId ?? ""}
                onChange={(e) => updateValue("docPassportFileId", e.target.value)}
                placeholder="Upload or paste file id / URL"
              />
              <button
                type="button"
                className="px-3 py-2 rounded-lg border border-white/20 text-xs hover:border-white/40"
                onClick={() => passportFileInputRef.current?.click()}
              >
                Upload
              </button>
              <input
                ref={passportFileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) updateValue("docPassportFileId", file.name);
                }}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card title="Compensation">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs uppercase opacity-70">Basic salary</label>
            <input
              type="number"
              step="0.01"
              className={inputClass}
              value={values.basicSalary}
              onChange={(e) => updateValue("basicSalary", Number(e.target.value))}
              required
            />
          </div>
          <div>
            <label className="text-xs uppercase opacity-70">Pension amount</label>
            <input
              type="number"
              step="0.01"
              className={inputClass}
              value={values.pensionAmount ?? 0}
              onChange={(e) => updateValue("pensionAmount", Number(e.target.value))}
            />
          </div>
          <div>
            <label className="text-xs uppercase opacity-70">Gratuity amount</label>
            <input
              type="number"
              step="0.01"
              className={inputClass}
              value={values.gratuityAmount ?? 0}
              onChange={(e) => updateValue("gratuityAmount", Number(e.target.value))}
            />
          </div>
        </div>
      </Card>

      <Card title="Allowances (max 5)">
        <div className="space-y-3">
          {(values.allowances ?? []).map((row, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-4">
                <label className="text-xs uppercase opacity-70">Kind</label>
                <select
                  className={inputClass}
                  value={row.kind}
                  onChange={(e) => updateAllowance(idx, { kind: e.target.value })}
                >
                  <option value="housing">Housing</option>
                  <option value="transport">Transport</option>
                  <option value="education">Education</option>
                  <option value="medical">Medical</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="col-span-5">
                <label className="text-xs uppercase opacity-70">Label</label>
                <input
                  className={inputClass}
                  value={row.label ?? ""}
                  onChange={(e) => updateAllowance(idx, { label: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs uppercase opacity-70">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  className={inputClass}
                  value={row.amount}
                  onChange={(e) => updateAllowance(idx, { amount: Number(e.target.value) })}
                />
              </div>
              <div className="col-span-1">
                <button
                  type="button"
                  onClick={() => removeAllowance(idx)}
                  className="text-sm px-2 py-2 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-100"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}

          {(values.allowances ?? []).length < 5 && (
            <button
              type="button"
              className="text-xs px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
              onClick={() =>
                setValues((prev) => ({
                  ...prev,
                  allowances: [...(prev.allowances ?? []), { kind: "housing", amount: 0 }],
                }))
              }
            >
              + Add allowance
            </button>
          )}
          <div className="text-sm opacity-80">Allowances total: {allowancesTotal.toFixed(2)}</div>
        </div>
      </Card>

      <Card title="Visa / Government fees">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-1">
            <label className="text-xs uppercase opacity-70">Visa required</label>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!values.visaRequired}
                onChange={(e) => updateValue("visaRequired", e.target.checked)}
              />
              <span className="text-sm">Yes</span>
            </div>
          </div>
          {values.visaRequired && (
            <>
              <div>
                <label className="text-xs uppercase opacity-70">Visa fee</label>
                <input
                  type="number"
                  step="0.01"
                  className={inputClass}
                  value={values.visaFee ?? 0}
                  onChange={(e) => updateValue("visaFee", Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs uppercase opacity-70">Immigration fee</label>
                <input
                  type="number"
                  step="0.01"
                  className={inputClass}
                  value={values.immigrationFee ?? 0}
                  onChange={(e) => updateValue("immigrationFee", Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs uppercase opacity-70">Visa issue date</label>
                <input
                  type="date"
                  className={inputClass}
                  value={(values as any).visaIssue ?? ""}
                  onChange={(e) => updateValue("visaIssue" as any, e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs uppercase opacity-70">Visa expiry date</label>
                <input
                  type="date"
                  className={inputClass}
                  value={(values as any).visaExpiry ?? ""}
                  onChange={(e) => updateValue("visaExpiry" as any, e.target.value)}
                />
              </div>
            </>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          <div>
            <label className="text-xs uppercase opacity-70">Work permit fee</label>
            <input
              type="number"
              step="0.01"
              className={inputClass}
              value={values.workPermitFee ?? 0}
              onChange={(e) => updateValue("workPermitFee", Number(e.target.value))}
            />
          </div>
          <div>
            <label className="text-xs uppercase opacity-70">Admin fee</label>
            <input
              type="number"
              step="0.01"
              className={inputClass}
              value={values.adminFee ?? 0}
              onChange={(e) => updateValue("adminFee", Number(e.target.value))}
            />
          </div>
          <div>
            <label className="text-xs uppercase opacity-70">Insurance fee</label>
            <input
              type="number"
              step="0.01"
              className={inputClass}
              value={values.insuranceFee ?? 0}
              onChange={(e) => updateValue("insuranceFee", Number(e.target.value))}
            />
          </div>
        </div>
      </Card>

      <Card title="Accommodation & Transport">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs uppercase opacity-70">Accommodation</label>
            <select
              className={inputClass}
              value={values.accommodationType ?? "self"}
              onChange={(e) => updateValue("accommodationType", e.target.value)}
            >
              <option value="self">Self</option>
              <option value="company">Company</option>
            </select>
          </div>
          <div>
            <label className="text-xs uppercase opacity-70">Transport</label>
            <select
              className={inputClass}
              value={values.transportType ?? "self"}
              onChange={(e) => updateValue("transportType", e.target.value)}
            >
              <option value="self">Self</option>
              <option value="company">Company</option>
            </select>
          </div>
        </div>
      </Card>

      <Card title="Emergency contact">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs uppercase opacity-70">Name</label>
            <input
              className={inputClass}
              value={values.emergencyName ?? ""}
              onChange={(e) => updateValue("emergencyName", e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs uppercase opacity-70">Relation</label>
            <input
              className={inputClass}
              value={values.emergencyRelation ?? ""}
              onChange={(e) => updateValue("emergencyRelation", e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs uppercase opacity-70">Phone</label>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <input
                  className={inputClass}
                  list="phone-codes-emergency"
                  placeholder="Code"
                  value={values.emergencyPhoneCode ?? ""}
                  onChange={(e) => updateValue("emergencyPhoneCode", e.target.value)}
                />
                <datalist id="phone-codes-emergency">
                  {phoneCodes.map((code) => (
                    <option key={code} value={code} />
                  ))}
                </datalist>
              </div>
              <input
                className={`${inputClass} col-span-2`}
                placeholder="Phone number"
                value={values.emergencyPhone ?? ""}
                onChange={(e) => updateValue("emergencyPhone", e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-xs uppercase opacity-70">Email</label>
            <input
              className={inputClass}
              value={values.emergencyEmail ?? ""}
              onChange={(e) => updateValue("emergencyEmail", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs uppercase opacity-70">Address</label>
            <textarea
              className={`${inputClass} min-h-[70px]`}
              value={values.emergencyAddress ?? ""}
              onChange={(e) => updateValue("emergencyAddress", e.target.value)}
            />
          </div>
        </div>
      </Card>

      <Card title="Totals">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
          <div>Basic salary: {numberOr(values.basicSalary).toFixed(2)}</div>
          <div>Allowances total: {allowancesTotal.toFixed(2)}</div>
          <div>Government fees: {govFeeTotal.toFixed(2)}</div>
          <div className="font-semibold">Grand total: {grandTotal.toFixed(2)}</div>
        </div>
      </Card>

      {error && <div className="text-red-400 text-sm">{error}</div>}
      {success && <div className="text-green-400 text-sm">{success}</div>}

      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 via-indigo-500 to-fuchsia-500 text-white shadow-lg disabled:opacity-50"
      >
        {saving ? "Saving..." : mode === "edit" ? "Update Employee" : "Create Employee"}
      </button>
    </form>
  );
}
