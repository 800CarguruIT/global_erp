"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, useTheme, useI18n } from "@repo/ui";

type Invoice = {
  id: string;
  company_id?: string | null;
  status: string;
  currency: string;
  total_amount: number;
  due_date?: string | null;
  paid_at?: string | null;
  reference?: string | null;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
};

type InvoiceLine = { line_no: number; name: string; description?: string | null; amount: number };

export default function InvoicesPage() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const tf = (key: string, fallback: string) => {
    const val = t(key);
    return val === key ? fallback : val;
  };

  const [list, setList] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [companyInfo, setCompanyInfo] = useState<any | null>(null);
  const [orgProfile, setOrgProfile] = useState<any | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const paidCount = useMemo(() => list.filter((i) => i.status === "paid").length, [list]);
  const unpaidCount = useMemo(() => list.filter((i) => i.status !== "paid").length, [list]);
  const totalCount = list.length;

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/accounting/invoices", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load invoices");
        const data = await res.json();
        const arr = Array.isArray(data) ? data : data.data ?? [];
        if (active) setList(arr);
      } catch (err: any) {
        if (active) setError(err?.message ?? "Failed to load invoices");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  async function loadDetail(id: string) {
    setActionMessage(null);
    try {
      const res = await fetch(`/api/accounting/invoices/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load invoice");
      const data = await res.json();
      const payload = data?.data ?? data;
      setSelected(payload?.invoice ?? payload ?? null);
      setLines(payload?.lines ?? []);
      setCompanyInfo(payload?.company ?? null);
      setOrgProfile(payload?.orgProfile ?? null);
    } catch (err: any) {
      setActionMessage(err?.message ?? "Failed to load invoice");
    }
  }

  async function markPaid(id: string) {
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/accounting/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paid" }),
      });
      if (!res.ok) throw new Error("Failed to mark paid");
      const json = await res.json().catch(() => ({}));
      const updated = json?.data ?? null;
      setSelected(updated);
      setList((prev) => prev.map((inv) => (inv.id === id ? { ...inv, status: updated?.status ?? inv.status, paid_at: updated?.paid_at } : inv)));
      setActionMessage(tf("accounting.invoices.marked", "Marked as paid."));
    } catch (err: any) {
      setActionMessage(err?.message ?? tf("accounting.invoices.markFailed", "Failed to mark paid"));
    } finally {
      setActionLoading(false);
    }
  }

  function formatDate(value?: string | null) {
    if (!value) return "-";
    return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
  }

  function downloadPdf() {
    if (!selected) return;
    const win = window.open("", "_blank", "width=800,height=900");
    if (!win) return;
    const billTo = companyInfo
      ? [
          companyInfo.legal_name || companyInfo.display_name || "",
          companyInfo.company_email,
          companyInfo.company_phone,
          [companyInfo.address_line1, companyInfo.address_line2, companyInfo.city, companyInfo.state_region, companyInfo.postal_code, companyInfo.country]
            .filter(Boolean)
            .join(", "),
          companyInfo.vat_number ? `Tax / TRN: ${companyInfo.vat_number}` : "",
          companyInfo.owner_name ? `Owner: ${[companyInfo.owner_name, companyInfo.owner_email, companyInfo.owner_phone].filter(Boolean).join(" ")}` : "",
        ]
          .filter(Boolean)
          .join("<br/>")
      : "N/A";
    const from = orgProfile
      ? [orgProfile.name ?? "", orgProfile.address, orgProfile.email, orgProfile.phone, orgProfile.tax_id ? `Tax ID: ${orgProfile.tax_id}` : "", orgProfile.website]
          .filter(Boolean)
          .join("<br/>")
      : "Global ERP";
    const lineHtml = lines
      .map(
        (l) =>
          `<tr><td>${l.line_no}</td><td>${l.name}</td><td>${l.description ?? ""}</td><td style="text-align:right;">${
            typeof l.amount === "number" ? l.amount.toFixed(2) : l.amount
          } ${selected.currency}</td></tr>`
      )
      .join("");
    win.document.write(`
      <html><head><title>Invoice ${selected.reference ?? selected.id}</title></head>
      <body>
        <h2>Invoice ${selected.reference ?? selected.id}</h2>
        <p>Status: ${selected.status}</p>
        <table width="100%" cellpadding="6" cellspacing="0" style="margin: 12px 0;">
          <tr>
            <td width="50%" valign="top">
              <strong>From:</strong><br/>
              ${from}
            </td>
            <td width="50%" valign="top">
              <strong>Bill To:</strong><br/>
              ${billTo}
            </td>
          </tr>
        </table>
        <table border="1" cellspacing="0" cellpadding="4" width="100%">
          <thead><tr><th>#</th><th>Item</th><th>Description</th><th>Amount</th></tr></thead>
          <tbody>${lineHtml}</tbody>
        </table>
        <div style="margin-top: 12px; display: flex; justify-content: flex-end;">
          <table border="0" cellspacing="0" cellpadding="4">
            <tr>
              <td style="text-align: right;"><strong>Due:</strong></td>
              <td>${formatDate(selected.due_date)}</td>
            </tr>
            <tr>
              <td style="text-align: right;"><strong>Total:</strong></td>
              <td>${selected.total_amount} ${selected.currency}</td>
            </tr>
          </table>
        </div>
      </body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
  }

  return (
    <div className="space-y-6 py-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{tf("accounting.invoices.title", "Invoices")}</h1>
          <p className="text-sm text-muted-foreground">{tf("accounting.invoices.subtitle", "View, open, download, and mark invoices as paid.")}</p>
        </div>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}
      {loading ? (
        <div className="text-sm text-muted-foreground">{tf("accounting.invoices.loading", "Loading invoices…")}</div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{tf("accounting.invoices.total", "Total invoices")}</div>
              <div className="mt-1 text-xl font-semibold">{totalCount}</div>
            </Card>
            <Card>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{tf("accounting.invoices.paid", "Paid")}</div>
              <div className="mt-1 text-xl font-semibold">{paidCount}</div>
            </Card>
            <Card>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{tf("accounting.invoices.unpaid", "Unpaid")}</div>
              <div className="mt-1 text-xl font-semibold">{unpaidCount}</div>
            </Card>
          </div>

          <Card className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border/60">
                  <th className="px-3 py-2">{tf("accounting.invoices.reference", "Reference")}</th>
                  <th className="px-3 py-2">{tf("accounting.invoices.status", "Status")}</th>
                  <th className="px-3 py-2">{tf("accounting.invoices.amount", "Amount")}</th>
                  <th className="px-3 py-2">{tf("accounting.invoices.due", "Due")}</th>
                  <th className="px-3 py-2">{tf("accounting.invoices.paidAt", "Paid")}</th>
                  <th className="px-3 py-2">{tf("accounting.invoices.actions", "Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((inv) => (
                  <tr key={inv.id} className="border-b border-border/60">
                    <td className="px-3 py-2">
                      <div className="font-semibold">{inv.reference ?? inv.id}</div>
                      <div className="text-xs text-muted-foreground">{inv.description ?? ""}</div>
                    </td>
                    <td className="px-3 py-2 capitalize">{inv.status}</td>
                    <td className="px-3 py-2">
                      {inv.total_amount} {inv.currency}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(inv.due_date)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(inv.paid_at)}</td>
                    <td className="px-3 py-2 text-xs">
                      <button className="text-primary hover:underline" onClick={() => loadDetail(inv.id)}>
                        {tf("accounting.invoices.open", "Open")}
                      </button>
                    </td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-3 text-sm text-muted-foreground">
                      {tf("accounting.invoices.empty", "No invoices yet.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {selected && (
        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold">{selected.reference ?? selected.id}</div>
              <div className="text-xs text-muted-foreground">
                {tf("accounting.invoices.statusLabel", "Status:")} {selected.status}
              </div>
            </div>
            <div className="flex gap-2">
              <button className="rounded-md border px-3 py-1.5 text-sm hover:border-primary" onClick={downloadPdf}>
                {tf("accounting.invoices.download", "Download / Print")}
              </button>
              {selected.status !== "paid" && (
                <button
                  className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-60"
                  onClick={() => markPaid(selected.id)}
                  disabled={actionLoading}
                >
                  {actionLoading ? tf("accounting.invoices.marking", "Marking…") : tf("accounting.invoices.markPaid", "Mark paid")}
                </button>
              )}
            </div>
          </div>
          {actionMessage && <div className="text-xs text-muted-foreground">{actionMessage}</div>}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-3">
              <div className="text-sm font-semibold">{tf("accounting.invoices.from", "From")}</div>
              <div className="text-xs text-muted-foreground">
                {orgProfile?.name ?? tf("accounting.invoices.orgDefault", "Global ERP")}
                <br />
                {orgProfile?.address}
                <br />
                {orgProfile?.email}
                {orgProfile?.phone ? ` ${orgProfile.phone}` : ""}
                {orgProfile?.tax_id ? ` ${tf("accounting.invoices.taxId", "Tax:")} ${orgProfile.tax_id}` : ""}
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-sm font-semibold">{tf("accounting.invoices.billTo", "Bill To")}</div>
              {companyInfo ? (
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>{companyInfo.legal_name || companyInfo.display_name || "-"}</div>
                  <div>{companyInfo.company_email}</div>
                  <div>{companyInfo.company_phone}</div>
                  <div>
                    {[companyInfo.address_line1, companyInfo.address_line2, companyInfo.city, companyInfo.state_region, companyInfo.postal_code, companyInfo.country]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                  {companyInfo.vat_number && <div>{tf("accounting.invoices.vat", "Tax / TRN:")} {companyInfo.vat_number}</div>}
                  {(companyInfo.owner_name || companyInfo.owner_email || companyInfo.owner_phone) && (
                    <div>
                      {tf("accounting.invoices.owner", "Owner:")}{" "}
                      {[companyInfo.owner_name, companyInfo.owner_email, companyInfo.owner_phone].filter(Boolean).join(" ")}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  {tf("accounting.invoices.noCompany", "No company details.")}
                </div>
              )}
            </div>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <div className="text-xs text-muted-foreground">{tf("accounting.invoices.totalLabel", "Total")}</div>
              <div className="font-semibold">
                {selected.total_amount} {selected.currency}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{tf("accounting.invoices.dueDate", "Due date")}</div>
              <div>{formatDate(selected.due_date)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{tf("accounting.invoices.paidAtLabel", "Paid at")}</div>
              <div>{formatDate(selected.paid_at)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{tf("accounting.invoices.referenceLabel", "Reference")}</div>
              <div className="break-all">{selected.reference ?? selected.id}</div>
            </div>
            <div className="sm:col-span-2">
              <div className="text-xs text-muted-foreground">{tf("accounting.invoices.descriptionLabel", "Description")}</div>
              <div>{selected.description ?? "-"}</div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border/60">
                  <th className="px-2 py-1">{tf("accounting.invoices.lineNo", "#")}</th>
                  <th className="px-2 py-1">{tf("accounting.invoices.item", "Item")}</th>
                  <th className="px-2 py-1">{tf("accounting.invoices.lineDescription", "Description")}</th>
                  <th className="px-2 py-1 text-right">{tf("accounting.invoices.lineAmount", "Amount")}</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((ln) => (
                  <tr key={ln.line_no} className="border-b border-border/60">
                    <td className="px-2 py-1 text-xs">{ln.line_no}</td>
                    <td className="px-2 py-1">{ln.name}</td>
                    <td className="px-2 py-1 text-xs text-muted-foreground">{ln.description ?? ""}</td>
                    <td className="px-2 py-1 text-right">
                      {typeof ln.amount === "number" ? ln.amount.toFixed(2) : ln.amount} {selected.currency}
                    </td>
                  </tr>
                ))}
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-2 py-2 text-xs text-muted-foreground">
                      {tf("accounting.invoices.noLines", "No lines.")}
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
