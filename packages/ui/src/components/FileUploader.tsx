"use client";

import React, { useRef, useState } from "react";
import { useTheme } from "../theme";

export type FileKind = "image" | "audio" | "video" | "any";

interface FileUploaderProps {
  label: string;
  kind?: FileKind;
  value?: string | null;
  onChange: (fileId: string | null) => void;
  helperText?: string;
  hint?: string;
  disabled?: boolean;
}

export function FileUploader({
  label,
  kind = "any",
  value,
  onChange,
  helperText,
  hint,
  disabled,
}: FileUploaderProps) {
  const { theme } = useTheme();
  const [isUploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const accept =
    kind === "image"
      ? "image/*"
      : kind === "audio"
      ? "audio/*"
      : kind === "video"
      ? "video/*"
      : undefined;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", kind === "any" ? inferKind(file.type) : kind);

      const res = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Upload failed");
      }
      const data = await res.json();
      onChange(data.fileId ?? null);
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function inferKind(mime: string): FileKind {
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("audio/")) return "audio";
    if (mime.startsWith("video/")) return "video";
    return "any";
  }

  return (
    <div className="space-y-2">
      <label className="text-xs uppercase opacity-80 block">{label}</label>
      <div className="flex flex-col gap-2 md:flex-row md:items-stretch">
        <div className="flex w-full flex-1 items-stretch gap-2">
          <input
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
            placeholder="File id will appear after upload"
            className={`${theme.input} flex-1 min-w-0`}
            readOnly
          />
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            disabled={disabled || isUploading}
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            disabled={disabled || isUploading}
            onClick={() => fileInputRef.current?.click()}
            className={`whitespace-nowrap rounded-lg px-3 text-sm text-white disabled:opacity-50 bg-gradient-to-r ${theme.accent}`}
          >
            {isUploading ? "Uploading..." : "Choose File"}
          </button>
        </div>
        {value && (
          <span className="text-xs opacity-70 truncate" title={value}>
            {value}
          </span>
        )}
      </div>
      {isUploading && <p className="text-xs text-muted-foreground">Uploading...</p>}
      {(helperText || hint) && (
        <p className="text-xs text-muted-foreground">{helperText ?? hint}</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
