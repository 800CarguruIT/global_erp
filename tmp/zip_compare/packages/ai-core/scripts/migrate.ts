import fs from "fs/promises";
import path from "path";
import { getSql } from "../src/db";

type MigrationRow = { name: string };

async function loadEnvFromRoot() {
  if (process.env.DATABASE_URL) return;
  const envPath = path.resolve(__dirname, "..", "..", "..", ".env");
  try {
    const contents = await fs.readFile(envPath, "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if (
        (value.startsWith("\"") && value.endsWith("\"")) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // ignore missing .env
  }
}

async function ensureMigrationsTable() {
  const sql = getSql();
  await sql/* sql */ `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const sql = getSql();
  const rows = await sql<MigrationRow[]>/* sql */ `
    SELECT name
    FROM schema_migrations
  `;
  return new Set(rows.map((row) => row.name));
}

async function runMigration(name: string, sqlText: string) {
  const sql = getSql();
  await sql.unsafe(sqlText);
  await sql/* sql */ `
    INSERT INTO schema_migrations (name)
    VALUES (${name})
  `;
}

async function main() {
  await loadEnvFromRoot();
  const migrationsDir = path.resolve(__dirname, "..", "migrations");
  const entries = await fs.readdir(migrationsDir);
  const migrations = entries.filter((entry) => entry.endsWith(".sql")).sort();

  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  for (const file of migrations) {
    if (applied.has(file)) continue;
    const filePath = path.join(migrationsDir, file);
    const sqlText = await fs.readFile(filePath, "utf8");
    await runMigration(file, sqlText);
    console.log(`Applied migration: ${file}`);
  }

  console.log("Migrations complete.");
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
