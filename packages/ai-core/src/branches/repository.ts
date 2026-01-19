import { getSql } from "../db";
import { ensureBranchAdminForBranch } from "./branchBootstrap";
import type {
  Branch,
  BranchBankAccount,
  BranchBankAccountInput,
  BranchContact,
  BranchContactInput,
  CreateBranchInput,
  UpdateBranchInput,
} from "./types";

function rowsFrom<T>(result: T[] | { rows: T[] }): T[] {
  return (result as any).rows ?? (result as any);
}

async function generateBranchCode(companyId: string): Promise<string> {
  const sql = getSql();
  const res = await sql<{ code: string }[]>`
    SELECT code FROM branches
    WHERE company_id = ${companyId} AND code LIKE 'BR-%'
    ORDER BY code DESC
    LIMIT 1
  `;
  const last = rowsFrom(res)[0]?.code;
  const num = last ? parseInt((last as string).split("-").pop() ?? "0", 10) : 0;
  const next = num + 1;
  return `BR-${String(next).padStart(4, "0")}`;
}

export async function listBranches(
  companyId: string,
  opts?: { search?: string; activeOnly?: boolean }
): Promise<Branch[]> {
  const sql = getSql();
  const search = opts?.search ? `%${opts.search}%` : null;
  const activeOnly = opts?.activeOnly ?? true;

  if (search) {
    const res = await sql<Branch[]>`
      SELECT *
      FROM branches
      WHERE company_id = ${companyId}
        AND (${activeOnly} = FALSE OR is_active = TRUE)
        AND (
          code ILIKE ${search} OR
          name ILIKE ${search} OR
          phone ILIKE ${search} OR
          email ILIKE ${search}
        )
      ORDER BY created_at DESC
    `;
    return rowsFrom(res);
  }

  const res = await sql<Branch[]>`
    SELECT *
    FROM branches
    WHERE company_id = ${companyId}
      AND (${activeOnly} = FALSE OR is_active = TRUE)
    ORDER BY created_at DESC
  `;
  return rowsFrom(res);
}

export async function getBranchById(
  companyId: string,
  branchId: string
): Promise<Branch | null> {
  const sql = getSql();
  const res = await sql<Branch[]>`
    SELECT *
    FROM branches
    WHERE company_id = ${companyId} AND id = ${branchId}
    LIMIT 1
  `;
  const row = rowsFrom(res)[0] as Branch | undefined;
  return row ?? null;
}

export async function insertBranch(input: CreateBranchInput): Promise<Branch> {
  const code = input.code ?? (await generateBranchCode(input.companyId));
  const sql = getSql();
  const res = await sql<Branch[]>`
    INSERT INTO branches (
      company_id,
      code,
      name,
      display_name,
      legal_name,
      ownership_type,
      branch_types,
      service_types,
      phone_code,
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
      allow_branch_invoicing,
      vat_certificate_file_id,
      trn_number,
      is_active
    )
    VALUES (
      ${input.companyId},
      ${code},
      ${input.name},
      ${input.displayName ?? null},
      ${input.legalName ?? null},
      ${input.ownershipType ?? null},
      ${input.branchTypes ?? null},
      ${input.serviceTypes ?? null},
      ${input.phoneCode ?? null},
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
      ${input.allowBranchInvoicing ?? false},
      ${input.vatCertificateFileId ?? null},
      ${input.trnNumber ?? null},
      ${input.isActive ?? true}
    )
    RETURNING *
  `;
  const row = rowsFrom(res)[0] as Branch;
  if (!row) {
    throw new Error("Failed to insert branch row");
  }
  return row;
}

export async function updateBranchRow(
  companyId: string,
  branchId: string,
  patch: UpdateBranchInput
): Promise<Branch> {
  const sql = getSql();
  const res = await sql<Branch[]>`
    UPDATE branches
    SET
      code = COALESCE(${patch.code ?? null}, code),
      name = COALESCE(${patch.name ?? null}, name),
      display_name = COALESCE(${patch.displayName ?? null}, display_name),
      legal_name = COALESCE(${patch.legalName ?? null}, legal_name),
      ownership_type = COALESCE(${patch.ownershipType ?? null}, ownership_type),
      branch_types = COALESCE(${patch.branchTypes ?? null}, branch_types),
      service_types = COALESCE(${patch.serviceTypes ?? null}, service_types),
      phone_code = COALESCE(${patch.phoneCode ?? null}, phone_code),
      phone = COALESCE(${patch.phone ?? null}, phone),
      email = COALESCE(${patch.email ?? null}, email),
      address_line1 = COALESCE(${patch.addressLine1 ?? null}, address_line1),
      address_line2 = COALESCE(${patch.addressLine2 ?? null}, address_line2),
      city = COALESCE(${patch.city ?? null}, city),
      state_region = COALESCE(${patch.stateRegion ?? null}, state_region),
      postal_code = COALESCE(${patch.postalCode ?? null}, postal_code),
      country = COALESCE(${patch.country ?? null}, country),
      google_location = COALESCE(${patch.googleLocation ?? null}, google_location),
      trade_license_number = COALESCE(${patch.tradeLicenseNumber ?? null}, trade_license_number),
      trade_license_issue = COALESCE(${patch.tradeLicenseIssue ?? null}, trade_license_issue),
      trade_license_expiry = COALESCE(${patch.tradeLicenseExpiry ?? null}, trade_license_expiry),
      trade_license_file_id = COALESCE(${patch.tradeLicenseFileId ?? null}, trade_license_file_id),
      allow_branch_invoicing = COALESCE(${patch.allowBranchInvoicing ?? null}, allow_branch_invoicing),
      vat_certificate_file_id = COALESCE(${patch.vatCertificateFileId ?? null}, vat_certificate_file_id),
      trn_number = COALESCE(${patch.trnNumber ?? null}, trn_number),
      is_active = COALESCE(${patch.isActive ?? null}, is_active),
      updated_at = NOW()
    WHERE company_id = ${companyId} AND id = ${branchId}
    RETURNING *
  `;
  const row = rowsFrom(res)[0] as Branch | undefined;
  if (!row) {
    throw new Error(`Branch not found for id=${branchId}`);
  }
  return row;
}

