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
  "Call Center",
  "Leads",
  "Sales",
  "Jobs",
  "Accounting",
  "Reports",
  "HR",
  "Analytics",
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
        const href = getHref(scopeInfo, cat);
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
  if (pathname.startsWith("/global")) {
    if (pathname.includes("/call-center")) return "Call Center";
    if (pathname.includes("/leads")) return "Leads";
    if (pathname.includes("/sales")) return "Sales";
    if (pathname.includes("/jobs")) return "Jobs";
    if (pathname.includes("/accounting")) return "Accounting";
    if (pathname.includes("/reports")) return "Reports";
    if (pathname.includes("/hr")) return "HR";
    if (pathname.includes("/analytics")) return "Analytics";
    return "Main";
  }
  if (pathname.includes("/call-center")) return "Call Center";
  if (pathname.includes("/leads") || pathname.includes("/crm")) return "Leads";
  if (pathname.includes("/sales")) return "Sales";
  if (pathname.includes("/jobs")) return "Jobs";
  if (pathname.includes("/accounting")) return "Accounting";
  if (pathname.includes("/reports")) return "Reports";
  if (pathname.includes("/hr")) return "HR";
  if (pathname.includes("/analytics")) return "Analytics";
  return "Main";
};

const CATEGORY_MODULE_MAP: Partial<Record<Category, ModuleKey>> = {
  "Call Center": "callCenter",
  Leads: "leads",
  Sales: "sales",
  Jobs: "jobs",
  Accounting: "accounting",
  Reports: "reports",
  HR: "hr",
  Analytics: "analytics",
};

function getHref(scopeInfo: ScopeInfo, category: Category): string {
  const base =
    scopeInfo.scope === "global"
      ? "/global"
      : scopeInfo.scope === "company"
      ? `/company/${scopeInfo.companyId ?? ""}`
      : scopeInfo.scope === "branch"
      ? `/company/${scopeInfo.companyId ?? ""}/branches/${scopeInfo.branchId ?? ""}`
      : `/company/${scopeInfo.companyId ?? ""}/vendors/${scopeInfo.vendorId ?? ""}`;

  switch (category) {
    case "Main":
      return base || "/";
    case "Call Center":
      return `${base}/call-center`;
    case "Leads":
      return `${base}/leads`;
    case "Sales":
      return `${base}/sales`;
    case "Jobs":
      return `${base}/jobs`;
    case "Accounting":
      return `${base}/accounting`;
    case "Reports":
      return `${base}/reports`;
    case "HR":
      return `${base}/hr`;
    case "Analytics":
      return `${base}/analytics`;
  }
}
