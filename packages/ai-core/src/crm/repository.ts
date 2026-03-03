import { getSql } from "../db";
import type {
  CarRow,
  CreateCarInput,
  CreateCustomerInput,
  CreateCustomerWalletTransactionInput,
  CustomerCarLinkRow,
  CustomerCarRelationType,
  CustomerRow,
  CustomerWalletTransactionRow,
  CustomerWalletTransactionWithCustomer,
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

export async function countCustomers(
  companyId: string,
  opts?: { search?: string; activeOnly?: boolean; status?: "active" | "archived" | "all" }
): Promise<number> {
  const sql = getSql();
  const rawSearch = opts?.search?.trim();
  const search = rawSearch ? `%${rawSearch}%` : null;
  const status = opts?.status ?? (opts?.activeOnly ? "active" : "all");
  const statusFilterSql =
    status === "active"
      ? sql`AND is_active = TRUE`
      : status === "archived"
        ? sql`AND is_active = FALSE`
        : sql``;
  const filterSql = search
    ? sql`
      AND (
        code ILIKE ${search} OR
        name ILIKE ${search} OR
        email ILIKE ${search} OR
        phone ILIKE ${search}
      )`
    : sql``;

  const res = await sql<{ cnt: number | string }[]>`
    SELECT COUNT(*)::bigint AS cnt
    FROM customers
    WHERE company_id = ${companyId}
      ${statusFilterSql}
      ${filterSql}
  `;
  const row = rowsFrom(res)[0] as { cnt: number | string } | undefined;
  return Number(row?.cnt ?? 0);
}

export async function listCustomersPageWithSummary(
  companyId: string,
  opts?: {
    search?: string;
    activeOnly?: boolean;
    status?: "active" | "archived" | "all";
    sortBy?: "created_at" | "name" | "code" | "phone" | "email";
    sortDir?: "asc" | "desc";
    limit?: number;
    offset?: number;
  }
): Promise<(CustomerRow & { carCount: number })[]> {
  const sql = getSql();
  const rawSearch = opts?.search?.trim();
  const search = rawSearch ? `%${rawSearch}%` : null;
  const status = opts?.status ?? (opts?.activeOnly ? "active" : "all");
  const statusFilterSql =
    status === "active"
      ? sql`AND is_active = TRUE`
      : status === "archived"
        ? sql`AND is_active = FALSE`
        : sql``;
  const filterSql = search
    ? sql`
      AND (
        code ILIKE ${search} OR
        name ILIKE ${search} OR
        email ILIKE ${search} OR
        phone ILIKE ${search}
      )`
    : sql``;

  const safeLimit = Math.max(1, Math.min(opts?.limit ?? 50, 500000));
  const safeOffset = Math.max(0, opts?.offset ?? 0);
  const sortBy = opts?.sortBy ?? "created_at";
  const sortDir = opts?.sortDir === "asc" ? "asc" : "desc";
  const sortDirSql = sortDir === "asc" ? sql`ASC` : sql`DESC`;
  const orderSqlPaged =
    sortBy === "name"
      ? sql`ORDER BY name ${sortDirSql}, id ${sortDirSql}`
      : sortBy === "code"
        ? sql`ORDER BY code ${sortDirSql}, id ${sortDirSql}`
        : sortBy === "phone"
          ? sql`ORDER BY phone ${sortDirSql}, id ${sortDirSql}`
          : sortBy === "email"
            ? sql`ORDER BY email ${sortDirSql}, id ${sortDirSql}`
            : sql`ORDER BY created_at ${sortDirSql}, id ${sortDirSql}`;
  const orderSqlFinal =
    sortBy === "name"
      ? sql`ORDER BY p.name ${sortDirSql}, p.id ${sortDirSql}`
      : sortBy === "code"
        ? sql`ORDER BY p.code ${sortDirSql}, p.id ${sortDirSql}`
        : sortBy === "phone"
          ? sql`ORDER BY p.phone ${sortDirSql}, p.id ${sortDirSql}`
          : sortBy === "email"
            ? sql`ORDER BY p.email ${sortDirSql}, p.id ${sortDirSql}`
            : sql`ORDER BY p.created_at ${sortDirSql}, p.id ${sortDirSql}`;

  const res = await sql<(CustomerRow & { carCount: number })[]>`
    WITH paged AS (
      SELECT *
      FROM customers
      WHERE company_id = ${companyId}
        ${statusFilterSql}
        ${filterSql}
      ${orderSqlPaged}
      LIMIT ${safeLimit}
      OFFSET ${safeOffset}
    ),
    car_counts AS (
      SELECT l.customer_id, COUNT(*)::int AS cnt
      FROM customer_car_links l
      JOIN paged p ON p.id = l.customer_id
      WHERE l.company_id = ${companyId}
        AND l.is_active = TRUE
      GROUP BY l.customer_id
    )
    SELECT
      p.*,
      COALESCE(cc.cnt, 0)::int AS "carCount"
    FROM paged p
    LEFT JOIN car_counts cc ON cc.customer_id = p.id
    ${orderSqlFinal}
  `;

  return rowsFrom(res);
}

export async function insertCustomer(data: { code: string } & CreateCustomerInput): Promise<CustomerRow> {
  const sql = getSql();
  const res = await sql<CustomerRow[]>`
    INSERT INTO customers (
      company_id, customer_type, code, name, first_name, last_name, date_of_birth, national_id, passport_no,
      legal_name, trade_license_no, tax_number, email, phone, phone_alt, whatsapp_phone, address, country, city, google_location, notes, is_active
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
      ${data.country ?? null},
      ${data.city ?? null},
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
      country = COALESCE(${(patch as any).country ?? null}, country),
      city = COALESCE(${(patch as any).city ?? null}, city),
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

export async function countCars(
  companyId: string,
  opts?: { search?: string; activeOnly?: boolean; status?: "active" | "archived" | "all" }
): Promise<number> {
  const sql = getSql();
  const rawSearch = opts?.search?.trim();
  const search = rawSearch ? `%${rawSearch}%` : null;
  const status = opts?.status ?? (opts?.activeOnly ? "active" : "all");
  const statusFilterSql =
    status === "active"
      ? sql`AND is_active = TRUE`
      : status === "archived"
        ? sql`AND is_active = FALSE`
        : sql``;
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

  const res = await sql<{ cnt: number | string }[]>`
    SELECT COUNT(*)::bigint AS cnt
    FROM cars
    WHERE company_id = ${companyId}
      ${statusFilterSql}
      ${filterSql}
  `;
  const row = rowsFrom(res)[0] as { cnt: number | string } | undefined;
  return Number(row?.cnt ?? 0);
}

export async function listCarsPageWithSummary(
  companyId: string,
  opts?: {
    search?: string;
    activeOnly?: boolean;
    status?: "active" | "archived" | "all";
    sortBy?: "created_at" | "plate_number" | "vin" | "make" | "model_year" | "code";
    sortDir?: "asc" | "desc";
    limit?: number;
    offset?: number;
  }
): Promise<(CarRow & { customerCount: number })[]> {
  const sql = getSql();
  const rawSearch = opts?.search?.trim();
  const search = rawSearch ? `%${rawSearch}%` : null;
  const status = opts?.status ?? (opts?.activeOnly ? "active" : "all");
  const statusFilterSql =
    status === "active"
      ? sql`AND is_active = TRUE`
      : status === "archived"
        ? sql`AND is_active = FALSE`
        : sql``;
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

  const safeLimit = Math.max(1, Math.min(opts?.limit ?? 50, 500000));
  const safeOffset = Math.max(0, opts?.offset ?? 0);
  const sortBy = opts?.sortBy ?? "created_at";
  const sortDir = opts?.sortDir === "asc" ? "asc" : "desc";
  const sortDirSql = sortDir === "asc" ? sql`ASC` : sql`DESC`;
  const orderSqlPaged =
    sortBy === "plate_number"
      ? sql`ORDER BY plate_number ${sortDirSql}, id ${sortDirSql}`
      : sortBy === "vin"
        ? sql`ORDER BY vin ${sortDirSql}, id ${sortDirSql}`
        : sortBy === "make"
          ? sql`ORDER BY make ${sortDirSql}, model ${sortDirSql}, id ${sortDirSql}`
          : sortBy === "model_year"
            ? sql`ORDER BY model_year ${sortDirSql}, id ${sortDirSql}`
            : sortBy === "code"
              ? sql`ORDER BY code ${sortDirSql}, id ${sortDirSql}`
              : sql`ORDER BY created_at ${sortDirSql}, id ${sortDirSql}`;
  const orderSqlFinal =
    sortBy === "plate_number"
      ? sql`ORDER BY p.plate_number ${sortDirSql}, p.id ${sortDirSql}`
      : sortBy === "vin"
        ? sql`ORDER BY p.vin ${sortDirSql}, p.id ${sortDirSql}`
        : sortBy === "make"
          ? sql`ORDER BY p.make ${sortDirSql}, p.model ${sortDirSql}, p.id ${sortDirSql}`
          : sortBy === "model_year"
            ? sql`ORDER BY p.model_year ${sortDirSql}, p.id ${sortDirSql}`
            : sortBy === "code"
              ? sql`ORDER BY p.code ${sortDirSql}, p.id ${sortDirSql}`
              : sql`ORDER BY p.created_at ${sortDirSql}, p.id ${sortDirSql}`;

  const res = await sql<(CarRow & { customerCount: number })[]>`
    WITH paged AS (
      SELECT *
      FROM cars
      WHERE company_id = ${companyId}
        ${statusFilterSql}
        ${filterSql}
      ${orderSqlPaged}
      LIMIT ${safeLimit}
      OFFSET ${safeOffset}
    ),
    customer_counts AS (
      SELECT l.car_id, COUNT(*)::int AS cnt
      FROM customer_car_links l
      JOIN paged p ON p.id = l.car_id
      WHERE l.company_id = ${companyId}
        AND l.is_active = TRUE
      GROUP BY l.car_id
    )
    SELECT
      p.*,
      COALESCE(cc.cnt, 0)::int AS "customerCount"
    FROM paged p
    LEFT JOIN customer_counts cc ON cc.car_id = p.id
    ${orderSqlFinal}
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
      vin, make, model, model_year, color, body_type, is_insurance,
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
      ${data.isInsurance ?? false},
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
      is_insurance = COALESCE(${(patch as any).is_insurance ?? null}, is_insurance),
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

export async function updateCustomerWalletAmount(
  companyId: string,
  customerId: string,
  delta: number
): Promise<number> {
  const sql = getSql();
  const res = await sql<{ wallet_amount: number }[]>`
    UPDATE customers
    SET wallet_amount = COALESCE(wallet_amount, 0) + ${delta},
        updated_at = NOW()
    WHERE company_id = ${companyId}
      AND id = ${customerId}
    RETURNING wallet_amount
  `;
  const row = rowsFrom(res)[0];
  return Number(row?.wallet_amount ?? 0);
}

// Wallet transactions
export async function insertCustomerWalletTransaction(
  data: CreateCustomerWalletTransactionInput
): Promise<CustomerWalletTransactionRow> {
  const sql = getSql();
  const res = await sql<CustomerWalletTransactionRow[]>`
    INSERT INTO customer_wallet_transactions (
      company_id,
      customer_id,
      amount,
      payment_method,
      payment_date,
      payment_proof_file_id,
      approved_at,
      approved_by,
      notes
    ) VALUES (
      ${data.companyId},
      ${data.customerId},
      ${data.amount},
      ${data.paymentMethod ?? null},
      ${data.paymentDate ?? null},
      ${data.paymentProofFileId ?? null},
      NULL,
      NULL,
      ${data.notes ?? null}
    )
    RETURNING *
  `;
  return rowsFrom(res)[0] as CustomerWalletTransactionRow;
}

export async function listCustomerWalletTransactions(
  companyId: string,
  customerId: string,
  opts?: { approvedOnly?: boolean }
): Promise<CustomerWalletTransactionWithCustomer[]> {
  const sql = getSql();
  const approvedFilter = opts?.approvedOnly ? sql`AND approved_at IS NOT NULL` : sql``;
  const res = await sql<CustomerWalletTransactionWithCustomer[]>`
    SELECT
      t.*,
      COALESCE(
        NULLIF(u.full_name, ''),
        NULLIF(e.full_name, ''),
        NULLIF(b.display_name, ''),
        NULLIF(b.name, ''),
        NULLIF(u.email, '')
      ) AS approved_by_name
    FROM customer_wallet_transactions t
    LEFT JOIN users u ON u.id = t.approved_by
    LEFT JOIN employees e ON e.id = u.employee_id
    LEFT JOIN branches b ON b.id = COALESCE(u.branch_id, e.branch_id)
    WHERE t.company_id = ${companyId}
      AND t.customer_id = ${customerId}
      ${approvedFilter}
    ORDER BY t.created_at DESC
  `;
  return rowsFrom(res);
}

export async function listCompanyWalletTransactions(
  companyId: string,
  opts?: { approvedOnly?: boolean }
): Promise<CustomerWalletTransactionWithCustomer[]> {
  const sql = getSql();
  const approvedFilter = opts?.approvedOnly ? sql`AND t.approved_at IS NOT NULL` : sql``;
  const res = await sql<CustomerWalletTransactionWithCustomer[]>`
    SELECT
      t.*,
      c.name AS customer_name,
      c.phone AS customer_phone,
      c.email AS customer_email,
      COALESCE(
        NULLIF(u.full_name, ''),
        NULLIF(e.full_name, ''),
        NULLIF(b.display_name, ''),
        NULLIF(b.name, ''),
        NULLIF(u.email, '')
      ) AS approved_by_name
    FROM customer_wallet_transactions t
    JOIN customers c ON c.id = t.customer_id
    LEFT JOIN users u ON u.id = t.approved_by
    LEFT JOIN employees e ON e.id = u.employee_id
    LEFT JOIN branches b ON b.id = COALESCE(u.branch_id, e.branch_id)
    WHERE t.company_id = ${companyId}
      ${approvedFilter}
    ORDER BY t.created_at DESC
  `;
  return rowsFrom(res);
}

export async function listCompanyWalletTransactionsPaged(
  companyId: string,
  opts?: {
    approvalState?: "all" | "approved" | "unapproved";
    search?: string;
    paymentMethod?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ rows: CustomerWalletTransactionWithCustomer[]; total: number }> {
  const sql = getSql();
  const approvedFilter =
    opts?.approvalState === "approved"
      ? sql`AND t.approved_at IS NOT NULL`
      : opts?.approvalState === "unapproved"
      ? sql`AND t.approved_at IS NULL`
      : sql``;
  const q = (opts?.search ?? "").trim();
  const searchFilter = q
    ? sql`AND (
      c.name ILIKE ${`%${q}%`}
      OR c.phone ILIKE ${`%${q}%`}
      OR c.email ILIKE ${`%${q}%`}
      OR coalesce(t.payment_method, '') ILIKE ${`%${q}%`}
      OR coalesce(t.notes, '') ILIKE ${`%${q}%`}
    )`
    : sql``;
  const paymentMethodFilter =
    opts?.paymentMethod && opts.paymentMethod !== "all"
      ? sql`AND lower(coalesce(t.payment_method, 'unknown')) = lower(${opts.paymentMethod})`
      : sql``;
  const limit = Math.max(1, Math.min(Number(opts?.limit ?? 25), 500));
  const offset = Math.max(0, Number(opts?.offset ?? 0));

  const countRes = await sql<{ total: number }[]>`
    SELECT COUNT(*)::int AS total
    FROM customer_wallet_transactions t
    JOIN customers c ON c.id = t.customer_id
    WHERE t.company_id = ${companyId}
      ${approvedFilter}
      ${searchFilter}
      ${paymentMethodFilter}
  `;
  const total = Number(rowsFrom(countRes)[0]?.total ?? 0);

  const dataRes = await sql<CustomerWalletTransactionWithCustomer[]>`
    SELECT
      t.*,
      c.name AS customer_name,
      c.phone AS customer_phone,
      c.email AS customer_email,
      COALESCE(
        NULLIF(u.full_name, ''),
        NULLIF(e.full_name, ''),
        NULLIF(b.display_name, ''),
        NULLIF(b.name, ''),
        NULLIF(u.email, '')
      ) AS approved_by_name
    FROM customer_wallet_transactions t
    JOIN customers c ON c.id = t.customer_id
    LEFT JOIN users u ON u.id = t.approved_by
    LEFT JOIN employees e ON e.id = u.employee_id
    LEFT JOIN branches b ON b.id = COALESCE(u.branch_id, e.branch_id)
    WHERE t.company_id = ${companyId}
      ${approvedFilter}
      ${searchFilter}
      ${paymentMethodFilter}
    ORDER BY t.created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;
  return { rows: rowsFrom(dataRes), total };
}

export async function getCustomerWalletTransactionById(
  id: string
): Promise<CustomerWalletTransactionRow | null> {
  const sql = getSql();
  const res = await sql<CustomerWalletTransactionRow[]>`
    SELECT *
    FROM customer_wallet_transactions
    WHERE id = ${id}
    LIMIT 1
  `;
  const row = rowsFrom(res)[0] as CustomerWalletTransactionRow | undefined;
  return row ?? null;
}

export async function approveCustomerWalletTransaction(
  id: string,
  approvedBy: string | null
): Promise<CustomerWalletTransactionRow> {
  const sql = getSql();
  const res = await sql<CustomerWalletTransactionRow[]>`
    UPDATE customer_wallet_transactions
    SET
      approved_at = NOW(),
      approved_by = ${approvedBy ?? null},
      updated_at = NOW()
    WHERE id = ${id}
      AND approved_at IS NULL
    RETURNING *
  `;
  const row = rowsFrom(res)[0] as CustomerWalletTransactionRow | undefined;
  if (!row) throw new Error(`Wallet transaction not found or already approved for id=${id}`);
  return row;
}

export async function getCustomerWalletBalance(
  companyId: string,
  customerId: string
): Promise<number> {
  const sql = getSql();
  const res = await sql<{ total: number | null }[]>`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM customer_wallet_transactions
    WHERE company_id = ${companyId}
      AND customer_id = ${customerId}
      AND approved_at IS NOT NULL
  `;
  const row = rowsFrom(res)[0];
  return Number(row?.total ?? 0);
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
