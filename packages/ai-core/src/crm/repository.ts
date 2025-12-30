import { getSql } from "../db";
import type {
  CarRow,
  CreateCarInput,
  CreateCustomerInput,
  CustomerCarLinkRow,
  CustomerCarRelationType,
  CustomerRow,
} from "./types";

function rowsFrom<T>(result: T[] | { rows: T[] }): T[] {
  return (result as any).rows ?? (result as any);
}

// Customers
export async function getCustomerById(id: string): Promise<CustomerRow | null> {
  const sql = getSql();
  const res = await sql<CustomerRow[]>`
    SELECT * FROM customers WHERE id = ${id} LIMIT 1
  `;
  const row = rowsFrom(res)[0] as CustomerRow | undefined;
  return row ?? null;
}

export async function getCustomerByCode(companyId: string, code: string): Promise<CustomerRow | null> {
  const sql = getSql();
  const res = await sql<CustomerRow[]>`
    SELECT * FROM customers WHERE company_id = ${companyId} AND code = ${code} LIMIT 1
  `;
  const row = rowsFrom(res)[0] as CustomerRow | undefined;
  return row ?? null;
}

export async function listCustomers(
  companyId: string,
  opts?: { search?: string; activeOnly?: boolean }
): Promise<CustomerRow[]> {
  const sql = getSql();
  const search = opts?.search ? `%${opts.search}%` : null;
  const filterSql = search
    ? sql`
      AND (
        code ILIKE ${search} OR
        name ILIKE ${search} OR
        email ILIKE ${search} OR
        phone ILIKE ${search}
      )`
    : sql``;

  const res = await sql<CustomerRow[]>`
    SELECT *
    FROM customers
    WHERE company_id = ${companyId}
      AND (${opts?.activeOnly ?? false} = FALSE OR is_active = TRUE)
      ${filterSql}
    ORDER BY created_at DESC
  `;
  return rowsFrom(res);
}

export async function insertCustomer(data: { code: string } & CreateCustomerInput): Promise<CustomerRow> {
  const sql = getSql();
  const res = await sql<CustomerRow[]>`
    INSERT INTO customers (
      company_id, customer_type, code, name, first_name, last_name, date_of_birth, national_id, passport_no,
      legal_name, trade_license_no, tax_number, email, phone, phone_alt, whatsapp_phone, address, google_location, notes, is_active
    ) VALUES (
      ${data.companyId},
      ${data.customerType},
      ${data.code},
      ${data.name},
      ${data.firstName ?? null},
      ${data.lastName ?? null},
      ${data.dateOfBirth ?? null},
      ${data.nationalId ?? null},
      ${data.passportNo ?? null},
      ${data.legalName ?? null},
      ${data.tradeLicenseNo ?? null},
      ${data.taxNumber ?? null},
      ${data.email ?? null},
      ${data.phone ?? null},
      ${data.phoneAlt ?? null},
      ${data.whatsappPhone ?? null},
      ${data.address ?? null},
      ${data.googleLocation ?? null},
      ${data.notes ?? null},
      TRUE
    )
    RETURNING *
  `;
  return rowsFrom(res)[0] as CustomerRow;
}

