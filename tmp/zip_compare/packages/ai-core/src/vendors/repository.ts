import type { Sql } from "postgres";
import { getSql } from "../db";
import type {
  VendorRow,
  VendorContactRow,
  VendorBankAccountRow,
  VendorContactInput,
  VendorBankAccountInput,
} from "./types";

function rowsFrom<T>(result: T[] | { rows: T[] }): T[] {
  return (result as any).rows ?? (result as any);
}

export interface InsertVendorInput {
  companyId: string;
  code: string;
  name: string;
  displayName?: string;
  legalName?: string;
  phone?: string;
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateRegion?: string;
  postalCode?: string;
  country?: string;
  tradeLicenseNumber?: string;
  tradeLicenseIssue?: string | null;
  tradeLicenseExpiry?: string | null;
  tradeLicenseFileId?: string | null;
  taxNumber?: string;
  taxCertificateFileId?: string | null;
  isActive?: boolean;
}

export async function insertVendor(sql: Sql, input: InsertVendorInput): Promise<VendorRow> {
  const res = await sql<VendorRow[]>`
    INSERT INTO vendors (
      company_id,
      code,
      name,
      legal_name,
      phone,
      email,
      address_line1,
      address_line2,
      city,
      state_region,
      postal_code,
      country,
      google_location,
      trade_license_number,
      trade_license_issue,
      trade_license_expiry,
      trade_license_file_id,
      tax_number,
      tax_certificate_file_id,
      is_active
    )
    VALUES (
      ${input.companyId},
      ${input.code},
      ${input.name},
      ${input.legalName ?? null},
      ${input.phone ?? null},
      ${input.email ?? null},
      ${input.addressLine1 ?? null},
      ${input.addressLine2 ?? null},
      ${input.city ?? null},
      ${input.stateRegion ?? null},
      ${input.postalCode ?? null},
      ${input.country ?? null},
      ${input.googleLocation ?? null},
      ${input.tradeLicenseNumber ?? null},
      ${input.tradeLicenseIssue ?? null},
      ${input.tradeLicenseExpiry ?? null},
      ${input.tradeLicenseFileId ?? null},
      ${input.taxNumber ?? null},
      ${input.taxCertificateFileId ?? null},
      ${input.isActive ?? true}
    )
    RETURNING *
  `;
  return rowsFrom(res)[0] as VendorRow;
}

export async function replaceVendorContacts(
  sql: Sql,
  vendorId: string,
  contacts: VendorContactInput[] = []
): Promise<VendorContactRow[]> {
  const sanitized = contacts.slice(0, 3);
  const inserted: VendorContactRow[] = [];
  await sql`DELETE FROM vendor_contacts WHERE vendor_id = ${vendorId}`;
  for (const [idx, c] of sanitized.entries()) {
    const res = await sql<VendorContactRow[]>`
      INSERT INTO vendor_contacts (vendor_id, name, phone, email, address, sort_order)
      VALUES (
        ${vendorId},
        ${c.name},
        ${c.phone ?? null},
        ${c.email ?? null},
        ${c.address ?? null},
        ${idx}
      )
      RETURNING *
    `;
    const row = rowsFrom(res)[0] as VendorContactRow | undefined;
    if (row) inserted.push(row);
  }
  return inserted;
}

export async function replaceVendorBankAccounts(
  sql: Sql,
  vendorId: string,
  bankAccounts: VendorBankAccountInput[] = []
): Promise<VendorBankAccountRow[]> {
  const inserted: VendorBankAccountRow[] = [];
  await sql`DELETE FROM vendor_bank_accounts WHERE vendor_id = ${vendorId}`;
  for (const ba of bankAccounts) {
    const res = await sql<VendorBankAccountRow[]>`
      INSERT INTO vendor_bank_accounts (
        vendor_id, bank_name, branch_name, account_name, account_number,
        iban, swift, currency, is_default
      ) VALUES (
        ${vendorId},
        ${ba.bankName ?? null},
        ${ba.branchName ?? null},
        ${ba.accountName ?? null},
        ${ba.accountNumber ?? null},
        ${ba.iban ?? null},
        ${ba.swift ?? null},
        ${ba.currency ?? null},
        ${ba.isDefault ?? false}
      )
      RETURNING *
    `;
    const row = rowsFrom(res)[0] as VendorBankAccountRow | undefined;
    if (row) inserted.push(row);
  }
  return inserted;
}

