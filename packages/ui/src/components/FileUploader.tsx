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
  buttonOnly?: boolean;
  showPreview?: boolean;
  buttonClassName?: string;
  containerClassName?: string;
  previewClassName?: string;
}

export function FileUploader({
  label,
  kind = "any",
  value,
  onChange,
  helperText,
  hint,
  disabled,
  buttonOnly = false,
  showPreview = false,
  buttonClassName,
  containerClassName,
  previewClassName,
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

  const helperContent = helperText ?? hint;
  const previewUrl = value ? `/api/files/${value}` : "";
  const showInlinePreview = showPreview && Boolean(value);
  const hasValue = Boolean(value);
  const buttonClasses = `inline-flex items-center whitespace-nowrap rounded-md bg-slate-100 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-700 shadow-md transition hover:bg-slate-200 hover:shadow-lg disabled:opacity-50${
    buttonClassName ? ` ${buttonClassName}` : ""
  }`;

  return (
    <div className={`space-y-1${containerClassName ? ` ${containerClassName}` : ""}`}>
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-foreground/90 block">{label}</label>
        {helperContent && (
          <button
            type="button"
            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted/40 text-[10px] text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
            title={helperContent}
            aria-label={`${label} info`}
          >
            <svg viewBox="0 0 24 24" className="h-3 w-3" aria-hidden="true">
              <path
                d="M12 8.5h.01M11 11h2v5h-2z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
        )}
      </div>
      <div className={`flex flex-col gap-2${buttonOnly ? "" : " md:flex-row md:items-stretch"}`}>
        <div className={`flex w-full items-stretch gap-2${buttonOnly ? "" : " flex-1"}`}>
          {!buttonOnly && (
            <input
              value={value ?? ""}
              onChange={(e) => onChange(e.target.value || null)}
              placeholder="File id will appear after upload"
              className={`${theme.input} flex-1 min-w-0`}
              readOnly
            />
          )}
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
            className={buttonClasses}
          >
            {isUploading ? "Uploading..." : hasValue ? "Replace file" : "Choose file"}
          </button>
        </div>
        {!buttonOnly && value && (
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex rounded-full bg-muted/40 px-2 py-0.5 text-muted-foreground">
              File attached
            </span>
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              Open
            </a>
            <span className="max-w-[18rem] truncate text-muted-foreground" title={value}>
              {value}
            </span>
          </div>
        )}
      </div>
      {showInlinePreview && kind === "image" && (
        <img
          src={previewUrl}
          alt={`${label} preview`}
          className={`h-24 w-full rounded-md object-cover${
            previewClassName ? ` ${previewClassName}` : ""
          }`}
        />
      )}
      {showInlinePreview && kind === "video" && (
        <video
          className={`h-24 w-full rounded-md object-cover${
            previewClassName ? ` ${previewClassName}` : ""
          }`}
          controls
          preload="metadata"
          src={previewUrl}
        />
      )}
      {showInlinePreview && kind === "audio" && (
        <audio className="w-full" controls preload="metadata" src={previewUrl} />
      )}
      {showInlinePreview && kind === "any" && (
        <a
          href={previewUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-primary hover:underline"
        >
          Open file
        </a>
      )}
      {isUploading && <p className="text-xs text-muted-foreground">Uploading...</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