export async function softDeleteBranch(
  companyId: string,
  branchId: string
): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE branches
    SET is_active = FALSE, updated_at = NOW()
    WHERE company_id = ${companyId} AND id = ${branchId}
  `;
}

export async function replaceBranchContacts(
  branchId: string,
  contacts: BranchContactInput[] = []
): Promise<BranchContact[]> {
  const sql = getSql();
  const sanitized = contacts.slice(0, 3);
  const inserted: BranchContact[] = [];
  await sql.begin(async (trx) => {
    await trx`DELETE FROM branch_contacts WHERE branch_id = ${branchId}`;
    for (const [idx, c] of sanitized.entries()) {
      const res = await trx<BranchContact[]>`
        INSERT INTO branch_contacts (branch_id, name, phone_code, phone_number, email, sort_order)
        VALUES (
          ${branchId},
          ${c.name},
          ${c.phoneCode ?? null},
          ${c.phoneNumber ?? null},
          ${c.email ?? null},
          ${idx}
        )
        RETURNING *
      `;
      const row = rowsFrom(res)[0] as BranchContact | undefined;
      if (row) inserted.push(row);
    }
  });
  return inserted;
}

export async function listContactsForBranch(branchId: string): Promise<BranchContact[]> {
  const sql = getSql();
  const res = await sql<BranchContact[]>`
    SELECT *
    FROM branch_contacts
    WHERE branch_id = ${branchId}
    ORDER BY sort_order, created_at
  `;
  return rowsFrom(res);
}

export async function replaceBranchBankAccounts(
  branchId: string,
  bankAccounts: BranchBankAccountInput[] = []
): Promise<BranchBankAccount[]> {
  const sql = getSql();
  const inserted: BranchBankAccount[] = [];
  await sql.begin(async (trx) => {
    await trx`DELETE FROM branch_bank_accounts WHERE branch_id = ${branchId}`;
    for (const ba of bankAccounts) {
      const res = await trx<BranchBankAccount[]>`
        INSERT INTO branch_bank_accounts (
          branch_id, bank_name, branch_name, account_name, account_number,
          iban, swift, currency, is_default
        ) VALUES (
          ${branchId},
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
      const row = rowsFrom(res)[0] as BranchBankAccount | undefined;
      if (row) inserted.push(row);
    }
  });
  return inserted;
}

export async function listBankAccountsForBranch(
  branchId: string
): Promise<BranchBankAccount[]> {
  const sql = getSql();
  const res = await sql<BranchBankAccount[]>`
    SELECT *
    FROM branch_bank_accounts
    WHERE branch_id = ${branchId}
    ORDER BY created_at
  `;
  return rowsFrom(res);
}

export async function createBranch(
  input: CreateBranchInput
): Promise<{ branch: Branch; contacts: BranchContact[]; bankAccounts: BranchBankAccount[] }> {
  const branch = await insertBranch(input);
  const [contacts, bankAccounts] = await Promise.all([
    replaceBranchContacts(branch.id, input.contacts ?? []),
    replaceBranchBankAccounts(branch.id, input.bankAccounts ?? []),
  ]);
  try {
    await ensureBranchAdminForBranch(branch);
  } catch (err) {
    console.error("Failed to bootstrap branch admin", err);
  }
  return { branch, contacts, bankAccounts };
}

export async function updateBranch(
  input: UpdateBranchInput
): Promise<{ branch: Branch; contacts: BranchContact[]; bankAccounts: BranchBankAccount[] }> {
  const branch = await updateBranchRow(input.companyId, input.branchId, input);
  const [contacts, bankAccounts] = await Promise.all([
    input.contacts ? replaceBranchContacts(input.branchId, input.contacts) : listContactsForBranch(input.branchId),
    input.bankAccounts
      ? replaceBranchBankAccounts(input.branchId, input.bankAccounts)
      : listBankAccountsForBranch(input.branchId),
  ]);
  try {
    await ensureBranchAdminForBranch(branch);
  } catch (err) {
    console.error("Failed to bootstrap branch admin on update", err);
  }
  return { branch, contacts, bankAccounts };
}

export async function getBranchWithDetails(
  companyId: string,
  branchId: string
): Promise<{ branch: Branch; contacts: BranchContact[]; bankAccounts: BranchBankAccount[] } | null> {
  const branch = await getBranchById(companyId, branchId);
  if (!branch) return null;
  const [contacts, bankAccounts] = await Promise.all([
    listContactsForBranch(branchId),
    listBankAccountsForBranch(branchId),
  ]);
  return { branch, contacts, bankAccounts };
}
