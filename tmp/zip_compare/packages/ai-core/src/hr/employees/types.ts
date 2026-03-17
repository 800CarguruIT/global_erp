export type EmployeeScope = "global" | "company" | "branch" | "vendor";

export interface EmployeeAllowanceRow {
  id: string;
  employee_id: string;
  kind: "housing" | "transport" | "education" | "medical" | "other" | string;
  label: string | null;
  amount: number;
  sort_order: number;
}

export interface EmployeeRow {
  id: string;
  auto_code: string;
  scope: EmployeeScope;
  company_id: string | null;
  branch_id: string | null;
  vendor_id: string | null;

  first_name: string;
  last_name: string;
  full_name: string;
  temp_address: string | null;
  perm_address: string | null;
  current_location?: string | null;

  phone_personal: string | null;
  phone_company: string | null;
  email_personal: string | null;
  email_company: string | null;

  doc_id_number: string | null;
  doc_id_issue: string | null;
  doc_id_expiry: string | null;
  doc_passport_number: string | null;
  doc_passport_issue: string | null;
  doc_passport_expiry: string | null;
  doc_id_file_id: string | null;
  doc_passport_file_id: string | null;

  nationality: string | null;
  title: string | null;
  division: string | null;
  department: string | null;

  start_date: string | null;
  date_of_birth: string | null;

  basic_salary: number;
  pension_amount: number;
  gratuity_amount: number;

  allowance_total: number;
  gov_fee_total: number;
  salary_grand_total: number;

  visa_required: boolean;
  visa_fee: number;
  immigration_fee: number;
  work_permit_fee: number;
  admin_fee: number;
  insurance_fee: number;

  employee_type: "full_time" | "part_time" | "probation" | string;
  accommodation_type: "self" | "company" | string;
  transport_type: "self" | "company" | string;

  working_days_per_week: number | null;
  working_hours_per_day: number | null;
  official_day_off: string | null;

  emergency_name: string | null;
  emergency_phone: string | null;
  emergency_email: string | null;
  emergency_relation: string | null;
  emergency_address: string | null;

  image_file_id: string | null;

  created_at: string;
  updated_at: string;
}

export interface EmployeeAllowanceInput {
  kind: "housing" | "transport" | "education" | "medical" | "other" | string;
  label?: string | null;
  amount: number;
}

export interface EmployeeInput {
  scope: EmployeeScope;
  companyId?: string | null;
  branchId?: string | null;
  vendorId?: string | null;

  firstName: string;
  lastName: string;
  fullName?: string;
  tempAddress?: string | null;
  permAddress?: string | null;
  currentLocation?: string | null;

  phonePersonal?: string | null;
  phoneCompany?: string | null;
  emailPersonal?: string | null;
  emailCompany?: string | null;

  docIdNumber?: string | null;
  docIdIssue?: string | null;
  docIdExpiry?: string | null;
  docPassportNumber?: string | null;
  docPassportIssue?: string | null;
  docPassportExpiry?: string | null;
  docIdFileId?: string | null;
  docPassportFileId?: string | null;

  nationality?: string | null;
  title?: string | null;
  division?: string | null;
  department?: string | null;

  startDate?: string | null;
  dateOfBirth?: string | null;

  basicSalary: number;
  pensionAmount?: number;
  gratuityAmount?: number;

  visaRequired?: boolean;
  visaFee?: number;
  immigrationFee?: number;
  workPermitFee?: number;
  adminFee?: number;
  insuranceFee?: number;

  employeeType?: "full_time" | "part_time" | "probation" | string;
  accommodationType?: "self" | "company" | string;
  transportType?: "self" | "company" | string;

  workingDaysPerWeek?: number | null;
  workingHoursPerDay?: number | null;
  officialDayOff?: string | null;

  emergencyName?: string | null;
  emergencyPhone?: string | null;
  emergencyEmail?: string | null;
  emergencyRelation?: string | null;
  emergencyAddress?: string | null;

  imageFileId?: string | null;

  allowances?: EmployeeAllowanceInput[];
}

export interface EmployeeTotals {
  basicSalary: number;
  allowancesTotal: number;
  govFeeTotal: number;
  grandTotal: number;
}
