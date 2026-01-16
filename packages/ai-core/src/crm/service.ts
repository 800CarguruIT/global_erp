import type {
  CarRow,
  CarWithCustomers,
  CreateCarInput,
  CreateCustomerInput,
  CreateCustomerWalletTransactionInput,
  CustomerCarLinkRow,
  CustomerCarRelationType,
  CustomerRow,
  CustomerWalletTransactionWithCustomer,
  CustomerWithCars,
  CustomerWalletTransactionRow,
  LinkCustomerToCarInput,
  UpdateCarInput,
  UpdateCustomerInput,
} from "./types";
import {
  clearPrimaryForRelation,
  deactivateCar as repoDeactivateCar,
  deactivateCustomer as repoDeactivateCustomer,
  deleteLink,
  getCarByCode,
  getCarById,
  getCustomerByCode,
  getCustomerById,
  getCustomerWalletTransactionById,
  getMaxPriorityForRelation,
  insertCar,
  insertCustomer,
  insertCustomerWalletTransaction,
  insertLink,
  getLinkByCustomerCarRelation,
  getCustomerWalletBalance,
  listCustomerWalletTransactions,
  listCompanyWalletTransactions as repoListCompanyWalletTransactions,
  listCars as repoListCars,
  listLinksForCar,
  listLinksForCustomer,
  listCustomers as repoListCustomers,
  approveCustomerWalletTransaction as repoApproveCustomerWalletTransaction,
  updateCustomerWalletAmount,
  updateCar,
  updateCustomer,
  updateLink,
} from "./repository";
import { getSql } from "../db";

// Code generators
export async function generateCustomerCode(companyId: string): Promise<string> {
  const sql = getSql();
  const res = await sql<{ code: string }[]>`
    SELECT code FROM customers
    WHERE company_id = ${companyId} AND code LIKE 'CUST-%'
    ORDER BY code DESC
    LIMIT 1
  `;
  const last = (res as any).rows ? (res as any).rows[0]?.code : res[0]?.code;
  const num = last ? parseInt(last.split("-").pop() ?? "0", 10) : 0;
  const next = num + 1;
  return `CUST-${String(next).padStart(4, "0")}`;
}

export async function generateCarCode(companyId: string): Promise<string> {
  const sql = getSql();
  const res = await sql<{ code: string }[]>`
    SELECT code FROM cars
    WHERE company_id = ${companyId} AND code LIKE 'CAR-%'
    ORDER BY code DESC
    LIMIT 1
  `;
  const last = (res as any).rows ? (res as any).rows[0]?.code : res[0]?.code;
  const num = last ? parseInt(last.split("-").pop() ?? "0", 10) : 0;
  const next = num + 1;
  return `CAR-${String(next).padStart(4, "0")}`;
}

export async function generateNoPlate(companyId: string): Promise<string> {
  const sql = getSql();
  const prefix = `NOPLATE-${companyId.slice(0, 4)}`;
  const res = await sql<{ plate_number: string }[]>`
    SELECT plate_number FROM cars
    WHERE company_id = ${companyId} AND plate_number LIKE ${prefix || ""} || '%'
    ORDER BY plate_number DESC
    LIMIT 1
  `;
  const last = (res as any).rows ? (res as any).rows[0]?.plate_number : res[0]?.plate_number;
  const lastNum = last ? parseInt(last.split("-").pop() ?? "0", 10) : 0;
  const next = lastNum + 1;
  return `${prefix}-${String(next).padStart(4, "0")}`;
}

// Customers
export async function createCustomer(input: CreateCustomerInput): Promise<CustomerRow> {
  const code = input.code || (await generateCustomerCode(input.companyId));
  const name =
    input.name ||
    (input.firstName || input.lastName
      ? `${input.firstName ?? ""} ${input.lastName ?? ""}`.trim()
      : "Customer");
  return insertCustomer({
    ...input,
    code,
    name,
  });
}

export async function updateCustomerRecord(
  id: string,
  input: UpdateCustomerInput
): Promise<CustomerRow> {
  const existing = await getCustomerById(id);
  if (!existing) throw new Error("Customer not found");
  const name =
    input.name ??
    existing.name ??
    (input.firstName || input.lastName
      ? `${input.firstName ?? existing.first_name ?? ""} ${input.lastName ?? existing.last_name ?? ""}`.trim()
      : undefined);
  return updateCustomer(id, {
    ...existing,
    ...mapCustomerInputToRow(existing.company_id, input),
    name: name ?? existing.name,
  });
}

function mapCustomerInputToRow(companyId: string, input: UpdateCustomerInput): Partial<CustomerRow> {
  return {
    company_id: companyId,
    customer_type: input.customerType ?? undefined,
    code: input.code,
    name: input.name,
    first_name: input.firstName ?? undefined,
    last_name: input.lastName ?? undefined,
    date_of_birth: input.dateOfBirth ?? undefined,
    national_id: input.nationalId ?? undefined,
    passport_no: input.passportNo ?? undefined,
    legal_name: input.legalName ?? undefined,
    trade_license_no: input.tradeLicenseNo ?? undefined,
    tax_number: input.taxNumber ?? undefined,
    email: input.email ?? undefined,
    phone: input.phone ?? undefined,
    phone_alt: input.phoneAlt ?? undefined,
    whatsapp_phone: input.whatsappPhone ?? undefined,
    address: input.address ?? undefined,
    country: input.country ?? undefined,
    city: input.city ?? undefined,
    notes: input.notes ?? undefined,
    is_active: input.isActive ?? (input as any).is_active ?? undefined,
  } as any;
}