export async function listContactsForVendor(vendorId: string, sqlParam?: Sql): Promise<VendorContactRow[]> {
  const sql = sqlParam ?? getSql();
  const res = await sql<VendorContactRow[]>`
    SELECT *
    FROM vendor_contacts
    WHERE vendor_id = ${vendorId}
    ORDER BY sort_order, created_at
  `;
  return rowsFrom(res);
}

export async function listBankAccountsForVendor(
  vendorId: string,
  sqlParam?: Sql
): Promise<VendorBankAccountRow[]> {
  const sql = sqlParam ?? getSql();
  const res = await sql<VendorBankAccountRow[]>`
    SELECT *
    FROM vendor_bank_accounts
    WHERE vendor_id = ${vendorId}
    ORDER BY created_at
  `;
  return rowsFrom(res);
}

export async function getVendorById(
  companyId: string,
  vendorId: string,
  sqlParam?: Sql
): Promise<VendorRow | null> {
  const sql = sqlParam ?? getSql();
  const res = await sql<VendorRow[]>`
    SELECT *
    FROM vendors
    WHERE id = ${vendorId} AND company_id = ${companyId}
    LIMIT 1
  `;
  const row = rowsFrom(res)[0] as VendorRow | undefined;
  return row ?? null;
}

export async function updateVendorRow(
  sql: Sql,
  companyId: string,
  vendorId: string,
  patch: Partial<VendorRow>
): Promise<VendorRow> {
  const res = await sql<VendorRow[]>`
    UPDATE vendors
    SET
      name = COALESCE(${patch.name ?? null}, name),
      legal_name = COALESCE(${patch.legal_name ?? null}, legal_name),
      phone = COALESCE(${patch.phone ?? null}, phone),
      email = COALESCE(${patch.email ?? null}, email),
      address_line1 = COALESCE(${patch.address_line1 ?? null}, address_line1),
      address_line2 = COALESCE(${patch.address_line2 ?? null}, address_line2),
      city = COALESCE(${patch.city ?? null}, city),
      state_region = COALESCE(${patch.state_region ?? null}, state_region),
      postal_code = COALESCE(${patch.postal_code ?? null}, postal_code),
      country = COALESCE(${patch.country ?? null}, country),
      google_location = COALESCE(${patch.google_location ?? null}, google_location),
      trade_license_number = COALESCE(${patch.trade_license_number ?? null}, trade_license_number),
      trade_license_issue = COALESCE(${patch.trade_license_issue ?? null}, trade_license_issue),
      trade_license_expiry = COALESCE(${patch.trade_license_expiry ?? null}, trade_license_expiry),
      trade_license_file_id = COALESCE(${patch.trade_license_file_id ?? null}, trade_license_file_id),
      tax_number = COALESCE(${patch.tax_number ?? null}, tax_number),
      tax_certificate_file_id = COALESCE(${patch.tax_certificate_file_id ?? null}, tax_certificate_file_id),
      is_active = COALESCE(${patch.is_active ?? null}, is_active),
      updated_at = NOW()
    WHERE id = ${vendorId} AND company_id = ${companyId}
    RETURNING *
  `;
  const row = rowsFrom(res)[0] as VendorRow | undefined;
  if (!row) throw new Error(`Vendor not found for id=${vendorId}`);
  return row;
}

export async function listVendors(
  companyId: string,
  opts: { search?: string; activeOnly?: boolean } = {}
): Promise<VendorRow[]> {
  const sql = getSql();
  const search = opts.search ? `%${opts.search}%` : null;
  const activeOnly = opts.activeOnly ?? true;
  const activeFilter = activeOnly ? sql`AND is_active = TRUE` : sql``;

  if (search) {
    const res = await sql<VendorRow[]>`
      SELECT *
      FROM vendors
      WHERE company_id = ${companyId}
        ${activeFilter}
        AND name ILIKE ${search}
      ORDER BY created_at DESC
    `;
    return rowsFrom(res);
  }

  const res = await sql<VendorRow[]>`
    SELECT *
    FROM vendors
    WHERE company_id = ${companyId}
      ${activeFilter}
    ORDER BY created_at DESC
  `;
  return rowsFrom(res);
}
