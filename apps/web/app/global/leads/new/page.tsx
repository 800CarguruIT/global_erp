"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppLayout, Card, useI18n, useTheme } from "@repo/ui";
import { CountrySelect } from "@repo/ui/components/common/CountrySelect";
import { StateSelect } from "@repo/ui/components/common/StateSelect";
import { CitySelect } from "@repo/ui/components/common/CitySelect";
import { PhoneInput } from "@repo/ui/components/common/PhoneInput";
import type { PhoneValue } from "@repo/ui/components/common/PhoneInput";

type LeadType = "sales" | "support" | "complaint";
type LeadStatus = "open" | "assigned" | "onboarding" | "inprocess" | "completed" | "closed" | "lost";

const EMPTY_PHONE: PhoneValue = { dialCode: "", nationalNumber: "" };

export default function CreateGlobalLeadPage() {
  const searchParams = useSearchParams();
  const preset = useMemo(() => {
    const companyId = searchParams?.get("companyId") ?? "";
    const companyName = searchParams?.get("companyName") ?? "";
    const contactName = searchParams?.get("contactName") ?? "";
    const email = searchParams?.get("email") ?? "";
    const phoneRaw = searchParams?.get("phone") ?? "";
    return {
      companyId,
      companyName,
      contactName,
      email,
      phone: parsePhoneValue(phoneRaw, EMPTY_PHONE),
    };
  }, [searchParams]);

  return (
    <AppLayout>
      <LeadContent preset={preset} />
    </AppLayout>
  );
}

