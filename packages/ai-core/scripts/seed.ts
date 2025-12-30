/* eslint-disable no-console */
import "dotenv/config";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { getSql } from "../src/db";

/**
 * Seed a minimal demo environment:
 * - Demo company
 * - Global admin user admin@demo.test / Admin@123
 * - Assign global_admin role
 *
 * This script is idempotent: safe to run multiple times.
 * Run manually via: pnpm db:seed
 */
async function main() {
  const sql = getSql();

  let demoCompanyId = randomUUID();
  const demoCompanyCode = "DEMO";

  console.log("Seeding demo company...");
  const [demoCompany] = await sql<{ id: string }[]>`
    INSERT INTO companies (id, display_name, legal_name, code, is_active)
    VALUES (${demoCompanyId}, ${"Demo Garage"}, ${"Demo Garage"}, ${demoCompanyCode}, ${true})
    ON CONFLICT (code) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      legal_name = EXCLUDED.legal_name,
      is_active = EXCLUDED.is_active,
      updated_at = now()
    RETURNING id
  `;
  demoCompanyId = demoCompany?.id ?? demoCompanyId;

  console.log("Seeding demo branches...");
  let branchDowntownId = randomUUID();
  let branchIndustrialId = randomUUID();
  const branches = await sql<{ id: string; code: string }[]>`
    INSERT INTO branches (id, company_id, code, name, city, country, is_active)
    VALUES
      (${branchDowntownId}, ${demoCompanyId}, ${"BR-DWTN"}, ${"Demo Garage - Downtown"}, ${"Dubai"}, ${"AE"}, ${true}),
      (${branchIndustrialId}, ${demoCompanyId}, ${"BR-IND"}, ${"Demo Garage - Industrial"}, ${"Dubai"}, ${"AE"}, ${true})
    ON CONFLICT (company_id, code) DO UPDATE SET
      name = EXCLUDED.name,
      city = EXCLUDED.city,
      country = EXCLUDED.country,
      is_active = EXCLUDED.is_active,
      updated_at = now()
    RETURNING id, code
  `;
  for (const b of branches) {
    if (b.code === "BR-DWTN") branchDowntownId = b.id;
    if (b.code === "BR-IND") branchIndustrialId = b.id;
  }

  console.log("Ensuring global admin user...");
  const passwordHash = await bcrypt.hash("Admin@123", 10);
  let userId = randomUUID();
  const [adminUser] = await sql<{ id: string }[]>`
    INSERT INTO users (id, email, password_hash, full_name, is_active)
    VALUES (${userId}, ${"admin@demo.test"}, ${passwordHash}, ${"Demo Admin"}, ${true})
    ON CONFLICT (email) DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      full_name = EXCLUDED.full_name,
      is_active = EXCLUDED.is_active,
      updated_at = now()
    RETURNING id
  `;
  userId = adminUser?.id ?? userId;

  console.log("Linking user to global_admin role...");
  const [globalRole] = await sql<{ id: string }[]>`
    SELECT id FROM roles WHERE key = 'global_admin' LIMIT 1
  `;
  if (!globalRole) {
    throw new Error(
      "global_admin role not found. Run migrations before seeding."
    );
  }

  await sql`
    INSERT INTO user_roles (user_id, role_id)
    VALUES (${userId}, ${globalRole.id})
    ON CONFLICT DO NOTHING
  `;

  console.log("Seeding company admin role link...");
  const [companyRole] = await sql<{ id: string }[]>`
    SELECT id FROM roles WHERE key = 'company_admin' LIMIT 1
  `;
  let companyAdminUserId = randomUUID();
  const [companyAdminUser] = await sql<{ id: string }[]>`
    INSERT INTO users (id, email, password_hash, full_name, is_active)
    VALUES (${companyAdminUserId}, ${"companyadmin@demo.test"}, ${passwordHash}, ${"Demo Company Admin"}, ${true})
    ON CONFLICT (email) DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      full_name = EXCLUDED.full_name,
      is_active = EXCLUDED.is_active,
      updated_at = now()
    RETURNING id
  `;
  companyAdminUserId = companyAdminUser?.id ?? companyAdminUserId;
  if (companyRole) {
    await sql`
      INSERT INTO user_roles (user_id, role_id)
      VALUES (${companyAdminUserId}, ${companyRole.id})
      ON CONFLICT DO NOTHING
    `;
  }

  console.log("Seeding branch roles (manager/tech/agent) if missing...");
  const roleTuples = [
    { name: "Branch Manager", key: "branch_manager", scope: "branch" },
    { name: "Technician", key: "branch_technician", scope: "branch" },
    { name: "Call Center Agent", key: "branch_agent", scope: "branch" },
  ];
  for (const r of roleTuples) {
    await sql`
      INSERT INTO roles (id, name, key, scope, company_id)
      VALUES (${randomUUID()}, ${r.name}, ${r.key}, ${r.scope}, ${demoCompanyId})
      ON CONFLICT (key) DO NOTHING
    `;
  }

  console.log("Seeding employees...");
  let empManagerId = randomUUID();
  let empTechId = randomUUID();
  let empAgentId = randomUUID();
  const employees = await sql<{ id: string; auto_code: string }[]>`
    INSERT INTO employees (
      id,
      auto_code,
      scope,
      company_id,
      branch_id,
      first_name,
      last_name,
      full_name,
      phone_personal,
      email_company
    )
    VALUES
      (${empManagerId}, ${"EMP-0001"}, ${"branch"}, ${demoCompanyId}, ${branchDowntownId},
       ${"Nora"}, ${"Manager"}, ${"Nora Manager"}, ${"+971500000001"}, ${"nora.manager@demo.test"}),
      (${empTechId}, ${"EMP-0002"}, ${"branch"}, ${demoCompanyId}, ${branchIndustrialId},
       ${"Tariq"}, ${"Tech"}, ${"Tariq Tech"}, ${"+971500000002"}, ${"tariq.tech@demo.test"}),
      (${empAgentId}, ${"EMP-0003"}, ${"branch"}, ${demoCompanyId}, ${branchDowntownId},
       ${"Aisha"}, ${"Agent"}, ${"Aisha Agent"}, ${"+971500000003"}, ${"aisha.agent@demo.test"})
    ON CONFLICT (auto_code) DO UPDATE SET
      scope = EXCLUDED.scope,
      company_id = EXCLUDED.company_id,
      branch_id = EXCLUDED.branch_id,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      full_name = EXCLUDED.full_name,
      phone_personal = EXCLUDED.phone_personal,
      email_company = EXCLUDED.email_company,
      updated_at = now()
    RETURNING id, auto_code
  `;
  for (const e of employees) {
    if (e.auto_code === "EMP-0001") empManagerId = e.id;
    if (e.auto_code === "EMP-0002") empTechId = e.id;
    if (e.auto_code === "EMP-0003") empAgentId = e.id;
  }

  console.log("Seeding branch users linked to employees...");
  const [branchManagerRole] = await sql<{ id: string }[]>`
    SELECT id FROM roles WHERE key = 'branch_manager' LIMIT 1
  `;
  const [branchTechRole] = await sql<{ id: string }[]>`
    SELECT id FROM roles WHERE key = 'branch_technician' LIMIT 1
  `;
  const [branchAgentRole] = await sql<{ id: string }[]>`
    SELECT id FROM roles WHERE key = 'branch_agent' LIMIT 1
  `;

  const branchUsers = [
    {
      email: "manager@demo.test",
      full_name: "Branch Manager",
      employee_id: empManagerId,
      role_id: branchManagerRole?.id,
    },
    {
      email: "tech@demo.test",
      full_name: "Branch Technician",
      employee_id: empTechId,
      role_id: branchTechRole?.id,
    },
    {
      email: "agent@demo.test",
      full_name: "Call Center Agent",
      employee_id: empAgentId,
      role_id: branchAgentRole?.id,
    },
  ];

  for (const u of branchUsers) {
    const uid = randomUUID();
    const [branchUser] = await sql<{ id: string }[]>`
      INSERT INTO users (id, email, password_hash, full_name, employee_id, is_active)
      VALUES (${uid}, ${u.email}, ${passwordHash}, ${u.full_name}, ${u.employee_id}, ${true})
      ON CONFLICT (email) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        full_name = EXCLUDED.full_name,
        employee_id = EXCLUDED.employee_id,
        is_active = EXCLUDED.is_active,
        updated_at = now()
      RETURNING id
    `;
    const branchUserId = branchUser?.id ?? uid;
    if (u.role_id) {
      await sql`
        INSERT INTO user_roles (user_id, role_id)
        VALUES (${branchUserId}, ${u.role_id})
        ON CONFLICT DO NOTHING
      `;
    }
  }

  console.log("Seeding CRM customer + car + lead...");
  let customerId = randomUUID();
  const [customer] = await sql<{ id: string }[]>`
    INSERT INTO customers (id, company_id, code, name, customer_type, phone, email, is_active)
    VALUES (${customerId}, ${demoCompanyId}, ${"CUST-0001"}, ${"John Doe"}, ${"individual"},
            ${"+971511111111"}, ${"john.doe@example.com"}, ${true})
    ON CONFLICT (company_id, code) DO UPDATE SET
      name = EXCLUDED.name,
      customer_type = EXCLUDED.customer_type,
      phone = EXCLUDED.phone,
      email = EXCLUDED.email,
      is_active = EXCLUDED.is_active,
      updated_at = now()
    RETURNING id
  `;
  customerId = customer?.id ?? customerId;
  let carId = randomUUID();
  const [carRow] = await sql<{ id: string }[]>`
    INSERT INTO cars (id, company_id, code, plate_number, make, model, model_year, is_active)
    VALUES (${carId}, ${demoCompanyId}, ${"CAR-0001"}, ${"ABC-12345"}, ${"Toyota"}, ${"Camry"}, ${2020}, ${true})
    ON CONFLICT (company_id, code) DO UPDATE SET
      plate_number = EXCLUDED.plate_number,
      make = EXCLUDED.make,
      model = EXCLUDED.model,
      model_year = EXCLUDED.model_year,
      is_active = EXCLUDED.is_active,
      updated_at = now()
    RETURNING id
  `;
  carId = carRow?.id ?? carId;
  await sql`
    INSERT INTO customer_car_links (
      company_id,
      customer_id,
      car_id,
      relation_type,
      priority,
      is_primary,
      is_active
    )
    VALUES (
      ${demoCompanyId},
      ${customerId},
      ${carId},
      ${"owner"},
      ${1},
      ${true},
      ${true}
    )
    ON CONFLICT DO NOTHING
  `;
  const leadId = randomUUID();
  await sql`
    INSERT INTO leads (
      id,
      company_id,
      customer_id,
      car_id,
      lead_type,
      lead_status,
      lead_stage,
      source,
      is_locked
    )
    VALUES (
      ${leadId},
      ${demoCompanyId},
      ${customerId},
      ${carId},
      ${"rsa"},
      ${"open"},
      ${"new"},
      ${"seed"},
      ${false}
    )
    ON CONFLICT (id) DO NOTHING
  `;

  console.log("Seeding extra customers, cars, and leads...");
  const customers = [
    {
      id: randomUUID(),
      code: "CUST-0002",
      name: "Jane Smith",
      phone: "+971522222222",
      email: "jane.smith@example.com",
    },
    {
      id: randomUUID(),
      code: "CUST-0003",
      name: "Acme Corp",
      phone: "+971533333333",
      email: "ops@acme.example.com",
    },
  ];

  for (const c of customers) {
    const [customerRow] = await sql<{ id: string }[]>`
      INSERT INTO customers (id, company_id, code, name, customer_type, phone, email, is_active)
      VALUES (${c.id}, ${demoCompanyId}, ${c.code}, ${c.name}, ${"individual"}, ${c.phone}, ${c.email}, ${true})
      ON CONFLICT (company_id, code) DO UPDATE SET
        name = EXCLUDED.name,
        customer_type = EXCLUDED.customer_type,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        is_active = EXCLUDED.is_active,
        updated_at = now()
      RETURNING id
    `;
    c.id = customerRow?.id ?? c.id;
  }

  const cars = [
    {
      id: randomUUID(),
      code: "CAR-0002",
      customerId: customers[0].id,
      plate: "DEF-56789",
      make: "Nissan",
      model: "Altima",
      year: 2019,
    },
    {
      id: randomUUID(),
      code: "CAR-0003",
      customerId: customers[1].id,
      plate: "GHI-24680",
      make: "BMW",
      model: "320i",
      year: 2021,
    },
  ];

  for (const car of cars) {
    const [carRow] = await sql<{ id: string }[]>`
      INSERT INTO cars (id, company_id, code, plate_number, make, model, model_year, is_active)
      VALUES (${car.id}, ${demoCompanyId}, ${car.code}, ${car.plate}, ${car.make}, ${car.model}, ${car.year}, ${true})
      ON CONFLICT (company_id, code) DO UPDATE SET
        plate_number = EXCLUDED.plate_number,
        make = EXCLUDED.make,
        model = EXCLUDED.model,
        model_year = EXCLUDED.model_year,
        is_active = EXCLUDED.is_active,
        updated_at = now()
      RETURNING id
    `;
    car.id = carRow?.id ?? car.id;
    await sql`
      INSERT INTO customer_car_links (
        company_id,
        customer_id,
        car_id,
        relation_type,
        priority,
        is_primary,
        is_active
      )
      VALUES (
        ${demoCompanyId},
        ${car.customerId},
        ${car.id},
        ${"owner"},
        ${1},
        ${true},
        ${true}
      )
      ON CONFLICT DO NOTHING
    `;
  }

  const leads = [
    {
      id: randomUUID(),
      customerId: customers[0].id,
      carId: cars[0].id,
      status: "open",
      stage: "new",
      source: "web",
    },
    {
      id: randomUUID(),
      customerId: customers[1].id,
      carId: cars[1].id,
      status: "processing",
      stage: "assigned",
      source: "call_center",
    },
    {
      id: randomUUID(),
      customerId: customers[1].id,
      carId: cars[1].id,
      status: "lost",
      stage: "closed",
      source: "referral",
    },
  ];

  for (const l of leads) {
    await sql`
      INSERT INTO leads (
        id,
        company_id,
        customer_id,
        car_id,
        lead_type,
        lead_status,
        lead_stage,
        source,
        is_locked
      )
      VALUES (
        ${l.id},
        ${demoCompanyId},
        ${l.customerId},
        ${l.carId},
        ${"workshop"},
        ${l.status},
        ${l.stage},
        ${l.source},
        ${false}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  console.log("Seeding a simple inspection → estimate → work order chain...");
  const inspectionId = "00000000-0000-0000-0000-000000000101";
  const estimateId = "00000000-0000-0000-0000-000000000201";
  const estimateItem1 = "00000000-0000-0000-0000-000000000211";
  const estimateItem2 = "00000000-0000-0000-0000-000000000212";
  const workOrderId = "00000000-0000-0000-0000-000000000301";

  await sql`
    INSERT INTO inspections (id, company_id, lead_id, car_id, customer_id, status)
    VALUES (${inspectionId}, ${demoCompanyId}, ${leadId}, ${carId}, ${customerId}, ${"completed"})
    ON CONFLICT (id) DO NOTHING
  `;

  await sql`
    INSERT INTO estimates (
      id,
      company_id,
      inspection_id,
      lead_id,
      car_id,
      customer_id,
      status,
      currency
    )
    VALUES (
      ${estimateId},
      ${demoCompanyId},
      ${inspectionId},
      ${leadId},
      ${carId},
      ${customerId},
      ${"approved"},
      ${"AED"}
    )
    ON CONFLICT (id) DO NOTHING
  `;

  await sql`
    INSERT INTO estimate_items (
      id,
      estimate_id,
      line_no,
      part_name,
      description,
      type,
      quantity,
      cost,
      sale,
      status,
      procurement_status
    )
    VALUES
      (${estimateItem1}, ${estimateId}, ${1}, ${"Front brake pads"}, ${"Replace front pads"}, ${"genuine"}, ${2}, ${100}, ${200}, ${"pending"}, ${"pending"}),
      (${estimateItem2}, ${estimateId}, ${2}, ${"Engine oil"}, ${"Oil change"}, ${"genuine"}, ${1}, ${50}, ${120}, ${"pending"}, ${"pending"})
    ON CONFLICT (id) DO NOTHING
  `;

  await sql`
    INSERT INTO work_orders (id, company_id, estimate_id, inspection_id, lead_id, car_id, customer_id, branch_id, status)
    VALUES (${workOrderId}, ${demoCompanyId}, ${estimateId}, ${inspectionId}, ${leadId}, ${carId}, ${customerId}, ${branchDowntownId}, ${"quoting"})
    ON CONFLICT (id) DO NOTHING
  `;

  await sql`
    INSERT INTO work_order_items (
      id,
      work_order_id,
      estimate_item_id,
      line_no,
      part_name,
      description,
      is_part,
      is_labor,
      required_qty,
      issued_qty,
      work_status
    )
    VALUES
      (${randomUUID()}, ${workOrderId}, ${estimateItem1}, ${1}, ${"Front brake pads"}, ${"Replace front pads"}, ${true}, ${false}, ${2}, ${0}, ${"waiting_parts"}),
      (${randomUUID()}, ${workOrderId}, ${estimateItem2}, ${2}, ${"Engine oil"}, ${"Oil change"}, ${true}, ${false}, ${1}, ${0}, ${"waiting_parts"})
    ON CONFLICT DO NOTHING
  `;

  console.log("Seeding example integrations (channel + dialer)...");
  await sql`
    INSERT INTO integration_channels (id, scope, company_id, name, channel_type, provider_key, auth_type, credentials, metadata, webhooks, is_active)
    VALUES (
      ${"00000000-0000-0000-0000-00000000c001"},
      ${"company"},
      ${demoCompanyId},
      ${"Demo SMTP"},
      ${"email"},
      ${"smtp"},
      ${"basic"},
      ${sql.json({
        host: "smtp.demo.test",
        port: 587,
        username: "demo",
        password: "password",
      })},
      ${sql.json({})},
      ${sql.json([])},
      ${true}
    )
    ON CONFLICT (id) DO NOTHING
  `;

  await sql`
    INSERT INTO integration_dialers (
      id,
      provider,
      label,
      auth_type,
      credentials,
      is_global,
      company_id,
      is_active
    )
    VALUES (
      ${"00000000-0000-0000-0000-00000000d001"},
      ${"twilio"},
      ${"Demo Dialer"},
      ${"api_key"},
      ${sql.json({ accountSid: "ACXXXX", authToken: "token", defaultFromNumber: "+1000000000" })},
      ${false},
      ${demoCompanyId},
      ${true}
    )
    ON CONFLICT (id) DO NOTHING
  `;

  console.log("Seeding sample call sessions...");
  const now = new Date();
  now.setHours(10, 0, 0, 0);
  const calls = [
    {
      id: randomUUID(),
      direction: "outbound",
      status: "completed",
      from: "+1000000000",
      to: "+971511111111",
      duration: 180,
    },
    {
      id: randomUUID(),
      direction: "inbound",
      status: "failed",
      from: "+971522222222",
      to: "+1000000000",
      duration: 0,
    },
    {
      id: randomUUID(),
      direction: "outbound",
      status: "completed",
      from: "+1000000000",
      to: "+971533333333",
      duration: 95,
    },
  ];
  for (const [idx, c] of calls.entries()) {
    const createdAt = new Date(now.getTime() - idx * 3_600_000);
    await sql`
      INSERT INTO call_sessions (
        id,
        scope,
        company_id,
        branch_id,
        created_by_user_id,
        direction,
        from_number,
        to_number,
        provider_key,
        status,
        duration_seconds,
        created_at
      ) VALUES (
        ${c.id},
        ${"company"},
        ${demoCompanyId},
        ${branchDowntownId},
        ${companyAdminUserId},
        ${c.direction},
        ${c.from},
        ${c.to},
        ${"twilio"},
        ${c.status},
        ${c.duration},
        ${createdAt.toISOString()}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  console.log("Seeding sample invoice for reporting...");
  const invoiceId = "00000000-0000-0000-0000-000000000401";
  await sql`
    INSERT INTO invoices (
      id,
      company_id,
      work_order_id,
      estimate_id,
      inspection_id,
      lead_id,
      car_id,
      customer_id,
      invoice_number,
      invoice_date,
      status,
      total_sale,
      total_discount,
      final_amount,
      vat_rate,
      vat_amount,
      grand_total
    )
    VALUES (
      ${invoiceId},
      ${demoCompanyId},
      ${workOrderId},
      ${estimateId},
      ${inspectionId},
      ${leadId},
      ${carId},
      ${customerId},
      ${"INV-0001"},
      ${new Date().toISOString().slice(0, 10)},
      ${"issued"},
      ${320},
      ${0},
      ${320},
      ${5},
      ${16},
      ${336}
    )
    ON CONFLICT (id) DO NOTHING
  `;

  await sql`
    INSERT INTO invoice_items (
      id,
      invoice_id,
      work_order_item_id,
      estimate_item_id,
      line_no,
      name,
      description,
      quantity,
      rate,
      line_sale,
      line_discount,
      line_final
    )
    VALUES
      (${randomUUID()}, ${invoiceId}, NULL, ${estimateItem1}, ${1}, ${"Front brake pads"}, ${"Replace front pads"}, ${2}, ${150}, ${300}, ${0}, ${300}),
      (${randomUUID()}, ${invoiceId}, NULL, ${estimateItem2}, ${2}, ${"Engine oil"}, ${"Oil change"}, ${1}, ${20}, ${20}, ${0}, ${20})
    ON CONFLICT DO NOTHING
  `;

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error("Seed failed", err);
    process.exit(1);
  })
  .finally(() => {
    // eslint-disable-next-line no-process-exit
    process.exit(0);
  });
