export type FileKind = "image" | "audio" | "video" | "other";

export interface FileRecord {
  id: string;
  scope: string;
  company_id: string | null;
  uploaded_by: string | null;
  kind: FileKind;
  mime_type: string;
  original_name: string;
  storage_path: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  created_at: string;
}