export async function getCustomerWithCars(id: string): Promise<CustomerWithCars | null> {
  const customer = await getCustomerById(id);
  if (!customer) return null;
  const links = await listLinksForCustomer(id);
  const cars: CustomerWithCars["cars"] = [];
  for (const link of links) {
    const car = await getCarById(link.car_id);
    if (car) cars.push({ car, link });
  }
  return { ...customer, cars };
}

export async function listCustomersWithSummary(
  companyId: string
): Promise<(CustomerRow & { carCount: number })[]> {
  const customers = await listCustomers(companyId);
  const sql = getSql();
  const counts = await sql<{ customer_id: string; cnt: number }[]>`
    SELECT customer_id, COUNT(*) as cnt
    FROM customer_car_links
    WHERE company_id = ${companyId}
    GROUP BY customer_id
  `;
  const map: Record<string, number> = {};
  for (const row of rowsFrom(counts)) {
    map[row.customer_id] = Number(row.cnt);
  }
  return customers.map((c) => ({ ...c, carCount: map[c.id] ?? 0 }));
}

// Cars
export async function createCar(input: CreateCarInput): Promise<CarRow> {
  const code = input.code || (await generateCarCode(input.companyId));
  const hasPlate = !!input.plateNumber;
  const plate_number = hasPlate ? input.plateNumber! : await generateNoPlate(input.companyId);
  const is_unregistered = !hasPlate;
  return insertCar({
    ...input,
    code,
    plate_number,
    is_unregistered,
  });
}

export async function updateCarRecord(id: string, input: UpdateCarInput): Promise<CarRow> {
  const existing = await getCarById(id);
  if (!existing) throw new Error("Car not found");
  let plate_number = existing.plate_number;
  let is_unregistered = existing.is_unregistered;
  if (input.plateNumber && existing.is_unregistered) {
    plate_number = input.plateNumber;
    is_unregistered = false;
  } else if (input.plateNumber != null) {
    plate_number = input.plateNumber;
  }
  return updateCar(id, {
    ...existing,
    ...mapCarInputToRow(existing.company_id, input),
    plate_number,
    is_unregistered,
  });
}

function mapCarInputToRow(companyId: string, input: UpdateCarInput): Partial<CarRow> {
  return {
    company_id: companyId,
    code: input.code,
    plate_code: input.plateCode ?? undefined,
    plate_country: input.plateCountry ?? undefined,
    plate_state: input.plateState ?? undefined,
    plate_city: input.plateCity ?? undefined,
    plate_location_mode: input.plateLocationMode ?? undefined,
    plate_number: input.plateNumber ?? undefined,
    vin: input.vin ?? undefined,
    make: input.make ?? undefined,
    model: input.model ?? undefined,
    model_year: input.modelYear ?? undefined,
    color: input.color ?? undefined,
    body_type: input.bodyType ?? undefined,
    is_insurance: input.isInsurance ?? undefined,
    mileage: input.mileage ?? undefined,
    tyre_size_front: input.tyreSizeFront ?? undefined,
    tyre_size_back: input.tyreSizeBack ?? undefined,
    registration_expiry: input.registrationExpiry ?? undefined,
    registration_card_file_id: input.registrationCardFileId ?? undefined,
    vin_photo_file_id: input.vinPhotoFileId ?? undefined,
    notes: input.notes ?? undefined,
  } as any;
}

export async function getCarWithCustomers(id: string): Promise<CarWithCustomers | null> {
  const car = await getCarById(id);
  if (!car) return null;
  const links = await listLinksForCar(id);
  const customers: CarWithCustomers["customers"] = [];
  for (const link of links) {
    const cust = await getCustomerById(link.customer_id);
    if (cust) customers.push({ customer: cust, link });
  }
  return { ...car, customers };
}

export async function listCarsWithSummary(
  companyId: string
): Promise<(CarRow & { customerCount: number })[]> {
  const cars = await listCars(companyId);
  const sql = getSql();
  const counts = await sql<{ car_id: string; cnt: number }[]>`
    SELECT car_id, COUNT(*) as cnt
    FROM customer_car_links
    WHERE company_id = ${companyId}
    GROUP BY car_id
  `;
  const map: Record<string, number> = {};
  for (const row of rowsFrom(counts)) {
    map[row.car_id] = Number(row.cnt);
  }
  return cars.map((c) => ({ ...c, customerCount: map[c.id] ?? 0 }));
}

