"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Select, { SingleValue } from "react-select";
import { Card } from "@repo/ui";

type Journal = {
  id: string;
  journal_no: string;
  journal_type: string;
  date: string;
  description: string | null;
  is_posted: boolean;
  created_at: string;
};

type JournalsResponse = {
  data: Journal[];
};

type Account = {
  id: string;
  accountCode: string;
  accountName: string;
};

type AccountsResponse = {
  data: Account[];
};

type JournalForm = {
  date: string;
  description: string;
  journalType: string;
};

const defaultForm: JournalForm = {
  date: new Date().toISOString().slice(0, 10),
  description: "",
  journalType: "general",
};

type LineForm = {
  id: string;
  accountId: string;
  debit: string;
  credit: string;
  description: string;
};

type JournalLineView = {
  id: string;
  account_id: string;
  debit: number;
  credit: number;
  description: string | null;
  line_no: number;
};

const createLine = (): LineForm => ({
  id: Math.random().toString(36).slice(2),
  accountId: "",
  debit: "",
  credit: "",
  description: "",
});

export default function JournalsClient({ companyId }: { companyId: string }) {
  const basePath = `/api/company/${companyId}/accounting`;
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [form, setForm] = useState<JournalForm>(defaultForm);
  const [lines, setLines] = useState<LineForm[]>(() => [createLine(), createLine()]);
  const [viewJournal, setViewJournal] = useState<Journal & { lines: JournalLineView[] } | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);
  const [postingJournalId, setPostingJournalId] = useState<string | null>(null);
  const [editingJournalId, setEditingJournalId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [rangePreset, setRangePreset] = useState("today");
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const updateLine = (id: string, patch: Partial<LineForm>) => {
    setLines((prev) => prev.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  };

  const addLine = () => {
    setLines((prev) => [...prev, createLine()]);
  };

  const removeLine = (id: string) => {
    setLines((prev) => (prev.length <= 2 ? prev : prev.filter((line) => line.id !== id)));
  };

  const totalDebit = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
  const totalDebitRef = useRef<HTMLInputElement>(null);
  const totalCreditRef = useRef<HTMLInputElement>(null);

  const accountOptions = useMemo(
    () =>
      accounts.map((account) => ({
        value: account.id,
        label: `${account.accountCode ?? account.id} - ${account.accountName ?? "Account"}`,
      })),
    [accounts]
  );
  const accountMap = useMemo(() => {
    const map = new Map<string, Account>();
    accounts.forEach((account) => map.set(account.id, account));
    return map;
  }, [accounts]);
  const editingJournalNo = useMemo(
    () => journals.find((journal) => journal.id === editingJournalId)?.journal_no,
    [journals, editingJournalId]
  );
  const formatDecimal = useCallback(
    (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    []
  );

  const selectStyles = useMemo(
    () => ({
      control: (provided: any) => ({
        ...provided,
        backgroundColor: "rgba(255,255,255,0.9)",
        borderColor: "rgba(148,163,184,0.5)",
        color: "#0f172a",
        minHeight: "38px",
      }),
      singleValue: (provided: any) => ({ ...provided, color: "#0f172a" }),
      option: (provided: any, state: any) => ({
        ...provided,
        backgroundColor: state.isFocused ? "rgba(14,165,233,0.2)" : "#fff",
        color: "#0f172a",
      }),
      menu: (provided: any) => ({ ...provided, zIndex: 30 }),
      menuList: (provided: any) => ({
        ...provided,
        maxHeight: "220px",
        overflowY: "auto",
      }),
      placeholder: (provided: any) => ({ ...provided, color: "#64748b" }),
    }),
    []
  );

  const menuPortalTarget = useMemo(() => (typeof document !== "undefined" ? document.body : null), []);

  const getAccountOption = (accountId: string) =>
    accountOptions.find((opt) => opt.value === accountId) ?? null;

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        timeZone: "UTC",
        year: "numeric",
        month: "short",
        day: "2-digit",
      }),
    []
  );

  const viewJournalLines = viewJournal?.lines ?? [];
  const viewDebitTotal = viewJournalLines.reduce(
    (sum, line) => sum + Number(line.debit ?? 0),
    0
  );
  const viewCreditTotal = viewJournalLines.reduce(
    (sum, line) => sum + Number(line.credit ?? 0),
    0
  );
  const viewBalance = viewDebitTotal - viewCreditTotal;

  const getViewAccountLabel = (line: JournalLineView) => {
    const account = accountMap.get(line.account_id);
    if (!account) return line.account_id;
    return `${account.accountCode ?? account.id} - ${account.accountName ?? "Account"}`;
  };

  const loadJournals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`${basePath}/journals?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load journals");
      const json = (await res.json()) as JournalsResponse;
      setJournals(json.data ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load journals");
    } finally {
      setLoading(false);
    }
  }, [basePath]);

  useEffect(() => {
    loadJournals();
  }, [loadJournals]);

  useEffect(() => {
    const now = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    switch (rangePreset) {
      case "today":
        setFrom(iso(now));
        setTo(iso(now));
        break;
      case "yesterday": {
        const target = new Date(now);
        target.setDate(target.getDate() - 1);
        const dateStr = iso(target);
        setFrom(dateStr);
        setTo(dateStr);
        break;
      }
      case "last7": {
        const start = new Date(now);
        start.setDate(start.getDate() - 6);
        setFrom(iso(start));
        setTo(iso(now));
        break;
      }
      case "last30": {
        const start = new Date(now);
        start.setDate(start.getDate() - 29);
        setFrom(iso(start));
        setTo(iso(now));
        break;
      }
      case "thisMonth": {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        setFrom(iso(start));
        setTo(iso(end));
        break;
      }
      case "lastMonth": {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        setFrom(iso(start));
        setTo(iso(end));
        break;
      }
      default:
        break;
    }
  }, [rangePreset]);

  useEffect(() => {
    let active = true;
    async function loadAccounts() {
      setAccountsError(null);
      try {
        const res = await fetch(`/api/accounting/accounts?companyId=${companyId}`, { cache: "no-store" });
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
  }, [companyId]);

  async function handleCreateJournal() {
    const parsedLines = lines.map((line) => ({
      ...line,
      debit: Number(line.debit || 0),
      credit: Number(line.credit || 0),
    }));
    const debitTotal = parsedLines.reduce((sum, line) => sum + line.debit, 0);
    const creditTotal = parsedLines.reduce((sum, line) => sum + line.credit, 0);

    if (debitTotal <= 0 || creditTotal <= 0) {
      setMessage("Enter at least one debit and one credit line with positive amounts.");
      setMessageType("error");
      totalDebitRef.current?.focus();
      return;
    }
    if (debitTotal !== creditTotal) {
      setMessage("Debits and credits must balance.");
      setMessageType("error");
      totalDebitRef.current?.focus();
      return;
    }
    const invalidLine = parsedLines.find((line) => !line.accountId || (line.debit <= 0 && line.credit <= 0));
    if (invalidLine) {
      setMessage("Each line needs an account and a positive amount.");
      return;
    }

    setSaving(true);
    setMessage(null);
    setMessageType(null);
    try {
      const payload = {
        date: form.date,
        description: form.description || null,
        journalType: form.journalType,
        lines: parsedLines.map((line) => ({
          accountId: line.accountId,
          debit: line.debit,
          credit: line.credit,
          description: line.description || null,
        })),
      };
      const isEditing = Boolean(editingJournalId);
      const res = await fetch(
        isEditing ? `${basePath}/journals/${editingJournalId}` : `${basePath}/journals`,
        {
          method: isEditing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to create journal");
      setMessage(isEditing ? "Draft updated." : "Draft saved.");
      setMessageType("success");
      setForm(defaultForm);
      setLines([createLine(), createLine()]);
      setShowForm(false);
      setEditingJournalId(null);
      await loadJournals();
    } catch (err: any) {
      setMessage(err?.message ?? "Failed to create journal");
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  const handleViewJournal = useCallback(
    async (journalId: string) => {
      setViewLoading(true);
      setViewError(null);
      try {
        const res = await fetch(`${basePath}/journals/${journalId}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load journal");
        const json = (await res.json()) as { data?: Journal & { lines: JournalLineView[] } };
        setViewJournal(json.data ?? null);
      } catch (err: any) {
        setViewError(err?.message ?? "Failed to load journal");
        setViewJournal(null);
      } finally {
        setViewLoading(false);
      }
    },
    [basePath]
  );

  const handleEditJournal = useCallback(
    async (journalId: string) => {
      setMessage(null);
      setMessageType(null);
      setActionMessage(null);
      try {
        const res = await fetch(`${basePath}/journals/${journalId}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load journal for edit");
        const json = (await res.json()) as { data?: Journal & { lines: JournalLineView[] } };
        const journal = json.data;
        if (!journal) {
          throw new Error("Journal not found");
        }
        setForm({
          date: journal.date ?? new Date().toISOString().slice(0, 10),
          description: journal.description ?? "",
          journalType: journal.journal_type,
        });
        const mappedLines = journal.lines.map((line) => ({
          id: Math.random().toString(36).slice(2),
          accountId: line.account_id,
          debit: line.debit.toString(),
          credit: line.credit.toString(),
          description: line.description ?? "",
        }));
        if (mappedLines.length < 2) {
          setLines([
            ...mappedLines,
            ...Array.from({ length: 2 - mappedLines.length }, () => createLine()),
          ]);
        } else {
          setLines(mappedLines);
        }
        setEditingJournalId(journalId);
        setShowForm(true);
        setMessage("Draft ready for editing.");
        setMessageType("success");
      } catch (err: any) {
        setMessage(err?.message ?? "Failed to load journal for edit");
        setMessageType("error");
      }
    },
    [basePath]
  );

  const handlePostJournal = useCallback(
    async (journalId: string) => {
      setPostingJournalId(journalId);
      setActionMessage(null);
      try {
        const res = await fetch(`${basePath}/journals/${journalId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Failed to post journal");
        setActionMessage({ text: "Journal posted.", type: "success" });
        await loadJournals();
        if (viewJournal?.id === journalId) {
          handleViewJournal(journalId);
        }
      } catch (err: any) {
        setActionMessage({ text: err?.message ?? "Failed to post journal", type: "error" });
      } finally {
        setPostingJournalId(null);
      }
    },
    [basePath, handleViewJournal, loadJournals, viewJournal?.id]
  );

  const cancelEdit = useCallback(() => {
    setEditingJournalId(null);
    setForm(defaultForm);
    setLines([createLine(), createLine()]);
    setMessage(null);
    setMessageType(null);
    setShowForm(false);
  }, []);

  const inputClass =
    "w-full rounded-md border border-white/30 bg-white/90 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus:border-primary focus:ring-2 focus:ring-primary/40 appearance-none";
  const labelClass = "text-xs font-semibold text-white/70";
  const panelClass = "space-y-4 bg-slate-900/70 border border-white/10 p-4 shadow-xl text-white";
  const buttonClass =
    "rounded-md border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/50 hover:bg-white/10 disabled:opacity-50";
  const addLineClass =
    "rounded-md border border-white/20 bg-transparent px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:border-white/50 hover:text-white";

  return (
    <div className="space-y-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Journals</h1>
          <p className="text-sm text-muted-foreground">Review journal entries and post new ones.</p>
        </div>
        <button className={buttonClass} onClick={() => setShowForm((prev) => !prev)}>
          {showForm ? "Close" : "Add Journal"}
        </button>
      </div>

      {showForm && (
        <Card className={panelClass}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-semibold">
                {editingJournalId ? "Edit journal draft" : "New journal"}
              </div>
              {editingJournalId && (
                <p className="text-xs text-muted-foreground">
                  {editingJournalNo ? `Editing draft ${editingJournalNo}` : "Editing draft journal"}
                </p>
              )}
            </div>
            {editingJournalId && (
              <button
                type="button"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-white"
                onClick={cancelEdit}
              >
                Cancel edit
              </button>
            )}
          </div>
          {message && (
            <div
              className={`rounded-md border px-3 py-2 text-sm font-semibold flex items-center gap-2 ${
                messageType === "error"
                  ? "border-red-400 bg-red-500/10 text-red-200"
                  : "border-emerald-500 bg-emerald-500/10 text-emerald-100"
              }`}
            >
              {messageType === "error" ? "⚠️" : "✅"} {message}
            </div>
          )}
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <div className={labelClass}>Date</div>
          <input
            type="date"
            className={inputClass}
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </div>
        <div>
          <div className={labelClass}>Journal type</div>
          <select
            className={inputClass}
            value={form.journalType}
            onChange={(e) => setForm({ ...form, journalType: e.target.value })}
          >
            <option value="general">General</option>
            <option value="invoice">Invoice</option>
            <option value="payment">Payment</option>
            <option value="adjustment">Adjustment</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <div className={labelClass}>Description</div>
          <input
            className={inputClass}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
      </div>

            <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold">Ledger lines</div>
              <button type="button" className={addLineClass} onClick={addLine}>
                Add line
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-white/60 border-b border-white/10">
              <tr>
                <th className="px-2 py-2">Chart Account</th>
                <th className="px-2 py-2">Description</th>
                <th className="px-2 py-2">Debit</th>
                <th className="px-2 py-2">Credit</th>
                <th className="px-2 py-2">Action</th>
              </tr>
            </thead>
                <tbody>
                  {lines.map((line, idx) => (
                    <tr key={line.id} className="border-t border-white/10">
                      <td className="px-2 py-2">
                        <Select
                          options={accountOptions}
                          value={getAccountOption(line.accountId)}
                          onChange={(option: SingleValue<{ value: string; label: string }>) =>
                            updateLine(line.id, { accountId: option?.value ?? "" })
                          }
                          placeholder="Select account"
                          styles={selectStyles}
                          classNamePrefix="react-select"
                          menuPortalTarget={menuPortalTarget ?? undefined}
                          menuPosition="fixed"
                          menuPlacement="auto"
                          filterOption={(option, rawInput) => {
                            const input = rawInput.toLowerCase();
                            const label = option.label?.toLowerCase() ?? "";
                            const value = option.value?.toLowerCase() ?? "";
                            return label.includes(input) || value.includes(input);
                          }}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className={inputClass}
                          placeholder="Optional note"
                          value={line.description}
                          onChange={(e) => updateLine(line.id, { description: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min="0"
                          className={inputClass}
                          value={line.debit}
                          onChange={(e) => updateLine(line.id, { debit: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min="0"
                          className={inputClass}
                          value={line.credit}
                          onChange={(e) => updateLine(line.id, { credit: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <button
                          className="text-xs text-destructive hover:text-red-400 disabled:text-white/40"
                          type="button"
                          onClick={() => removeLine(line.id)}
                          disabled={lines.length <= 2}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-white/10 bg-white/5">
                    <td className="px-2 py-2 font-semibold" colSpan={2}>
                      Totals
                    </td>
                    <td className="px-2 py-2">
                      <input
                        ref={totalDebitRef}
                        className={`${inputClass} border-dashed border-white/40 bg-white/40 text-slate-900`}
                        value={totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        readOnly
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        ref={totalCreditRef}
                        className={`${inputClass} border-dashed border-white/40 bg-white/40 text-slate-900`}
                        value={totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        readOnly
                      />
                    </td>
                    <td className="px-2 py-2" />
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-6 text-xs font-semibold text-muted-foreground">
              <span>Total debit: {totalDebit.toLocaleString()} </span>
              <span>Total credit: {totalCredit.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button className={buttonClass} onClick={handleCreateJournal} disabled={saving}>
              {saving ? "Saving..." : "Create journal"}
            </button>
            {message && <div className="text-xs text-muted-foreground">{message}</div>}
            {accountsError && <div className="text-xs text-destructive">{accountsError}</div>}
          </div>
        </Card>
      )}

      {actionMessage && (
        <div
          className={`rounded-md border px-3 py-2 text-sm font-semibold ${
            actionMessage.type === "error"
              ? "border-red-400 bg-red-500/10 text-red-200"
              : "border-emerald-500 bg-emerald-500/10 text-emerald-100"
          }`}
        >
          {actionMessage.text}
        </div>
      )}
      <Card className="overflow-x-auto bg-slate-900/70 border border-white/10 shadow-xl">
        {error && <div className="p-4 text-sm text-destructive">{error}</div>}
        {loading && !error && <div className="p-4 text-sm text-muted-foreground">Loading journals...</div>}
        {!loading && !error && journals.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground">No journals posted yet.</div>
        )}
        {!loading && !error && journals.length > 0 && (
          <table className="min-w-full text-sm">
            <thead className="border-b">
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Journal No</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
            </thead>
            <tbody>
              {journals.map((j) => (
                <tr key={j.id} className="border-b border-border/60">
                  <td className="px-4 py-3 text-sm">
                    {j.date ? dateFormatter.format(new Date(j.date)) : "-"}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold">{j.journal_no}</td>
                  <td className="px-4 py-3 text-sm capitalize">{j.journal_type}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{j.description ?? "-"}</td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                        j.is_posted ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-200"
                      }`}
                    >
                      {j.is_posted ? "Posted" : "Draft"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="text-xs text-blue-400 hover:text-blue-300"
                      onClick={() => handleViewJournal(j.id)}
                    >
                      View
                    </button>
                    {!j.is_posted && (
                      <>
                        <button
                          type="button"
                          className={`text-xs font-semibold rounded border px-2 py-1 transition ${
                            postingJournalId === j.id
                              ? "border-white/30 text-white/40"
                              : "border-white/20 text-emerald-400 hover:border-white/40 hover:text-emerald-300"
                          }`}
                          disabled={postingJournalId === j.id}
                          onClick={() => handlePostJournal(j.id)}
                        >
                          {postingJournalId === j.id ? "Posting..." : "Post"}
                        </button>
                        <button
                          type="button"
                          className="text-xs text-blue-400 hover:text-blue-300"
                          onClick={() => handleEditJournal(j.id)}
                        >
                          Edit
                        </button>
                      </>
                    )}
                    {j.is_posted && (
                      <button
                        type="button"
                        className="text-xs text-white/40 border border-white/20 px-2 py-1 rounded"
                        disabled
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {(viewLoading || viewError || viewJournal) && (
        <Card className="bg-slate-900/80 border border-white/10 shadow-xl">
          {viewLoading && (
            <div className="p-4 text-sm text-muted-foreground">Loading journal details...</div>
          )}
          {viewError && !viewLoading && (
            <div className="p-4 text-sm text-destructive">{viewError}</div>
          )}
          {!viewLoading && !viewError && viewJournal && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">Journal {viewJournal.journal_no}</div>
                  <div className="text-sm text-muted-foreground">
                    {viewJournal.date ? dateFormatter.format(new Date(viewJournal.date)) : "-"} -{" "}
                    {viewJournal.journal_type}
                  </div>
                  {viewJournal.description && (
                    <p className="text-sm text-muted-foreground">{viewJournal.description}</p>
                  )}
                </div>
                <div className="space-x-2">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                      viewJournal.is_posted ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-200"
                    }`}
                  >
                    {viewJournal.is_posted ? "Posted" : "Draft"}
                  </span>
                  <button
                    type="button"
                    className="rounded-md border border-white/20 bg-white/5 px-3 py-1 text-xs font-semibold text-white transition hover:border-white/50 hover:bg-white/10"
                    onClick={() => {
                      setViewJournal(null);
                      setViewError(null);
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2">Line</th>
                      <th className="px-4 py-2">Account</th>
                      <th className="px-4 py-2">Description</th>
                      <th className="px-4 py-2">Debit</th>
                      <th className="px-4 py-2">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewJournalLines.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-3 text-sm text-muted-foreground">
                          No lines recorded.
                        </td>
                      </tr>
                    )}
                    {viewJournalLines.map((line) => (
                      <tr key={line.id} className="border-b border-white/10">
                        <td className="px-4 py-3 text-sm font-semibold">{line.line_no}</td>
                        <td className="px-4 py-3 text-sm">{getViewAccountLabel(line)}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {line.description ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono">{formatDecimal(Number(line.debit ?? 0))}</td>
                        <td className="px-4 py-3 text-sm font-mono">{formatDecimal(Number(line.credit ?? 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-4 text-xs font-semibold text-muted-foreground">
                <span>Debit total: {formatDecimal(viewDebitTotal)}</span>
                <span>Credit total: {formatDecimal(viewCreditTotal)}</span>
                <span
                  className={`font-semibold ${
                    viewBalance === 0 ? "text-emerald-300" : viewBalance > 0 ? "text-blue-200" : "text-amber-200"
                  }`}
                >
                  Balance: {formatDecimal(viewBalance)}
                </span>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
