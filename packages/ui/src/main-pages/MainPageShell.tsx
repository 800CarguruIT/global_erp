"use client";

import React from "react";

export function MainPageShell({
  title,
  subtitle,
  scopeLabel,
  primaryAction,
  secondaryActions,
  contentClassName,
  children,
}: {
  title: string;
  subtitle?: string;
  scopeLabel?: string;
  primaryAction?: React.ReactNode;
  secondaryActions?: React.ReactNode;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  const contentClass =
    contentClassName ?? "rounded-2xl border border-border/60 bg-card/80 p-4";

  return (
    <div className="space-y-3 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
          {scopeLabel && <div className="text-xs text-muted-foreground">{scopeLabel}</div>}
          {primaryAction && <div className="flex items-center gap-2">{primaryAction}</div>}
          {secondaryActions && <div className="flex items-center gap-2">{secondaryActions}</div>}
        </div>
      </div>
      <div className={contentClass}>{children}</div>
    </div>
  );
}
