"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppLayout, Card, useTheme } from "@repo/ui";
import { CarMakeModelSelect } from "@repo/ui/components/common/CarMakeModelSelect";
import { PhoneInput } from "@repo/ui/components/common/PhoneInput";
import type { PhoneValue } from "@repo/ui/components/common/PhoneInput";
import { PlateInput, PlateValue } from "@repo/ui/components/common/PlateInput";

type Params = { params: { companyId: string } | Promise<{ companyId: string }> };

const EMPTY_PHONE: PhoneValue = { dialCode: "+971", nationalNumber: "" };
const EMPTY_PLATE: PlateValue = {
  country: "AE",
  locationMode: undefined,
  state: "",
  city: "",
  series: "",
  number: "",
};

const CAR_TYPE_OPTIONS = ["Regular", "SUV", "Pickup", "Van", "Truck", "Motorcycle", "Other"];

type CustomerDuplicateInfo = {
  id: string;
  name: string | null;
  phone: string | null;
};

type CarDuplicateInfo = {
  id: string;
  plateNumber: string | null;
};

export default function CustomerCreatePage({ params }: Params) {
  const { theme } = useTheme();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customerDuplicate, setCustomerDuplicate] = useState<CustomerDuplicateInfo | null>(null);
  const [carDuplicate, setCarDuplicate] = useState<CarDuplicateInfo | null>(null);
  const [duplicateModalVisible, setDuplicateModalVisible] = useState(false);
  const [duplicateModalDismissedId, setDuplicateModalDismissedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: EMPTY_PHONE as PhoneValue,
    whatsappPhone: EMPTY_PHONE as PhoneValue,
    useDifferentWhatsapp: false,
    plate: EMPTY_PLATE as PlateValue,
    carMake: "",
    carModel: "",
    carYear: "",
    carType: "Regular",
    isInsurance: false,
  });

  useEffect(() => {
    Promise.resolve(params).then((p) => setCompanyId(p?.companyId ?? null));
  }, [params]);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const normalizedPhone = useMemo(() => {
    const dial = form.phone.dialCode?.trim() ?? "";
    const digits = form.phone.nationalNumber?.replace(/[^0-9]/g, "").trim() ?? "";
    if (!dial || !digits) return null;
    const dialNormalized = dial.startsWith("+") ? dial : `+${dial.replace(/[^0-9]/g, "")}`;
    if (!dialNormalized) return null;
    return `${dialNormalized}${digits}`;
  }, [form.phone.dialCode, form.phone.nationalNumber]);

  const normalizedPlateNumber = useMemo(() => {
    const series = form.plate.series?.trim().toUpperCase() ?? "";
    const number = form.plate.number?.trim() ?? "";
    if (!series && !number) return null;
    return [series, number].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  }, [form.plate.series, form.plate.number]);

  const hasCarDetails =
    [form.carMake, form.carModel, form.carYear].some((value) => (value ?? "").trim().length > 0);
  const hasPlateInfo = Boolean(
    (form.plate.series?.trim().length ?? 0) > 0 || (form.plate.number?.trim().length ?? 0) > 0
  );
  const hasCarInfo = hasCarDetails || hasPlateInfo;

  useEffect(() => {
    if (!companyId || !normalizedPhone) {
      setCustomerDuplicate(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/customers?companyId=${companyId}&search=${encodeURIComponent(normalizedPhone)}`,
          { cache: "no-store", signal: controller.signal }
        );
        if (!res.ok) {
          throw new Error("Failed to check customer");
        }
        const payload = await res.json();
        const customers: any[] = Array.isArray(payload?.data) ? payload.data : [];
        const match = customers.find((cust) => {
          const phone = (cust.phone ?? "").replace(/\s+/g, "");
          const whatsapp = (cust.whatsapp_phone ?? "").replace(/\s+/g, "");
          return phone === normalizedPhone || whatsapp === normalizedPhone;
        });
        if (match) {
          setCustomerDuplicate({
            id: match.id,
            name: match.name ?? null,
            phone: match.phone ?? null,
          });
        } else {
          setCustomerDuplicate(null);
        }
      } catch (err: any) {
        if (controller.signal.aborted) return;
        console.error("customer duplicate check", err);
        setCustomerDuplicate(null);
      }
    }, 450);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [companyId, normalizedPhone]);

  useEffect(() => {
    if (!companyId || !normalizedPlateNumber) {
      setCarDuplicate(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/cars?companyId=${companyId}&search=${encodeURIComponent(normalizedPlateNumber)}`,
          { cache: "no-store", signal: controller.signal }
        );
        if (!res.ok) {
          throw new Error("Failed to check car");
        }
        const payload = await res.json();
        const cars: any[] = Array.isArray(payload?.data) ? payload.data : [];
        const match = cars.find((car) => {
          const plate = (car.plate_number ?? "").replace(/\s+/g, " ").trim();
          return plate && plate.toLowerCase() === normalizedPlateNumber.toLowerCase();
        });
        if (match) {
          setCarDuplicate({
            id: match.id,
            plateNumber: match.plate_number ?? null,
          });
        } else {
          setCarDuplicate(null);
        }
      } catch (err: any) {
        if (controller.signal.aborted) return;
        console.error("car duplicate check", err);
        setCarDuplicate(null);
      }
    }, 450);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [companyId, normalizedPlateNumber]);

  useEffect(() => {
    if (!customerDuplicate && !carDuplicate) {
      setDuplicateModalVisible(false);
      setDuplicateModalDismissedId(null);
      return;
    }
    const duplicateKey = customerDuplicate
      ? `customer-${customerDuplicate.id}`
      : carDuplicate
      ? `car-${carDuplicate.id}`
      : null;
    if (!duplicateKey) {
      setDuplicateModalVisible(false);
      return;
    }
    if (duplicateModalDismissedId === duplicateKey) return;
    setDuplicateModalVisible(true);
  }, [customerDuplicate, carDuplicate, duplicateModalDismissedId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) return;
    if (!hasCarInfo) {
      setError("Add at least one car before creating the customer.");
      return;
    }
    if (customerDuplicate) {
      setError("A customer with this mobile number already exists.");
      return;
    }
    if (carDuplicate) {
      setError("A car with this plate number already exists.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        companyId,
        customerType: "individual" as const,
        name: form.name,
        email: form.email || null,
        phone: `${form.phone.dialCode}${form.phone.nationalNumber}`,
        whatsappPhone: form.useDifferentWhatsapp
          ? `${form.whatsappPhone.dialCode}${form.whatsappPhone.nationalNumber}`
          : `${form.phone.dialCode}${form.phone.nationalNumber}`,
      };
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to create customer");
      }
      const data = await res.json();
      const id = data?.id ?? data?.data?.id;
      if (id) {
        const plateText = `${form.plate.series ?? ""} ${form.plate.number ?? ""}`.trim() || null;
        const carRes = await fetch(`/api/customers/${id}/cars?companyId=${companyId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            relationType: "owner",
            isPrimary: true,
            newCar: {
              plateNumber: plateText,
              plateCode: form.plate.series || null,
              plateCountry: form.plate.country || null,
              plateState: form.plate.state || null,
              plateCity: form.plate.city || null,
              plateLocationMode: form.plate.locationMode || null,
              make: form.carMake || null,
              model: form.carModel || null,
              modelYear: form.carYear ? Number(form.carYear) : null,
              bodyType: form.carType || null,
              isInsurance: form.isInsurance,
            },
          }),
        });
        if (!carRes.ok) {
          const carData = await carRes.json().catch(() => ({}));
          throw new Error(carData?.error ?? "Failed to add car");
        }
        window.location.href = `/company/${companyId}/customers/${id}`;
      } else {
        window.location.href = `/company/${companyId}/customers`;
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to create customer");
    } finally {
      setSaving(false);
    }
  }

  const labelClass = "text-xs font-semibold text-muted-foreground";
  const inputClass = theme.input;
  const duplicateKey = customerDuplicate
    ? `customer-${customerDuplicate.id}`
    : carDuplicate
    ? `car-${carDuplicate.id}`
    : null;
  const duplicateTitle = customerDuplicate
    ? "Customer already exists"
    : carDuplicate
    ? "Car already exists"
    : null;
  const duplicateDescription = customerDuplicate
    ? `A customer named ${customerDuplicate.name ?? "this customer"} with ${
        customerDuplicate.phone ?? "this number"
      } is already in the system.`
    : carDuplicate
    ? `The car with plate ${carDuplicate.plateNumber ?? normalizedPlateNumber} already exists in the fleet.`
    : null;
  const duplicateLinkHref =
    (customerDuplicate && companyId && `/company/${companyId}/customers/${customerDuplicate.id}`) ||
    (carDuplicate && companyId && `/company/${companyId}/cars/${carDuplicate.id}`) ||
    "#";
  const duplicateLinkLabel = customerDuplicate ? "View customer" : "View car";
  const handleCloseDuplicateModal = () => {
    if (duplicateKey) {
      setDuplicateModalDismissedId(duplicateKey);
    }
    setDuplicateModalVisible(false);
  };

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">New Customer</h1>
            <p className="text-sm text-muted-foreground">Create a customer using the same fields as lead capture.</p>
          </div>
          <Link
            href={companyId ? `/company/${companyId}/customers` : "#"}
            className="text-sm text-primary hover:underline"
          >
            Back to customers
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Card className="space-y-3">
            <div className="text-lg font-semibold">Customer</div>
            {error && <div className="text-sm text-destructive">{error}</div>}
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className={labelClass}>Customer Name</div>
                <input
                  className={inputClass}
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
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
              <div className="md:col-span-2">
                <div className={labelClass}>Email</div>
                <input
                  className={inputClass}
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  id="useDifferentWhatsapp"
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
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
            {!hasCarInfo && (
              <div className="text-xs text-destructive">
                Add at least one car before creating the customer.
              </div>
            )}
            <div className="space-y-2">
              <div className={labelClass}>Car Plate #</div>
              <PlateInput
                value={form.plate}
                onChange={(val) => update("plate", val)}
              />
            </div>
            <CarMakeModelSelect
              value={{
                make: form.carMake,
                model: form.carModel,
                year: form.carYear ? Number(form.carYear) : undefined,
              }}
              onChange={(val) => {
                update("carMake", val.make);
                update("carModel", val.model ?? "");
                update("carYear", val.year ? String(val.year) : "");
              }}
              minYear={1980}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className={labelClass}>Car Type</div>
                <select
                  className={inputClass}
                  value={form.carType}
                  onChange={(e) => update("carType", e.target.value)}
                >
                  {CAR_TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center">
                <label className="mt-5 inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-100/70 px-3 py-2 text-sm font-semibold text-amber-900">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-amber-500"
                    checked={form.isInsurance}
                    onChange={(e) => update("isInsurance", e.target.checked)}
                  />
                  Insurance Car
                </label>
              </div>
            </div>
          </Card>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving || Boolean(customerDuplicate) || Boolean(carDuplicate) || !hasCarInfo}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60 hover:opacity-90"
            >
              {saving ? "Saving..." : "Create Customer"}
            </button>
            <Link
              href={companyId ? `/company/${companyId}/customers` : "#"}
              className="rounded-md border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
            >
              Cancel
            </Link>
          </div>
          {(customerDuplicate || carDuplicate) && (
            <div className="text-xs text-amber-300">
              Please resolve the existing {customerDuplicate ? "customer" : "car"} before adding a new one.
            </div>
          )}
        </form>
        {duplicateModalVisible && duplicateTitle && duplicateDescription && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
            <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-2xl">
              <div className="text-lg font-semibold">{duplicateTitle}</div>
              <p className="mt-2 text-sm text-muted-foreground">{duplicateDescription}</p>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-between">
                {duplicateLinkHref && duplicateLinkHref !== "#" && (
                  <Link
                    href={duplicateLinkHref}
                    className="rounded-md border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
                    onClick={handleCloseDuplicateModal}
                  >
                    {duplicateLinkLabel}
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleCloseDuplicateModal}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
