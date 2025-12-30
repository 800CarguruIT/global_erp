"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppLayout, Card, useTheme } from "@repo/ui";
import Link from "next/link";
import { PhoneInput } from "@repo/ui/components/common/PhoneInput";
import type { PhoneValue } from "@repo/ui/components/common/PhoneInput";
import { CarMakeModelSelect } from "@repo/ui/components/common/CarMakeModelSelect";
import { ReferenceData } from "@repo/ai-core/client";
import { PlateInput, PlateValue } from "@repo/ui/components/common/PlateInput";
import { FileUploader } from "@repo/ui";

type AgentOption = { id: string; name: string };
type LookupResult = {
  customerName?: string | null;
  phoneCode?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  whatsappPhoneCode?: string | null;
  whatsappPhoneNumber?: string | null;
  cars?: Array<{
    id: string;
    make?: string | null;
    model?: string | null;
    year?: string | number | null;
    plateCountry?: string | null;
    plateCode?: string | null;
    plateNumber?: string | null;
    plateState?: string | null;
    plateCity?: string | null;
    plateLocationMode?: PlateValue["locationMode"] | null;
    vin?: string | null;
    vinPhotoFileId?: string | null;
    tyreSizeFront?: string | null;
    tyreSizeBack?: string | null;
    registrationExpiry?: string | null;
    registrationCardFileId?: string | null;
    mileage?: number | null;
    registrationCardFileId?: string | null;
    registrationExpiry?: string | null;
  }>;
};

const EMPTY_PHONE: PhoneValue = { dialCode: "+971", nationalNumber: "" };
const LEAD_DIVISIONS = [
  { value: "rsa", label: "Roadside Assistance (RSA)" },
  { value: "recovery", label: "Recovery (Towing)" },
  { value: "workshop", label: "Workshop" },
];

const LEAD_TYPES = [
  { value: "sales", label: "Sales" },
  { value: "support", label: "Support" },
  { value: "complaint", label: "Complaint" },
];

