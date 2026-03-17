"use client";

import React from "react";
import { useTheme } from "@repo/ui";

export type BankAccount = {
  bankName?: string | null;
  branchName?: string | null;
  accountName?: string | null;
  accountNumber?: string | null;
  iban?: string | null;
  swift?: string | null;
  currency?: string | null;
  isDefault?: boolean;
};

type Props = {
  accounts: BankAccount[];
  onChange: (accounts: BankAccount[]) => void;
};

export function BankAccountFields({ accounts, onChange }: Props) {
  const { theme } = useTheme();
  const inputClass = theme.input;
  const cardClass = `${theme.cardBg} ${theme.cardBorder}`;

  const update = (idx: number, patch: Partial<BankAccount>) => {
    const next = accounts.slice();
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const add = () => {
    onChange([
      ...accounts,
      {
        bankName: "",
        branchName: "",
        accountName: "",
        accountNumber: "",
        iban: "",
        swift: "",
        currency: "",
        isDefault: accounts.length === 0,
      },
    ]);
  };

  const remove = (idx: number) => {
    const next = accounts.slice();
    next.splice(idx, 1);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Bank Accounts</h3>
        <button type="button" onClick={add} className="text-sm text-primary hover:underline">
          Add bank account
        </button>
      </div>
      {accounts.length === 0 && <div className="text-sm text-muted-foreground">No bank accounts yet.</div>}
      <div className="space-y-3">
        {accounts.map((acc, idx) => (
          <div key={idx} className={`rounded-lg p-3 space-y-2 ${cardClass}`}>
            <div className="flex items-center justify-between text-sm">
              <span>Account #{idx + 1}</span>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={!!acc.isDefault} onChange={(e) => update(idx, { isDefault: e.target.checked })} />
                  Default
                </label>
                <button type="button" onClick={() => remove(idx)} className="text-destructive hover:underline text-xs">
                  Remove
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                className={inputClass}
                placeholder="Bank name"
                value={acc.bankName ?? ""}
                onChange={(e) => update(idx, { bankName: e.target.value })}
              />
              <input
                className={inputClass}
                placeholder="Branch name"
                value={acc.branchName ?? ""}
                onChange={(e) => update(idx, { branchName: e.target.value })}
              />
              <input
                className={inputClass}
                placeholder="Account name"
                value={acc.accountName ?? ""}
                onChange={(e) => update(idx, { accountName: e.target.value })}
              />
              <input
                className={inputClass}
                placeholder="Account number"
                value={acc.accountNumber ?? ""}
                onChange={(e) => update(idx, { accountNumber: e.target.value })}
              />
              <input
                className={inputClass}
                placeholder="IBAN"
                value={acc.iban ?? ""}
                onChange={(e) => update(idx, { iban: e.target.value })}
              />
              <input
                className={inputClass}
                placeholder="SWIFT"
                value={acc.swift ?? ""}
                onChange={(e) => update(idx, { swift: e.target.value })}
              />
              <input
                className={inputClass}
                placeholder="Currency"
                value={acc.currency ?? ""}
                onChange={(e) => update(idx, { currency: e.target.value })}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
