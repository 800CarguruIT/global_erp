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
