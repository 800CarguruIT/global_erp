/* eslint-disable no-console */
import "dotenv/config";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { getSql } from "../src/db";

/**
 * Minimal bootstrap seed:
 * - Creates/ensures a global admin role
 * - Creates a single global admin user:
 *     email: admin@bootstrap.test
 *     password: Admin@123
 * This script is idempotent and does NOT create any companies or demo data.
 *
 * Run with: pnpm db:bootstrap:minimal
 */
async function main() {
  const sql = getSql();

  const adminEmail = "admin@bootstrap.test";
  const adminPasswordHash = await bcrypt.hash("Admin@123", 10);

  console.log("Ensuring global_admin role...");
  const [roleRow] = await sql<{ id: string }[]>`
    INSERT INTO roles (id, name, key, scope)
    VALUES (${randomUUID()}, ${"Global Admin"}, ${"global_admin"}, ${"global"})
    ON CONFLICT (key) DO UPDATE SET
      name = EXCLUDED.name,
      scope = EXCLUDED.scope
    RETURNING id
  `;
  const roleId = roleRow.id;

  console.log("Ensuring global admin user...");
  const [userRow] = await sql<{ id: string }[]>`
    INSERT INTO users (id, email, password_hash, full_name, is_active)
    VALUES (${randomUUID()}, ${adminEmail}, ${adminPasswordHash}, ${"Bootstrap Admin"}, ${true})
    ON CONFLICT (email) DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      full_name = EXCLUDED.full_name,
      is_active = EXCLUDED.is_active,
      updated_at = now()
    RETURNING id
  `;
  const adminUserId = userRow.id;

  console.log("Linking admin user to global_admin role...");
  await sql`
    INSERT INTO user_roles (user_id, role_id)
    VALUES (${adminUserId}, ${roleId})
    ON CONFLICT (user_id, role_id) DO NOTHING
  `;

  console.log("Bootstrap minimal seed complete.");
}

main()
  .catch((err) => {
    console.error("Bootstrap minimal seed failed", err);
    process.exit(1);
  })
  .finally(() => {
    // eslint-disable-next-line no-process-exit
    process.exit(0);
  });
