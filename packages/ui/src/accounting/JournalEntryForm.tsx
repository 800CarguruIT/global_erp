"use client";

import React, { useMemo, useState } from "react";

type AccountOption = { id: string; code: string; name: string };

export interface JournalEntryFormProps {
  accounts: AccountOption[];
  initialValues?: {
    date?: string;
    reference?: string;
    description?: string;
    lines: Array<{
      accountId: string;
      debit: number;
      credit: number;
    }>;
  };
  mode: "create" | "view";
  onSubmit?: (values: {
    date: string;
    reference?: string;
    description?: string;
    lines: Array<{ accountId: string; debit: number; credit: number }>;
  }) => Promise<void>;
  onCancel?: () => void;
}

const emptyLine = (accountId?: string) => ({
  accountId: accountId ?? "",
  debit: 0,
  credit: 0,
});

export function JournalEntryForm({ accounts, initialValues, mode, onSubmit, onCancel }: JournalEntryFormProps) {
  const [date, setDate] = useState<string>(
    initialValues?.date ?? new Date().toISOString().slice(0, 10)
  );
  const [reference, setReference] = useState<string>(initialValues?.reference ?? "");
  const [description, setDescription] = useState<string>(initialValues?.description ?? "");
  const [lines, setLines] = useState<Array<{ accountId: string; debit: number; credit: number }>>(
    initialValues?.lines?.length ? initialValues.lines : [emptyLine(accounts[0]?.id)]
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const totals = useMemo(() => {
    const debit = lines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
    const credit = lines.reduce((sum, l) => sum + Number(l.credit || 0), 0);
    return { debit, credit };
  }, [lines]);

  const readonly = mode === "view";

  function updateLine(idx: number, patch: Partial<{ accountId: string; debit: number; credit: number }>) {
    setLines((prev) => {
      const next = [...prev];
      const current = next[idx] ?? emptyLine(accounts[0]?.id);
      next[idx] = {
        accountId: patch.accountId ?? current.accountId ?? "",
        debit: patch.debit ?? current.debit ?? 0,
        credit: patch.credit ?? current.credit ?? 0,
      };
      return next;
    });
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine(accounts[0]?.id)]);
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (readonly || !onSubmit) return;
    setError(null);
    setSaving(true);
    try {
      await onSubmit({
        date,
        reference: reference || undefined,
        description: description || undefined,
        lines: lines.map((l) => ({
          accountId: l.accountId,
          debit: Number(l.debit || 0),
          credit: Number(l.credit || 0),
        })),
      });
    } catch (err: any) {
      setError(err?.message ?? "Failed to save journal entry");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1">
          <label className="text-xs font-medium">Date</label>
          <input
            type="date"
            value={date}
            disabled={readonly}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Reference</label>
          <input
            value={reference}
            disabled={readonly}
            onChange={(e) => setReference(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="JV number or reference"
          />
        </div>
        <div className="space-y-1 md:col-span-1">
          <label className="text-xs font-medium">Description</label>
          <input
            value={description}
            disabled={readonly}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Optional description"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
              <th className="py-2 pl-3 pr-4 text-left">Account</th>
              <th className="px-3 py-2 text-right">Debit</th>
              <th className="px-3 py-2 text-right">Credit</th>
              {mode === "create" && <th className="px-3 py-2 text-left">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => (
              <tr key={idx} className="border-b last:border-0">
                <td className="py-2 pl-3 pr-4">
                  <select
                    value={line.accountId}
                    disabled={readonly}
                    onChange={(e) => updateLine(idx, { accountId: e.target.value })}
                    className="w-full rounded-md border bg-background px-2 py-1 text-sm"
                  >
                    <option value="">Select account</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    disabled={readonly}
                    value={line.debit}
                    onChange={(e) => updateLine(idx, { debit: Number(e.target.value || 0) })}
                    className="w-full rounded-md border bg-background px-2 py-1 text-right text-sm tabular-nums"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    disabled={readonly}
                    value={line.credit}
                    onChange={(e) => updateLine(idx, { credit: Number(e.target.value || 0) })}
                    className="w-full rounded-md border bg-background px-2 py-1 text-right text-sm tabular-nums"
                  />
                </td>
                {mode === "create" && (
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      className="rounded-md border px-2 py-1 text-xs hover:bg-muted/40"
                    >
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {mode === "create" && (
        <div className="flex justify-between text-sm text-muted-foreground">
          <button
            type="button"
            onClick={addLine}
            className="rounded-md border px-3 py-1 text-sm font-medium hover:bg-white/10"
          >
            Add line
          </button>
          <div className="flex gap-4">
            <div>Debit: {totals.debit.toFixed(2)}</div>
            <div>Credit: {totals.credit.toFixed(2)}</div>
          </div>
        </div>
      )}

      {mode === "view" && (
        <div className="text-sm text-muted-foreground flex gap-4">
          <div>Debit: {totals.debit.toFixed(2)}</div>
          <div>Credit: {totals.credit.toFixed(2)}</div>
        </div>
      )}

      {error && <div className="text-sm text-destructive">{error}</div>}

      {mode === "create" && (
        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="rounded-md border px-4 py-2 text-sm font-semibold hover:bg-white/10"
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Journal Entry"}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border px-3 py-2 text-sm hover:bg-white/10"
              disabled={saving}
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </form>
  );
}
