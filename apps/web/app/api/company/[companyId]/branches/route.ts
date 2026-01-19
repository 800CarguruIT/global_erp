import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserIdFromRequest } from "../../../../../lib/auth/current-user";
import { buildScopeContextFromRoute, requirePermission } from "../../../../../lib/auth/permissions";

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
  return (
    normalizeId(raw?.companyId) ??
    normalizeId(body?.companyId) ??
    companyIdFromUrl(url)
  );
}

// GET /api/company/[companyId]/branches
export async function GET(_req: NextRequest, ctx: ParamsContext) {
  const companyId = await getCompanyId(ctx, undefined, _req.url);
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }
  const userId = await getCurrentUserIdFromRequest(_req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const scope = _req.nextUrl.searchParams.get("scope") ?? "company";
  const branchId = _req.nextUrl.searchParams.get("branchId") ?? undefined;
  const context = buildScopeContextFromRoute(
    { companyId, branchId },
    scope === "branch" ? "branch" : "company"
  );
  if (scope === "branch") {
    const { Rbac } = await import("@repo/ai-core");
    const perms = await Rbac.getUserPermissions(userId, context);
    const allowed =
      perms.includes("branches.view") ||
      perms.includes("branches.create") ||
      perms.includes("branches.edit") ||
      perms.includes("branches.delete");
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    const authError = await requirePermission(_req, "branches.view", context);
    if (authError) return authError;
  }

  try {
    const { Branches } = await import("@repo/ai-core");
    const includeInactive = _req.nextUrl.searchParams.get("includeInactive") === "true";
    const branches = await Branches.listBranches(companyId, { activeOnly: !includeInactive });
    return NextResponse.json({ branches }, { status: 200 });
  } catch (error) {
    console.error("GET /api/company/[companyId]/branches error:", error);
    return NextResponse.json(
      { error: "Failed to list branches" },
      { status: 500 }
    );
  }
}

// POST /api/company/[companyId]/branches
export async function POST(req: NextRequest, ctx: ParamsContext) {
  try {
    const body = await req.json();
    const companyId = await getCompanyId(ctx, body, req.url);
    if (!companyId) {
      return NextResponse.json({ error: "companyId is required", received: { body, url: req.url } }, { status: 400 });
    }
    const authError = await requirePermission(
      req,
      "branches.create",
      buildScopeContextFromRoute({ companyId }, "company")
    );
    if (authError) return authError;
    const { Branches } = await import("@repo/ai-core");
    const created = await Branches.createBranch({
      companyId,
      code: body?.code ?? null,
      name: body?.name,
      displayName: body?.displayName ?? body?.display_name ?? body?.name ?? null,
      legalName: body?.legalName ?? body?.legal_name ?? null,
      ownershipType: body?.ownershipType ?? body?.ownership_type ?? null,
      branchTypes: body?.branchTypes ?? body?.branch_types ?? null,
      serviceTypes: body?.serviceTypes ?? body?.service_types ?? null,
      phoneCode: body?.phoneCode ?? body?.phone_code ?? null,
      phone: body?.phone ?? null,
      email: body?.email ?? null,
      addressLine1: body?.addressLine1 ?? body?.address_line1 ?? null,
      addressLine2: body?.addressLine2 ?? body?.address_line2 ?? null,
      city: body?.city ?? null,
      stateRegion: body?.stateRegion ?? body?.state_region ?? null,
      postalCode: body?.postalCode ?? body?.postal_code ?? null,
      country: body?.country ?? null,
      googleLocation: body?.googleLocation ?? body?.google_location ?? null,
      tradeLicenseNumber: body?.tradeLicenseNumber ?? body?.trade_license_number ?? null,
      tradeLicenseIssue: body?.tradeLicenseIssue ?? body?.trade_license_issue ?? null,
      tradeLicenseExpiry: body?.tradeLicenseExpiry ?? body?.trade_license_expiry ?? null,
      tradeLicenseFileId: body?.tradeLicenseFileId ?? body?.trade_license_file_id ?? null,
      allowBranchInvoicing: body?.allowBranchInvoicing ?? body?.allow_branch_invoicing ?? false,
      vatCertificateFileId: body?.vatCertificateFileId ?? body?.vat_certificate_file_id ?? null,
      trnNumber: body?.trnNumber ?? body?.trn_number ?? null,
      isActive: body?.isActive ?? body?.is_active ?? true,
      contacts: body?.contacts ?? [],
      bankAccounts: body?.bankAccounts ?? [],
    });
    return NextResponse.json({ branch: created.branch, contacts: created.contacts, bankAccounts: created.bankAccounts }, { status: 201 });
  } catch (error) {
    console.error("POST /api/company/[companyId]/branches error:", error);
    return NextResponse.json(
      { error: "Failed to create branch" },
      { status: 500 }
    );
  }
}