// Linking
export async function linkCustomerToCar(input: LinkCustomerToCarInput): Promise<CustomerCarLinkRow> {
  const customer = await getCustomerById(input.customerId);
  const car = await getCarById(input.carId);
  if (!customer || !car) throw new Error("Customer or car not found");
  if (customer.company_id !== input.companyId || car.company_id !== input.companyId) {
    throw new Error("Customer and car must belong to the same company");
  }

  // Reactivate existing link if it was archived
  const existingLink = await getLinkByCustomerCarRelation(input.customerId, input.carId, input.relationType);
  if (existingLink) {
    const shouldActivate = existingLink.is_active === false;
    const priority =
      input.priority ??
      existingLink.priority ??
      (await getMaxPriorityForRelation(input.companyId, input.customerId, input.relationType)) + 1;
    if (input.isPrimary) {
      await clearPrimaryForRelation(input.companyId, input.customerId, input.relationType);
    }
    const updated = await updateLink(existingLink.id, {
      relation_type: input.relationType,
      priority,
      is_primary: input.isPrimary ?? existingLink.is_primary,
      notes: input.notes ?? existingLink.notes,
      is_active: true,
    });
    return updated;
  }

  if (input.isPrimary) {
    await clearPrimaryForRelation(input.companyId, input.customerId, input.relationType);
  }
  const priority =
    input.priority ??
    (await getMaxPriorityForRelation(input.companyId, input.customerId, input.relationType)) + 1;

  return insertLink({
    companyId: input.companyId,
    customerId: input.customerId,
    carId: input.carId,
    relationType: input.relationType,
    priority,
    isPrimary: input.isPrimary ?? false,
    notes: input.notes ?? null,
  });
}

export async function updateCustomerCarLink(
  id: string,
  patch: { relationType?: CustomerCarRelationType; priority?: number; isPrimary?: boolean; notes?: string | null; isActive?: boolean }
): Promise<CustomerCarLinkRow> {
  const existing = await getLinkById(id);
  if (!existing) throw new Error("Link not found");
  const newRelation = patch.relationType ?? (existing.relation_type as CustomerCarRelationType);
  if (patch.isPrimary) {
    await clearPrimaryForRelation(existing.company_id, existing.customer_id, newRelation);
  }
  return updateLink(id, {
    relation_type: newRelation,
    priority: patch.priority ?? existing.priority,
    is_primary: patch.isPrimary ?? existing.is_primary,
    notes: patch.notes ?? existing.notes,
    is_active: patch.isActive ?? existing.is_active,
  });
}

export async function unlinkCustomerFromCar(linkId: string): Promise<void> {
  // Soft-delete so we can show historical cars
  await updateCustomerCarLink(linkId, { isActive: false });
}

export async function listCustomersForGlobal(companyId: string): Promise<CustomerRow[]> {
  return repoListCustomers(companyId);
}

export async function listCarsForGlobal(companyId: string): Promise<CarRow[]> {
  return repoListCars(companyId);
}

export async function listCustomers(companyId: string, opts?: { search?: string; activeOnly?: boolean }) {
  return repoListCustomers(companyId, opts);
}

export async function listCars(companyId: string, opts?: { search?: string; activeOnly?: boolean }) {
  return repoListCars(companyId, opts);
}

export async function deactivateCustomer(id: string): Promise<void> {
  await repoDeactivateCustomer(id);
}

export async function deactivateCar(id: string): Promise<void> {
  await repoDeactivateCar(id);
}

// Wallet
export async function createCustomerWalletTopup(
  input: CreateCustomerWalletTransactionInput
): Promise<CustomerWalletTransactionRow> {
  return insertCustomerWalletTransaction(input);
}

export async function approveCustomerWalletTopup(
  id: string,
  approvedBy: string | null
): Promise<CustomerWalletTransactionRow> {
  const existing = await getCustomerWalletTransactionById(id);
  if (!existing) throw new Error("Wallet transaction not found");
  if (existing.approved_at) return existing;
  const approved = await repoApproveCustomerWalletTransaction(id, approvedBy);
  await updateCustomerWalletAmount(approved.company_id, approved.customer_id, Number(approved.amount));
  return approved;
}

export async function listCustomerWalletTopups(companyId: string, customerId: string, approvedOnly = false) {
  return listCustomerWalletTransactions(companyId, customerId, { approvedOnly });
}

export async function listCompanyWalletTopups(
  companyId: string,
  approvedOnly = false
): Promise<CustomerWalletTransactionWithCustomer[]> {
  return repoListCompanyWalletTransactions(companyId, { approvedOnly });
}

export async function getCustomerWalletSummary(companyId: string, customerId: string) {
  const customer = await getCustomerById(customerId);
  if (!customer || customer.company_id !== companyId) return { balance: 0 };
  return { balance: Number((customer as any).wallet_amount ?? 0) };
}

export async function getCustomerWalletTransaction(id: string) {
  return getCustomerWalletTransactionById(id);
}

// Helpers
async function getLinkById(id: string) {
  const sql = getSql();
  const res = await sql<any[]>`
    SELECT * FROM customer_car_links WHERE id = ${id} LIMIT 1
  `;
  return rowsFrom(res)[0];
}

function rowsFrom<T>(result: T[] | { rows: T[] }): T[] {
  return (result as any).rows ?? (result as any);
}
