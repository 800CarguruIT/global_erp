"use client";

import React from "react";
import Link from "next/link";
import { CategoryNav, Category } from "./CategoryNav";
import { SIDEBAR_CONFIG, NavScope } from "./sidebarConfig";
import { isModuleVisibleForScope, CURRENT_MODULE_PHASE } from "@repo/ai-core/shared/scopes-and-modules";
import { useI18n } from "../i18n";

export function SidebarNav({
  scope,
  activeCategory,
  currentPathname,
  children,
}: {
  scope: NavScope;
  activeCategory: Category;
  currentPathname: string;
  children: React.ReactNode;
}) {
  const { t } = useI18n();

  const resolveItems = (category: Category) =>
    (SIDEBAR_CONFIG[scope]?.[category] || []).filter((item) => {
      if (scope === "global" && item.href === "/global") return false;
      return item.moduleKey ? isModuleVisibleForScope(scope as any, item.moduleKey as any, CURRENT_MODULE_PHASE) : true;
    });

  let items = resolveItems(activeCategory);

  // Fallback: if no items for the active category (e.g., module hidden), show Main links so the sidebar remains visible.
  if (!items.length && activeCategory !== "Main") {
    items = resolveItems("Main");
  }

  if (!items || items.length === 0) {
    return <div className="mx-auto max-w-6xl">{children}</div>;
  }

  const pathParts = currentPathname.split("/").filter(Boolean);
  const companyId = pathParts[0] === "company" ? pathParts[1] : undefined;
  const branchId = pathParts[2] === "branches" ? pathParts[3] : undefined;
  const vendorId = pathParts[2] === "vendors" ? pathParts[3] : undefined;

  const resolveHref = (href: string): string | null => {
    let next = href;
    if (next.includes("[companyId]")) {
      if (!companyId) return null;
      next = next.replace("[companyId]", companyId);
    }
    if (next.includes("[branchId]")) {
      if (!branchId) return null;
      next = next.replace("[branchId]", branchId);
    }
    if (next.includes("[vendorId]")) {
      if (!vendorId) return null;
      next = next.replace("[vendorId]", vendorId);
    }
    return next;
  };

  return (
    <div className="mx-auto flex gap-4">
      <aside className="w-56 shrink-0">
        <nav className="rounded-xl border bg-card/60 p-3 text-sm">
          <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">{activeCategory}</div>
          <div className="flex flex-col gap-1">
            {items.map((item) => {
              const resolvedHref = resolveHref(item.href);
              const active = resolvedHref ? currentPathname.startsWith(resolvedHref) : false;
              const label = item.labelKey ? t(item.labelKey) : item.label ?? item.href;
              const classes = `rounded-md px-3 py-2 transition ${
                active ? "bg-primary text-primary-foreground" : "hover:bg-muted/60"
              } ${resolvedHref ? "" : "opacity-60 cursor-not-allowed"}`;

              return resolvedHref ? (
                <Link key={item.href} href={resolvedHref} className={classes}>
                  {label}
                </Link>
              ) : (
                <span key={item.href} className={classes} aria-disabled>
                  {label}
                </span>
              );
            })}
          </div>
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

// helper for reuse
SidebarNav.getActiveCategory = CategoryNav.getActiveCategory;
