import { NextRequest, NextResponse } from "next/server";

type ParamsContext = { params: { companyId: string; branchId: string } | Promise<{ companyId: string; branchId: string }> };

function normalizeId(value?: string | null) {
  const id = value?.toString?.().trim?.();
  if (!id || id === "undefined" || id === "null") return null;
  return id;
}

function idsFromUrl(url?: string | null) {
  if (!url) return { companyId: null, branchId: null };
  const match = url.match(/\/company\/([^/]+)\/branches\/([^/]+)/i);
  return {
    companyId: normalizeId(match?.[1] ?? null),
    branchId: normalizeId(match?.[2] ?? null),
  };
}

async function resolveIds(ctx: ParamsContext, url?: string | null) {
  const raw = await Promise.resolve(ctx.params);
  return {
    companyId: normalizeId(raw?.companyId) ?? idsFromUrl(url).companyId,
    branchId: normalizeId(raw?.branchId) ?? idsFromUrl(url).branchId,
  };
}

export async function GET(_req: NextRequest, ctx: ParamsContext) {
  const { companyId, branchId } = await resolveIds(ctx, _req.url);
  if (!companyId || !branchId) {
    return NextResponse.json({ error: "companyId and branchId are required" }, { status: 400 });
  }
  try {
    const { Branches } = await import("@repo/ai-core");
    const branch = await Branches.getBranchWithDetails(companyId, branchId);
    if (!branch) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(branch, { status: 200 });
  } catch (error) {
    console.error("GET /api/company/[companyId]/branches/[branchId] error:", error);
    return NextResponse.json({ error: "Failed to fetch branch" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: ParamsContext) {
  const { companyId, branchId } = await resolveIds(ctx, req.url);
  if (!companyId || !branchId) {
    return NextResponse.json({ error: "companyId and branchId are required", received: { companyId, branchId, url: req.url } }, { status: 400 });
  }
  try {
    const body = await req.json();
    const { Branches } = await import("@repo/ai-core");
    const branch = await Branches.updateBranch({
      branchId,
      companyId,
      code: body?.code ?? undefined,
      name: body?.name ?? undefined,
      displayName: body?.displayName ?? body?.display_name ?? undefined,
      legalName: body?.legalName ?? body?.legal_name ?? undefined,
      ownershipType: body?.ownershipType ?? body?.ownership_type ?? undefined,
      branchTypes: body?.branchTypes ?? body?.branch_types ?? undefined,
      serviceTypes: body?.serviceTypes ?? body?.service_types ?? undefined,
      phoneCode: body?.phoneCode ?? body?.phone_code ?? undefined,
      phone: body?.phone ?? undefined,
      email: body?.email ?? undefined,
      addressLine1: body?.addressLine1 ?? body?.address_line1 ?? undefined,
      addressLine2: body?.addressLine2 ?? body?.address_line2 ?? undefined,
      city: body?.city ?? undefined,
      stateRegion: body?.stateRegion ?? body?.state_region ?? undefined,
      postalCode: body?.postalCode ?? body?.postal_code ?? undefined,
      country: body?.country ?? undefined,
      googleLocation: body?.googleLocation ?? body?.google_location ?? undefined,
      tradeLicenseNumber: body?.tradeLicenseNumber ?? body?.trade_license_number ?? undefined,
      tradeLicenseIssue: body?.tradeLicenseIssue ?? body?.trade_license_issue ?? undefined,
      tradeLicenseExpiry: body?.tradeLicenseExpiry ?? body?.trade_license_expiry ?? undefined,
      tradeLicenseFileId: body?.tradeLicenseFileId ?? body?.trade_license_file_id ?? undefined,
      allowBranchInvoicing: body?.allowBranchInvoicing ?? body?.allow_branch_invoicing ?? undefined,
      vatCertificateFileId: body?.vatCertificateFileId ?? body?.vat_certificate_file_id ?? undefined,
      trnNumber: body?.trnNumber ?? body?.trn_number ?? undefined,
      isActive: body?.isActive ?? body?.is_active ?? undefined,
      contacts: body?.contacts ?? undefined,
      bankAccounts: body?.bankAccounts ?? undefined,
    });
    return NextResponse.json(branch, { status: 200 });
  } catch (error) {
    console.error("PUT /api/company/[companyId]/branches/[branchId] error:", error);
    return NextResponse.json({ error: "Failed to update branch" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: ParamsContext) {
  const { companyId, branchId } = await resolveIds(ctx, _req.url);
  if (!companyId || !branchId) {
    return NextResponse.json({ error: "companyId and branchId are required", received: { companyId, branchId, url: _req.url } }, { status: 400 });
  }
  try {
    const { Branches } = await import("@repo/ai-core");
    await Branches.softDeleteBranch(companyId, branchId);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("DELETE /api/company/[companyId]/branches/[branchId] error:", error);
    return NextResponse.json({ error: "Failed to delete branch" }, { status: 500 });
  }
}
