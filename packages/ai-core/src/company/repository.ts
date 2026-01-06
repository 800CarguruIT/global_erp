import { getSql } from "../db";
import type { CompanyContactInput, CompanyContactRow, CompanyRow } from "./types";

function rowsFrom<T>(result: T[] | { rows: T[] }): T[] {
  return (result as any).rows ?? (result as any);
}

function normalizeOptionalUuid(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
}

function mapInsertFields(input: any) {
  return {
    logo_file_id: normalizeOptionalUuid(input.logoFileId),
    display_name: input.displayName ?? null,
    legal_name: input.legalName ?? null,
    trade_license_number: input.tradeLicense?.number ?? null,
    trade_license_issue: input.tradeLicense?.issue ?? null,
    trade_license_expiry: input.tradeLicense?.expiry ?? null,
    trade_license_file_id: normalizeOptionalUuid(input.tradeLicense?.fileId),
    has_vat_tax: input.taxSettings?.hasVatTax ?? false,
    has_corporate_tax: input.taxSettings?.hasCorporateTax ?? false,
    vat_number: input.taxSettings?.vatNumber ?? null,
    vat_certificate_file_id: normalizeOptionalUuid(input.taxSettings?.vatCertificateFileId),
    corporate_tax_number: input.taxSettings?.corporateTaxNumber ?? null,
    corporate_tax_certificate_file_id: normalizeOptionalUuid(
      input.taxSettings?.corporateTaxCertificateFileId
    ),
    owner_name: input.ownerPassport?.name ?? null,
    owner_passport_number: input.ownerPassport?.number ?? null,
    owner_passport_issue: input.ownerPassport?.issue ?? null,
    owner_passport_expiry: input.ownerPassport?.expiry ?? null,
    owner_passport_file_id: normalizeOptionalUuid(input.ownerPassport?.fileId),
    owner_phone: input.ownerPassport?.phone ?? null,
    owner_email: input.ownerPassport?.email ?? null,
    owner_address: input.ownerPassport?.address ?? null,
    company_domain: input.companyDomain ?? null,
    company_email: input.companyEmail ?? null,
    company_phone: input.companyPhone ?? null,
    address_line1: input.address?.line1 ?? null,
    address_line2: input.address?.line2 ?? null,
    city: input.address?.city ?? null,
    state_region: input.address?.stateRegion ?? null,
    postal_code: input.address?.postalCode ?? null,
    country: input.address?.country ?? null,
    timezone: input.timezone ?? null,
    currency: input.currency ?? null,
    google_location: input.googleLocation ?? null,
    google_maps_api_key: input.googleMapsApiKey ?? null,
  };
}

export async function getCompanyById(id: string): Promise<CompanyRow | null> {
  const sql = getSql();
  const res = await sql<CompanyRow[]>`
    SELECT * FROM companies WHERE id = ${id} LIMIT 1
  `;
  return rowsFrom(res)[0] ?? null;
}

export async function listCompanies(opts: { includeInactive?: boolean } = {}): Promise<CompanyRow[]> {
  const sql = getSql();
  const includeInactive = opts.includeInactive ?? false;
  const activeFilter = includeInactive ? sql`` : sql`WHERE is_active = TRUE`;
  const res = await sql<CompanyRow[]>`
    SELECT * FROM companies
    ${activeFilter}
    ORDER BY created_at DESC
  `;
  return rowsFrom(res);
}

