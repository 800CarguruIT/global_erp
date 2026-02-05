import { NextRequest, NextResponse } from "next/server";
import {
  getCompanyById,
  listCompanyContacts,
  updateCompanyProfile,
  disableCompany,
} from "@repo/ai-core/company/service";
import { getSql } from "@repo/ai-core";

function mapToForm(company: any, contacts: any[]) {
  if (!company) return null;
  return {
    logoFileId: company.logo_file_id ?? null,
    displayName: company.display_name ?? null,
    legalName: company.legal_name ?? null,
    tradeLicense: {
      number: company.trade_license_number ?? null,
      issue: company.trade_license_issue ?? null,
      expiry: company.trade_license_expiry ?? null,
      fileId: company.trade_license_file_id ?? null,
    },
    taxSettings: {
      hasVatTax: company.has_vat_tax ?? false,
      hasCorporateTax: company.has_corporate_tax ?? false,
      vatNumber: company.vat_number ?? null,
      vatCertificateFileId: company.vat_certificate_file_id ?? null,
      corporateTaxNumber: company.corporate_tax_number ?? null,
      corporateTaxCertificateFileId: company.corporate_tax_certificate_file_id ?? null,
    },
    ownerPassport: {
      name: company.owner_name ?? null,
      number: company.owner_passport_number ?? null,
      phone: company.owner_phone ?? null,
      email: company.owner_email ?? null,
      address: company.owner_address ?? null,
      issue: company.owner_passport_issue ?? null,
      expiry: company.owner_passport_expiry ?? null,
      fileId: company.owner_passport_file_id ?? null,
    },
    contacts: contacts.map((c) => ({
      title: c.title ?? null,
      name: c.name ?? "",
      phone: c.phone ?? null,
      email: c.email ?? null,
      address: c.address ?? null,
    })),
    companyDomain: company.company_domain ?? null,
    companyEmail: company.company_email ?? null,
    companyPhone: company.company_phone ?? null,
    googleLocation: company.google_location ?? null,
    address: {
      line1: company.address_line1 ?? null,
      line2: company.address_line2 ?? null,
      city: company.city ?? null,
      stateRegion: company.state_region ?? null,
      postalCode: company.postal_code ?? null,
      country: company.country ?? null,
    },
    timezone: company.timezone ?? null,
    currency: company.currency ?? null,
    isActive: company.is_active ?? null,
  };
}

function mapToUpdatePayload(body: any) {
  return {
    logo_file_id: body.logoFileId ?? null,
    display_name: body.displayName ?? null,
    legal_name: body.legalName ?? null,
    trade_license_number: body.tradeLicense?.number ?? null,
    trade_license_issue: body.tradeLicense?.issue ?? null,
    trade_license_expiry: body.tradeLicense?.expiry ?? null,
    trade_license_file_id: body.tradeLicense?.fileId ?? null,
    has_vat_tax: body.taxSettings?.hasVatTax ?? false,
    has_corporate_tax: body.taxSettings?.hasCorporateTax ?? false,
    vat_number: body.taxSettings?.vatNumber ?? null,
    vat_certificate_file_id: body.taxSettings?.vatCertificateFileId ?? null,
    corporate_tax_number: body.taxSettings?.corporateTaxNumber ?? null,
    corporate_tax_certificate_file_id: body.taxSettings?.corporateTaxCertificateFileId ?? null,
    owner_name: body.ownerPassport?.name ?? null,
    owner_passport_number: body.ownerPassport?.number ?? null,
    owner_passport_issue: body.ownerPassport?.issue ?? null,
    owner_passport_expiry: body.ownerPassport?.expiry ?? null,
    owner_passport_file_id: body.ownerPassport?.fileId ?? null,
    owner_phone: body.ownerPassport?.phone ?? null,
    owner_email: body.ownerPassport?.email ?? null,
    owner_address: body.ownerPassport?.address ?? null,
    company_domain: body.companyDomain ?? null,
    company_email: body.companyEmail ?? null,
    company_phone: body.companyPhone ?? null,
    address_line1: body.address?.line1 ?? null,
    address_line2: body.address?.line2 ?? null,
    city: body.address?.city ?? null,
    state_region: body.address?.stateRegion ?? null,
    postal_code: body.address?.postalCode ?? null,
    country: body.address?.country ?? null,
    timezone: body.timezone ?? null,
    currency: body.currency ?? null,
    google_location: body.googleLocation ?? null,
    is_active: body.isActive ?? null,
  };
}

async function resolveId(params: any): Promise<string | null> {
  const resolved = await Promise.resolve(params);
  const id = Array.isArray(resolved?.id) ? resolved.id[0] : resolved?.id;
  return id ?? null;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const id = await resolveId(params);
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const company = await getCompanyById(id);
    if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const contacts = await listCompanyContacts(id);
    const sql = getSql();
    const latestSub = await sql<
      { category: string | null; amount: number | null; currency: string | null; ends_at: string | null; started_at: string | null }[]
    >`
      SELECT category, amount, currency, ends_at, started_at
      FROM global_subscriptions
      WHERE company_id = ${id}
      ORDER BY started_at DESC NULLS LAST, created_at DESC NULLS LAST
      LIMIT 1
    `;
    const subscription = latestSub?.[0] ?? null;
    return NextResponse.json({ data: { company: mapToForm(company, contacts ?? []), subscription } });
  } catch (error) {
    console.error("GET /api/master/companies/:id error", error);
    return NextResponse.json({ error: "Failed to load company" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const id = await resolveId(params);
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const patch = mapToUpdatePayload(body);
    const contacts = Array.isArray(body.contacts)
      ? body.contacts.map((c: any, idx: number) => ({
          title: c.title ?? null,
          name: c.name ?? "",
          phone: c.phone ?? null,
          email: c.email ?? null,
          address: c.address ?? null,
          sort_order: idx,
        }))
      : undefined;
    const updated = await updateCompanyProfile({ companyId: id, data: patch, contacts });
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/master/companies/:id error", error);
    return NextResponse.json({ error: "Failed to update company" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const id = await resolveId(params);
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    await disableCompany(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/master/companies/:id error", error);
    return NextResponse.json({ error: "Failed to delete company" }, { status: 500 });
  }
}
