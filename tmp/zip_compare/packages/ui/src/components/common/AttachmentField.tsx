"use client";

import React, { useCallback, useState } from "react";
import { useTheme } from "../../theme";
import { DropzoneFileInput } from "./DropzoneFileInput";

export interface AttachmentFieldProps {
  label: string;
  value?: string | null;
  onChange: (value: string) => void;
  name?: string;
  hint?: string;
  uploadUrl?: string;
  uploadFields?: Record<string, string | null | undefined>;
  onUploadComplete?: (fileId: string) => void;
  onUploadError?: (message: string) => void;
  viewUrlPrefix?: string;
}

export function AttachmentField({
  label,
  value,
  onChange,
  name,
  hint,
  uploadUrl,
  uploadFields,
  onUploadComplete,
  onUploadError,
  viewUrlPrefix = "/api/files/",
}: AttachmentFieldProps) {
  const { theme } = useTheme();
  const [isUploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      setError(null);
      if (!uploadUrl) {
        onChange(file.name);
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      if (uploadFields) {
        Object.entries(uploadFields).forEach(([k, v]) => {
          if (v !== undefined && v !== null) formData.append(k, v);
        });
      }

      setUploading(true);
      try {
        const res = await fetch(uploadUrl, {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Upload failed");
        }
        const json = await res.json();
        const fileId = json.fileId ?? json.id ?? json.data?.id;
        if (fileId) {
          onChange(fileId);
          onUploadComplete?.(fileId);
        } else {
          throw new Error("Upload response missing fileId");
        }
      } catch (err: any) {
        console.error("Attachment upload error", err);
        const message = err?.message ?? "Upload failed";
        setError(message);
        onUploadError?.(message);
      } finally {
        setUploading(false);
      }
    },
    [onChange, onUploadComplete, onUploadError, uploadFields, uploadUrl]
  );

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-foreground">{label}</div>
      <div className="space-y-2">
        <div className="flex-1 flex items-center gap-2">
          <input
            id={name}
            name={name}
            className={`${theme.input} flex-1`}
            value={value ?? ""}
            placeholder="File id or URL"
            onChange={(e) => onChange(e.target.value)}
          />
          {value && (
            <a
              href={`${viewUrlPrefix}${value}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary underline whitespace-nowrap"
            >
              View
            </a>
          )}
        </div>
        <DropzoneFileInput
          disabled={isUploading}
          onFileSelect={handleFile}
          onReject={(message) => {
            setError(message);
            onUploadError?.(message);
          }}
          idleText="Drag and drop a file here"
          activeText="Drop file to attach"
          buttonText={isUploading ? "Uploading..." : "Browse"}
        />
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
