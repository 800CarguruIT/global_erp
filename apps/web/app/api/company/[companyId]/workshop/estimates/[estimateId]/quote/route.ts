import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";
import fs from "node:fs/promises";
import { Crm, Files, Leads, WorkshopEstimates } from "@repo/ai-core";
import { getCompanyById } from "@repo/ai-core/company/service";

export const runtime = "nodejs";

type Params = { params: Promise<{ companyId: string; estimateId: string }> };

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDateOnly(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatMoney(value: number) {
  return Number(value || 0).toFixed(2);
}

function buildQuoteHtml(payload: {
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
  estimateId: string;
  date: string;
  items: Array<{
    name: string;
    description: string;
    qty: number;
    rate: number;
    discount: number;
    price: number;
  }>;
}) {
  const rows = payload.items
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.description)}</td>
        <td class="center">${formatMoney(item.qty)}</td>
        <td class="right">${formatMoney(item.rate)}</td>
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
      <title>Quotation</title>
      <style>
        @page { size: A4; margin: 20mm; }
        body { font-family: "Times New Roman", serif; color: #111; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; }
        .brand h1 { margin: 0; font-size: 20px; color: #0a8b00; }
        .brand p { margin: 2px 0; font-size: 12px; }
        .logo { width: 90px; height: 90px; object-fit: contain; }
        .bar { background: #0a8b00; color: #fff; text-align: center; font-weight: bold; padding: 6px; margin-top: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
        th, td { border: 1px solid #333; padding: 6px; }
        th { background: #f2f2f2; }
        .meta td { background: #f2f2f2; }
        .center { text-align: center; }
        .right { text-align: right; }
        .terms { margin-top: 14px; font-size: 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .terms h3 { margin: 0 0 6px; font-size: 11px; text-decoration: underline; }
        .terms ol { margin: 0; padding-left: 16px; }
        .terms li { margin-bottom: 4px; }
      </style>
    </head>
    <body>
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

      <div class="bar">QUOTATION</div>

      <table class="meta">
        <tbody>
          <tr>
            <td>Customer Name:</td>
            <td>${escapeHtml(payload.customerName)}</td>
            <td>Estimate ID #</td>
            <td>${escapeHtml(payload.estimateId)}</td>
          </tr>
          <tr>
            <td>Customer Phone:</td>
            <td>${escapeHtml(payload.customerPhone)}</td>
            <td>Date</td>
            <td>${escapeHtml(payload.date)}</td>
          </tr>
          <tr>
            <td>Car Make/Model</td>
            <td>${escapeHtml(payload.carMakeModel)}</td>
            <td>Advisor</td>
            <td>${escapeHtml(payload.advisor)}</td>
          </tr>
          <tr>
            <td>Car Plate #</td>
            <td>${escapeHtml(payload.carPlate)}</td>
            <td></td>
            <td></td>
          </tr>
        </tbody>
      </table>

      <div class="bar">SERVICES</div>
      <table>
        <thead>
          <tr>
            <th style="width: 28%;">Item</th>
            <th>Description</th>
            <th style="width: 8%;">Qty</th>
            <th style="width: 12%;">Rate</th>
            <th style="width: 12%;">Discount</th>
            <th style="width: 12%;">Price</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="6" class="center">No items</td></tr>`}
        </tbody>
      </table>

      <div class="terms">
        <div>
          <h3>*Terms & Conditions*</h3>
          <ol>
            <li>Estimated price is valid for the time being and will change if there is any impact on the price.</li>
            <li>Price in effect applies at the time of order and subject to availability.</li>
            <li>All estimate are prepared on the basis of customer requirement(s) and our inspection report.</li>
            <li>You can pay up to 7 installments subject to approval.</li>
            <li>Additional faults and parts might be required while performing the job.</li>
            <li>Minimum amount of 500 AED will be paid by the customer, in case of refused/pullout after approval.</li>
            <li>Customer must collect the car within 3 days of work completion.</li>
            <li>Any damages on the parking fee of 100 AED per day will be levied by customer.</li>
          </ol>
        </div>
        <div>
          <h3>الشروط والأحكام</h3>
          <ol>
            <li>الأسعار تقديرية وقد تتغير حسب توفر القطع وتغير الأسعار.</li>
            <li>السعر الساري وقت الطلب ويخضع لتوفر القطع.</li>
            <li>التقدير مبني على متطلبات العميل وتقرير الفحص.</li>
            <li>يمكن الدفع على أقساط بعد الموافقة.</li>
            <li>قد يلزم إصلاحات أو قطع إضافية أثناء العمل.</li>
            <li>حد أدنى 500 درهم في حال الرفض بعد الموافقة.</li>
            <li>استلام السيارة خلال 3 أيام من اكتمال العمل.</li>
            <li>رسوم مواقف 100 درهم يومياً تتحمل من قبل العميل.</li>
          </ol>
        </div>
      </div>
    </body>
  </html>`;
}

export async function GET(_req: NextRequest, { params }: Params) {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  try {
    const { companyId, estimateId } = await params;
    const data = await WorkshopEstimates.getEstimateWithItems(companyId, estimateId);
    if (!data) {
      return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
    }

    const company = await getCompanyById(companyId);
    const estimate = data.estimate;
    const items = data.items.filter((i) => i.status !== "rejected");
    const customer = estimate.customerId ? await Crm.getCustomerById(estimate.customerId) : null;
    const car = estimate.carId ? await Crm.getCarById(estimate.carId) : null;
    const lead = estimate.leadId ? await Leads.getLeadById(companyId, estimate.leadId) : null;

    const companyName = (company as any)?.display_name || (company as any)?.legal_name || "800CARGURU";
    const companyLegalName = (company as any)?.legal_name || "Mobile Auto Repair Services L.L.C";
    const companyAddress =
      (company as any)?.address_line1 ||
      (company as any)?.address_line2 ||
      (company as any)?.city ||
      "Dubai, UAE";
    const companyPhone = (company as any)?.company_phone || "800 2274878";
    const companyEmail = (company as any)?.company_email || "info@800carguru.ae";
    const companyTrn = (company as any)?.vat_number || "100585978800003";

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
      const rate = Number(item.sale ?? 0) || 0;
      const discount = 0;
      const price = rate * qty - discount;
      return {
        name: item.partName ?? "",
        description: item.description ?? "",
        qty,
        rate,
        discount,
        price,
      };
    });

    const html = buildQuoteHtml({
      companyName: String(companyName),
      companyLegalName: String(companyLegalName),
      companyAddress: String(companyAddress),
      companyPhone: String(companyPhone),
      companyEmail: String(companyEmail),
      companyTrn: String(companyTrn),
      companyLogo,
      customerName: String(customer?.name ?? "Customer"),
      customerPhone: String(customer?.phone ?? "-"),
      carMakeModel: String(
        [car?.make, car?.model].filter(Boolean).join(" ") || (lead as any)?.car_model || "-"
      ),
      carPlate: String(car?.plate_number ?? (lead as any)?.car_plate_number ?? "-"),
      advisor: String((lead as any)?.advisor ?? (lead as any)?.agent_name ?? "-"),
      estimateId: String(estimate.id),
      date: formatDateOnly(estimate.createdAt),
      items: rows,
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
        "Content-Disposition": `inline; filename="quote-${estimate.id}.pdf"`,
      },
    });
  } catch (error) {
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
    console.error("GET /api/company/[companyId]/workshop/estimates/[estimateId]/quote error:", error);
    return NextResponse.json({ error: "Failed to generate quotation" }, { status: 500 });
  }
}
