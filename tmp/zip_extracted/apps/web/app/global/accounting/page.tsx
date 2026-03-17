"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, useI18n, useTheme } from "@repo/ui";

type Metric = {
  label: string;
  value: string;
  detail?: string;
  key?: string;
};

type Entry = {
  id: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
};

type SummaryResponse = {
  metrics: Metric[];
  entries: Entry[];
};

type Account = {
  id: string;
  code: string;
  name: string;
  type: string;
  subType?: string | null;
  normalBalance?: string | null;
};

type AccountsResponse = {
  data: Account[];
};

export default function GlobalAccountingPage() {
  const { t } = useI18n();
  const { theme } = useTheme();
  const tf = (key: string, fallback: string) => {
    const val = t(key);
    return val === key ? fallback : val;
  };

  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiAppreciation, setAiAppreciation] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [ledgerSaving, setLedgerSaving] = useState(false);
  const [ledgerMessage, setLedgerMessage] = useState<string | null>(null);
  const [ledgerForm, setLedgerForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    description: "",
    debitAccountId: "",
    creditAccountId: "",
    amount: "",
  });

  const formatter = useMemo(
    () => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }),
    []
  );
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        timeZone: "UTC",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),
    []
  );

  function formatAmount(value: number) {
    return formatter.format(value);
  }

  function formatDate(value: string) {
    return dateFormatter.format(new Date(value));
  }

  const loadSummary = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/global/accounting/summary", { cache: "no-store" });
      if (!res.ok) throw new Error(t("accounting.summary.loadError"));
      const json = (await res.json()) as SummaryResponse;
      setData(json);
    } catch (err: any) {
      setError(err?.message ?? t("accounting.summary.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    let active = true;
    async function loadAi() {
      setAiLoading(true);
      setAiError(null);
      try {
        const res = await fetch("/api/global/accounting/ai-summary", { cache: "no-store" });
        if (!res.ok) throw new Error("AI unavailable");
        const json = await res.json();
        if (!active) return;
        setAiSuggestions(Array.isArray(json.suggestions) ? json.suggestions : []);
        setAiAppreciation(json.appreciation ?? null);
      } catch (err: any) {
        if (active) setAiError(err?.message ?? t("accounting.ai.error"));
      } finally {
        if (active) setAiLoading(false);
      }
    }
    loadAi();
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    let active = true;
    async function loadAccounts() {
      setAccountsError(null);
      try {
        const res = await fetch("/api/global/accounting/accounts", { cache: "no-store" });
        if (!res.ok) throw new Error(t("accounting.accounts.loadError"));
        const json = (await res.json()) as AccountsResponse;
        if (active) setAccounts(json.data ?? []);
      } catch (err: any) {
        if (active) setAccountsError(err?.message ?? t("accounting.accounts.loadError"));
      }
    }
    loadAccounts();
    return () => {
      active = false;
    };
  }, [t]);

  async function handleLedgerEntry() {
    const amount = Number(ledgerForm.amount || 0);
    if (!ledgerForm.debitAccountId || !ledgerForm.creditAccountId || amount <= 0) {
      setLedgerMessage(t("accounting.ledger.validation"));
      return;
    }
    setLedgerSaving(true);
    setLedgerMessage(null);
    try {
      const res = await fetch("/api/global/accounting/journals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: ledgerForm.date,
          description: ledgerForm.description,
          lines: [
            { accountId: ledgerForm.debitAccountId, debit: amount, credit: 0 },
            { accountId: ledgerForm.creditAccountId, debit: 0, credit: amount },
          ],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? t("accounting.ledger.error"));
      setLedgerMessage(t("accounting.ledger.success"));
      setLedgerForm({
        ...ledgerForm,
        description: "",
        amount: "",
      });
      await loadSummary();
    } catch (err: any) {
      setLedgerMessage(err?.message ?? t("accounting.ledger.error"));
    } finally {
      setLedgerSaving(false);
    }
  }

  const inputClass = `${theme.input}`;
  const labelClass = "text-xs font-semibold text-muted-foreground";

  const metrics = data?.metrics ?? [];
  const entries = data?.entries ?? [];
  const aiTitle = tf("accounting.ai.actionsTitle", "AI suggestions");
  const aiAppTitle = tf("accounting.ai.appreciationTitle", "AI appreciation");
  const aiLoadingText = tf("accounting.ai.loading", "Thinking...");
  const aiEmptyText = tf("accounting.ai.empty", "No notes yet.");
  const metricDefaults: Record<string, string> = {
    balance: "Balance",
    total_debit: "Total debit",
    total_credit: "Total credit",
    journals: "Journals",
    accounts_receivable: "Accounts receivable",
    accounts_payable: "Accounts payable",
    available_balance: "Available balance",
  };

  const translateMetricLabel = (m: Metric) => {
    const slug = (m.key || m.label || "metric").toLowerCase().replace(/\s+/g, "_");
    const fallback = metricDefaults[slug] || m.label || "-";
    return tf(`accounting.metric.${slug}`, fallback);
  };
  const translateMetricDetail = (detail?: string) => {
    if (!detail) return null;
    const slug = detail.toLowerCase().replace(/\s+/g, "_");
    return tf(`accounting.metric.detail.${slug}`, detail);
  };

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("accounting.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("accounting.subtitle")}</p>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}
      {loading && !error && <div className="text-sm text-muted-foreground">{t("accounting.summary.loading")}</div>}

      {!loading && !error && (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            {metrics.map((m) => (
              <Card key={m.label}>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{translateMetricLabel(m)}</div>
                <div className="mt-1 text-xl font-semibold">{m.value}</div>
                {translateMetricDetail(m.detail) && (
                  <div className="mt-1 text-xs text-muted-foreground">{translateMetricDetail(m.detail)}</div>
                )}
              </Card>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Link href="/global/accounting/reports/pnl">
              <Card className="h-full cursor-pointer transition hover:border-primary/60">
                <div className="text-sm text-muted-foreground">{t("accounting.reports.label")}</div>
                <div className="mt-1 text-lg font-semibold">{t("accounting.reports.pnl")}</div>
                <div className="mt-1 text-xs text-muted-foreground">{t("accounting.reports.pnl.desc")}</div>
              </Card>
            </Link>
            <Link href="/global/accounting/reports/cashflow">
              <Card className="h-full cursor-pointer transition hover:border-primary/60">
                <div className="text-sm text-muted-foreground">{t("accounting.reports.label")}</div>
                <div className="mt-1 text-lg font-semibold">{t("accounting.reports.cashflow")}</div>
                <div className="mt-1 text-xs text-muted-foreground">{t("accounting.reports.cashflow.desc")}</div>
              </Card>
            </Link>
            <Link href="/global/accounting/reports/trial-balance">
              <Card className="h-full cursor-pointer transition hover:border-primary/60">
                <div className="text-sm text-muted-foreground">{t("accounting.reports.label")}</div>
                <div className="mt-1 text-lg font-semibold">{t("accounting.reports.trial")}</div>
                <div className="mt-1 text-xs text-muted-foreground">{t("accounting.reports.trial.desc")}</div>
              </Card>
            </Link>
            <Link href="/global/accounting/reports/balance-sheet">
              <Card className="h-full cursor-pointer transition hover:border-primary/60">
                <div className="text-sm text-muted-foreground">{t("accounting.reports.label")}</div>
                <div className="mt-1 text-lg font-semibold">{t("accounting.reports.balance")}</div>
                <div className="mt-1 text-xs text-muted-foreground">{t("accounting.reports.balance.desc")}</div>
              </Card>
            </Link>
            <Link href="/global/accounting/chart-of-accounts">
              <Card className="h-full cursor-pointer transition hover:border-primary/60">
                <div className="text-sm text-muted-foreground">{t("accounting.reports.label")}</div>
                <div className="mt-1 text-lg font-semibold">{t("accounting.reports.chart")}</div>
                <div className="mt-1 text-xs text-muted-foreground">{t("accounting.reports.chart.desc")}</div>
              </Card>
            </Link>
          </div>

          <Card className="grid gap-4 border p-4 md:grid-cols-2">
            <div>
              <div className="text-sm font-semibold">{aiTitle}</div>
              {aiLoading && <div className="text-sm text-muted-foreground">{aiLoadingText}</div>}
              {aiError && <div className="text-sm text-destructive">{aiError}</div>}
              {!aiLoading && !aiError && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {aiSuggestions.length === 0 && <li>{aiEmptyText}</li>}
                  {aiSuggestions.map((s, idx) => (
                    <li key={`ai-s-${idx}`}>{s}</li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div className="text-sm font-semibold">{aiAppTitle}</div>
              <div className="mt-2 text-sm text-muted-foreground">
                {aiLoading ? aiLoadingText : aiAppreciation ?? aiEmptyText}
              </div>
            </div>
          </Card>

          <div className="grid gap-3 md:grid-cols-2">
            <Card className="space-y-3">
              <div className="text-lg font-semibold">{t("accounting.ledger.title")}</div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <div className={labelClass}>{t("accounting.ledger.date")}</div>
                  <input
                    type="date"
                    className={inputClass}
                    value={ledgerForm.date}
                    onChange={(e) => setLedgerForm({ ...ledgerForm, date: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <div className={labelClass}>{t("accounting.ledger.description")}</div>
                  <input
                    className={inputClass}
                    value={ledgerForm.description}
                    onChange={(e) => setLedgerForm({ ...ledgerForm, description: e.target.value })}
                    placeholder={t("accounting.ledger.descriptionPlaceholder")}
                  />
                </div>
                <div>
                  <div className={labelClass}>{t("accounting.ledger.debitAccount")}</div>
                  <select
                    className={inputClass}
                    value={ledgerForm.debitAccountId}
                    onChange={(e) => setLedgerForm({ ...ledgerForm, debitAccountId: e.target.value })}
                  >
                    <option value="">{t("accounting.select")}</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className={labelClass}>{t("accounting.ledger.creditAccount")}</div>
                  <select
                    className={inputClass}
                    value={ledgerForm.creditAccountId}
                    onChange={(e) => setLedgerForm({ ...ledgerForm, creditAccountId: e.target.value })}
                  >
                    <option value="">{t("accounting.select")}</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <div className={labelClass}>{t("accounting.ledger.amount")}</div>
                  <input
                    className={inputClass}
                    value={ledgerForm.amount}
                    onChange={(e) => setLedgerForm({ ...ledgerForm, amount: e.target.value })}
                    placeholder="1000"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleLedgerEntry}
                  disabled={ledgerSaving}
                  className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {ledgerSaving ? t("accounting.ledger.posting") : t("accounting.ledger.post")}
                </button>
                {ledgerMessage && <div className="text-xs text-muted-foreground">{ledgerMessage}</div>}
              </div>
            </Card>

            <Card className="space-y-3">
              <div className="text-lg font-semibold">{t("accounting.entries.title")}</div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2">{t("accounting.entries.date")}</th>
                      <th className="px-3 py-2">{t("accounting.entries.description")}</th>
                      <th className="px-3 py-2 text-right">{t("accounting.entries.debit")}</th>
                      <th className="px-3 py-2 text-right">{t("accounting.entries.credit")}</th>
                      <th className="px-3 py-2 text-right">{t("accounting.entries.balance")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.id} className="border-b border-white/5">
                        <td className="px-3 py-2">
                          <div className="font-semibold">{formatDate(entry.date)}</div>
                          <div className="text-xs text-muted-foreground">{entry.id}</div>
                        </td>
                        <td className="px-3 py-2">{entry.description}</td>
                        <td className="px-3 py-2 text-right">{formatAmount(entry.debit)}</td>
                        <td className="px-3 py-2 text-right">{formatAmount(entry.credit)}</td>
                        <td className="px-3 py-2 text-right">{formatAmount(entry.balance)}</td>
                      </tr>
                    ))}
                    {entries.length === 0 && (
                      <tr>
                        <td className="px-3 py-3 text-sm text-muted-foreground" colSpan={5}>
                          {t("accounting.entries.empty")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {accountsError && <div className="text-sm text-destructive">{accountsError}</div>}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
