import { getSql } from "../db";
import type { FileKind, FileRecord } from "./types";

export interface CreateFileInput {
  scope: string;
  companyId?: string | null;
  uploadedBy?: string | null;
  kind: FileKind;
  mimeType: string;
  originalName: string;
  storagePath: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
}

export async function insertFile(input: CreateFileInput): Promise<FileRecord> {
  const sql = getSql();
  const rows = await sql<FileRecord[]>`
    INSERT INTO files (
      scope,
      company_id,
      uploaded_by,
      kind,
      mime_type,
      original_name,
      storage_path,
      size_bytes,
      width,
      height,
      duration_seconds
    )
    VALUES (
      ${input.scope},
      ${input.companyId ?? null},
      ${input.uploadedBy ?? null},
      ${input.kind},
      ${input.mimeType},
      ${input.originalName},
      ${input.storagePath},
      ${input.sizeBytes},
      ${input.width ?? null},
      ${input.height ?? null},
      ${input.durationSeconds ?? null}
    )
    RETURNING *
  `;
  return rows[0];
}

export async function getFileById(id: string): Promise<FileRecord | null> {
  const sql = getSql();
  const rows = await sql<FileRecord[]>`
    SELECT * FROM files WHERE id = ${id} LIMIT 1
  `;
  return rows[0] ?? null;
}
