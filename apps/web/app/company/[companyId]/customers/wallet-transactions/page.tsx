"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AppLayout, Card, useTheme } from "@repo/ui";

type WalletTransactionRow = {
  id: string;
  customer_id: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  amount: number;
  payment_method?: string | null;
  payment_date?: string | null;
  payment_proof_file_id?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  approved_by_name?: string | null;
  created_at?: string | null;
};

type Params = { params: { companyId: string } | Promise<{ companyId: string }> };

export default function WalletTransactionsPage({ params }: Params) {
  const { theme } = useTheme();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [rows, setRows] = useState<WalletTransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState<Record<string, boolean>>({});
  const [confirmRow, setConfirmRow] = useState<WalletTransactionRow | null>(null);

  useEffect(() => {
    Promise.resolve(params).then((p) => setCompanyId(p?.companyId ?? null));
  }, [params]);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/company/${companyId}/customers/wallet-transactions?approvedOnly=false`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to load transactions"))))
      .then((data) => setRows(data?.data ?? []))
      .catch((err: any) => setError(err?.message ?? "Failed to load transactions"))
      .finally(() => setLoading(false));
  }, [companyId]);

  const formatDateTime = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Wallet Transactions</h1>
            <p className={`text-sm ${theme.mutedText}`}>Approved customer wallet topups.</p>
          </div>
          <Link
            href={companyId ? `/company/${companyId}/customers` : "#"}
            className="text-sm text-primary hover:underline"
          >
            Back to customers
          </Link>
        </div>

        {error && <div className="text-sm text-red-400">{error}</div>}

        <Card className={`p-4 ${theme.cardBg} ${theme.cardBorder}`}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-white/60">
                <tr>
                  <th className="px-3 py-2 text-left">Customer</th>
                  <th className="px-3 py-2 text-left">Phone</th>
                  <th className="px-3 py-2 text-left">Amount</th>
                  <th className="px-3 py-2 text-left">Method</th>
                  <th className="px-3 py-2 text-left">Payment Proof</th>
                  <th className="px-3 py-2 text-left">Payment Date</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Approved At</th>
                  <th className="px-3 py-2 text-left">Approved By</th>
                  <th className="px-3 py-2 text-left">Created At</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-3 py-4 text-sm text-white/60" colSpan={10}>
                      Loading transactions...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-sm text-white/60" colSpan={10}>
                      No approved transactions found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-b border-white/5 text-white/80">
                      <td className="px-3 py-2">
                        <Link
                          href={
                            companyId
                              ? `/company/${companyId}/customers/${row.customer_id}`
                              : "#"
                          }
                          className="font-semibold text-primary hover:underline"
                        >
                          {row.customer_name ?? "Customer"}
                        </Link>
                        <div className="text-xs text-white/40">{row.customer_email ?? "-"}</div>
                      </td>
                      <td className="px-3 py-2">{row.customer_phone ?? "-"}</td>
                      <td className="px-3 py-2">AED {Number(row.amount).toFixed(2)}</td>
                      <td className="px-3 py-2">{row.payment_method ?? "-"}</td>
                      <td className="px-3 py-2">
                        {row.payment_proof_file_id ? (
                          <a
                            href={`/api/files/${row.payment_proof_file_id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-md border border-white/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/70 hover:bg-white/10"
                          >
                            View
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-3 py-2">{formatDateTime(row.payment_date)}</td>
                      <td className="px-3 py-2">
                        {row.approved_at ? (
                          "Approved"
                        ) : (
                          <select
                            className={`rounded-md px-2 py-1 text-xs ${theme.inputBg} ${theme.inputBorder} ${theme.inputText}`}
                            value="unapproved"
                            disabled={approving[row.id] ?? false}
                            onChange={(e) => {
                              if (e.target.value !== "approved") return;
                              setConfirmRow(row);
                            }}
                          >
                            <option value="unapproved">Unapproved</option>
                            <option value="approved">Approve</option>
                          </select>
                        )}
                      </td>
                      <td className="px-3 py-2">{formatDateTime(row.approved_at)}</td>
                      <td className="px-3 py-2">{row.approved_by_name ?? "-"}</td>
                      <td className="px-3 py-2">{formatDateTime(row.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      {confirmRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className={`w-full max-w-md rounded-xl shadow-xl ${theme.cardBg} ${theme.cardBorder}`}>
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="text-sm font-semibold">Approve Wallet Transaction</div>
              <button
                type="button"
                onClick={() => setConfirmRow(null)}
                className={`rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-white/10`}
              >
                Close
              </button>
            </div>
            <div className="space-y-4 p-4 text-sm">
              <div className={theme.mutedText}>
                Approve the topup of{" "}
                <span className="font-semibold text-white">
                  AED {Number(confirmRow.amount).toFixed(2)}
                </span>{" "}
                for <span className="font-semibold text-white">{confirmRow.customer_name ?? "Customer"}</span>?
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className={`rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-white/10`}
                  onClick={() => setConfirmRow(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-md bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary-foreground"
                  disabled={approving[confirmRow.id] ?? false}
                  onClick={async () => {
                    if (!companyId) return;
                    setApproving((prev) => ({ ...prev, [confirmRow.id]: true }));
                    try {
                      const res = await fetch(
                        `/api/customers/${confirmRow.customer_id}/wallet/transactions/${confirmRow.id}`,
                        {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ companyId, approved: true }),
                        }
                      );
                      if (!res.ok) {
                        const data = await res.json().catch(() => ({}));
                        throw new Error(data?.error ?? "Failed to approve");
                      }
                      const data = await res.json().catch(() => ({}));
                      setRows((prev) =>
                        prev.map((item) =>
                          item.id === confirmRow.id
                            ? {
                                ...item,
                                approved_at: data?.approved_at ?? data?.approvedAt ?? item.approved_at,
                                approved_by: data?.approved_by ?? data?.approvedBy ?? item.approved_by,
                                approved_by_name:
                                  data?.approved_by_name ?? data?.approvedByName ?? item.approved_by_name,
                              }
                            : item
                        )
                      );
                      setConfirmRow(null);
                    } catch (err: any) {
                      setError(err?.message ?? "Failed to approve");
                    } finally {
                      setApproving((prev) => ({ ...prev, [confirmRow.id]: false }));
                    }
                  }}
                >
                  {approving[confirmRow.id] ? "Approving..." : "Approve"}
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </AppLayout>
  );
}
