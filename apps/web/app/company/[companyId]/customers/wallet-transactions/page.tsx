"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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

type ApprovalFilter = "all" | "approved" | "unapproved";
type PaymentMethodKpi = {
  method: string;
  txCount: number;
  totalAmount: number;
  approvedAmount: number;
  pendingAmount: number;
};
type WalletKpis = {
  pendingTopups: number;
  pendingAmount: number;
  approvedToday: number;
  approvedAmountToday: number;
  approvedMtd: number;
  approvedAmountMtd: number;
  approvedTotal: number;
  approvedAmountTotal: number;
  avgApprovalMinutes30d: number;
  approvalRate30d: number;
  paymentMethods: PaymentMethodKpi[];
};

export default function WalletTransactionsPage({ params }: Params) {
  const { theme } = useTheme();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [rows, setRows] = useState<WalletTransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState<Record<string, boolean>>({});
  const [confirmRow, setConfirmRow] = useState<WalletTransactionRow | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [approvalFilter, setApprovalFilter] = useState<ApprovalFilter>("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
  const [pageSize, setPageSize] = useState<"10" | "25" | "50" | "100">("25");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [kpis, setKpis] = useState<WalletKpis>({
    pendingTopups: 0,
    pendingAmount: 0,
    approvedToday: 0,
    approvedAmountToday: 0,
    approvedMtd: 0,
    approvedAmountMtd: 0,
    approvedTotal: 0,
    approvedAmountTotal: 0,
    avgApprovalMinutes30d: 0,
    approvalRate30d: 0,
    paymentMethods: [],
  });

  useEffect(() => {
    Promise.resolve(params).then((p) => setCompanyId(p?.companyId ?? null));
  }, [params]);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, approvalFilter, paymentMethodFilter, pageSize]);

  const fetchRows = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        approval: approvalFilter,
        page: String(page),
        pageSize: pageSize,
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (paymentMethodFilter !== "all") params.set("paymentMethod", paymentMethodFilter);
      const res = await fetch(`/api/company/${companyId}/customers/wallet-transactions?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load transactions");
      const data = await res.json().catch(() => ({}));
      const list: WalletTransactionRow[] = Array.isArray(data?.data) ? data.data : [];
      setRows(list);
      setTotal(Number(data?.meta?.total ?? list.length));
      const nextKpis = data?.kpis ?? {};
      setKpis({
        pendingTopups: Number(nextKpis.pendingTopups ?? 0),
        pendingAmount: Number(nextKpis.pendingAmount ?? 0),
        approvedToday: Number(nextKpis.approvedToday ?? 0),
        approvedAmountToday: Number(nextKpis.approvedAmountToday ?? 0),
        approvedMtd: Number(nextKpis.approvedMtd ?? 0),
        approvedAmountMtd: Number(nextKpis.approvedAmountMtd ?? 0),
        approvedTotal: Number(nextKpis.approvedTotal ?? 0),
        approvedAmountTotal: Number(nextKpis.approvedAmountTotal ?? 0),
        avgApprovalMinutes30d: Number(nextKpis.avgApprovalMinutes30d ?? 0),
        approvalRate30d: Number(nextKpis.approvalRate30d ?? 0),
        paymentMethods: Array.isArray(nextKpis.paymentMethods)
          ? nextKpis.paymentMethods.map((item: any) => ({
              method: String(item?.method ?? "Unknown"),
              txCount: Number(item?.txCount ?? 0),
              totalAmount: Number(item?.totalAmount ?? 0),
              approvedAmount: Number(item?.approvedAmount ?? 0),
              pendingAmount: Number(item?.pendingAmount ?? 0),
            }))
          : [],
      });
    } catch (err: any) {
      setError(err?.message ?? "Failed to load transactions");
      setRows([]);
      setTotal(0);
      setKpis({
        pendingTopups: 0,
        pendingAmount: 0,
        approvedToday: 0,
        approvedAmountToday: 0,
        approvedMtd: 0,
        approvedAmountMtd: 0,
        approvedTotal: 0,
        approvedAmountTotal: 0,
        avgApprovalMinutes30d: 0,
        approvalRate30d: 0,
        paymentMethods: [],
      });
    } finally {
      setLoading(false);
    }
  }, [companyId, debouncedSearch, approvalFilter, paymentMethodFilter, page, pageSize]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const formatDateTime = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };

  const formatAmount = (value: number) =>
    `AED ${new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value ?? 0))}`;

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / Number(pageSize))), [total, pageSize]);
  const paymentMethodOptions = useMemo(() => {
    const set = new Set<string>();
    for (const item of kpis.paymentMethods) {
      const value = (item.method || "").trim();
      if (value) set.add(value);
    }
    return Array.from(set);
  }, [kpis.paymentMethods]);
  const hasActiveFilters =
    approvalFilter !== "all" || paymentMethodFilter !== "all" || debouncedSearch.length > 0;
  const pageItems = useMemo(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + 4);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [page, totalPages]);

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Wallet Transactions</h1>
            <p className={`text-sm ${theme.mutedText}`}>Manage customer wallet topups and approvals.</p>
          </div>
          <Link
            href={companyId ? `/company/${companyId}/customers` : "#"}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-foreground/80 hover:bg-muted"
          >
            Back to customers
          </Link>
        </div>

        {error && <div className="text-sm text-red-400">{error}</div>}

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <Card className={`px-3 py-2 ${theme.cardBg} ${theme.cardBorder}`}>
            <div className={`text-[10px] uppercase tracking-wide ${theme.mutedText}`}>Pending Topups</div>
            <div className="text-base font-semibold">{loading ? "..." : kpis.pendingTopups}</div>
          </Card>
          <Card className={`px-3 py-2 ${theme.cardBg} ${theme.cardBorder}`}>
            <div className={`text-[10px] uppercase tracking-wide ${theme.mutedText}`}>Pending Amount</div>
            <div className="text-base font-semibold">{loading ? "..." : formatAmount(kpis.pendingAmount)}</div>
          </Card>
          <Card className={`px-3 py-2 ${theme.cardBg} ${theme.cardBorder}`}>
            <div className={`text-[10px] uppercase tracking-wide ${theme.mutedText}`}>Approved Today</div>
            <div className="text-base font-semibold">{loading ? "..." : `${kpis.approvedToday} tx`}</div>
            <div className={`text-[11px] ${theme.mutedText}`}>{loading ? "..." : formatAmount(kpis.approvedAmountToday)}</div>
          </Card>
          <Card className={`px-3 py-2 ${theme.cardBg} ${theme.cardBorder}`}>
            <div className={`text-[10px] uppercase tracking-wide ${theme.mutedText}`}>Approved This Month</div>
            <div className="text-base font-semibold">{loading ? "..." : `${kpis.approvedMtd} tx`}</div>
            <div className={`text-[11px] ${theme.mutedText}`}>{loading ? "..." : formatAmount(kpis.approvedAmountMtd)}</div>
          </Card>
          <Card className={`px-3 py-2 ${theme.cardBg} ${theme.cardBorder}`}>
            <div className={`text-[10px] uppercase tracking-wide ${theme.mutedText}`}>Approved Total</div>
            <div className="text-base font-semibold">{loading ? "..." : `${kpis.approvedTotal} tx`}</div>
            <div className={`text-[11px] ${theme.mutedText}`}>{loading ? "..." : formatAmount(kpis.approvedAmountTotal)}</div>
          </Card>
        </div>
        {/* {kpis.paymentMethods.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.paymentMethods.map((method) => (
              <button
                key={method.method}
                type="button"
                onClick={() => setPaymentMethodFilter(method.method)}
                className={`rounded-xl border px-3 py-2 text-left transition ${theme.cardBg} ${
                  paymentMethodFilter === method.method
                    ? "border-cyan-300/80 shadow-[0_0_0_1px_rgba(34,211,238,0.35)]"
                    : theme.cardBorder
                }`}
              >
                <div className={`text-[10px] uppercase tracking-wide ${theme.mutedText}`}>{method.method}</div>
                <div className="text-base font-semibold">{loading ? "..." : formatAmount(method.totalAmount)}</div>
                <div className={`text-[11px] ${theme.mutedText}`}>{loading ? "..." : `${method.txCount} tx`}</div>
              </button>
            ))}
          </div>
        )} */}

        <Card className={`p-3 ${theme.cardBg} ${theme.cardBorder}`}>
          <div className="overflow-x-auto py-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30">
            <div className="flex min-w-max flex-nowrap gap-2 text-xs">
              {[
                { id: "all", label: "All" },
                { id: "approved", label: "Approved" },
                { id: "unapproved", label: "Unapproved" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setApprovalFilter(tab.id as ApprovalFilter)}
                  className={`min-w-[96px] shrink-0 rounded-full px-4 py-1.5 text-[11px] font-medium transition ${
                    approvalFilter === tab.id
                      ? "bg-gradient-to-b from-emerald-500/30 to-emerald-500/10 text-emerald-100 shadow-[0_0_8px_rgba(16,185,129,0.35)] border border-emerald-400/40"
                      : "bg-muted/40 text-foreground/70 border border-border hover:text-foreground hover:border-border"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-12">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer, phone, email, method, notes"
              className="h-10 rounded-md border border-cyan-400/40 bg-slate-900/35 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-cyan-300/70 md:col-span-7"
            />
            <select
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value)}
              className="h-10 rounded-md border border-cyan-400/40 bg-slate-900/35 px-2 text-sm text-foreground outline-none focus:border-cyan-300/70 md:col-span-2"
            >
              <option value="all">All methods</option>
              {paymentMethodOptions.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2 md:col-span-2">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Rows</span>
              <select
                className="h-10 w-full rounded-md border border-cyan-400/40 bg-slate-900/35 px-2 text-sm text-foreground outline-none focus:border-cyan-300/70"
                value={pageSize}
                onChange={(e) => setPageSize(e.target.value as "10" | "25" | "50" | "100")}
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => {
                setApprovalFilter("all");
                setPaymentMethodFilter("all");
                setSearch("");
                setDebouncedSearch("");
              }}
              className="h-10 rounded-md border border-border px-3 text-xs font-semibold uppercase tracking-wide text-foreground/75 hover:bg-muted md:col-span-1"
            >
              Clear
            </button>
          </div>

          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="text-muted-foreground">Active:</span>
              {approvalFilter !== "all" && (
                <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-200">
                  Status: {approvalFilter}
                </span>
              )}
              {paymentMethodFilter !== "all" && (
                <span className="rounded-full border border-cyan-400/40 bg-cyan-500/10 px-2 py-0.5 text-cyan-200">
                  Method: {paymentMethodFilter}
                </span>
              )}
              {debouncedSearch && (
                <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-foreground/80">
                  Search: {debouncedSearch}
                </span>
              )}
            </div>
          )}
        </Card>

        <Card className={`p-3 ${theme.cardBg} ${theme.cardBorder}`}>
          <div className={`hidden overflow-auto rounded-md border md:block ${theme.cardBorder} ${theme.surfaceSubtle} max-h-[620px]`}>
            <table className="min-w-full table-fixed text-xs">
              <thead className="sticky top-0 z-20 bg-popovertext-foreground/80">
                <tr className="border-b border-slate-500/40">
                  <th className="w-[220px] px-3 py-2 text-left">Customer</th>
                  <th className="w-[130px] px-3 py-2 text-left">Phone</th>
                  <th className="w-[120px] px-3 py-2 text-left">Amount</th>
                  <th className="w-[120px] px-3 py-2 text-left">Method</th>
                  <th className="w-[110px] px-3 py-2 text-left">Proof</th>
                  <th className="w-[180px] px-3 py-2 text-left">Payment Date</th>
                  <th className="w-[140px] px-3 py-2 text-left">Status</th>
                  <th className="w-[190px] px-3 py-2 text-left">Approved At</th>
                  <th className="w-[160px] px-3 py-2 text-left">Approved By</th>
                  <th className="w-[190px] px-3 py-2 text-left">Created At</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-foreground/70">
                      Loading transactions...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-foreground/70">
                      No transactions found for this filter.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-500/30 text-foreground/85 hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <Link
                          href={companyId ? `/company/${companyId}/customers/${row.customer_id}` : "#"}
                          className="font-semibold text-foreground hover:text-cyan-200"
                        >
                          {row.customer_name ?? "Customer"}
                        </Link>
                        <div className="text-[11px] text-muted-foreground">{row.customer_email ?? "-"}</div>
                      </td>
                      <td className="px-3 py-2">{row.customer_phone ?? "-"}</td>
                      <td className="px-3 py-2">{formatAmount(row.amount)}</td>
                      <td className="px-3 py-2">{row.payment_method ?? "-"}</td>
                      <td className="px-3 py-2">
                        {row.payment_proof_file_id ? (
                          <a
                            href={`/api/files/${row.payment_proof_file_id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-md border border-border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-foreground/70 hover:bg-muted"
                          >
                            View
                          </a>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2">{formatDateTime(row.payment_date)}</td>
                      <td className="px-3 py-2">
                        {row.approved_at ? (
                          <span className="inline-flex rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                            Approved
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="rounded-md border border-amber-400/35 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-300 hover:bg-amber-500/20"
                            disabled={approving[row.id] ?? false}
                            onClick={() => setConfirmRow(row)}
                          >
                            Approve
                          </button>
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

          <div className="space-y-2 md:hidden">
            {loading ? (
              <div className="rounded-md border border-slate-500/30 bg-slate-900/40 px-3 py-4 text-sm text-foreground/70">Loading transactions...</div>
            ) : rows.length === 0 ? (
              <div className="rounded-md border border-slate-500/30 bg-slate-900/40 px-3 py-4 text-sm text-foreground/70">
                No transactions found for this filter.
              </div>
            ) : (
              rows.map((row) => (
                <div key={row.id} className="space-y-2 rounded-md border border-slate-500/35 bg-slate-900/45 px-3 py-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={companyId ? `/company/${companyId}/customers/${row.customer_id}` : "#"} className="font-semibold text-foreground/90">
                      {row.customer_name ?? "Customer"}
                    </Link>
                    {row.approved_at ? (
                      <span className="inline-flex rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                        Approved
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="rounded-md border border-amber-400/35 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-300"
                        disabled={approving[row.id] ?? false}
                        onClick={() => setConfirmRow(row)}
                      >
                        Approve
                      </button>
                    )}
                  </div>
                  <div className="text-foreground/70">Phone: {row.customer_phone ?? "-"}</div>
                  <div className="text-foreground/70">Amount: {formatAmount(row.amount)}</div>
                  <div className="text-foreground/70">Method: {row.payment_method ?? "-"}</div>
                  <div className="text-muted-foreground">Created: {formatDateTime(row.created_at)}</div>
                </div>
              ))
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-foreground/70">
            <div>Showing {loading ? 0 : rows.length} of {total} transactions</div>
            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-end gap-1">
                <button
                  type="button"
                  className="rounded-md border border-border px-2 py-1 text-[11px] text-foreground/70 disabled:opacity-50"
                  disabled={page <= 1}
                  onClick={() => setPage(Math.max(1, page - 1))}
                >
                  Prev
                </button>
                {pageItems.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`rounded-md px-2 py-1 text-[11px] ${item === page ? "bg-blue-600 text-white" : "border border-border text-foreground/70"}`}
                    onClick={() => setPage(item)}
                  >
                    {item}
                  </button>
                ))}
                <button
                  type="button"
                  className="rounded-md border border-border px-2 py-1 text-[11px] text-foreground/70 disabled:opacity-50"
                  disabled={page >= totalPages}
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </Card>
      </div>

      {confirmRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className={`w-full max-w-md rounded-xl shadow-xl ${theme.cardBg} ${theme.cardBorder}`}>
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="text-sm font-semibold">Approve Wallet Transaction</div>
              <button
                type="button"
                onClick={() => setConfirmRow(null)}
                className={`rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-muted`}
              >
                Close
              </button>
            </div>
            <div className="space-y-4 p-4 text-sm">
              <div className={theme.mutedText}>
                Approve the topup of <span className="font-semibold text-foreground">{formatAmount(confirmRow.amount)}</span>{" "}
                for <span className="font-semibold text-foreground">{confirmRow.customer_name ?? "Customer"}</span>?
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className={`rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-muted`}
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
                      const res = await fetch(`/api/customers/${confirmRow.customer_id}/wallet/transactions/${confirmRow.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ companyId, approved: true }),
                      });
                      if (!res.ok) {
                        const data = await res.json().catch(() => ({}));
                        throw new Error(data?.error ?? "Failed to approve");
                      }
                      setConfirmRow(null);
                      await fetchRows();
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