export default function CompanyLeadCreatePage({
  params,
}: {
  params: { companyId: string } | Promise<{ companyId: string }>;
}) {
  const { theme } = useTheme();
  const searchParams = useSearchParams();

  const preset = useMemo(() => {
    const name = searchParams?.get("customerName") ?? "";
    const phoneRaw = searchParams?.get("phone") ?? "";
    const email = searchParams?.get("email") ?? "";
    const plate = searchParams?.get("plate") ?? "";
    const carId = searchParams?.get("carId") ?? "";
    const customerId = searchParams?.get("customerId") ?? "";
    const parsedPhone = parsePhoneValue(phoneRaw, EMPTY_PHONE);
    return { name, phone: parsedPhone, email, plate, carId, customerId };
  }, [searchParams]);

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [branchesError, setBranchesError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [linkedCars, setLinkedCars] = useState<LookupResult["cars"]>([]);
  const [selectedCarId, setSelectedCarId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(preset.customerId || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    customerName: preset.name || "",
    phone: preset.phone as PhoneValue,
    whatsappPhone: EMPTY_PHONE as PhoneValue,
    useDifferentWhatsapp: false,
    email: preset.email || "",
    carMake: "",
    carModel: "",
    carYear: "",
    plateCountry: "AE",
    plateLocationMode: undefined as PlateValue["locationMode"],
    plateState: "",
    plateCity: "",
    plateCode: "",
    plateNumber: "",
    vinNumber: "",
    vinPhotoFileId: "",
    mileage: "",
    tyreSizeFront: "",
    tyreSizeBack: "",
    registrationExpiry: "",
    registrationCardFileId: "",
    leadDivision: "rsa",
    leadType: "sales",
    assignTo: "",
    customerRemarks: "",
    agentRemarks: "",
    rsaServiceType: "",
    recoveryType: "",
    recoveryDirection: "",
    recoveryFlow: "",
    pickupFrom: "",
    dropoffTo: "",
    pickupGoogleLocation: "",
    dropoffGoogleLocation: "",
    rsaLocation: "",
    rsaGoogleLocation: "",
    recoveryBranchId: "",
    lastRecoveryFlow: "",
    workshopFlow: "",
    workshopVisitType: "walkin",
    recoveryType: "",
    appointmentAt: "",
    pickupLocation: "",
    pickupLocationGoogle: "",
    workshopInquiry: "",
  });

    const isWorkshop = form.leadDivision === "workshop";
    const isDirectEstimate = isWorkshop && form.workshopFlow === "direct_estimate";

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      customerName: preset.name || prev.customerName,
      phone: preset.phone ?? prev.phone,
      email: preset.email || prev.email,
    }));
  }, [preset.name, preset.phone, preset.email]);

  useEffect(() => {
    Promise.resolve(params).then((p) => setCompanyId(p?.companyId ?? null));
  }, [params]);

  useEffect(() => {
    if (!companyId) return;
    // load agents (best-effort)
    fetch(`/api/company/${companyId}/hr/employees?scope=agents`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        const list: AgentOption[] = (data?.data ?? data ?? []).map((a: any) => ({
          id: a.id ?? a.employeeId ?? a.userId ?? "",
          name: a.name ?? a.fullName ?? a.email ?? "Agent",
        }));
        setAgents(list);
        if (list.length) {
          setForm((prev) => ({ ...prev, assignTo: list[0].id }));
        }
      })
      .catch(() => {
        // ignore
      });
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    fetch(`/api/company/${companyId}/branches`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        setBranches(data?.data ?? data?.branches ?? []);
        setBranchesError(null);
      })
      .catch(() => setBranchesError("Failed to load branches"));
  }, [companyId]);

  useEffect(() => {
    if (isDirectEstimate) {
      setForm((prev) => ({
        ...prev,
        workshopVisitType: "walkin",
        pickupLocation: "",
      }));
    }
  }, [isDirectEstimate]);

  useEffect(() => {
    setForm((prev) => {
      if (prev.recoveryFlow === prev.lastRecoveryFlow) return prev;
      return {
        ...prev,
        lastRecoveryFlow: prev.recoveryFlow,
        pickupFrom: "",
        dropoffTo: "",
        pickupGoogleLocation: "",
        dropoffGoogleLocation: "",
        recoveryBranchId: "",
      };
    });
  }, [form.recoveryFlow, form.recoveryDirection]);

  const plateCodes = useMemo(() => {
    const fmt = ReferenceData.ReferencePlateFormats.getPlateFormat(form.plateCountry);
    return fmt?.codes ?? [];
  }, [form.plateCountry]);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleLookup() {
    if (!companyId) return;
    setLookupLoading(true);
    setLookupError(null);
    setLinkedCars([]);
    setSelectedCarId(null);
    try {
      const phoneParam = `${form.phone.dialCode ?? ""}${form.phone.nationalNumber ?? ""}`.replace(/\s+/g, "");
      const res = await fetch(
        `/api/company/${companyId}/crm/customers/lookup?phone=${encodeURIComponent(
          phoneParam
        )}&plate=${encodeURIComponent(form.plateNumber)}`
      );
      if (!res.ok) throw new Error("Lookup failed");
      const data: LookupResult = await res.json();
      if (data) {
        setForm((prev) => {
          const parsedWhatsapp =
            data.whatsappPhoneCode || data.whatsappPhoneNumber
              ? parsePhoneValue(`${data.whatsappPhoneCode ?? ""}${data.whatsappPhoneNumber ?? ""}`, prev.whatsappPhone)
              : {
                  dialCode: data.phoneCode ?? prev.phone.dialCode,
                  nationalNumber: data.phoneNumber ?? prev.phone.nationalNumber,
                };
          return {
            ...prev,
            customerName: data.customerName ?? prev.customerName,
            phone: {
              dialCode: data.phoneCode ?? prev.phone.dialCode,
              nationalNumber: data.phoneNumber ?? prev.phone.nationalNumber,
            },
            whatsappPhone: parsedWhatsapp,
            useDifferentWhatsapp: !!(data.whatsappPhoneCode || data.whatsappPhoneNumber),
            email: data.email ?? prev.email,
          };
        });
        setSelectedCustomerId((data as any).customerId ?? null);
        setLinkedCars(data.cars ?? []);
        if (data.cars && data.cars.length) {
          setSelectedCarId(data.cars[0].id ?? null);
        }
      }
    } catch (err: any) {
      setLookupError(err?.message ?? "Lookup failed");
    } finally {
      setLookupLoading(false);
    }
  }

  function applyLinkedCar(carId: string) {
    const car = linkedCars?.find((c) => c.id === carId);
    if (!car) return;
    setSelectedCarId(carId);
    setForm((prev) => ({
      ...prev,
      carMake: car.make ?? prev.carMake,
      carModel: car.model ?? prev.carModel,
      carYear: car.year ? String(car.year) : prev.carYear,
      plateCountry: car.plateCountry ?? prev.plateCountry,
      plateLocationMode: car.plateLocationMode ?? prev.plateLocationMode,
      plateState: car.plateState ?? prev.plateState,
      plateCity: car.plateCity ?? prev.plateCity,
      plateCode: car.plateCode ?? prev.plateCode,
      plateNumber: car.plateNumber ?? prev.plateNumber,
      vinNumber: car.vin ?? prev.vinNumber,
      vinPhotoFileId: car.vinPhotoFileId ?? prev.vinPhotoFileId,
      mileage: car.mileage ? String(car.mileage) : prev.mileage,
      tyreSizeFront: car.tyreSizeFront ?? prev.tyreSizeFront,
      tyreSizeBack: car.tyreSizeBack ?? prev.tyreSizeBack,
      registrationExpiry: car.registrationExpiry ?? prev.registrationExpiry,
      registrationCardFileId: car.registrationCardFileId ?? prev.registrationCardFileId,
    }));
  }

  // Auto-lookup when arriving with prefilled phone/plate/car/customer from manual lookup
  useEffect(() => {
    if (!companyId) return;
    if ((preset.phone?.nationalNumber && preset.phone?.dialCode) || preset.plate || preset.carId || preset.customerId) {
      setForm((prev) => ({
        ...prev,
        plateNumber: preset.plate || prev.plateNumber,
      }));
      handleLookup();
    }
  }, [companyId, preset.phone?.nationalNumber, preset.plate, preset.carId, preset.customerId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) return;
    setSaving(true);
    setError(null);
    try {
      if (form.leadDivision === "workshop") {
        if (!form.workshopFlow) {
          setError("Workshop flow is required");
          setSaving(false);
          return;
        }
        if (form.workshopVisitType === "pickup" && !form.recoveryType) {
          setError("Recovery type is required for pickup");
          setSaving(false);
          return;
        }
      }
      if (form.leadDivision === "rsa") {
        if (!form.rsaServiceType) {
          setError("RSA service type is required");
          setSaving(false);
          return;
        }
        if (!form.rsaGoogleLocation) {
          setError("RSA location is required");
          setSaving(false);
          return;
        }
      }
      const payload = {
        customer: {
          name: form.customerName,
          phoneCode: form.phone.dialCode,
          phoneNumber: form.phone.nationalNumber,
          whatsappPhoneCode: form.useDifferentWhatsapp ? form.whatsappPhone.dialCode : form.phone.dialCode,
          whatsappPhoneNumber: form.useDifferentWhatsapp ? form.whatsappPhone.nationalNumber : form.phone.nationalNumber,
          email: form.email,
        },
        customerId: selectedCustomerId || undefined,
        car: {
          id: selectedCarId || undefined,
          make: form.carMake,
          model: form.carModel,
          year: form.carYear,
          plateCountry: form.plateCountry,
          plateCode: form.plateCode,
          plateState: form.plateState,
          plateCity: form.plateCity,
          plateLocationMode: form.plateLocationMode,
          plateNumber: form.plateNumber,
          vin: form.vinNumber,
          vinPhotoFileId: form.vinPhotoFileId || null,
          mileage: form.mileage ? Number(form.mileage) : null,
          tyreSizeFront: form.tyreSizeFront || null,
          tyreSizeBack: form.tyreSizeBack || null,
          registrationExpiry: form.registrationExpiry || null,
          registrationCardFileId: form.registrationCardFileId || null,
        },
        leadType: form.leadDivision, // backend lead type (legacy)
        leadDivision: form.leadDivision,
        leadCategory: form.leadType,
        serviceType:
          form.leadDivision === "rsa"
            ? form.rsaServiceType || null
              : form.leadDivision === "recovery"
                ? form.recoveryType || null
                : form.leadDivision === "workshop" && form.workshopVisitType === "pickup"
                  ? form.recoveryType || null
                  : null,
        recoveryDirection: form.leadDivision === "recovery" ? form.recoveryDirection || null : null,
        recoveryFlow:
          form.leadDivision === "recovery"
            ? form.recoveryDirection === "dropoff"
              ? "branch_to_customer"
              : form.recoveryFlow || null
            : null,
        pickupFrom:
          form.leadDivision === "recovery"
            ? form.pickupFrom || null
            : form.leadDivision === "rsa"
              ? form.rsaLocation || null
              : null,
        pickupGoogleLocation:
          form.leadDivision === "recovery"
            ? form.pickupGoogleLocation || form.pickupFrom || null
            : form.leadDivision === "rsa"
              ? form.rsaGoogleLocation || form.rsaLocation || null
              : form.leadDivision === "workshop" && form.workshopVisitType === "pickup"
                ? form.pickupLocationGoogle || form.pickupLocation || null
                : null,
        dropoffTo: form.leadDivision === "recovery" ? form.dropoffTo || null : null,
        dropoffGoogleLocation:
          form.leadDivision === "recovery"
            ? form.dropoffGoogleLocation || form.dropoffTo || null
            : null,
        branchId:
          form.leadDivision === "recovery" && form.recoveryDirection === "pickup" ? form.recoveryBranchId || null : undefined,
        workshopFlow: form.leadDivision === "workshop" ? form.workshopFlow : undefined,
        workshopVisitType: form.leadDivision === "workshop" ? form.workshopVisitType : undefined,
        appointmentAt: form.leadDivision === "workshop" ? form.appointmentAt || null : null,
        pickupLocation:
          form.leadDivision === "workshop" && form.workshopVisitType === "pickup" ? form.pickupLocation : "",
        pickupLocationGoogle: form.leadDivision === "workshop" && form.workshopVisitType === "pickup" ? form.pickupLocationGoogle : "",
        workshopInquiry: form.leadDivision === "workshop" ? form.workshopInquiry : undefined,
        assignTo: form.assignTo || null,
        customerRemarks: form.customerRemarks,
        agentRemarks: form.agentRemarks,
      };
      const res = await fetch(`/api/company/${companyId}/sales/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to create lead");
      }
      window.location.href = `/company/${companyId}/leads`;
    } catch (err: any) {
      setError(err?.message ?? "Failed to create lead");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = theme.input;
  const labelClass = "text-xs font-semibold text-muted-foreground";

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Create Lead</h1>
            <p className="text-sm text-muted-foreground">Capture customer and car details for a new lead.</p>
          </div>
          <Link href={companyId ? `/company/${companyId}/leads` : "#"} className="text-sm text-primary hover:underline">
            Back to leads
          </Link>
        </div>

        {error && <div className="text-sm text-destructive">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-4 md:col-span-2">
              <Card className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-lg font-semibold">Customer</div>
                  <button
                    type="button"
                    onClick={handleLookup}
                    className="rounded-md border px-3 py-1 text-sm"
                    disabled={lookupLoading}
                  >
                    {lookupLoading ? "Searching..." : "Lookup by phone/plate"}
                  </button>
                </div>
                {lookupError && <div className="text-sm text-destructive">{lookupError}</div>}
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className={labelClass}>Customer Name</div>
                    <input
                      className={inputClass}
                      value={form.customerName}
                      onChange={(e) => update("customerName", e.target.value)}
                      required
                    />
                  </div>
                <div>
                  <div className={labelClass}>Phone</div>
                  <PhoneInput
                    value={form.phone}
                    onChange={(val) => update("phone", val ?? EMPTY_PHONE)}
                    countryIso2="AE"
                  />
                </div>
                  <div>
                    <div className={labelClass}>Email</div>
                    <input
                      className={inputClass}
                      type="email"
                      value={form.email}
                      onChange={(e) => update("email", e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      id="useDifferentWhatsapp"
                      type="checkbox"
                      className="h-4 w-4"
                      checked={form.useDifferentWhatsapp}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setForm((prev) => ({
                          ...prev,
                          useDifferentWhatsapp: checked,
                          whatsappPhone: checked ? prev.whatsappPhone : prev.phone,
                        }));
                      }}
                    />
                    <span className="text-foreground">WhatsApp number is different from phone</span>
                  </label>
                  {form.useDifferentWhatsapp && (
                    <div>
                      <PhoneInput
                        label="WhatsApp (optional)"
                        value={form.whatsappPhone}
                        onChange={(val) => update("whatsappPhone", val ?? EMPTY_PHONE)}
                        countryIso2="AE"
                      />
                      <div className="text-xs text-muted-foreground">Leave unchecked to reuse main phone</div>
                    </div>
                  )}
                </div>
              </Card>

              <Card className="space-y-3">
                <div className="text-lg font-semibold">Car</div>
                <CarMakeModelSelect
                  value={{
                    make: form.carMake,
                    model: form.carModel,
                    year: form.carYear ? Number(form.carYear) : undefined,
                  }}
                  onChange={(v) => {
                    update("carMake", v.make);
                    update("carModel", v.model ?? "");
                    update("carYear", v.year ? String(v.year) : "");
                  }}
                  minYear={1900}
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className={labelClass}>VIN Number</div>
                    <input className={inputClass} value={form.vinNumber} onChange={(e) => update("vinNumber", e.target.value)} />
                  </div>
                  <div>
                    <FileUploader
                      label="VIN Photo"
                      value={form.vinPhotoFileId}
                      onChange={(id) => update("vinPhotoFileId", id ?? "")}
                      helperText="Upload a clear photo of the VIN (optional)"
                    />
                  </div>
                </div>

                <PlateInput
                  value={{
                    country: form.plateCountry,
                    locationMode: form.plateLocationMode,
                    state: form.plateState,
                    city: form.plateCity,
                    series: form.plateCode,
                    number: form.plateNumber,
                  }}
                  onChange={(v) => {
                    update("plateCountry", v.country);
                    update("plateLocationMode", v.locationMode);
                    update("plateState", v.state ?? "");
                    update("plateCity", v.city ?? "");
                    update("plateCode", v.series ?? "");
                    update("plateNumber", v.number ?? "");
                  }}
                />

                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <div className={labelClass}>Mileage</div>
                    <input
                      className={inputClass}
                      type="number"
                      value={form.mileage}
                      onChange={(e) => update("mileage", e.target.value)}
                      placeholder="Odometer"
                    />
                  </div>
                  <div>
                    <div className={labelClass}>Tire Size (Front)</div>
                    <input
                      className={inputClass}
                      value={form.tyreSizeFront}
                      onChange={(e) => update("tyreSizeFront", e.target.value)}
                      placeholder="e.g. 235/55R18"
                    />
                  </div>
                  <div>
                    <div className={labelClass}>Tire Size (Rear)</div>
                    <input
                      className={inputClass}
                      value={form.tyreSizeBack}
                      onChange={(e) => update("tyreSizeBack", e.target.value)}
                      placeholder="e.g. 255/50R18"
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className={labelClass}>Registration Expiry</div>
                    <input
                      className={inputClass}
                      type="date"
                      value={form.registrationExpiry}
                      onChange={(e) => update("registrationExpiry", e.target.value)}
                    />
                  </div>
                  <div>
                    <FileUploader
                      label="Registration Card Attachment"
                      value={form.registrationCardFileId}
                      onChange={(id) => update("registrationCardFileId", id ?? "")}
                      helperText="Upload a copy of the registration card (optional)"
                    />
                  </div>
                </div>
              </Card>

              <Card className="space-y-3">
                <div className="text-lg font-semibold">Lead Settings</div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <div className={labelClass}>Lead Division</div>
                    <select
                      className={inputClass}
                      value={form.leadDivision}
                      onChange={(e) => update("leadDivision", e.target.value)}
                    >
                      {LEAD_DIVISIONS.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className={labelClass}>Lead Type</div>
                    <select
                      className={inputClass}
                      value={form.leadType}
                      onChange={(e) => update("leadType", e.target.value)}
                    >
                      {LEAD_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className={labelClass}>Assign To</div>
                    <select
                      className={inputClass}
                      value={form.assignTo}
                      onChange={(e) => update("assignTo", e.target.value)}
                    >
                      {agents.length === 0 && <option value="">Current agent</option>}
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {form.leadDivision === "rsa" && (
                  <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className={labelClass}>RSA Service Type</div>
                    <select
                      className={inputClass}
                      value={form.rsaServiceType}
                      onChange={(e) => update("rsaServiceType", e.target.value)}
                      required
                    >
                      <option value="">Select service</option>
                      <option value="battery">Battery</option>
                      <option value="tire">Tire</option>
                      <option value="fuel">Fuel</option>
                      <option value="repair">Repair</option>
                    </select>
                  </div>
                </div>
                <div>
                  <div className={labelClass}>Google embedded location</div>
                  <input
                    className={inputClass}
                    value={form.rsaGoogleLocation}
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        rsaGoogleLocation: val,
                        rsaLocation: val || prev.rsaLocation,
                      }));
                    }}
                    placeholder="Paste Google Maps embed / link"
                    required
                  />
                  <div className="text-xs text-muted-foreground">
                    Used to dispatch the RSA technician to the right spot.
                  </div>
                </div>
              </div>
            )}
                                {form.leadDivision === "recovery" && (
                  <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <div className={labelClass}>Recovery Type</div>
                        <select
                          className={inputClass}
                          value={form.recoveryType}
                          onChange={(e) => update("recoveryType", e.target.value)}
                          required
                        >
                          <option value="">Select type</option>
                          <option value="any">Any</option>
                          <option value="regular">Regular</option>
                          <option value="flatbed">Flatbed</option>
                          <option value="covered">Covered</option>
                        </select>
                      </div>
                      <div>
                        <div className={labelClass}>Pickup or Dropoff</div>
                        <select
                          className={inputClass}
                          value={form.recoveryDirection}
                          onChange={(e) => {
                            const val = e.target.value;
                            setForm((prev) => ({
                              ...prev,
                              recoveryDirection: val,
                              recoveryFlow: val === "dropoff" ? "branch_to_customer" : "",
                              recoveryBranchId: val === "pickup" ? prev.recoveryBranchId : "",
                              dropoffTo: val === "pickup" ? prev.dropoffTo : "",
                            }));
                          }}
                          required
                        >
                          <option value="">Select</option>
                          <option value="pickup">Pickup</option>
                          <option value="dropoff">Dropoff</option>
                        </select>
                      </div>
                    </div>

                    {form.recoveryDirection === "pickup" ? (
                      <div className="space-y-3">
                        <div>
                          <div className={labelClass}>Flow</div>
                          <select
                            className={inputClass}
                            value={form.recoveryFlow}
                            onChange={(e) => {
                              const val = e.target.value;
                              setForm((prev) => ({
                                ...prev,
                                recoveryFlow: val,
                              }));
                            }}
                            required
                          >
                            <option value="">Select flow</option>
                            <option value="customer_to_branch">Customer to Branch</option>
                            <option value="customer_to_customer">Customer to Customer</option>
                            <option value="branch_to_branch">Branch to Branch</option>
                          </select>
                          <div className="text-xs text-muted-foreground">Flow determines drop-off destination.</div>
                        </div>

                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <div className={labelClass}>
                        {form.recoveryFlow === "branch_to_branch" ? "Pickup branch" : "Pickup location (Google embed / link)"}
                      </div>
                      {form.recoveryFlow === "branch_to_branch" ? (
                        <select
                          className={inputClass}
                          value={form.pickupFrom}
                          onChange={(e) => {
                            const val = e.target.value;
                            const branch = branches.find((b: any) => b.id === val);
                            const branchLocation =
                              branch?.address_line1 ||
                              branch?.addressLine1 ||
                              branch?.display_name ||
                              branch?.name ||
                              branch?.code ||
                              "";
                            const branchGoogle = branch?.google_location ?? branch?.googleLocation ?? "";
                            setForm((prev) => ({
                              ...prev,
                              pickupFrom: val,
                              pickupGoogleLocation: branchGoogle || prev.pickupGoogleLocation,
                            }));
                          }}
                          required
                        >
                          <option value="">Select branch</option>
                          {branches.map((b: any) => (
                            <option key={b.id} value={b.id}>
                              {b.display_name ?? b.name ?? b.code ?? b.id?.slice(0, 8) ?? "Branch"}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className={inputClass}
                          value={form.pickupGoogleLocation}
                          onChange={(e) => {
                            const val = e.target.value;
                            setForm((prev) => ({
                              ...prev,
                              pickupGoogleLocation: val,
                              pickupFrom: val || prev.pickupFrom,
                            }));
                          }}
                          placeholder={
                            form.recoveryFlow === "customer_to_customer"
                              ? "Embed / Maps link for pickup"
                              : "Embed / Maps link for pickup or customer location"
                          }
                          required
                        />
                      )}
                    </div>
                    <div>
                      <div className={labelClass}>
                        {form.recoveryFlow === "customer_to_customer" ? "Drop-off location (Google embed / link)" : "Drop-off branch"}
                      </div>
                      {form.recoveryFlow === "customer_to_customer" ? (
                        <input
                          className={inputClass}
                          value={form.dropoffGoogleLocation}
                          onChange={(e) => {
                            const val = e.target.value;
                            setForm((prev) => ({
                              ...prev,
                              dropoffGoogleLocation: val,
                              dropoffTo: val || prev.dropoffTo,
                            }));
                          }}
                          placeholder="Embed / Maps link for drop-off"
                          required
                        />
                      ) : (
                        <select
                          className={inputClass}
                          value={form.recoveryBranchId}
                          onChange={(e) => {
                            const val = e.target.value;
                            const branch = branches.find((b: any) => b.id === val);
                            const branchLocation =
                              branch?.address_line1 ||
                              branch?.addressLine1 ||
                              branch?.display_name ||
                              branch?.name ||
                              branch?.code ||
                              "";
                            const branchGoogle = branch?.google_location ?? branch?.googleLocation ?? "";
                            setForm((prev) => ({
                              ...prev,
                              recoveryBranchId: val,
                              dropoffTo:
                                prev.recoveryFlow === "customer_to_branch" || prev.recoveryFlow === "branch_to_branch"
                                  ? branchLocation || prev.dropoffTo
                                  : prev.dropoffTo,
                              dropoffGoogleLocation:
                                prev.recoveryFlow === "customer_to_branch" || prev.recoveryFlow === "branch_to_branch"
                                  ? branchGoogle || prev.dropoffGoogleLocation
                                  : prev.dropoffGoogleLocation,
                            }));
                          }}
                          required
                        >
                          <option value="">Select branch</option>
                          {branches.map((b: any) => (
                            <option key={b.id} value={b.id}>
                              {b.display_name ?? b.name ?? b.code ?? b.id?.slice(0, 8) ?? "Branch"}
                            </option>
                          ))}
                        </select>
                      )}
                      {form.recoveryFlow !== "customer_to_customer" && (
                        <div className="text-xs text-muted-foreground">Auto-fills location from the selected branch.</div>
                      )}
                    </div>
                  </div>
                </div>
                      </div>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <div className={labelClass}>Flow</div>
                          <select
                            className={inputClass}
                            value={form.recoveryFlow}
                            onChange={(e) => update("recoveryFlow", e.target.value)}
                            disabled={!form.recoveryDirection || form.recoveryDirection === "dropoff"}
                            required
                          >
                            <option value="">Select flow</option>
                            {form.recoveryDirection !== "dropoff" && (
                              <>
                                <option value="customer_to_branch">Customer to Branch</option>
                                <option value="customer_to_customer">Customer to Customer</option>
                                <option value="branch_to_branch">Branch to Branch</option>
                              </>
                            )}
                            {form.recoveryDirection === "dropoff" && <option value="branch_to_customer">Branch to Customer</option>}
                          </select>
                          <div className="text-xs text-muted-foreground">
                            Pickup: choose the handover path. Dropoff is always Branch to Customer.
                          </div>
                        </div>
                        <div>
                          <div className={labelClass}>Drop-off location (Google embed / link)</div>
                          <input
                            className={inputClass}
                            value={form.dropoffGoogleLocation}
                            onChange={(e) => {
                              const val = e.target.value;
                              setForm((prev) => ({
                                ...prev,
                                dropoffGoogleLocation: val,
                                dropoffTo: val || prev.dropoffTo,
                              }));
                            }}
                            placeholder="Embed / Maps link for drop-off"
                            required
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {form.leadDivision === "workshop" && (
                  <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <div className={labelClass}>Workshop Flow</div>
                        <select
                          className={inputClass}
                          value={form.workshopFlow}
                          onChange={(e) => update("workshopFlow", e.target.value)}
                          required
                        >
                          <option value="">Select option</option>
                          <option value="direct_estimate">Direct estimate (no inspection)</option>
                          <option value="inspection">Inspection</option>
                          <option value="inspection_oil_change">Inspection + Oil Change</option>
                        </select>
                        <div className="text-xs text-muted-foreground">
                          Choose how this workshop lead should start.
                        </div>
                      </div>
                    </div>
                    {!isDirectEstimate && (
                      <>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <div className={labelClass}>Appointment Time</div>
                            <input
                              className={inputClass}
                              type="datetime-local"
                              value={form.appointmentAt}
                              onChange={(e) => update("appointmentAt", e.target.value)}
                            />
                          </div>
                          <div>
                            <div className={labelClass}>Visit Type</div>
                            <select
                              className={inputClass}
                              value={form.workshopVisitType}
                              onChange={(e) => update("workshopVisitType", e.target.value)}
                            >
                              <option value="walkin">Walk-in</option>
                              <option value="pickup">Pickup</option>
                            </select>
                            <div className="text-xs text-muted-foreground">
                              Pickup will auto-create a recovery lead from customer to branch.
                            </div>
                          </div>
                        </div>
                        {form.workshopVisitType === "pickup" && (
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <div className={labelClass}>Recovery Type</div>
                              <select
                                className={inputClass}
                                value={form.recoveryType}
                                onChange={(e) => update("recoveryType", e.target.value)}
                                required
                              >
                                <option value="">Select type</option>
                                <option value="any">Any</option>
                                <option value="regular">Regular</option>
                                <option value="flatbed">Flatbed</option>
                                <option value="covered">Covered</option>
                              </select>
                            </div>
                            <div className="md:col-span-2">
                              <div className={labelClass}>Pickup location (Google embed / link)</div>
                              <input
                                className={inputClass}
                                value={form.pickupLocationGoogle}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setForm((prev) => ({
                                    ...prev,
                                    pickupLocationGoogle: val,
                                    pickupLocation: val || prev.pickupLocation,
                                  }));
                                }}
                                placeholder="Embed / Maps link for pickup"
                                required
                              />
                              <div className="text-xs text-muted-foreground">
                                Include a Google Maps link to embed the location.
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    <div>
                      <div className={labelClass}>Inquiry / Notes</div>
                      <textarea
                        className={`${inputClass} min-h-[80px]`}
                        value={form.workshopInquiry}
                        onChange={(e) => update("workshopInquiry", e.target.value)}
                        placeholder="Describe the issue or requested work"
                      />
                    </div>
                  </div>
                )}
              </Card>

              <Card className="space-y-3">
                <div className="text-lg font-semibold">Remarks</div>
                <div>
                  <div className={labelClass}>Customer Remarks</div>
                  <textarea
                    className={`${inputClass} min-h-[80px]`}
                    value={form.customerRemarks}
                    onChange={(e) => update("customerRemarks", e.target.value)}
                  />
                </div>
                <div>
                  <div className={labelClass}>Agent Remarks</div>
                  <textarea
                    className={`${inputClass} min-h-[80px]`}
                    value={form.agentRemarks}
                    onChange={(e) => update("agentRemarks", e.target.value)}
                  />
                </div>
              </Card>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Create Lead"}
                </button>
                <Link
                  href={companyId ? `/company/${companyId}/leads` : "#"}
                  className="rounded-md border px-4 py-2 text-sm font-semibold"
                >
                  Cancel
                </Link>
              </div>
            </div>

            <div className="space-y-4">
              <Card className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-lg font-semibold">Existing Customer</div>
                  <button
                    type="button"
                    onClick={handleLookup}
                    className="rounded-md border px-3 py-1 text-xs"
                    disabled={lookupLoading}
                  >
                    {lookupLoading ? "Loading..." : "Refresh"}
                  </button>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="text-xs text-muted-foreground">Name</div>
                  <div className="font-medium truncate">{form.customerName || "—"}</div>
                  <div className="text-xs text-muted-foreground">Phone</div>
                  <div className="truncate">
                    {(form.phone?.dialCode || "") + (form.phone?.nationalNumber || "") || "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">Email</div>
                  <div className="truncate">{form.email || "—"}</div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-semibold">Linked Cars</div>
                  {linkedCars && linkedCars.length > 0 ? (
                    <div className="space-y-2">
                      {linkedCars.map((car) => {
                        const label = [car.plateNumber, car.vin, car.make, car.model].filter(Boolean).join(" • ");
                        return (
                          <button
                            type="button"
                            key={car.id ?? car.plateNumber ?? Math.random()}
                            onClick={() => car.id && applyLinkedCar(car.id)}
                            className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                              selectedCarId === car.id ? "border-primary text-primary" : "hover:border-primary"
                            }`}
                          >
                            <div className="font-medium truncate">{label || "Car"}</div>
                            <div className="text-xs text-muted-foreground">
                              {[car.year, car.make, car.model].filter(Boolean).join(" ")}
                            </div>
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCarId(null);
                          setForm((prev) => ({
                            ...prev,
                            carMake: "",
                            carModel: "",
                            carYear: "",
                            plateLocationMode: undefined,
                            plateState: "",
                            plateCity: "",
                        plateCode: "",
                        plateNumber: "",
                        vinNumber: "",
                        vinPhotoFileId: "",
                        mileage: "",
                        tyreSizeFront: "",
                        tyreSizeBack: "",
                        registrationExpiry: "",
                        registrationCardFileId: "",
                      }));
                        }}
                        className="w-full rounded-md border px-3 py-2 text-sm hover:border-primary"
                      >
                        New car
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">Run lookup to load linked cars</div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}

function parsePhoneValue(raw: string, fallback: PhoneValue): PhoneValue {
  if (!raw) return fallback;
  const digits = raw.replace(/[^0-9+]/g, "");
  if (!digits) return fallback;
  if (digits.startsWith("+")) {
    const match = digits.match(/^(\\+\\d{1,4})(\\d{5,})$/);
    if (match) {
      return { dialCode: match[1], nationalNumber: match[2] };
    }
    return { dialCode: digits.slice(0, 4), nationalNumber: digits.slice(4) || fallback.nationalNumber };
  }
  if (digits.startsWith("971") && digits.length > 3) {
    return { dialCode: "+971", nationalNumber: digits.slice(3) };
  }
  if (digits.length > 7) {
    return { dialCode: `+${digits.slice(0, 3)}`, nationalNumber: digits.slice(3) };
  }
  return fallback;
}


