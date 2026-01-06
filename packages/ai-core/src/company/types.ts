export interface CompanyRow {
  id: string;
  name?: string | null;
  code?: string | null;
  logo_file_id: string | null;
  display_name: string | null;
  legal_name: string | null;
  trade_license_number: string | null;
  trade_license_issue: string | null;
  trade_license_expiry: string | null;
  trade_license_file_id: string | null;
  has_vat_tax: boolean;
  has_corporate_tax: boolean;
  vat_number: string | null;
  vat_certificate_file_id: string | null;
  corporate_tax_number: string | null;
  corporate_tax_certificate_file_id: string | null;
  owner_name: string | null;
  owner_passport_number: string | null;
  owner_passport_issue: string | null;
  owner_passport_expiry: string | null;
  owner_passport_file_id?: string | null;
  owner_phone?: string | null;
  owner_email?: string | null;
  owner_address?: string | null;
  company_domain: string | null;
  company_email: string | null;
  company_phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state_region: string | null;
  postal_code: string | null;
  country: string | null;
  timezone: string | null;
  currency: string | null;
  google_location?: string | null;
  google_maps_api_key?: string | null;
  is_active?: boolean | null;
  created_at?: string;
  updated_at?: string;
}

export interface CompanyContactRow {
  id: string;
  company_id: string;
  title: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type CompanyContactInput = {
  title?: string | null;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  sort_order: number;
};
