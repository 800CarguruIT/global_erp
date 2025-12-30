import { NextRequest, NextResponse } from "next/server";

type ParamsContext = { params: { companyId: string } | Promise<{ companyId: string }> };

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

async function getCompanyId(ctx: ParamsContext, body?: any, url?: string) {
  const raw = await Promise.resolve(ctx.params);
  return normalizeId(raw?.companyId) ?? normalizeId(body?.companyId) ?? companyIdFromUrl(url);
}

export async function GET(req: NextRequest, ctx: ParamsContext) {
  const companyId = await getCompanyId(ctx, undefined, req.url);
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required", received: { url: req.url } }, { status: 400 });
  }

  try {
    const search = req.nextUrl.searchParams.get("search") ?? undefined;
    const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "true";
    const { Vendors } = await import("@repo/ai-core");

    const vendors = await Vendors.listVendors(companyId, { search, activeOnly: !includeInactive });

    return NextResponse.json({ vendors }, { status: 200 });
  } catch (error) {
    console.error("Vendors GET error", error);
    return NextResponse.json(
      { error: "Failed to load vendors" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, ctx: ParamsContext) {
  try {
    const values = await req.json();
    const companyId = await getCompanyId(ctx, values, req.url);

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId is required", received: { body: values, url: req.url } },
        { status: 400 }
      );
    }

    console.log("Vendors POST payload", {
      companyId,
      keys: Object.keys(values),
    });

    const { Vendors } = await import("@repo/ai-core");

    const created = await Vendors.createVendor({
      ...values,
      companyId,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Vendors POST error", error);
    return NextResponse.json(
      { error: "Failed to create vendor" },
      { status: 500 }
    );
  }
}
