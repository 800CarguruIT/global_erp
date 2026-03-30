// packages/ai-core/src/db.ts
import postgres from "postgres";

let sql: postgres.Sql | null = null;

export function getSql() {
  if (!sql) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set");
    }

    sql = postgres(url, {
      max: 15,
      idle_timeout: 30,
      max_lifetime: 60 * 10,
      connect_timeout: 5,
    });
  }
  return sql;
}
