"use client";

import React from "react";

export function AccessDenied({
  title = "Access denied",
  description = "You do not currently have permission to view this section.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/15 bg-red-500/10 p-6 text-sm text-white">
      <p className="text-lg font-semibold">{title}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.3em] text-red-200">Unauthorized</p>
      <p className="mt-3 text-sm text-red-100">{description}</p>
    </div>
  );
}
