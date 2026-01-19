"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppLayout, Card } from "@repo/ui";

type Metric = {
  label: string;
  value: string;
  detail?: string;
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
};

type AccountsResponse = {
  data: Account[];
};

export default function AccountingClient({ companyId }: { companyId: string }) {
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  const basePath = `/api/company/${companyId}/accounting`;

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
      const res = await fetch(`${basePath}/summary`, { cache: "no-store" });
      if (res.status === 404) {
        setData({ metrics: [], entries: [] });
        return;
      }
      if (!res.ok) throw new Error("Failed to load accounting summary");
      const json = (await res.json()) as SummaryResponse;
      setData(json);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load accounting summary");
    } finally {
      setLoading(false);
    }
  }, [basePath]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    let active = true;
    async function loadAccounts() {
      setAccountsError(null);
      try {
        const res = await fetch(`${basePath}/accounts`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load accounts");
        const json = (await res.json()) as AccountsResponse;
        if (active) setAccounts(json.data ?? []);
      } catch (err: any) {
        if (active) setAccountsError(err?.message ?? "Failed to load accounts");
      }
    }
    loadAccounts();
    return () => {
      active = false;
    };
  }, [basePath]);

  async function handleLedgerEntry() {
    const amount = Number(ledgerForm.amount || 0);
    if (!ledgerForm.debitAccountId || !ledgerForm.creditAccountId || amount <= 0) {
      setLedgerMessage("Please select accounts and enter an amount greater than zero.");
      return;
    }
    setLedgerSaving(true);
    setLedgerMessage(null);
    try {
      const res = await fetch(`${basePath}/journals`, {
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
      if (!res.ok) throw new Error(json?.error ?? "Failed to post ledger entry");
      setLedgerMessage("Ledger entry posted.");
      setLedgerForm({
        ...ledgerForm,
        description: "",
        amount: "",
      });
      await loadSummary();
    } catch (err: any) {
      setLedgerMessage(err?.message ?? "Failed to post ledger entry");
    } finally {
      setLedgerSaving(false);
    }
  }

  const inputClass = "w-full rounded-md border px-3 py-2 text-sm";
  const labelClass = "text-xs font-semibold text-muted-foreground";

  const metrics = data?.metrics ?? [];
  const entries = data?.entries ?? [];

  return (
    <AppLayout>
      <div className="space-y-6 py-4">
        <div>
          <h1 className="text-2xl font-semibold">Accounting</h1>
          <p className="text-sm text-muted-foreground">Company-level accounting overview and quick actions.</p>
        </div>

        {error && <div className="text-sm text-destructive">{error}</div>}
        {loading && !error && <div className="text-sm text-muted-foreground">Loading summary...</div>}

        {!loading && !error && (
          <>
            <div className="grid gap-3 md:grid-cols-3">
              {metrics.map((m) => (
                <Card key={m.label}>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{m.label}</div>
                  <div className="mt-1 text-xl font-semibold">{m.value}</div>
                  {m.detail && <div className="mt-1 text-xs text-muted-foreground">{m.detail}</div>}
                </Card>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <Link href={`/company/${companyId}/accounting/reports/pnl`}>
                <Card className="h-full cursor-pointer transition hover:border-primary/60">
                  <div className="text-sm text-muted-foreground">Reports</div>
                  <div className="mt-1 text-lg font-semibold">Profit &amp; Loss</div>
                  <div className="mt-1 text-xs text-muted-foreground">Review income and expenses.</div>
                </Card>
              </Link>
              <Link href={`/company/${companyId}/accounting/reports/cashflow`}>
                <Card className="h-full cursor-pointer transition hover:border-primary/60">
                  <div className="text-sm text-muted-foreground">Reports</div>
                  <div className="mt-1 text-lg font-semibold">Cash Flow</div>
                  <div className="mt-1 text-xs text-muted-foreground">Track operating, investing, and financing cash.</div>
                </Card>
              </Link>
              <Link href={`/company/${companyId}/accounting/reports/trial-balance`}>
                <Card className="h-full cursor-pointer transition hover:border-primary/60">
                  <div className="text-sm text-muted-foreground">Reports</div>
                  <div className="mt-1 text-lg font-semibold">Trial Balance</div>
                  <div className="mt-1 text-xs text-muted-foreground">Check balances across accounts.</div>
                </Card>
              </Link>
              <Link href={`/company/${companyId}/accounting/reports/balance-sheet`}>
                <Card className="h-full cursor-pointer transition hover:border-primary/60">
                  <div className="text-sm text-muted-foreground">Reports</div>
                  <div className="mt-1 text-lg font-semibold">Balance Sheet</div>
                  <div className="mt-1 text-xs text-muted-foreground">Review assets, liabilities, and equity.</div>
                </Card>
              </Link>
              <Link href={`/company/${companyId}/accounting/accounts`}>
                <Card className="h-full cursor-pointer transition hover:border-primary/60">
                  <div className="text-sm text-muted-foreground">Reports</div>
                  <div className="mt-1 text-lg font-semibold">Chart of Accounts</div>
                  <div className="mt-1 text-xs text-muted-foreground">View and manage GL accounts.</div>
                </Card>
              </Link>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Card className="space-y-3">
                <div className="text-lg font-semibold">Quick Ledger Entry</div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className={labelClass}>Date</div>
                    <input
                      type="date"
                      className={inputClass}
                      value={ledgerForm.date}
                      onChange={(e) => setLedgerForm({ ...ledgerForm, date: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <div className={labelClass}>Description</div>
                    <input
                      className={inputClass}
                      value={ledgerForm.description}
                      onChange={(e) => setLedgerForm({ ...ledgerForm, description: e.target.value })}
                    />
                  </div>
                  <div>
                    <div className={labelClass}>Debit account</div>
                    <select
                      className={inputClass}
                      value={ledgerForm.debitAccountId}
                      onChange={(e) => setLedgerForm({ ...ledgerForm, debitAccountId: e.target.value })}
                    >
                      <option value="">Select account</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} — {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className={labelClass}>Credit account</div>
                    <select
                      className={inputClass}
                      value={ledgerForm.creditAccountId}
                      onChange={(e) => setLedgerForm({ ...ledgerForm, creditAccountId: e.target.value })}
                    >
                      <option value="">Select account</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} — {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className={labelClass}>Amount</div>
                    <input
                      type="number"
                      min="0"
                      className={inputClass}
                      value={ledgerForm.amount}
                      onChange={(e) => setLedgerForm({ ...ledgerForm, amount: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
                    onClick={handleLedgerEntry}
                    disabled={ledgerSaving || !ledgerForm.debitAccountId || !ledgerForm.creditAccountId}
                  >
                    {ledgerSaving ? "Posting..." : "Post entry"}
                  </button>
                  {ledgerMessage && <div className="text-xs text-muted-foreground">{ledgerMessage}</div>}
                </div>
                {accountsError && <div className="text-xs text-destructive">{accountsError}</div>}
              </Card>

              <Card className="space-y-3">
                <div className="text-lg font-semibold">Recent entries</div>
                <div className="space-y-2">
                  {entries.length === 0 && <div className="text-sm text-muted-foreground">No entries yet.</div>}
                  {entries.map((e) => (
                    <div key={e.id} className="rounded-md border p-2">
                      <div className="flex items-center justify-between text-sm font-semibold">
                        <span>{formatDate(e.date)}</span>
                        <span>{formatAmount(e.balance)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{e.description}</div>
                      <div className="mt-1 text-xs">
                        Debit: {formatAmount(e.debit)} · Credit: {formatAmount(e.credit)}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
