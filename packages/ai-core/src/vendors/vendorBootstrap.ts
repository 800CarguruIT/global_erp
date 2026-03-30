import bcrypt from "bcryptjs";
import { getSql } from "../db";
import type { VendorRow } from "./types";
import { generateSecurePassword } from "../company/companyBootstrap";

export async function ensureVendorAdminForVendor(vendor: VendorRow) {
  const email = vendor.email?.trim().toLowerCase();
  if (!email) return;

  const sql = getSql();
  const plainPassword = generateSecurePassword();
  const passwordHash = await bcrypt.hash(plainPassword, 10);

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
      password_hash = EXCLUDED.password_hash,
      company_id = COALESCE(users.company_id, EXCLUDED.company_id),
      vendor_id = COALESCE(users.vendor_id, EXCLUDED.vendor_id)
    RETURNING id
  `;
  const userId = userRes[0]?.id;
  if (!userId) return;

  console.log(
    `[VendorBootstrap] Admin created for ${email} -- temporary password generated. User must change password on first login.`
  );

  return { userId, plainPassword };
}
