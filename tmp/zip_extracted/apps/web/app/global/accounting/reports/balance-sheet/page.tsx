"use client";

import React, { useEffect, useState } from "react";
import { Card, useI18n, useTheme } from "@repo/ui";

type Row = { accountCode: string; accountName: string; amount: number };

export default function BalanceSheetPage() {
  const { t } = useI18n();
  const { theme } = useTheme();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/global/accounting/balance-sheet?date=${asOf}`, { cache: "no-store" });
      if (!res.ok) throw new Error(t("accounting.balance.error"));
      const json = await res.json();
      setRows(json.data ?? []);
    } catch (err: any) {
      setError(err?.message ?? t("accounting.balance.error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4 py-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("accounting.balance.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("accounting.balance.subtitle", { date: asOf })}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className={theme.input} />
          <button
            onClick={load}
            className="rounded-full bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            {t("accounting.balance.apply")}
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}
      {loading ? (
        <div className="text-sm text-muted-foreground">{t("accounting.balance.loading")}</div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2">{t("accounting.balance.account")}</th>
                  <th className="px-3 py-2 text-right">{t("accounting.balance.amount")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const code = r.accountCode ?? "";
                  const name = r.accountName ?? "";
                  const amount = typeof r.amount === "number" ? r.amount : Number(r.amount ?? 0);
                  return (
                    <tr key={`${code || "acct"}-${idx}`} className="border-b border-white/5">
                      <td className="px-3 py-2">
                        <div className="font-semibold">{name || code || "-"}</div>
                        <div className="text-xs text-muted-foreground">{code}</div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {Number.isFinite(amount) ? amount.toFixed(2) : "-"}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td className="px-3 py-3 text-sm text-muted-foreground" colSpan={2}>
                      {t("accounting.balance.empty")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
