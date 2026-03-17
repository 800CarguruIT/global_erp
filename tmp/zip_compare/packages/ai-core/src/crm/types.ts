export type CustomerType = "individual" | "corporate";

export interface CustomerRow {
  id: string;
  company_id: string;
  customer_type: CustomerType;
  code: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  national_id: string | null;
  passport_no: string | null;
  legal_name: string | null;
  trade_license_no: string | null;
  tax_number: string | null;
  email: string | null;
  phone: string | null;
  phone_alt: string | null;
  whatsapp_phone: string | null;
  address: string | null;
  country?: string | null;
  city?: string | null;
  wallet_amount: number;
  google_location?: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CarRow {
  id: string;
  company_id: string;
  code: string;
  plate_code: string | null;
  plate_number: string;
  plate_country: string | null;
  plate_state: string | null;
  plate_city: string | null;
  plate_location_mode: "state" | "city" | "both" | null;
  vin: string | null;
  make: string | null;
  model: string | null;
  model_year: number | null;
  color: string | null;
  body_type: string | null;
  is_insurance: boolean;
  mileage: number | null;
  tyre_size_front: string | null;
  tyre_size_back: string | null;
  registration_expiry: string | null;
  registration_card_file_id: string | null;
  vin_photo_file_id?: string | null;
  is_unregistered: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type CustomerCarRelationType = "owner" | "driver" | "other";

export interface CustomerCarLinkRow {
  id: string;
  company_id: string;
  customer_id: string;
  car_id: string;
  relation_type: CustomerCarRelationType;
  priority: number;
  is_primary: boolean;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type CreateCustomerInput = {
  companyId: string;
  customerType: CustomerType;
  code?: string;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  dateOfBirth?: string | null;
  nationalId?: string | null;
  passportNo?: string | null;
  legalName?: string | null;
  tradeLicenseNo?: string | null;
  taxNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  phoneAlt?: string | null;
  whatsappPhone?: string | null;
  address?: string | null;
  country?: string | null;
  city?: string | null;
  googleLocation?: string | null;
  notes?: string | null;
};

export type UpdateCustomerInput = Partial<CreateCustomerInput> & {
  isActive?: boolean;
};

export type CreateCarInput = {
  companyId: string;
  code?: string;
  plateCode?: string | null;
  plateNumber?: string | null;
  plateCountry?: string | null;
  plateState?: string | null;
  plateCity?: string | null;
  plateLocationMode?: "state" | "city" | "both" | null;
  vin?: string | null;
  make?: string | null;
  model?: string | null;
  modelYear?: number | null;
  color?: string | null;
  bodyType?: string | null;
  isInsurance?: boolean | null;
  mileage?: number | null;
  tyreSizeFront?: string | null;
  tyreSizeBack?: string | null;
  registrationExpiry?: string | null;
  registrationCardFileId?: string | null;
  vinPhotoFileId?: string | null;
  notes?: string | null;
};

export type UpdateCarInput = Partial<CreateCarInput> & {
  isActive?: boolean;
};

export type LinkCustomerToCarInput = {
  companyId: string;
  customerId: string;
  carId: string;
  relationType: CustomerCarRelationType;
  priority?: number;
  isPrimary?: boolean;
  notes?: string | null;
};

export type CustomerWithCars = CustomerRow & {
  cars: Array<{
    car: CarRow;
    link: CustomerCarLinkRow;
  }>;
};

export type CarWithCustomers = CarRow & {
  customers: Array<{
    customer: CustomerRow;
    link: CustomerCarLinkRow;
  }>;
};

export interface CustomerWalletTransactionRow {
  id: string;
  company_id: string;
  customer_id: string;
  amount: number;
  payment_method: string | null;
  payment_date: string | null;
  payment_proof_file_id: string | null;
  approved_at: string | null;
  approved_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerWalletTransactionWithCustomer extends CustomerWalletTransactionRow {
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  approved_by_name?: string | null;
}

export type CreateCustomerWalletTransactionInput = {
  companyId: string;
  customerId: string;
  amount: number;
  paymentMethod?: string | null;
  paymentDate?: string | null;
  paymentProofFileId?: string | null;
  notes?: string | null;
};
