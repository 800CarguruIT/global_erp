import { NextRequest, NextResponse } from "next/server";
import { WorkshopQuotes } from "@repo/ai-core";

type Params = { params: Promise<{ companyId: string; quoteId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { companyId, quoteId } = await params;
  try {
    const data = await WorkshopQuotes.getQuoteWithItems(companyId, quoteId);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET quote failed", err);
    return NextResponse.json({ error: "Failed to load quote" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { companyId, quoteId } = await params;
  try {
    const body = await req.json().catch(() => ({}));
    const quoteData = await WorkshopQuotes.getQuoteWithItems(companyId, quoteId);
    if (!quoteData) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const headerPatch = body.header ?? {};
    if (body.status && !headerPatch.status) headerPatch.status = body.status;
    if (body.validUntil && headerPatch.validUntil === undefined) headerPatch.validUntil = body.validUntil;
    const metaPatch = body.meta;
    const items = Array.isArray(body.items) ? body.items : body.item ? [body.item] : undefined;
    const hasHeader = headerPatch && Object.keys(headerPatch).length > 0;
    const hasMeta = metaPatch && Object.keys(metaPatch ?? {}).length > 0;

    if ((items && items.length) || hasHeader || hasMeta) {
      if (quoteData.quote.quoteType === "vendor_part") {
        await WorkshopQuotes.updateVendorQuote(companyId, quoteId, {
          headerPatch: hasHeader ? headerPatch : undefined,
          items,
        });
      } else {
        await WorkshopQuotes.updateBranchQuote(companyId, quoteId, {
          headerPatch: hasHeader ? headerPatch : undefined,
          item: items?.[0],
          metaPatch: hasMeta ? metaPatch : undefined,
        });
      }
    }

    if (body.approve === true) {
      const nowUserId = null; // TODO: derive from session
      if (quoteData.quote.quoteType === "vendor_part") {
        await WorkshopQuotes.approveVendorQuote(companyId, quoteId, nowUserId);
      } else {
        await WorkshopQuotes.approveBranchQuote(companyId, quoteId, nowUserId);
      }
    }

    const data = await WorkshopQuotes.getQuoteWithItems(companyId, quoteId);
    return NextResponse.json({ data });
  } catch (err) {
    console.error("PATCH quote failed", err);
    return NextResponse.json({ error: "Failed to update quote" }, { status: 500 });
  }
}
