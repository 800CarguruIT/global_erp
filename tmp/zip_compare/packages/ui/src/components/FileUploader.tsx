"use client";

import React, { useCallback, useState } from "react";
import { DropzoneFileInput } from "./common/DropzoneFileInput";
import { useTheme } from "../theme";
import type { Accept } from "react-dropzone";

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
  chooseLabel?: string;
  replaceLabel?: string;
  maxSizeBytes?: number;
  acceptMimeTypes?: string[];
  showFileIdField?: boolean;
  capture?: "user" | "environment";
  externalError?: string | null;
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
  chooseLabel,
  replaceLabel,
  maxSizeBytes,
  acceptMimeTypes,
  showFileIdField = true,
  capture,
  externalError,
}: FileUploaderProps) {
  const { theme } = useTheme();
  const [isUploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [lastFile, setLastFile] = useState<File | null>(null);

  const accept: Accept | undefined =
    acceptMimeTypes && acceptMimeTypes.length
      ? acceptMimeTypes.reduce<Accept>((acc, mime) => {
          acc[mime] = [];
          return acc;
        }, {})
      : kind === "image"
      ? { "image/*": [] }
      : kind === "audio"
      ? { "audio/*": [] }
      : kind === "video"
      ? { "video/*": [] }
      : undefined;

  const uploadFile = useCallback(
    async (file: File | null, keepAsRetry = true) => {
      if (!file) return;
      setError(null);
      if (keepAsRetry) setLastFile(file);
      if (acceptMimeTypes?.length && !acceptMimeTypes.includes(file.type)) {
        setError(`Invalid file type. Allowed: ${acceptMimeTypes.join(", ")}`);
        return;
      }
      if (maxSizeBytes && file.size > maxSizeBytes) {
        const mb = (maxSizeBytes / (1024 * 1024)).toFixed(0);
        setError(`File is too large. Max ${mb} MB.`);
        return;
      }
      setUploading(true);
      setProgress(0);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("kind", kind === "any" ? inferKind(file.type) : kind);

        const data = await new Promise<any>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", "/api/files/upload");
          xhr.upload.onprogress = (event) => {
            if (!event.lengthComputable) return;
            setProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
          };
          xhr.onload = () => {
            if (xhr.status < 200 || xhr.status >= 300) {
              let message = "Upload failed";
              try {
                const json = JSON.parse(xhr.responseText || "{}");
                message = json?.error || message;
              } catch {
                // ignore parse
              }
              reject(new Error(message));
              return;
            }
            try {
              const json = JSON.parse(xhr.responseText || "{}");
              resolve(json);
            } catch {
              reject(new Error("Invalid upload response"));
            }
          };
          xhr.onerror = () => reject(new Error("Network error while uploading"));
          xhr.send(formData);
        });
        onChange(data.fileId ?? null);
        setProgress(100);
      } catch (err: unknown) {
        console.error(err);
        const message = err instanceof Error ? err.message : "Upload failed";
        setError(message);
      } finally {
        setUploading(false);
      }
    },
    [acceptMimeTypes, kind, maxSizeBytes, onChange]
  );

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

  return (
    <div className={`space-y-2${containerClassName ? ` ${containerClassName}` : ""}`}>
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

      {!buttonOnly && (
        <>
        {showFileIdField ? (
        <div className="flex flex-col gap-2 md:flex-row md:items-stretch">
          <input
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
            placeholder="File id will appear after upload"
            className={`${theme.input} flex-1 min-w-0`}
            readOnly
          />
          {value && (
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex rounded-full bg-muted/40 px-2 py-0.5 text-muted-foreground">
                File attached
              </span>
              <a href={previewUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                Open
              </a>
              <span className="max-w-[18rem] truncate text-muted-foreground" title={value}>
                {value}
              </span>
            </div>
          )}
        </div>
        ) : value ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-300">Uploaded</span>
            <a href={previewUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
              Open
            </a>
          </div>
        ) : null}
        </>
      )}

      <DropzoneFileInput
        accept={accept}
        maxSizeBytes={maxSizeBytes}
        capture={capture}
        disabled={disabled || isUploading}
        onFileSelect={uploadFile}
        onReject={setError}
        idleText="Drag and drop a file here"
        activeText="Drop file to upload"
        buttonText={isUploading ? "Uploading..." : hasValue ? (replaceLabel ?? "Replace file") : (chooseLabel ?? "Choose file")}
        buttonClassName={buttonClassName}
      />

      {showInlinePreview && kind === "image" && (
        <img
          src={previewUrl}
          alt={`${label} preview`}
          className={`h-24 w-full rounded-md object-cover${previewClassName ? ` ${previewClassName}` : ""}`}
        />
      )}
      {showInlinePreview && kind === "video" && (
        <video
          className={`h-24 w-full rounded-md object-cover${previewClassName ? ` ${previewClassName}` : ""}`}
          controls
          preload="metadata"
          src={previewUrl}
        />
      )}
      {showInlinePreview && kind === "audio" && <audio className="w-full" controls preload="metadata" src={previewUrl} />}
      {showInlinePreview && kind === "any" && (
        <a href={previewUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
          Open file
        </a>
      )}
      {isUploading && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Uploading... {progress}%</p>
          <div className="h-1.5 w-full overflow-hidden rounded bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2">
          <p className="text-xs text-destructive">{error}</p>
          {lastFile ? (
            <button
              type="button"
              onClick={() => void uploadFile(lastFile, false)}
              className="rounded border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
            >
              Retry
            </button>
          ) : null}
        </div>
      )}
      {externalError ? <p className="text-xs text-destructive">{externalError}</p> : null}
    </div>
  );
}
