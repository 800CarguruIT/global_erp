"use client";

import React, { useMemo, useState } from "react";
import { AppLayout, CompanyForm, useI18n, useTheme } from "@repo/ui";

export default function GlobalCompanyCreatePage() {
  return (
    <AppLayout>
      <CreateCompanyContent />
    </AppLayout>
  );
}

function CreateCompanyContent() {
  const [error, setError] = useState<string | null>(null);
  const [subCategory, setSubCategory] = useState("active");
  const [subCurrency, setSubCurrency] = useState("USD");
  const [subAmount, setSubAmount] = useState("");
  const [subEndsAt, setSubEndsAt] = useState("");
  const [addSubscription, setAddSubscription] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const { t } = useI18n();
  const { theme } = useTheme();

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

  async function handleSubmit(values: any) {
    setError(null);
    try {
      const res = await fetch("/api/master/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error(t("companies.save.error"));
      const created = await res.json().catch(() => ({}));
      const companyId = created?.data?.id ?? created?.id;

      if (addSubscription && companyId) {
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

        const subRes = await fetch("/api/global/subscriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!subRes.ok) {
          const detail = await subRes.json().catch(() => ({}));
          throw new Error(detail?.error || t("subscriptions.add.error"));
        }

        // Best-effort invoice creation
        if (payload.amount != null) {
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
                items: [{ name: `Subscription ${selectedPlan ?? ""}`, amount: payload.amount }],
              }),
            }).catch(() => {});
          } catch {
            // ignore invoice errors
          }
        }
      }

      window.location.href = "/global/companies";
    } catch (err: any) {
      setError(err?.message ?? t("companies.save.error"));
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase text-muted-foreground">{t("companies.breadcrumb")}</p>
          <h1 className="text-2xl font-semibold">{t("companies.create.title")}</h1>
        </div>
        <button
          className={`px-3 py-1.5 rounded-lg text-sm bg-transparent hover:bg-black/5 ${theme.cardBorder}`}
          onClick={() => (window.location.href = "/global/companies")}
        >
          {"<"} {t("companies.back")}
        </button>
      </div>
      {error && <div className="text-red-400 text-sm">{error}</div>}
      <CompanyForm mode="create" onSubmit={handleSubmit} />
      <div className="space-y-3 rounded-2xl border p-4 shadow-sm bg-background">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">{t("subscriptions.add.title")}</div>
            <div className="text-xs text-muted-foreground">{t("subscriptions.add.hint")}</div>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={addSubscription}
              onChange={(e) => setAddSubscription(e.target.checked)}
            />
            {t("subscriptions.add.button")}
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {plans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              disabled={!addSubscription}
              onClick={() => {
                setSelectedPlan(plan.id);
                setSubCategory(plan.category);
                setSubCurrency(plan.currency);
                setSubAmount(String(plan.amount ?? ""));
              }}
              className={`rounded-xl border p-3 text-left transition ${
                selectedPlan === plan.id ? "border-primary shadow-sm" : "border-muted"
              } ${!addSubscription ? "opacity-60 cursor-not-allowed" : "hover:border-primary/60"}`}
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
              disabled={!addSubscription}
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
                disabled={!addSubscription}
              />
              <input
                className={`${theme.input} w-20 sm:w-24 text-center`}
                placeholder="USD"
                value={subCurrency}
                onChange={(e) => setSubCurrency(e.target.value.toUpperCase())}
                disabled={!addSubscription}
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
              disabled={!addSubscription}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
