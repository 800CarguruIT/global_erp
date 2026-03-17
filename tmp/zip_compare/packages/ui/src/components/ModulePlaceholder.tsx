"use client";

import React from "react";

export function ModulePlaceholder({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-2 rounded-xl border bg-card/60 p-4">
      <h1 className="text-xl font-semibold">{title}</h1>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      <p className="text-xs text-muted-foreground">
        Placeholder page. Implementation coming soon.
      </p>
    </div>
  );
}
