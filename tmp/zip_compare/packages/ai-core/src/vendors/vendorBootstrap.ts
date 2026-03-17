import bcrypt from "bcryptjs";
import { getSql } from "../db";
import type { VendorRow } from "./types";
import { CompanyBootstrapDefaults } from "../company/companyBootstrap";

export async function ensureVendorAdminForVendor(vendor: VendorRow) {
  const email = vendor.email?.trim().toLowerCase();
  if (!email) return;

  const sql = getSql();
  const passwordHash = await bcrypt.hash(CompanyBootstrapDefaults.defaultAdminPassword, 10);

  const userRes = await sql<{ id: string }[]>`
    INSERT INTO users (id, email, password_hash, is_active, company_id, vendor_id)
    VALUES (
      gen_random_uuid(),
      ${email},
      ${passwordHash},
      true,
      ${vendor.company_id},
      ${vendor.id}
    )
    ON CONFLICT (email)
    DO UPDATE SET
      is_active = true,
      company_id = COALESCE(users.company_id, EXCLUDED.company_id),
      vendor_id = COALESCE(users.vendor_id, EXCLUDED.vendor_id)
    RETURNING id
  `;
  const userId = userRes[0]?.id;
  if (!userId) return;
  return { userId };
}
