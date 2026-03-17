import bcrypt from "bcryptjs";
import { getSql } from "../db";
import type { CompanyRow } from "./types";

const DEFAULT_COMPANY_ADMIN_PASSWORD = "Admin@123";

export async function ensureCompanyAdminForCompany(company: CompanyRow) {
  if (!company.company_email) return;
  const sql = getSql();
  const adminEmail = company.company_email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(DEFAULT_COMPANY_ADMIN_PASSWORD, 10);

  const roleKey = `company_admin_${company.id}`;

  const roleRes = await sql<{ id: string }[]>`
    INSERT INTO roles (id, scope, company_id, branch_id, vendor_id, name, key, description)
    VALUES (
      gen_random_uuid(),
      'company',
      ${company.id},
      NULL,
      NULL,
      'Company Admin',
      ${roleKey},
      'Company admin role with full access'
    )
    ON CONFLICT (key)
    DO UPDATE SET description = EXCLUDED.description
    RETURNING id
  `;
  const roleId = roleRes[0]?.id;
  if (!roleId) return;

  const userRes = await sql<{ id: string }[]>`
    INSERT INTO users (id, email, password_hash, is_active, company_id)
    VALUES (
      gen_random_uuid(),
      ${adminEmail},
      ${passwordHash},
      true,
      ${company.id}
    )
    ON CONFLICT (email)
    DO UPDATE SET is_active = true, company_id = COALESCE(users.company_id, EXCLUDED.company_id)
    RETURNING id
  `;
  const userId = userRes[0]?.id;
  if (!userId) return;

  await sql`
    INSERT INTO user_roles (user_id, role_id)
    VALUES (${userId}, ${roleId})
    ON CONFLICT (user_id, role_id) DO NOTHING
  `;

  // Grant all permissions to this role
  await sql`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT ${roleId}, p.id FROM permissions p
    ON CONFLICT DO NOTHING
  `;
}

export const CompanyBootstrapDefaults = {
  defaultAdminPassword: DEFAULT_COMPANY_ADMIN_PASSWORD,
};
