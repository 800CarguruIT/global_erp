import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";
import fs from "node:fs/promises";
import { Crm, Files, Leads, WorkshopEstimates, WorkshopInvoices } from "@repo/ai-core";
import { getCompanyById } from "@repo/ai-core/company/service";

export const runtime = "nodejs";

type Params = { params: Promise<{ companyId: string; invoiceId: string }> };

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDateLabel(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const month = date.toLocaleString("en-US", { month: "short" });
  const day = String(date.getDate()).padStart(2, "0");
  return `${day}-${month}-${date.getFullYear()}`;
}

function formatMoney(value: number) {
  return Number(value || 0).toFixed(2);
}

function buildInvoiceHtml(payload: {
  companyName: string;
  companyLegalName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyTrn: string;
  companyLogo?: string | null;
  customerName: string;
  customerPhone: string;
  carMakeModel: string;
  carPlate: string;
  advisor: string;
  invoiceNumber: string;
  invoiceDate: string;
  status: string;
  items: Array<{
    name: string;
    description: string;
    qty: number;
    rate: number;
    discount: number;
    price: number;
  }>;
  totals: {
    subtotal: number;
    discount: number;
    amount: number;
    vatRate: number;
    vatAmount: number;
    grandTotal: number;
  };
}) {
  const rows = payload.items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(item.description)}</td>
          <td class="right">${formatMoney(item.rate)}</td>
          <td class="center">${formatMoney(item.qty)}</td>
          <td class="right">${formatMoney(item.discount)}</td>
          <td class="right">${formatMoney(item.price)}</td>
        </tr>
      `
    )
    .join("");

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Tax Invoice</title>
      <style>
        @page { size: A4; margin: 16mm; }
        body { font-family: Arial, Helvetica, sans-serif; color: #111; }
        .bar { background: #0a0a0a; color: #fff; text-align: center; font-weight: 700; padding: 8px; letter-spacing: 6px; border-radius: 6px; }
        .header { display: flex; justify-content: space-between; gap: 12px; margin-top: 12px; }
        .brand h1 { margin: 0 0 2px; font-size: 16px; color: #0a8b00; }
        .brand p { margin: 2px 0; font-size: 11px; }
        .logo { width: 90px; height: 90px; object-fit: contain; }
        .meta { margin-top: 12px; width: 100%; border-collapse: separate; border-spacing: 4px; font-size: 12px; }
        .meta td { padding: 4px 6px; border-radius: 4px; }
        .meta .label { background: #d1d1d1; font-weight: 600; width: 24%; }
        .meta .value { background: #fff; border: 1px solid #cfcfcf; }
        .meta .right { width: 13%; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        table.items { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
        table.items th, table.items td { border: 1px solid #bdbdbd; padding: 6px; }
        table.items th { background: #e5e5e5; font-weight: 700; }
        .center { text-align: center; }
        .right { text-align: right; }
        .totals { width: 45%; margin-left: auto; margin-top: 8px; border-collapse: separate; border-spacing: 4px; font-size: 12px; }
        .totals td { padding: 4px 6px; border-radius: 4px; }
        .totals .label { background: #d1d1d1; font-weight: 600; }
        .totals .value { background: #fff; border: 1px solid #cfcfcf; text-align: right; min-width: 90px; }
        .terms { margin-top: 16px; font-size: 10px; }
        .terms h3 { margin: 0 0 6px; font-size: 11px; text-decoration: underline; }
        .terms ol { margin: 0; padding-left: 16px; }
        .terms li { margin-bottom: 3px; }
      </style>
    </head>
    <body>
      <div class="bar">TAX INVOICE</div>
      <div class="header">
        <div class="brand">
          <h1>${escapeHtml(payload.companyName)}</h1>
          <p>${escapeHtml(payload.companyLegalName)}</p>
          <p>${escapeHtml(payload.companyAddress)}</p>
          <p>Call: ${escapeHtml(payload.companyPhone)}</p>
          <p>Email: ${escapeHtml(payload.companyEmail)}</p>
          <p>TRN: ${escapeHtml(payload.companyTrn)}</p>
        </div>
        ${payload.companyLogo ? `<img class="logo" src="${payload.companyLogo}" alt="Logo" />` : ""}
      </div>

      <div class="grid">
        <table class="meta">
          <tbody>
            <tr>
              <td class="label">Customer Name</td>
              <td class="value">${escapeHtml(payload.customerName)}</td>
            </tr>
            <tr>
              <td class="label">Customer Phone</td>
              <td class="value">${escapeHtml(payload.customerPhone)}</td>
            </tr>
            <tr>
              <td class="label">Car Plate #</td>
              <td class="value">${escapeHtml(payload.carPlate)}</td>
            </tr>
            <tr>
              <td class="label">Car Make/Model</td>
              <td class="value">${escapeHtml(payload.carMakeModel)}</td>
            </tr>
          </tbody>
        </table>
        <table class="meta">
          <tbody>
            <tr>
              <td class="label right">Invoice #</td>
              <td class="value">${escapeHtml(payload.invoiceNumber)}</td>
            </tr>
            <tr>
              <td class="label right">Date</td>
              <td class="value">${escapeHtml(payload.invoiceDate)}</td>
            </tr>
            <tr>
              <td class="label right">Status</td>
              <td class="value">${escapeHtml(payload.status)}</td>
            </tr>
            <tr>
              <td class="label right">Advisor</td>
              <td class="value">${escapeHtml(payload.advisor)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <table class="items">
        <thead>
          <tr>
            <th style="width: 26%;">Item</th>
            <th>Description</th>
            <th style="width: 12%;">Rate</th>
            <th style="width: 7%;">Qty</th>
            <th style="width: 10%;">Disc.</th>
            <th style="width: 12%;">Price</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="6" class="center">No items</td></tr>`}
        </tbody>
      </table>

      <table class="totals">
        <tbody>
          <tr>
            <td class="label">Sub Total</td>
            <td class="value">${formatMoney(payload.totals.subtotal)}</td>
          </tr>
          <tr>
            <td class="label">Discount</td>
            <td class="value">${formatMoney(payload.totals.discount)}</td>
          </tr>
          <tr>
            <td class="label">Amount</td>
            <td class="value">${formatMoney(payload.totals.amount)}</td>
          </tr>
          <tr>
            <td class="label">VAT - ${formatMoney(payload.totals.vatRate)}%</td>
            <td class="value">${formatMoney(payload.totals.vatAmount)}</td>
          </tr>
          <tr>
            <td class="label">Grand Total</td>
            <td class="value"><strong>AED${formatMoney(payload.totals.grandTotal)}</strong></td>
          </tr>
        </tbody>
      </table>

      <div class="terms">
        <h3>*Terms & Conditions*</h3>
        <ol>
          <li>All products and services are completely non-refundable.</li>
          <li>Product warranty will be as per manufacturer policy.</li>
          <li>This system generated invoice does not require signature.</li>
          <li>Car battery warranty claim is subject to battery warranty card.</li>
          <li>In the event of a car battery replacement, claim is accepted as per warranty policy.</li>
        </ol>
      </div>
    </body>
  </html>`;
}

export async function GET(_req: NextRequest, { params }: Params) {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  try {
    const { companyId, invoiceId } = await params;
    const data = await WorkshopInvoices.getInvoiceWithItems(companyId, invoiceId);
    if (!data) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    let company: any = null;
    try {
      company = await getCompanyById(companyId);
    } catch {
      company = null;
    }

    const invoice = data.invoice;
    let items = data.items;
    let estimate: any = null;
    if (invoice.estimateId) {
      try {
        const estimateData = await WorkshopEstimates.getEstimateWithItems(
          companyId,
          invoice.estimateId
        );
        estimate = estimateData?.estimate ?? null;
        const approvedIds = new Set(
          (estimateData?.items ?? [])
            .filter((item) => String(item.status ?? "").toLowerCase() === "approved")
            .map((item) => item.id)
        );
        items = items.filter(
          (item) => !item.estimateItemId || approvedIds.has(item.estimateItemId)
        );
      } catch {
        estimate = null;
      }
    }
    let customer: any = null;
    let car: any = null;
    let lead: any = null;
    const customerId = invoice.customerId ?? estimate?.customerId ?? null;
    const carId = invoice.carId ?? estimate?.carId ?? null;
    const leadId = invoice.leadId ?? estimate?.leadId ?? null;

    if (customerId) {
      try {
        customer = await Crm.getCustomerById(customerId);
      } catch {
        customer = null;
      }
    }
    if (carId) {
      try {
        car = await Crm.getCarById(carId);
      } catch {
        car = null;
      }
    }
    if (leadId) {
      try {
        lead = await Leads.getLeadById(companyId, leadId);
      } catch {
        lead = null;
      }
    }

    const companyName = (company as any)?.display_name || (company as any)?.legal_name || "800CARGURU";
    const companyLegalName = (company as any)?.legal_name || "Mobile Auto Repair Services L.L.C";
    const companyAddress =
      (company as any)?.address_line1 ||
      (company as any)?.address_line2 ||
      (company as any)?.city ||
      "Dubai, UAE";
    const companyPhone = (company as any)?.company_phone || "800 2274878";
    const companyEmail = (company as any)?.company_email || "info@800carguru.ae";
    const companyTrn = (company as any)?.vat_number || "100578154500003";

    const logoFileId = (company as any)?.logo_file_id ?? null;
    let companyLogo: string | null = null;
    if (logoFileId) {
      try {
        const record = await Files.getFileById(logoFileId);
        const storagePath = (record as any)?.storage_path ?? (record as any)?.storagePath;
        const mimeType = (record as any)?.mime_type ?? (record as any)?.mimeType ?? "image/png";
        if (storagePath) {
          const data = await fs.readFile(storagePath);
          const base64 = Buffer.from(data).toString("base64");
          companyLogo = `data:${mimeType};base64,${base64}`;
        }
      } catch {
        companyLogo = null;
      }
    }

    const rows = items.map((item) => {
      const qty = Number(item.quantity ?? 0) || 0;
      const rate = Number(item.rate ?? 0) || 0;
      const discount = Number(item.lineDiscount ?? 0) || 0;
      const price = Number(item.lineFinal ?? rate * qty - discount) || 0;
      return {
        name: item.name ?? "",
        description: item.description ?? "",
        qty,
        rate,
        discount,
        price,
      };
    });

    const totals = items.reduce(
      (acc, item) => {
        const lineSale = Number(item.lineSale ?? (item.quantity ?? 0) * (item.rate ?? 0)) || 0;
        const lineDiscount = Number(item.lineDiscount ?? 0) || 0;
        acc.totalSale += lineSale;
        acc.totalDiscount += lineDiscount;
        return acc;
      },
      { totalSale: 0, totalDiscount: 0 }
    );
    const amount = totals.totalSale - totals.totalDiscount;
    const vatRate = Number(invoice.vatRate ?? 0);
    const vatAmount = amount * (vatRate / 100);
    const grandTotal = amount + vatAmount;

    const customerName =
      customer?.name ??
      (lead as any)?.customer_name ??
      (lead as any)?.customerName ??
      "Customer";
    const customerPhone =
      customer?.phone ??
      (lead as any)?.customer_phone ??
      (lead as any)?.customerPhone ??
      "-";
    const carMakeModel = String(
      [car?.make, car?.model, car?.model_year]
        .filter(Boolean)
        .join(" ") ||
        (lead as any)?.car_model ||
        (lead as any)?.carModel ||
        "-"
    );
    const carPlate = String(
      car?.plate_number ??
        (lead as any)?.car_plate_number ??
        (lead as any)?.carPlateNumber ??
        "-"
    );
    const advisor = String(
      (lead as any)?.advisor ??
        (lead as any)?.agent_name ??
        (lead as any)?.agentName ??
        "-"
    );

    const html = buildInvoiceHtml({
      companyName: String(companyName),
      companyLegalName: String(companyLegalName),
      companyAddress: String(companyAddress),
      companyPhone: String(companyPhone),
      companyEmail: String(companyEmail),
      companyTrn: String(companyTrn),
      companyLogo,
      customerName: String(customerName),
      customerPhone: String(customerPhone),
      carMakeModel,
      carPlate,
      advisor,
      invoiceNumber: String(invoice.invoiceNumber ?? invoice.id),
      invoiceDate: formatDateLabel(invoice.invoiceDate ?? invoice.createdAt),
      status: String(invoice.status ?? "").toLowerCase() === "paid" ? "Paid" : "Unpaid",
      items: rows,
      totals: {
        subtotal: totals.totalSale,
        discount: totals.totalDiscount,
        amount,
        vatRate,
        vatAmount,
        grandTotal,
      },
    });

    browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const pdf = await page.pdf({ format: "A4", printBackground: true });
    await page.close();
    await browser.close();

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="invoice-${invoice.id}.pdf"`,
      },
    });
  } catch (error) {
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
    console.error("GET /api/company/[companyId]/workshop/invoices/[invoiceId]/print error:", error);
    return NextResponse.json({ error: "Failed to generate invoice" }, { status: 500 });
  }
}
