"use client";

import React from "react";
import Link from "next/link";
import {
  CURRENT_MODULE_PHASE,
  isModuleVisibleForScope,
  type ModuleKey,
} from "@repo/ai-core/shared/scopes-and-modules";

const CATEGORIES = [
  "Main",
  "Sales",
  "Service Center",
] as const;

export type Category = (typeof CATEGORIES)[number];

type ScopeInfo =
  | { scope: "global" }
  | { scope: "company"; companyId?: string }
  | { scope: "branch"; companyId?: string; branchId?: string }
  | { scope: "vendor"; companyId?: string; vendorId?: string };

export function CategoryNav({
  scopeInfo,
  currentPath,
  compact = false,
}: {
  scopeInfo: ScopeInfo;
  currentPath: string;
  compact?: boolean;
}) {
  const visibleCategories = CATEGORIES.filter((cat) => {
    const moduleKey = CATEGORY_MODULE_MAP[cat];
    if (!moduleKey) return true; // keep Main or undefined categories visible
    return isModuleVisibleForScope(scopeInfo.scope, moduleKey, CURRENT_MODULE_PHASE);
  });

  return (
    <div className={`flex flex-wrap items-center justify-center gap-1 sm:gap-2 ${compact ? "text-xs" : "text-sm"}`}>
      {visibleCategories.map((cat) => {
        const href = getHref(scopeInfo, cat, currentPath);
        const active = currentPath.startsWith(href);
        return (
          <Link
            key={cat}
            href={href}
            className={`rounded-full border px-3 py-1 transition ${
              active ? "bg-primary text-primary-foreground border-primary" : "border-white/30 bg-card/60"
            }`}
          >
            {cat}
          </Link>
        );
      })}
    </div>
  );
}

CategoryNav.getActiveCategory = function getActiveCategory(pathname: string): Category {
  if (pathname.includes("/call-center") || pathname.includes("/leads") || pathname.includes("/estimates")) return "Sales";
  if (pathname.includes("/pis") || pathname.includes("/car-in-dashboard")) return "Service Center";
  return "Main";
};

const CATEGORY_MODULE_MAP: Partial<Record<Category, ModuleKey>> = {
  Sales: "sales",
};

function getHref(scopeInfo: ScopeInfo, category: Category, currentPath: string): string {
  const useBranchRoot = scopeInfo.scope === "branch" && currentPath.startsWith("/branches/");
  const base =
    scopeInfo.scope === "global"
      ? "/global"
      : scopeInfo.scope === "company"
      ? `/company/${scopeInfo.companyId ?? ""}`
      : scopeInfo.scope === "branch"
      ? useBranchRoot
        ? `/branches/${scopeInfo.branchId ?? ""}`
        : `/company/${scopeInfo.companyId ?? ""}/branches/${scopeInfo.branchId ?? ""}`
      : `/company/${scopeInfo.companyId ?? ""}/vendors/${scopeInfo.vendorId ?? ""}`;

  switch (category) {
    case "Main":
      return base || "/";
    case "Sales":
      return `${base}/call-center`;
    case "Service Center":
      return `${base}/pis/advisor-portal`;
  }
}
