"use client";

import React from "react";
import { useDropzone, type Accept } from "react-dropzone";

export interface DropzoneFileInputProps {
  accept?: Accept;
  disabled?: boolean;
  onFileSelect: (file: File | null) => void;
  onReject?: (message: string) => void;
  selectedFileName?: string;
  idleText?: string;
  activeText?: string;
  buttonText?: string;
  className?: string;
  textClassName?: string;
  buttonClassName?: string;
}

export function DropzoneFileInput({
  accept,
  disabled,
  onFileSelect,
  onReject,
  selectedFileName,
  idleText = "Drag and drop a file here",
  activeText = "Drop file to upload",
  buttonText = "Browse",
  className,
  textClassName,
  buttonClassName,
}: DropzoneFileInputProps) {
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept,
    multiple: false,
    maxFiles: 1,
    noClick: true,
    noKeyboard: true,
    disabled: Boolean(disabled),
    onDropAccepted: (files) => {
      onFileSelect(files[0] ?? null);
    },
    onDropRejected: (rejections) => {
      const message = rejections[0]?.errors?.[0]?.message ?? "File rejected";
      onReject?.(message);
    },
  });

  const rootClassName = `flex items-center justify-between gap-3 rounded-md border border-dashed px-3 py-2 text-xs transition ${
    isDragActive ? "border-primary/80 bg-primary/5" : "border-border/70"
  }${className ? ` ${className}` : ""}`;

  return (
    <div {...getRootProps({ className: rootClassName })}>
      <input {...getInputProps()} />
      <span className={textClassName ?? "text-muted-foreground"}>
        {selectedFileName || (isDragActive ? activeText : idleText)}
      </span>
      <button
        type="button"
        className={`rounded-md border border-border bg-card px-3 py-1 text-xs text-foreground disabled:opacity-60${
          buttonClassName ? ` ${buttonClassName}` : ""
        }`}
        onClick={(e) => {
          e.stopPropagation();
          open();
        }}
        disabled={Boolean(disabled)}
      >
        {buttonText}
      </button>
    </div>
  );
}
