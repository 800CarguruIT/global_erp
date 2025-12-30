export interface Branch {
  id: string;
  company_id: string;
  code: string | null;
  name: string;
  display_name: string | null;
  legal_name: string | null;
  ownership_type: "own" | "third_party" | null;
  branch_types: string[] | null;
  service_types: string[] | null;
  phone_code: string | null;
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
  allow_branch_invoicing: boolean;
  vat_certificate_file_id: string | null;
  trn_number: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export type CreateBranchInput = {
  companyId: string;
  code?: string | null;
  name: string;
  displayName?: string | null;
  legalName?: string | null;
  ownershipType?: "own" | "third_party" | null;
  branchTypes?: string[] | null;
  serviceTypes?: string[] | null;
  phoneCode?: string | null;
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
  allowBranchInvoicing?: boolean;
  vatCertificateFileId?: string | null;
  trnNumber?: string | null;
  isActive?: boolean;
  contacts?: BranchContactInput[];
  bankAccounts?: BranchBankAccountInput[];
};

export type UpdateBranchInput = {
  branchId: string;
  companyId: string;
  code?: string | null;
  name?: string;
  displayName?: string | null;
  legalName?: string | null;
  ownershipType?: "own" | "third_party" | null;
  branchTypes?: string[] | null;
  serviceTypes?: string[] | null;
  phoneCode?: string | null;
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
  allowBranchInvoicing?: boolean;
  vatCertificateFileId?: string | null;
  trnNumber?: string | null;
  isActive?: boolean;
  contacts?: BranchContactInput[];
  bankAccounts?: BranchBankAccountInput[];
};

export type BranchContactInput = {
  name: string;
  phoneCode?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
};

export type BranchContact = {
  id: string;
  branch_id: string;
  name: string;
  phone_code: string | null;
  phone_number: string | null;
  email: string | null;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
};

export type BranchBankAccountInput = {
  bankName?: string | null;
  branchName?: string | null;
  accountName?: string | null;
  accountNumber?: string | null;
  iban?: string | null;
  swift?: string | null;
  currency?: string | null;
  isDefault?: boolean;
};

export type BranchBankAccount = {
  id: string;
  branch_id: string;
  bank_name: string | null;
  branch_name: string | null;
  account_name: string | null;
  account_number: string | null;
  iban: string | null;
  swift: string | null;
  currency: string | null;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
};
