"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card } from "@repo/ui";

type Account = {
  id: string;
  code: string;
  name: string;
  type: string;
  subType?: string | null;
  normalBalance?: string | null;
  standardId?: string | null;
  isActive?: boolean;
};

type AccountsResponse = {
  data: Account[];
};

type StandardAccount = {
  id: string;
  code: string;
  name: string;
  type: string;
};

type StandardsResponse = {
  data: StandardAccount[];
};

export default function ChartClient({ companyId }: { companyId: string }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [mappingSaving, setMappingSaving] = useState<string | null>(null);
  const [standards, setStandards] = useState<StandardAccount[]>([]);
  const [standardsError, setStandardsError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    code: "",
    name: "",
    type: "asset",
    normalBalance: "debit",
    subType: "",
  });

  const accountTypes = useMemo(() => ["asset", "liability", "equity", "income", "expense"], []);

  useEffect(() => {
    let active = true;
    async function loadAccounts() {
      setAccountsLoading(true);
      setAccountsError(null);
      try {
        const res = await fetch(`/api/company/${companyId}/accounting/accounts`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load accounts");
        const json = (await res.json()) as AccountsResponse;
        if (active) setAccounts(json.data ?? []);
      } catch (err: any) {
        if (active) setAccountsError(err?.message ?? "Failed to load accounts");
      } finally {
        if (active) setAccountsLoading(false);
      }
    }
    loadAccounts();
    return () => {
      active = false;
    };
  }, [companyId]);

  useEffect(() => {
    let active = true;
    async function loadStandards() {
      try {
        const res = await fetch("/api/global/accounting/standards", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load standard accounts");
        const json = (await res.json()) as StandardsResponse;
        if (active) setStandards(json.data ?? []);
      } catch (err: any) {
        if (active) setStandardsError(err?.message ?? "Failed to load standard accounts");
      }
    }
    loadStandards();
    return () => {
      active = false;
    };
  }, []);

  async function handleImport() {
    setImporting(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/company/${companyId}/accounting/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "importStandard" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to import accounts");
      setAccounts(json.data ?? []);
      setActionMessage("Standard accounting heads imported.");
    } catch (err: any) {
      setActionMessage(err?.message ?? "Failed to import accounting heads");
    } finally {
      setImporting(false);
    }
  }

  async function handleCreate() {
    if (!createForm.code.trim() || !createForm.name.trim()) {
      setActionMessage("Code and name are required.");
      return;
    }
    setCreating(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/company/${companyId}/accounting/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          code: createForm.code,
          name: createForm.name,
          type: createForm.type,
          normalBalance: createForm.normalBalance,
          subType: createForm.subType || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to create account");
      setAccounts((prev) => [json.data, ...prev]);
      setCreateForm({ ...createForm, code: "", name: "" });
      setActionMessage("New accounting head created.");
    } catch (err: any) {
      setActionMessage(err?.message ?? "Failed to create accounting head");
    } finally {
      setCreating(false);
    }
  }

  async function handleMap(accountId: string, standardId: string | null) {
    setMappingSaving(accountId);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/company/${companyId}/accounting/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "map", accountId, standardId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to update mapping");
      const updated: Account = json.data;
      setAccounts((prev) => prev.map((a) => (a.id === accountId ? { ...a, ...updated } : a)));
      setActionMessage("Mapping updated.");
    } catch (err: any) {
      setActionMessage(err?.message ?? "Failed to update mapping");
    } finally {
      setMappingSaving(null);
    }
  }

  const inputClass =
    "w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/30";
  const labelClass = "text-xs font-semibold text-muted-foreground";
  const standardAccountOptions = standards.map((s) => ({
    id: s.id,
    label: `${s.code} - ${s.name} (${s.type})`,
  }));

  return (
    <div className="space-y-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Chart of accounts & mappings</h1>
          <p className="text-sm text-muted-foreground">
            Import standard heads, add new ones, and review mapping for the company books.
          </p>
        </div>
        <button
          onClick={handleImport}
          disabled={importing}
          className="rounded-full border border-white/10 px-3 py-2 text-sm hover:border-white/30 disabled:opacity-50"
        >
          {importing ? "Importing..." : "Import standard heads"}
        </button>
      </div>

      <Card className="space-y-4">
        <div className="grid gap-3 md:grid-cols-5">
          <div className="md:col-span-1">
            <div className={labelClass}>Code</div>
            <input
              className={inputClass}
              value={createForm.code}
              onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })}
              placeholder="1000"
            />
          </div>
          <div className="md:col-span-2">
            <div className={labelClass}>Name</div>
            <input
              className={inputClass}
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              placeholder="Cash and bank"
            />
          </div>
          <div className="md:col-span-1">
            <div className={labelClass}>Type</div>
            <select
              className={inputClass}
              value={createForm.type}
              onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}
            >
              {accountTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className={labelClass}>Normal balance</div>
            <select
              className={inputClass}
              value={createForm.normalBalance}
              onChange={(e) => setCreateForm({ ...createForm, normalBalance: e.target.value })}
            >
              <option value="debit">Debit</option>
              <option value="credit">Credit</option>
            </select>
          </div>
          <div className="md:col-span-3">
            <div className={labelClass}>Sub-type (optional)</div>
            <input
              className={inputClass}
              value={createForm.subType}
              onChange={(e) => setCreateForm({ ...createForm, subType: e.target.value })}
              placeholder="cash, bank, ar, ap..."
            />
          </div>
          <div className="md:col-span-2 flex items-end">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {creating ? "Saving..." : "Create new head"}
            </button>
          </div>
        </div>
        {actionMessage && <div className="text-xs text-muted-foreground">{actionMessage}</div>}
      </Card>

      <Card className="space-y-2">
        <div className="text-lg font-semibold">Current heads & mapping</div>
        {accountsError && <div className="text-sm text-destructive">{accountsError}</div>}
        {standardsError && <div className="text-sm text-destructive">{standardsError}</div>}
        {accountsLoading ? (
          <div className="text-sm text-muted-foreground">Loading accounts...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-white/10">
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Balance</th>
                  <th className="px-3 py-2">Mapping</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} className="border-b border-white/5">
                    <td className="px-3 py-2">{a.code}</td>
                    <td className="px-3 py-2">{a.name}</td>
                    <td className="px-3 py-2 uppercase">{a.type}</td>
                    <td className="px-3 py-2">{a.normalBalance}</td>
                    <td className="px-3 py-2">
                      <select
                        className={inputClass}
                        value={a.standardId ?? ""}
                        onChange={(e) => handleMap(a.id, e.target.value || null)}
                        disabled={!!mappingSaving && mappingSaving !== a.id}
                      >
                        <option value="">Unmapped</option>
                        {standardAccountOptions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