export async function updateCompany(
  id: string,
  patch: Partial<CompanyRow>
): Promise<CompanyRow> {
  const sql = getSql();
  const res = await sql<CompanyRow[]>`
    UPDATE companies
    SET
      logo_file_id = COALESCE(${patch.logo_file_id ?? null}, logo_file_id),
      display_name = COALESCE(${patch.display_name ?? null}, display_name),
      legal_name = COALESCE(${patch.legal_name ?? null}, legal_name),
      trade_license_number = COALESCE(${patch.trade_license_number ?? null}, trade_license_number),
      trade_license_issue = COALESCE(${patch.trade_license_issue ?? null}, trade_license_issue),
      trade_license_expiry = COALESCE(${patch.trade_license_expiry ?? null}, trade_license_expiry),
      trade_license_file_id = COALESCE(${patch.trade_license_file_id ?? null}, trade_license_file_id),
      has_vat_tax = COALESCE(${patch.has_vat_tax ?? null}, has_vat_tax),
      has_corporate_tax = COALESCE(${patch.has_corporate_tax ?? null}, has_corporate_tax),
      vat_number = COALESCE(${patch.vat_number ?? null}, vat_number),
      vat_certificate_file_id = COALESCE(${patch.vat_certificate_file_id ?? null}, vat_certificate_file_id),
      corporate_tax_number = COALESCE(${patch.corporate_tax_number ?? null}, corporate_tax_number),
      corporate_tax_certificate_file_id = COALESCE(${patch.corporate_tax_certificate_file_id ?? null}, corporate_tax_certificate_file_id),
      owner_name = COALESCE(${patch.owner_name ?? null}, owner_name),
      owner_passport_number = COALESCE(${patch.owner_passport_number ?? null}, owner_passport_number),
      owner_passport_issue = COALESCE(${patch.owner_passport_issue ?? null}, owner_passport_issue),
      owner_passport_expiry = COALESCE(${patch.owner_passport_expiry ?? null}, owner_passport_expiry),
      owner_passport_file_id = COALESCE(${patch.owner_passport_file_id ?? null}, owner_passport_file_id),
      owner_phone = COALESCE(${patch.owner_phone ?? null}, owner_phone),
      owner_email = COALESCE(${patch.owner_email ?? null}, owner_email),
      owner_address = COALESCE(${patch.owner_address ?? null}, owner_address),
      company_domain = COALESCE(${patch.company_domain ?? null}, company_domain),
      company_email = COALESCE(${patch.company_email ?? null}, company_email),
      company_phone = COALESCE(${patch.company_phone ?? null}, company_phone),
      address_line1 = COALESCE(${patch.address_line1 ?? null}, address_line1),
      address_line2 = COALESCE(${patch.address_line2 ?? null}, address_line2),
      city = COALESCE(${patch.city ?? null}, city),
      state_region = COALESCE(${patch.state_region ?? null}, state_region),
      postal_code = COALESCE(${patch.postal_code ?? null}, postal_code),
      country = COALESCE(${patch.country ?? null}, country),
      timezone = COALESCE(${patch.timezone ?? null}, timezone),
      currency = COALESCE(${patch.currency ?? null}, currency),
      google_location = COALESCE(${patch.google_location ?? null}, google_location),
      google_maps_api_key = COALESCE(${patch.google_maps_api_key ?? null}, google_maps_api_key),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  const row = rowsFrom(res)[0];
  if (!row) throw new Error(`Company not found for id=${id}`);
  return row;
}

export async function disableCompany(id: string): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE companies
    SET is_active = FALSE, updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function createCompany(input: any): Promise<CompanyRow> {
  const sql = getSql();
  const fields = mapInsertFields(input);
  const res = await sql<CompanyRow[]>`
    INSERT INTO companies (
      logo_file_id,
      display_name,
      legal_name,
      trade_license_number,
      trade_license_issue,
      trade_license_expiry,
      trade_license_file_id,
      has_vat_tax,
      has_corporate_tax,
      vat_number,
      vat_certificate_file_id,
      corporate_tax_number,
      corporate_tax_certificate_file_id,
      owner_name,
      owner_passport_number,
      owner_passport_issue,
      owner_passport_expiry,
      owner_passport_file_id,
      owner_phone,
      owner_email,
      owner_address,
      company_domain,
      company_email,
      company_phone,
      address_line1,
      address_line2,
      city,
      state_region,
      postal_code,
      country,
      timezone,
      currency,
      google_maps_api_key
    ) VALUES (
      ${fields.logo_file_id},
      ${fields.display_name},
      ${fields.legal_name},
      ${fields.trade_license_number},
      ${fields.trade_license_issue},
      ${fields.trade_license_expiry},
      ${fields.trade_license_file_id},
      ${fields.has_vat_tax},
      ${fields.has_corporate_tax},
      ${fields.vat_number},
      ${fields.vat_certificate_file_id},
      ${fields.corporate_tax_number},
      ${fields.corporate_tax_certificate_file_id},
      ${fields.owner_name},
      ${fields.owner_passport_number},
      ${fields.owner_passport_issue},
      ${fields.owner_passport_expiry},
      ${fields.owner_passport_file_id},
      ${fields.owner_phone},
      ${fields.owner_email},
      ${fields.owner_address},
      ${fields.company_domain},
      ${fields.company_email},
      ${fields.company_phone},
      ${fields.address_line1},
      ${fields.address_line2},
      ${fields.city},
      ${fields.state_region},
      ${fields.postal_code},
      ${fields.country},
      ${fields.timezone},
      ${fields.currency},
      ${fields.google_maps_api_key}
    )
    RETURNING *
  `;
  const row = rowsFrom(res)[0];
  if (!row) throw new Error("Failed to create company");
  return row;
}

export async function listCompanyContacts(companyId: string): Promise<CompanyContactRow[]> {
  const sql = getSql();
  const res = await sql<CompanyContactRow[]>`
    SELECT *
    FROM company_contacts
    WHERE company_id = ${companyId}
    ORDER BY sort_order, created_at
  `;
  return rowsFrom(res);
}

export async function replaceCompanyContacts(
  companyId: string,
  contacts: CompanyContactInput[]
): Promise<void> {
  const sql = getSql();
  await sql.begin(async (trx) => {
    await trx`
      DELETE FROM company_contacts
      WHERE company_id = ${companyId}
    `;
    for (const contact of contacts) {
      await trx`
        INSERT INTO company_contacts (
          company_id, title, name, phone, email, address, sort_order
        ) VALUES (
          ${companyId},
          ${contact.title ?? null},
          ${contact.name},
          ${contact.phone ?? null},
          ${contact.email ?? null},
          ${contact.address ?? null},
          ${contact.sort_order}
        )
      `;
    }
  });
}
