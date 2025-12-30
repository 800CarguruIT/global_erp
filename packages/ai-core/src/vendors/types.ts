export interface VendorRow {
  id: string;
  company_id: string;
  code: string;
  name: string;
  legal_name: string | null;
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state_region: string | null;
  postal_code: string | null;
  country: string | null;
  google_location?: string | null;
  trade_license_number: string | null;
  trade_license_issue: string | null;
  trade_license_expiry: string | null;
  trade_license_file_id: string | null;
  tax_number: string | null;
  tax_certificate_file_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface VendorContactRow {
  id: string;
  vendor_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface VendorBankAccountRow {
  id: string;
  vendor_id: string;
  bank_name: string | null;
  branch_name: string | null;
  account_name: string | null;
  account_number: string | null;
  iban: string | null;
  swift: string | null;
  currency: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface VendorContactInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

export interface VendorBankAccountInput {
  bankName?: string | null;
  branchName?: string | null;
  accountName?: string | null;
  accountNumber?: string | null;
  iban?: string | null;
  swift?: string | null;
  currency?: string | null;
  isDefault?: boolean;
}

export interface CreateVendorInput {
  companyId: string;
  code?: string;
  name: string;
  legalName?: string | null;
  phone?: string | null;
  email?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateRegion?: string | null;
  postalCode?: string | null;
  country?: string | null;
  googleLocation?: string | null;
  tradeLicenseNumber?: string | null;
  tradeLicenseIssue?: string | null;
  tradeLicenseExpiry?: string | null;
  tradeLicenseFileId?: string | null;
  taxNumber?: string | null;
  taxCertificateFileId?: string | null;
  isActive?: boolean;
  contacts?: VendorContactInput[];
  bankAccounts?: VendorBankAccountInput[];
}

export interface UpdateVendorInput {
  vendorId: string;
  companyId: string;
  name?: string;
  legalName?: string | null;
  phone?: string | null;
  email?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateRegion?: string | null;
  postalCode?: string | null;
  country?: string | null;
  googleLocation?: string | null;
  tradeLicenseNumber?: string | null;
  tradeLicenseIssue?: string | null;
  tradeLicenseExpiry?: string | null;
  tradeLicenseFileId?: string | null;
  taxNumber?: string | null;
  taxCertificateFileId?: string | null;
  isActive?: boolean;
  contacts?: VendorContactInput[];
  bankAccounts?: VendorBankAccountInput[];
}
