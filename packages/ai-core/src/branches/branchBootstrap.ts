import bcrypt from "bcryptjs";
import { getSql } from "../db";
import type { Branch } from "./types";
import { CompanyBootstrapDefaults } from "../company/companyBootstrap";

export async function ensureBranchAdminForBranch(branch: Branch) {
  const email = branch.email?.trim().toLowerCase();
  if (!email) return;

  const sql = getSql();
  const passwordHash = await bcrypt.hash(CompanyBootstrapDefaults.defaultAdminPassword, 10);
  const roleKey = `branch_admin_${branch.id}`;

  const roleRes = await sql<{ id: string }[]>`
    INSERT INTO roles (id, scope, company_id, branch_id, vendor_id, name, key, description)
    VALUES (
      gen_random_uuid(),
      'branch',
      ${branch.company_id},
      ${branch.id},
      NULL,
      'Branch Admin',
      ${roleKey},
      'Branch admin role with full access'
    )
    ON CONFLICT (key)
    DO UPDATE SET description = EXCLUDED.description
    RETURNING id
  `;
  const roleId = (roleRes as any).rows ? (roleRes as any).rows[0]?.id : roleRes[0]?.id;
  if (!roleId) return;

  const userRes = await sql<{ id: string }[]>`
    INSERT INTO users (id, email, password_hash, is_active, company_id)
    VALUES (
      gen_random_uuid(),
      ${email},
      ${passwordHash},
      true,
      ${branch.company_id}
    )
    ON CONFLICT (email)
    DO UPDATE SET
      is_active = true,
      company_id = COALESCE(users.company_id, EXCLUDED.company_id),
      branch_id = ${branch.id}
    RETURNING id
  `;
  const userId = (userRes as any).rows ? (userRes as any).rows[0]?.id : userRes[0]?.id;
  if (!userId) return;

  await sql`
    INSERT INTO user_roles (user_id, role_id)
    VALUES (${userId}, ${roleId})
    ON CONFLICT (user_id, role_id) DO NOTHING
  `;

  const branchPermissionKeys = [
    "branches.view",
    "branches.create",
    "branches.edit",
    "branches.delete",
    "branch.admin",
  ];

  await sql`
    DELETE FROM role_permissions
    WHERE role_id = ${roleId}
  `;

  await sql`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT ${roleId}, p.id
    FROM permissions p
    WHERE p.key = ANY(${branchPermissionKeys})
    ON CONFLICT DO NOTHING
  `;
}
