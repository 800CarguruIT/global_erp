"use client";

import React, { ChangeEvent } from "react";
import { useTheme } from "../../theme";

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

/**
 * Lightweight attachment field. For now it accepts a file input and uses
 * the filename as a placeholder ID; later we can wire real uploads.
 */
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
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
      onUploadError?.(err?.message ?? "Upload failed");
    }
  };

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-foreground">{label}</div>
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
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
        <input
          type="file"
          onChange={handleFileChange}
          className="text-xs md:w-48 file:mr-3 file:rounded-md file:border file:border-border file:bg-card file:px-3 file:py-2 file:text-foreground"
        />
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