export async function updateCustomer(
  id: string,
  patch: Partial<CustomerRow>
): Promise<CustomerRow> {
  const sql = getSql();
  const res = await sql<CustomerRow[]>`
    UPDATE customers
    SET
      customer_type = COALESCE(${patch.customer_type ?? null}, customer_type),
      code = COALESCE(${patch.code ?? null}, code),
      name = COALESCE(${patch.name ?? null}, name),
      first_name = COALESCE(${patch.first_name ?? null}, first_name),
      last_name = COALESCE(${patch.last_name ?? null}, last_name),
      date_of_birth = COALESCE(${patch.date_of_birth ?? null}, date_of_birth),
      national_id = COALESCE(${patch.national_id ?? null}, national_id),
      passport_no = COALESCE(${patch.passport_no ?? null}, passport_no),
      legal_name = COALESCE(${patch.legal_name ?? null}, legal_name),
      trade_license_no = COALESCE(${patch.trade_license_no ?? null}, trade_license_no),
      tax_number = COALESCE(${patch.tax_number ?? null}, tax_number),
      email = COALESCE(${patch.email ?? null}, email),
      phone = COALESCE(${patch.phone ?? null}, phone),
      phone_alt = COALESCE(${patch.phone_alt ?? null}, phone_alt),
      whatsapp_phone = COALESCE(${patch.whatsapp_phone ?? null}, whatsapp_phone),
      address = COALESCE(${patch.address ?? null}, address),
      google_location = COALESCE(${patch.google_location ?? null}, google_location),
      notes = COALESCE(${patch.notes ?? null}, notes),
      is_active = COALESCE(${patch.is_active ?? null}, is_active),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  const row = rowsFrom(res)[0] as CustomerRow | undefined;
  if (!row) throw new Error(`Customer not found for id=${id}`);
  return row;
}

export async function deactivateCustomer(id: string): Promise<void> {
  const sql = getSql();
  await sql`UPDATE customers SET is_active = FALSE, updated_at = NOW() WHERE id = ${id}`;
}

// Cars
export async function getCarById(id: string): Promise<CarRow | null> {
  const sql = getSql();
  const res = await sql<CarRow[]>`
    SELECT * FROM cars WHERE id = ${id} LIMIT 1
  `;
  const row = rowsFrom(res)[0] as CarRow | undefined;
  return row ?? null;
}

export async function getCarByCode(companyId: string, code: string): Promise<CarRow | null> {
  const sql = getSql();
  const res = await sql<CarRow[]>`
    SELECT * FROM cars WHERE company_id = ${companyId} AND code = ${code} LIMIT 1
  `;
  const row = rowsFrom(res)[0] as CarRow | undefined;
  return row ?? null;
}

export async function listCars(
  companyId: string,
  opts?: { search?: string; activeOnly?: boolean }
): Promise<CarRow[]> {
  const sql = getSql();
  const search = opts?.search ? `%${opts.search}%` : null;
  const filterSql = search
    ? sql`
      AND (
        code ILIKE ${search} OR
        plate_number ILIKE ${search} OR
        vin ILIKE ${search} OR
        make ILIKE ${search} OR
        model ILIKE ${search}
      )`
    : sql``;
  const res = await sql<CarRow[]>`
    SELECT *
    FROM cars
    WHERE company_id = ${companyId}
      AND (${opts?.activeOnly ?? false} = FALSE OR is_active = TRUE)
      ${filterSql}
    ORDER BY created_at DESC
  `;
  return rowsFrom(res);
}

export async function insertCar(data: {
  companyId: string;
  code: string;
  plate_code?: string | null;
  plate_country?: string | null;
  plate_state?: string | null;
  plate_city?: string | null;
  plate_location_mode?: "state" | "city" | "both" | null;
  plate_number: string;
  is_unregistered: boolean;
} & CreateCarInput): Promise<CarRow> {
  const sql = getSql();
  const res = await sql<CarRow[]>`
    INSERT INTO cars (
      company_id, code, plate_code, plate_number, plate_country, plate_state, plate_city, plate_location_mode,
      vin, make, model, model_year, color, body_type,
      mileage, tyre_size_front, tyre_size_back, registration_expiry, registration_card_file_id, vin_photo_file_id,
      is_unregistered, notes, is_active
    ) VALUES (
      ${data.companyId},
      ${data.code},
      ${data.plate_code ?? null},
      ${data.plate_number},
      ${data.plate_country ?? null},
      ${data.plate_state ?? null},
      ${data.plate_city ?? null},
      ${data.plate_location_mode ?? null},
      ${data.vin ?? null},
      ${data.make ?? null},
      ${data.model ?? null},
      ${data.modelYear ?? null},
      ${data.color ?? null},
      ${data.bodyType ?? null},
      ${data.mileage ?? null},
      ${data.tyreSizeFront ?? null},
      ${data.tyreSizeBack ?? null},
      ${data.registrationExpiry ?? null},
      ${data.registrationCardFileId ?? null},
      ${data.vinPhotoFileId ?? null},
      ${data.is_unregistered},
      ${data.notes ?? null},
      TRUE
    )
    RETURNING *
  `;
  return rowsFrom(res)[0] as CarRow;
}

export async function updateCar(id: string, patch: Partial<CarRow>): Promise<CarRow> {
  const sql = getSql();
  const res = await sql<CarRow[]>`
    UPDATE cars
    SET
      code = COALESCE(${patch.code ?? null}, code),
      plate_code = COALESCE(${patch.plate_code ?? null}, plate_code),
      plate_number = COALESCE(${patch.plate_number ?? null}, plate_number),
      plate_country = COALESCE(${patch.plate_country ?? null}, plate_country),
      plate_state = COALESCE(${patch.plate_state ?? null}, plate_state),
      plate_city = COALESCE(${patch.plate_city ?? null}, plate_city),
      plate_location_mode = COALESCE(${patch.plate_location_mode ?? null}, plate_location_mode),
      vin = COALESCE(${patch.vin ?? null}, vin),
      make = COALESCE(${patch.make ?? null}, make),
      model = COALESCE(${patch.model ?? null}, model),
      model_year = COALESCE(${patch.model_year ?? null}, model_year),
      color = COALESCE(${patch.color ?? null}, color),
      body_type = COALESCE(${patch.body_type ?? null}, body_type),
      mileage = COALESCE(${patch.mileage ?? null}, mileage),
      tyre_size_front = COALESCE(${patch.tyre_size_front ?? null}, tyre_size_front),
      tyre_size_back = COALESCE(${patch.tyre_size_back ?? null}, tyre_size_back),
      registration_expiry = COALESCE(${patch.registration_expiry ?? null}, registration_expiry),
      registration_card_file_id = COALESCE(${patch.registration_card_file_id ?? null}, registration_card_file_id),
      vin_photo_file_id = COALESCE(${patch.vin_photo_file_id ?? null}, vin_photo_file_id),
      is_unregistered = COALESCE(${patch.is_unregistered ?? null}, is_unregistered),
      notes = COALESCE(${patch.notes ?? null}, notes),
      is_active = COALESCE(${patch.is_active ?? null}, is_active),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  const row = rowsFrom(res)[0] as CarRow | undefined;
  if (!row) throw new Error(`Car not found for id=${id}`);
  return row;
}

