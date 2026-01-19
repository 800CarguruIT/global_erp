import { NextRequest, NextResponse } from "next/server";

type ParamsContext =
  | { params: { companyId: string; vendorId: string } }
  | { params: Promise<{ companyId: string; vendorId: string }> };

function normalizeId(value?: string | null) {
  const id = value?.toString?.().trim?.();
  if (!id || id === "undefined" || id === "null") return null;
  return id;
}

function companyIdFromUrl(url?: string | null) {
  if (!url) return null;
  const match = url.match(/\/company\/([^/]+)/i);
  return normalizeId(match?.[1]);
}

function vendorIdFromUrl(url?: string | null) {
  if (!url) return null;
  const match = url.match(/\/vendors\/([^/]+)/i);
  return normalizeId(match?.[1]);
}

async function getCompanyId(ctx: ParamsContext, body?: any, url?: string) {
  const raw = await Promise.resolve(ctx.params);
  return normalizeId((raw as any)?.companyId) ?? normalizeId(body?.companyId) ?? companyIdFromUrl(url);
}

async function getVendorId(ctx: ParamsContext, body?: any, url?: string) {
  const raw = await Promise.resolve(ctx.params);
  return normalizeId((raw as any)?.vendorId) ?? normalizeId(body?.vendorId) ?? vendorIdFromUrl(url);
}

export async function GET(_req: NextRequest, ctx: ParamsContext) {
  const companyId = await getCompanyId(ctx, undefined, _req.url);
  const vendorId = await getVendorId(ctx, undefined, _req.url);
  if (!companyId || !vendorId) {
    return NextResponse.json(
      { error: "companyId and vendorId are required", received: { url: _req.url } },
      { status: 400 }
    );
  }

  try {
    const { Vendors } = await import("@repo/ai-core");
    const vendor = await Vendors.getVendor(companyId, vendorId);
    if (!vendor) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(vendor, { status: 200 });
  } catch (err) {
    console.error("Vendors [vendorId] GET error", err);
    return NextResponse.json({ error: "Failed to load vendor" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: ParamsContext) {
  try {
    const values = await req.json();
    const companyId = await getCompanyId(ctx, values, req.url);
    const vendorId = await getVendorId(ctx, values, req.url);
    if (!companyId || !vendorId) {
      return NextResponse.json(
        { error: "companyId and vendorId are required", received: { body: values, url: req.url } },
        { status: 400 }
      );
    }

    const { Vendors } = await import("@repo/ai-core");
    const updated = await Vendors.updateVendor({
      vendorId,
      companyId,
      ...values,
    });
    return NextResponse.json(updated, { status: 200 });
  } catch (err) {
    console.error("Vendors [vendorId] PUT error", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to update vendor" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: ParamsContext) {
  const companyId = await getCompanyId(ctx, undefined, _req.url);
  const vendorId = await getVendorId(ctx, undefined, _req.url);
  if (!companyId || !vendorId) {
    return NextResponse.json(
      { error: "companyId and vendorId are required", received: { url: _req.url } },
      { status: 400 }
    );
  }

  try {
    const { Vendors } = await import("@repo/ai-core");
    const removed = await Vendors.updateVendor({
      vendorId,
      companyId,
      isActive: false,
    });
    return NextResponse.json(removed, { status: 200 });
  } catch (err) {
    console.error("Vendors [vendorId] DELETE error", err);
    return NextResponse.json({ error: "Failed to delete vendor" }, { status: 500 });
  }
}
