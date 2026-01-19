import { getSql } from "../db";
import * as VendorsRepository from "./repository";
import type {
  VendorRow,
  VendorContactRow,
  VendorBankAccountRow,
  VendorContactInput,
  VendorBankAccountInput,
  UpdateVendorInput,
} from "./types";
import { ensureVendorAdminForVendor } from "./vendorBootstrap";

export interface CreateVendorInput {
  companyId: string;
  name?: string;
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
  contacts?: VendorContactInput[];
  bankAccounts?: VendorBankAccountInput[];
  code?: string;
}

export interface ListVendorsOptions {
  search?: string;
  activeOnly?: boolean;
}

export async function listVendors(companyId: string, opts: ListVendorsOptions = {}) {
  const id = companyId?.trim();
  if (!id) {
    throw new Error("companyId is required for listVendors");
  }

  const activeOnly = opts.activeOnly ?? true;
  return VendorsRepository.listVendors(id, { ...opts, activeOnly });
}

export async function generateVendorCode(companyId: string): Promise<string> {
  if (!companyId) {
    throw new Error("companyId is required for generateVendorCode");
  }

  const sql = getSql();
  const res = await sql<{ code: string }[]>`
    SELECT code
    FROM vendors
    WHERE company_id = ${companyId} AND code LIKE 'VEND-%'
    ORDER BY code DESC
    LIMIT 1
  `;

  const lastCode = res[0]?.code ?? "VEND-0000";
  const lastNumber = parseInt(lastCode.replace("VEND-", ""), 10) || 0;
  const nextNumber = lastNumber + 1;
  return `VEND-${nextNumber.toString().padStart(4, "0")}`;
}

export async function createVendor(input: CreateVendorInput): Promise<{
  vendor: VendorRow;
  contacts: VendorContactRow[];
  bankAccounts: VendorBankAccountRow[];
}> {
  const {
    companyId,
    displayName,
    name,
    contacts = [],
    bankAccounts = [],
    ...rest
  } = input;

  const id = companyId?.trim();
  if (!id) {
    throw new Error("companyId is required for createVendor");
  }

  const sql = getSql();

  const code =
    input.code && input.code.trim().length > 0
      ? input.code.trim()
      : await generateVendorCode(id);

  let vendor: VendorRow | undefined;
  let createdContacts: VendorContactRow[] = [];
  let createdBankAccounts: VendorBankAccountRow[] = [];

  await sql.begin(async (trx) => {
    vendor = await VendorsRepository.insertVendor(trx, {
      companyId: id,
      code,
      name: displayName || name || "",
      displayName,
      ...rest,
      isActive: rest.isActive ?? true,
    });

    console.log("[vendors] created vendor row", {
      id: vendor!.id,
      companyId: vendor!.company_id,
      code: vendor!.code,
      name: vendor!.name,
    });

    createdContacts = await VendorsRepository.replaceVendorContacts(
      trx,
      vendor!.id,
      contacts.slice(0, 3)
    );

    createdBankAccounts = await VendorsRepository.replaceVendorBankAccounts(
      trx,
      vendor!.id,
      bankAccounts
    );
  });

  try {
    await ensureVendorAdminForVendor(vendor!);
  } catch (err) {
    console.error("Failed to bootstrap vendor admin", err);
  }

  return {
    vendor: vendor!,
    contacts: createdContacts,
    bankAccounts: createdBankAccounts,
  };
}

export async function updateVendor(input: UpdateVendorInput): Promise<{
  vendor: VendorRow;
  contacts: VendorContactRow[];
  bankAccounts: VendorBankAccountRow[];
}> {
  const sql = getSql();
  const companyId = input.companyId?.trim();
  if (!companyId) {
    throw new Error("companyId is required for updateVendor");
  }

  const existing = await VendorsRepository.getVendorById(companyId, input.vendorId, sql);
  if (!existing) {
    throw new Error("Vendor not found");
  }

  const patch: Partial<VendorRow> = {
    name: input.name ?? undefined,
    legal_name: input.legalName ?? undefined,
    phone: input.phone ?? undefined,
    email: input.email ?? undefined,
    address_line1: input.addressLine1 ?? undefined,
    address_line2: input.addressLine2 ?? undefined,
    city: input.city ?? undefined,
    state_region: input.stateRegion ?? undefined,
    postal_code: input.postalCode ?? undefined,
    country: input.country ?? undefined,
    google_location: input.googleLocation ?? undefined,
    trade_license_number: input.tradeLicenseNumber ?? undefined,
    trade_license_issue: input.tradeLicenseIssue ?? undefined,
    trade_license_expiry: input.tradeLicenseExpiry ?? undefined,
    trade_license_file_id: input.tradeLicenseFileId ?? undefined,
    tax_number: input.taxNumber ?? undefined,
    tax_certificate_file_id: input.taxCertificateFileId ?? undefined,
    is_active: input.isActive ?? undefined,
  };

  let vendor: VendorRow | undefined;
  let contacts: VendorContactRow[] = [];
  let bankAccounts: VendorBankAccountRow[] = [];

  await sql.begin(async (trx) => {
    vendor = await VendorsRepository.updateVendorRow(trx, companyId, input.vendorId, patch);
    if (input.contacts) {
      contacts = await VendorsRepository.replaceVendorContacts(trx, input.vendorId, input.contacts.slice(0, 3));
    } else {
      contacts = await VendorsRepository.listContactsForVendor(input.vendorId, trx);
    }
    if (input.bankAccounts) {
      bankAccounts = await VendorsRepository.replaceVendorBankAccounts(trx, input.vendorId, input.bankAccounts);
    } else {
      bankAccounts = await VendorsRepository.listBankAccountsForVendor(input.vendorId, trx);
    }
  });

  try {
    if (vendor) {
      await ensureVendorAdminForVendor(vendor);
    }
  } catch (err) {
    console.error("Failed to bootstrap vendor admin on update", err);
  }

  return {
    vendor: vendor as VendorRow,
    contacts,
    bankAccounts,
  };
}

export async function getVendor(
  companyId: string,
  vendorId: string
): Promise<{
  vendor: VendorRow;
  contacts: VendorContactRow[];
  bankAccounts: VendorBankAccountRow[];
} | null> {
  const id = companyId?.trim();
  if (!id) {
    throw new Error("companyId is required for getVendor");
  }
  const sql = getSql();
  const vendor = await VendorsRepository.getVendorById(id, vendorId, sql);
  if (!vendor) return null;
  const [contacts, bankAccounts] = await Promise.all([
    VendorsRepository.listContactsForVendor(vendorId, sql),
    VendorsRepository.listBankAccountsForVendor(vendorId, sql),
  ]);
  return { vendor, contacts, bankAccounts };
}
