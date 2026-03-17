"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppLayout, CompanyForm, useI18n, useTheme } from "@repo/ui";

export default function GlobalCompanyEditPage() {
  return (
    <AppLayout>
      <EditCompanyContent />
    </AppLayout>
  );
}

function EditCompanyContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { theme } = useTheme();
  const companyId = Array.isArray(params?.id) ? params?.id[0] : params?.id;

  const [initial, setInitial] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [subCategory, setSubCategory] = useState("active");
  const [subCurrency, setSubCurrency] = useState("USD");
  const [subAmount, setSubAmount] = useState("");
  const [subEndsAt, setSubEndsAt] = useState("");
  const [subMessage, setSubMessage] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const plans = useMemo(
    () => [
      { id: "trial", name: "Trial", category: "trial", amount: 0, currency: "USD", endsInDays: 14, desc: "Free for 14 days" },
      { id: "basic", name: "Basic", category: "active", amount: 99, currency: "USD", endsInDays: 30, desc: "Core features" },
      { id: "plus", name: "Plus", category: "active", amount: 199, currency: "USD", endsInDays: 30, desc: "Adds automation" },
      { id: "pro", name: "Pro", category: "active", amount: 399, currency: "USD", endsInDays: 30, desc: "Full suite" },
      { id: "enterprise", name: "Enterprise", category: "active", amount: 0, currency: "USD", endsInDays: 30, desc: "Custom pricing" },
    ],
    []
  );

  useEffect(() => {
    if (!companyId) {
      setError("Company id missing from route.");
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/master/companies/${companyId}`);
        if (!res.ok) throw new Error("Failed to load company");
        const data = await res.json();
        if (active) {
          const company = data?.data?.company ?? data?.data ?? data;
          setInitial(company);
          const sub = data?.data?.subscription;
          if (sub) {
            setSubCategory(sub.category ?? "active");
            setSubCurrency(sub.currency ?? "USD");
            setSubAmount(sub.amount != null ? String(sub.amount) : "");
            const endsStr =
              sub.ends_at && typeof sub.ends_at === "string"
                ? sub.ends_at.substring(0, 10)
                : "";
            setSubEndsAt(endsStr);
            const matched = plans.find((p) => p.category === sub.category && p.currency === sub.currency && p.amount === sub.amount);
            if (matched) setSelectedPlan(matched.id);
          }
        }
      } catch (err: any) {
        if (active) setError(err?.message ?? "Failed to load company");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [companyId]);

  async function handleSubmit(values: any) {
    if (!companyId) return;
    setError(null);
    try {
      const res = await fetch(`/api/master/companies/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error(`Failed to update company (${res.status})`);
      router.push("/global/companies");
    } catch (err: any) {
      setError(err?.message ?? "Failed to save company");
    }
  }

  async function handleAddSubscription() {
    if (!companyId) return;
    setSubMessage(null);
    try {
      const plan = plans.find((p) => p.id === selectedPlan) ?? null;
      const payload: any = {
        companyId,
        category: plan?.category ?? subCategory,
        currency: (plan?.currency ?? subCurrency) || "USD",
      };
      const amountVal = plan ? plan.amount : subAmount ? Number(subAmount) : null;
      if (amountVal !== null) payload.amount = amountVal;
      if (plan?.endsInDays) {
        const ends = new Date();
        ends.setDate(ends.getDate() + plan.endsInDays);
        payload.endsAt = ends.toISOString().substring(0, 10);
      } else if (subEndsAt) {
        payload.endsAt = subEndsAt;
      }

      const res = await fetch("/api/global/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail?.error || `Failed to add subscription (${res.status})`);
      }
      setSubMessage(t("subscriptions.add.success"));

      // Try to create invoice when subscription added
      const amount = payload.amount;
      if (amount != null) {
        try {
          const dueDate =
            payload.endsAt ||
            (() => {
              const d = new Date();
              d.setDate(d.getDate() + 30);
              return d.toISOString().substring(0, 10);
            })();
          await fetch("/api/accounting/invoices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              companyId,
              currency: payload.currency,
              dueDate,
              reference: `SUB-${selectedPlan ?? "custom"}`,
              description: `Subscription ${selectedPlan ?? ""}`,
              items: [{ name: `Subscription ${selectedPlan ?? ""}`, amount }],
            }),
          }).catch(() => {});
        } catch {
          // invoice creation best-effort
        }
      }
    } catch (err: any) {
      setSubMessage(err?.message ?? t("subscriptions.add.error"));
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase text-muted-foreground">{t("companies.breadcrumb")}</p>
          <h1 className="text-2xl font-semibold">{t("companies.edit.title")}</h1>
        </div>
        <button
          className={`px-3 py-1.5 rounded-lg text-sm bg-transparent hover:bg-black/5 ${theme.cardBorder}`}
          onClick={() => router.push("/global/companies")}
        >
          {"<"} {t("companies.back")}
        </button>
      </div>
      {error && <div className="text-red-400 text-sm">{error}</div>}
      {loading || !initial ? (
        <div className="text-sm text-muted-foreground">{t("companies.loading")}</div>
      ) : (
        <CompanyForm mode="edit" initialValues={initial} onSubmit={handleSubmit} />
      )}
      <div className="space-y-3 rounded-2xl border p-4 shadow-sm bg-background">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">{t("subscriptions.add.title")}</div>
            <div className="text-xs text-muted-foreground">{t("subscriptions.add.hint")}</div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {plans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => {
                setSelectedPlan(plan.id);
                setSubCategory(plan.category);
                setSubCurrency(plan.currency);
                setSubAmount(String(plan.amount ?? ""));
              }}
              className={`rounded-xl border p-3 text-left transition ${
                selectedPlan === plan.id ? "border-primary shadow-sm" : "border-muted"
              } hover:border-primary/60`}
            >
              <div className="font-semibold">{plan.name}</div>
              <div className="text-xs text-muted-foreground">{plan.desc}</div>
              <div className="mt-1 text-sm">
                {plan.amount === 0 ? t("subscriptions.plan.free") : `$${plan.amount} / ${plan.endsInDays ?? 30}d`}
              </div>
            </button>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t("subscriptions.add.category")}</label>
            <select
              className={`${theme.input}`}
              value={subCategory}
              onChange={(e) => setSubCategory(e.target.value)}
            >
              <option value="trial">{t("subscriptions.categories.trial")}</option>
              <option value="active">{t("subscriptions.categories.active")}</option>
              <option value="expiring">{t("subscriptions.categories.expiring")}</option>
              <option value="expired">{t("subscriptions.categories.expired")}</option>
              <option value="offboarded">{t("subscriptions.categories.offboarded")}</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t("subscriptions.add.amount")}</label>
            <div className="grid grid-cols-[2fr_auto] items-center gap-2">
              <input
                type="number"
                step="0.01"
                className={`${theme.input} w-full`}
                placeholder="100.00"
                value={subAmount}
                onChange={(e) => setSubAmount(e.target.value)}
              />
              <input
                className={`${theme.input} w-20 sm:w-24 text-center`}
                placeholder="USD"
                value={subCurrency}
                onChange={(e) => setSubCurrency(e.target.value.toUpperCase())}
              />
            </div>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t("subscriptions.add.endsAt")}</label>
            <input
              type="date"
              className={`${theme.input}`}
              value={subEndsAt}
              onChange={(e) => setSubEndsAt(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <button
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
              onClick={handleAddSubscription}
              type="button"
            >
              {t("subscriptions.add.button")}
            </button>
          </div>
        </div>
        {subMessage && <div className="text-xs text-muted-foreground">{subMessage}</div>}
      </div>
    </div>
  );
}