export async function deactivateCar(id: string): Promise<void> {
  const sql = getSql();
  await sql`UPDATE cars SET is_active = FALSE, updated_at = NOW() WHERE id = ${id}`;
}

// Links
export async function listLinksForCustomer(customerId: string): Promise<CustomerCarLinkRow[]> {
  const sql = getSql();
  const res = await sql<CustomerCarLinkRow[]>`
    SELECT * FROM customer_car_links
    WHERE customer_id = ${customerId}
    ORDER BY priority, created_at
  `;
  return rowsFrom(res);
}

export async function listLinksForCar(carId: string): Promise<CustomerCarLinkRow[]> {
  const sql = getSql();
  const res = await sql<CustomerCarLinkRow[]>`
    SELECT * FROM customer_car_links
    WHERE car_id = ${carId}
    ORDER BY priority, created_at
  `;
  return rowsFrom(res);
}

export async function insertLink(data: {
  companyId: string;
  customerId: string;
  carId: string;
  relationType: CustomerCarRelationType;
  priority: number;
  isPrimary: boolean;
  notes?: string | null;
}): Promise<CustomerCarLinkRow> {
  const sql = getSql();
  const res = await sql<CustomerCarLinkRow[]>`
    INSERT INTO customer_car_links (
      company_id, customer_id, car_id, relation_type, priority, is_primary, notes, is_active
    ) VALUES (
      ${data.companyId},
      ${data.customerId},
      ${data.carId},
      ${data.relationType},
      ${data.priority},
      ${data.isPrimary},
      ${data.notes ?? null},
      TRUE
    )
    RETURNING *
  `;
  return rowsFrom(res)[0] as CustomerCarLinkRow;
}

export async function updateLink(
  id: string,
  patch: Partial<CustomerCarLinkRow>
): Promise<CustomerCarLinkRow> {
  const sql = getSql();
  const res = await sql<CustomerCarLinkRow[]>`
    UPDATE customer_car_links
    SET
      relation_type = COALESCE(${patch.relation_type ?? null}, relation_type),
      priority = COALESCE(${patch.priority ?? null}, priority),
      is_primary = COALESCE(${patch.is_primary ?? null}, is_primary),
      notes = COALESCE(${patch.notes ?? null}, notes),
      is_active = COALESCE(${(patch as any).is_active ?? null}, is_active),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  const row = rowsFrom(res)[0] as CustomerCarLinkRow | undefined;
  if (!row) throw new Error(`Link not found for id=${id}`);
  return row;
}

export async function getLinkByCustomerCarRelation(
  customerId: string,
  carId: string,
  relationType: CustomerCarRelationType
): Promise<CustomerCarLinkRow | null> {
  const sql = getSql();
  const res = await sql<CustomerCarLinkRow[]>`
    SELECT *
    FROM customer_car_links
    WHERE customer_id = ${customerId}
      AND car_id = ${carId}
      AND relation_type = ${relationType}
    ORDER BY updated_at DESC
    LIMIT 1
  `;
  const row = rowsFrom(res)[0] as CustomerCarLinkRow | undefined;
  return row ?? null;
}

export async function deleteLink(id: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM customer_car_links WHERE id = ${id}`;
}

export async function clearPrimaryForRelation(
  companyId: string,
  customerId: string,
  relationType: CustomerCarRelationType
): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE customer_car_links
    SET is_primary = FALSE
    WHERE company_id = ${companyId}
      AND customer_id = ${customerId}
      AND relation_type = ${relationType}
  `;
}

export async function getMaxPriorityForRelation(
  companyId: string,
  customerId: string,
  relationType: CustomerCarRelationType
): Promise<number> {
  const sql = getSql();
  const res = await sql<{ max: number | null }[]>`
    SELECT MAX(priority) as max
    FROM customer_car_links
    WHERE company_id = ${companyId}
      AND customer_id = ${customerId}
      AND relation_type = ${relationType}
  `;
  const row = rowsFrom(res)[0];
  return row?.max ?? 0;
}
