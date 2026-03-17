import crypto from "node:crypto";
import { getSql } from "../db";

export function computeChecksum(source: string): string {
  return crypto.createHash("sha256").update(source, "utf8").digest("hex");
}

export async function getCachedTranslation(source: string, lang: string) {
  const sql = getSql();
  const rows = await sql<{
    translated_text: string;
    checksum: string;
  }[]>`
    SELECT translated_text, checksum
    FROM ui_translations
    WHERE source_text = ${source} AND target_lang = ${lang}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function saveTranslation(source: string, lang: string, translated: string) {
  const sql = getSql();
  const checksum = computeChecksum(source);
  const rows = await sql<{
    translated_text: string;
  }[]>`
    INSERT INTO ui_translations (
      source_text,
      target_lang,
      translated_text,
      checksum
    )
    VALUES (
      ${source},
      ${lang},
      ${translated},
      ${checksum}
    )
    ON CONFLICT (source_text, target_lang)
    DO UPDATE SET
      translated_text = EXCLUDED.translated_text,
      checksum = EXCLUDED.checksum,
      updated_at = now()
    RETURNING translated_text
  `;
  return rows[0];
}