function LeadContent({
  preset,
}: {
  preset: { companyId: string; companyName: string; contactName: string; email: string; phone: PhoneValue };
}) {
  const router = useRouter();
  const { t } = useI18n();
  const { theme } = useTheme();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    companyId: preset.companyId,
    companyName: preset.companyName,
    country: "",
    city: "",
    state: "",
    postal: "",
    address: "",
    contactTitle: "",
    contactName: preset.contactName,
    phone: preset.phone as PhoneValue,
    email: preset.email,
    customerRemarks: "",
    agentRemarks: "",
    leadType: "sales" as LeadType,
    leadStatus: "open" as LeadStatus,
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/global/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || t("lead.create.error"));
      }
      router.push("/global/leads");
    } catch (err: any) {
      setError(err?.message ?? t("lead.create.error"));
    } finally {
      setSaving(false);
    }
  }

  const inputClass = `${theme.input}`;
  const labelClass = "text-xs font-semibold text-muted-foreground";

  useEffect(() => {
    async function hydrateFromCompany() {
      if (!preset.companyId) return;
      try {
        const res = await fetch(`/api/master/companies/${preset.companyId}`);
        if (!res.ok) return;
        const data = await res.json();
        const c = data?.data ?? data ?? {};

        setForm((prev) => {
          const address = c.address ?? {};
          const country = c.country ?? address.country ?? prev.country;
          const state = c.state_region ?? address.stateRegion ?? prev.state;
          const city = c.city ?? address.city ?? prev.city;
          const postal = c.postal_code ?? address.postalCode ?? prev.postal;
          const addressLine = c.address_line1 ?? address.line1 ?? prev.address;
          const companyName = c.display_name ?? c.displayName ?? c.legal_name ?? c.legalName ?? prev.companyName;
          const contactName = prev.contactName || c.owner_name || c.ownerPassport?.name || "";
          const email = prev.email || c.company_email || c.companyEmail || c.ownerPassport?.email || "";
          const phoneRaw = c.company_phone ?? c.companyPhone ?? c.ownerPassport?.phone ?? "";

          return {
            ...prev,
            companyName,
            country,
            state,
            city,
            postal,
            address: addressLine,
            contactName,
            email,
            phone: prev.phone?.nationalNumber
              ? prev.phone
              : phoneRaw
                ? parsePhoneValue(phoneRaw, prev.phone)
                : prev.phone,
          };
        });
      } catch {
        // ignore hydrate errors
      }
    }
    hydrateFromCompany();
  }, [preset.companyId]);

  return (
    <div className="space-y-6 py-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("lead.create.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("lead.create.subtitle")}</p>
        </div>
        <Link href="/global/leads" className="text-sm text-primary hover:underline">
          {t("lead.create.back")}
        </Link>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card className="space-y-3">
          <div className="text-lg font-semibold">{t("lead.create.companySection")}</div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className={labelClass}>{t("lead.create.companyName")}</div>
              <input
                className={inputClass}
                value={form.companyName}
                onChange={(e) => update("companyName", e.target.value)}
                required
              />
            </div>
            <div>
              <CountrySelect value={form.country} onChange={(iso) => update("country", iso ?? "")} />
            </div>
            <div>
              <StateSelect
                countryIso2={form.country}
                value={form.state}
                onChange={(v) => update("state", v ?? "")}
              />
            </div>
            <div>
              <CitySelect countryIso2={form.country} value={form.city} onChange={(v) => update("city", v ?? "")} />
            </div>
            <div>
              <div className={labelClass}>{t("lead.create.postal")}</div>
              <input className={inputClass} value={form.postal} onChange={(e) => update("postal", e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <div className={labelClass}>{t("lead.create.address")}</div>
              <input className={inputClass} value={form.address} onChange={(e) => update("address", e.target.value)} />
            </div>
          </div>
        </Card>

        <Card className="space-y-3">
          <div className="text-lg font-semibold">{t("lead.create.contactSection")}</div>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <div className={labelClass}>{t("lead.create.contactTitle")}</div>
              <input
                className={inputClass}
                value={form.contactTitle}
                onChange={(e) => update("contactTitle", e.target.value)}
              />
            </div>
            <div>
              <div className={labelClass}>{t("lead.create.contactName")}</div>
              <input
                className={inputClass}
                value={form.contactName}
                onChange={(e) => update("contactName", e.target.value)}
                required
              />
            </div>
            <div>
              <div className={labelClass}>{t("lead.create.email")}</div>
              <input
                className={inputClass}
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <div className={labelClass}>{t("lead.create.phone")}</div>
              <PhoneInput
                countryIso2={form.country || "AE"}
                value={form.phone}
                onChange={(val) => update("phone", val ?? EMPTY_PHONE)}
              />
            </div>
          </div>
        </Card>

        <Card className="space-y-3">
          <div className="text-lg font-semibold">{t("lead.create.settingsSection")}</div>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <div className={labelClass}>{t("lead.create.leadType")}</div>
              <select
                className={inputClass}
                value={form.leadType}
                onChange={(e) => update("leadType", e.target.value as LeadType)}
              >
                <option value="sales">{t("lead.create.type.sales")}</option>
                <option value="support">{t("lead.create.type.support")}</option>
                <option value="complaint">{t("lead.create.type.complaint")}</option>
              </select>
            </div>
            <div>
              <div className={labelClass}>{t("lead.create.leadStatus")}</div>
              <select
                className={inputClass}
                value={form.leadStatus}
                onChange={(e) => update("leadStatus", e.target.value as LeadStatus)}
              >
                <option value="open">{t("lead.create.status.open")}</option>
                <option value="assigned">{t("lead.create.status.assigned")}</option>
                <option value="onboarding">{t("lead.create.status.onboarding")}</option>
                <option value="inprocess">{t("lead.create.status.inprocess")}</option>
                <option value="completed">{t("lead.create.status.completed")}</option>
                <option value="closed">{t("lead.create.status.closed")}</option>
                <option value="lost">{t("lead.create.status.lost")}</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t("lead.create.rules")}</p>
        </Card>

        <Card className="space-y-3">
          <div className="text-lg font-semibold">{t("lead.create.remarksSection")}</div>
          <div>
            <div className={labelClass}>{t("lead.create.customerRemarks")}</div>
            <textarea
              className={`${inputClass} min-h-[80px]`}
              value={form.customerRemarks}
              onChange={(e) => update("customerRemarks", e.target.value)}
            />
          </div>
          <div>
            <div className={labelClass}>{t("lead.create.agentRemarks")}</div>
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
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving ? t("lead.create.saving") : t("lead.create.submit")}
          </button>
          <Link
            href="/global/leads"
            className="rounded-full border border-white/20 px-4 py-2 text-sm hover:border-white/40"
          >
            {t("lead.create.cancel")}
          </Link>
        </div>
      </form>
    </div>
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
