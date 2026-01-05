"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { CategoryNav, Category } from "./CategoryNav";
import { SIDEBAR_CONFIG, SIDEBAR_TREE, NavScope, SidebarItem } from "./sidebarConfig";
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

  const sectionOrder: Category[] = [
    "Call Center",
    "Leads",
    "Sales",
    "Jobs",
    "Accounting",
    "Reports",
    "HR",
    "Analytics",
  ];

  const sections = sectionOrder
    .map((category) => ({
      category,
      items: resolveItems(category),
    }))
    .filter((section) => section.items.length > 0);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => ({
    [activeCategory]: true,
  }));

  useEffect(() => {
    setOpenSections((prev) => (prev[activeCategory] ? prev : { ...prev, [activeCategory]: true }));
  }, [activeCategory]);

  if (!sections.length && !SIDEBAR_TREE[scope]?.length) {
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

  const buildSectionItems = (items: { href: string; label?: string; labelKey?: string }[]) => {
    const filtered = items;
    const seen = new Set<string>();
    return filtered.flatMap((item) => {
      const resolvedHref = resolveHref(item.href);
      const key = resolvedHref ?? item.href;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ item, resolvedHref }];
    });
  };

  const getMainGroupKey = (href: string) => {
    if (
      href === "/global" ||
      href === "/company/[companyId]" ||
      href.includes("/branches/[branchId]") ||
      href.includes("/vendors/[vendorId]") ||
      href.includes("/global/companies") ||
      href.includes("/company/[companyId]/branches") ||
      href.includes("/company/[companyId]/vendors")
    ) {
      return "Workspace";
    }
    if (href.includes("/call-center") || href.includes("/leads") || href.includes("/marketing")) return "Engagement";
    if (
      href.includes("/jobs") ||
      href.includes("/inventory") ||
      href.includes("/procurement") ||
      href.includes("/quotes") ||
      href.includes("/fleet") ||
      href.includes("/bays") ||
      href.includes("/cars")
    ) {
      return "Operations";
    }
    if (href.includes("/accounting") || href.includes("/accounts") || href.includes("/invoices")) return "Finance";
    if (href.includes("/hr") || href.includes("/customers") || href.includes("/settings/security/users")) return "People";
    if (href.includes("/analytics") || href.includes("/reports")) return "Analytics";
    return "Other";
  };

  const mainGroupOrder = ["Workspace", "Engagement", "Operations", "Finance", "People", "Analytics", "Other"];
  const mainGroupsMap = mainGroupOrder.reduce<Record<string, ReturnType<typeof buildSectionItems>>>(
    (acc, key) => ({ ...acc, [key]: [] }),
    {}
  );

  buildSectionItems(resolveItems("Main")).forEach((entry) => {
    const groupKey = getMainGroupKey(entry.item.href);
    mainGroupsMap[groupKey].push(entry);
  });

  const mainGroups = mainGroupOrder
    .map((key) => ({ key, items: mainGroupsMap[key] }))
    .filter((group) => group.items.length > 0);

  const [openMainGroups, setOpenMainGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!mainGroups.length) return;
    const activeGroup = mainGroups.find((group) =>
      group.items.some((entry) => entry.resolvedHref && currentPathname.startsWith(entry.resolvedHref))
    );
    const targetKey = activeGroup?.key ?? mainGroups[0]?.key;
    if (!targetKey) return;
    setOpenMainGroups((prev) => (prev[targetKey] ? prev : { ...prev, [targetKey]: true }));
  }, [mainGroups, currentPathname]);

  const treeItems = SIDEBAR_TREE[scope];
  const [openTree, setOpenTree] = useState<Record<string, boolean>>({});

  const getItemKey = (item: SidebarItem, parentKey: string) =>
    `${parentKey}/${item.labelKey ?? item.label ?? item.href}`;

  const resolveItemHref = (item: SidebarItem) => {
    if (item.disabled) return null;
    return resolveHref(item.href);
  };

  const isRootDashboardHref = (href: string) => href === "/global" || href === "/company/[companyId]";

  const isActivePath = (resolvedHref: string | null, rawHref: string, exactMatch?: boolean) => {
    if (!resolvedHref) return false;
    if (exactMatch || isRootDashboardHref(rawHref)) return currentPathname === resolvedHref;
    return currentPathname === resolvedHref || currentPathname.startsWith(`${resolvedHref}/`);
  };

  const isTreeItemActive = (item: SidebarItem): boolean => {
    const resolvedHref = resolveItemHref(item);
    if (isActivePath(resolvedHref, item.href, item.exactMatch)) return true;
    return item.children ? item.children.some((child) => isTreeItemActive(child)) : false;
  };

  useEffect(() => {
    if (!treeItems?.length) return;
    const activeKeys = new Set<string>();
    const walk = (items: SidebarItem[], parentKey: string) => {
      items.forEach((item) => {
        const key = getItemKey(item, parentKey);
        const active = isTreeItemActive(item);
        if (active) activeKeys.add(key);
        if (item.children?.length) walk(item.children, key);
      });
    };
    walk(treeItems, "tree");
    setOpenTree((prev) => {
      const next = { ...prev };
      activeKeys.forEach((key) => {
        if (!next[key]) next[key] = true;
      });
      return next;
    });
  }, [treeItems, currentPathname, companyId, branchId, vendorId]);

  return (
    <div className="mx-auto flex gap-6">
      <aside className="w-64 shrink-0">
        <nav className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-slate-950/85 via-slate-900/70 to-slate-950/85 p-4 text-sm shadow-[0_24px_60px_-32px_rgba(15,23,42,0.85)]">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-emerald-400/20 blur-3xl" />
            <div className="absolute -left-24 -bottom-24 h-52 w-52 rounded-full bg-amber-400/20 blur-3xl" />
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/5 to-transparent" />
          </div>
          <div className="relative mb-4 flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/50">Section</div>
            <div className="rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.2em] text-white/80">
              {activeCategory}
            </div>
          </div>
          {treeItems?.length ? (
            <div className="relative flex flex-col gap-2">
              {treeItems.map((item) => {
                const key = getItemKey(item, "tree");
                const isOpen = openTree[key];
                const resolvedHref = resolveItemHref(item);
                const active = isTreeItemActive(item);
                const label = item.labelKey ? t(item.labelKey) : item.label ?? item.href;
                const hasChildren = Boolean(item.children?.length);
                const classes = `group relative flex items-center justify-between rounded-xl px-4 py-2.5 pl-6 transition ${
                  active
                    ? "bg-white/12 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)]"
                    : "text-white/80 hover:bg-white/6"
                } ${resolvedHref ? "" : "opacity-50 cursor-not-allowed"}`;

                return (
                  <div key={key} className="rounded-xl border border-white/5 bg-white/[0.02]">
                    <div className="flex items-center">
                      {resolvedHref ? (
                        <Link href={resolvedHref} className={`${classes} flex-1`}>
                          <span
                            className={`absolute left-2 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full transition ${
                              active
                                ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]"
                                : "bg-white/10 group-hover:bg-white/30"
                            }`}
                          />
                          <span className="truncate">{label}</span>
                          <span
                            className={`text-[10px] uppercase tracking-[0.2em] ${
                              active ? "text-emerald-200/80" : "text-white/30"
                            }`}
                          />
                        </Link>
                      ) : (
                        <span className={`${classes} flex-1`} aria-disabled>
                          <span className="absolute left-2 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-white/10" />
                          <span className="truncate">{label}</span>
                          <span className="text-[10px] uppercase tracking-[0.2em] text-white/20">Soon</span>
                        </span>
                      )}
                      {hasChildren ? (
                        <button
                          type="button"
                          onClick={() => setOpenTree((prev) => ({ ...prev, [key]: !prev[key] }))}
                          className="px-3 py-2 text-xs uppercase tracking-[0.2em] text-white/50 hover:text-white"
                        >
                          {isOpen ? "-" : "+"}
                        </button>
                      ) : null}
                    </div>
                    {hasChildren && isOpen ? (
                      <div className="flex flex-col gap-1.5 px-2 pb-2">
                        {item.children?.map((child) => {
                          const childKey = getItemKey(child, key);
                          const childHref = resolveItemHref(child);
                          const childActive = isActivePath(childHref, child.href, child.exactMatch);
                          const childLabel = child.labelKey ? t(child.labelKey) : child.label ?? child.href;
                          const childClasses = `group relative flex items-center justify-between rounded-xl px-4 py-2.5 pl-6 text-sm transition ${
                            childActive
                              ? "bg-white/12 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)]"
                              : "text-white/70 hover:bg-white/6"
                          } ${childHref ? "" : "opacity-50 cursor-not-allowed"}`;
                          return childHref ? (
                            <Link key={childKey} href={childHref} className={childClasses}>
                              <span
                                className={`absolute left-2 top-1/2 h-4 w-1 -translate-y-1/2 rounded-full transition ${
                                  childActive
                                    ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]"
                                    : "bg-white/10 group-hover:bg-white/30"
                                }`}
                              />
                              <span className="truncate">{childLabel}</span>
                            </Link>
                          ) : (
                            <span key={childKey} className={childClasses} aria-disabled>
                              <span className="absolute left-2 top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-white/10" />
                              <span className="truncate">{childLabel}</span>
                              <span className="text-[10px] uppercase tracking-[0.2em] text-white/20">Soon</span>
                            </span>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              {mainGroups.length ? (
                <div className="relative mb-4 flex flex-col gap-2">
                  {mainGroups.map((group) => {
                    const isOpen = openMainGroups[group.key];
                    const enabledItems = group.items.filter((entry) => entry.resolvedHref);
                    const disabledItems = group.items.filter((entry) => !entry.resolvedHref);
                    return (
                      <div key={group.key} className="rounded-xl border border-white/5 bg-white/[0.02]">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenMainGroups((prev) => ({ ...prev, [group.key]: !prev[group.key] }))
                          }
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] uppercase tracking-[0.2em] text-white/70 hover:text-white"
                        >
                          <span>{group.key}</span>
                          <span className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/40">
                            <span>{group.items.length} items</span>
                            <span className="text-xs">{isOpen ? "-" : "+"}</span>
                          </span>
                        </button>
                        {isOpen ? (
                          <div className="flex flex-col gap-1.5 px-2 pb-2">
                            {enabledItems.map(({ item, resolvedHref }) => {
                              const active = resolvedHref ? currentPathname.startsWith(resolvedHref) : false;
                              const label = item.labelKey ? t(item.labelKey) : item.label ?? item.href;
                              const classes = `group relative flex items-center justify-between rounded-xl px-4 py-2.5 pl-6 transition ${
                                active
                                  ? "bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
                                  : "text-white/80 hover:bg-white/5"
                              }`;
                              return (
                                <Link key={item.href} href={resolvedHref as string} className={classes}>
                                  <span
                                    className={`absolute left-2 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full transition ${
                                      active
                                        ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]"
                                        : "bg-white/10 group-hover:bg-white/30"
                                    }`}
                                  />
                                  <span className="truncate">{label}</span>
                              <span
                                className={`text-[10px] uppercase tracking-[0.2em] ${
                                  active ? "text-emerald-200/80" : "text-white/30"
                                }`}
                              />
                            </Link>
                              );
                            })}
                            {disabledItems.length ? (
                              <div className="px-2 pt-2 text-[10px] uppercase tracking-[0.2em] text-white/30">
                                Unavailable
                              </div>
                            ) : null}
                            {disabledItems.map(({ item }) => {
                              const label = item.labelKey ? t(item.labelKey) : item.label ?? item.href;
                              return (
                                <span
                                  key={item.href}
                                  className="group relative flex items-center justify-between rounded-xl px-4 py-2.5 pl-6 text-white/40"
                                  aria-disabled
                                >
                                  <span className="absolute left-2 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-white/10" />
                                  <span className="truncate">{label}</span>
                                  <span className="text-[10px] uppercase tracking-[0.2em] text-white/20">Soon</span>
                                </span>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
              <div className="relative flex flex-col gap-2">
                {sections.map((section) => {
                  const isOpen = openSections[section.category];
                  const builtItems = buildSectionItems(section.items);
                  const enabledItems = builtItems.filter((entry) => entry.resolvedHref);
                  const disabledItems = builtItems.filter((entry) => !entry.resolvedHref);
                  return (
                    <div key={section.category} className="rounded-xl border border-white/5 bg-white/[0.02]">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenSections((prev) => ({ ...prev, [section.category]: !prev[section.category] }))
                        }
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] uppercase tracking-[0.2em] text-white/70 hover:text-white"
                      >
                        <span>{section.category}</span>
                        <span className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/40">
                          <span>{builtItems.length} items</span>
                          <span className="text-xs">{isOpen ? "-" : "+"}</span>
                        </span>
                      </button>
                      {isOpen ? (
                        <div className="flex flex-col gap-1.5 px-2 pb-2">
                          {enabledItems.map(({ item, resolvedHref }) => {
                            const active = resolvedHref ? currentPathname.startsWith(resolvedHref) : false;
                            const label = item.labelKey ? t(item.labelKey) : item.label ?? item.href;
                            const classes = `group relative flex items-center justify-between rounded-xl px-4 py-2.5 pl-6 transition ${
                              active
                                ? "bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
                                : "text-white/80 hover:bg-white/5"
                            } ${resolvedHref ? "" : "opacity-50 cursor-not-allowed"}`;

                            return (
                              <Link key={item.href} href={resolvedHref as string} className={classes}>
                                <span
                                  className={`absolute left-2 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full transition ${
                                    active
                                      ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]"
                                      : "bg-white/10 group-hover:bg-white/30"
                                  }`}
                                />
                                <span className="truncate">{label}</span>
                                <span
                                  className={`text-[10px] uppercase tracking-[0.2em] ${
                                    active ? "text-emerald-200/80" : "text-white/30"
                                  }`}
                                >
                                  Go
                                </span>
                              </Link>
                            );
                          })}
                          {disabledItems.length ? (
                            <div className="px-2 pt-2 text-[10px] uppercase tracking-[0.2em] text-white/30">
                              Unavailable
                            </div>
                          ) : null}
                          {disabledItems.map(({ item }) => {
                            const label = item.labelKey ? t(item.labelKey) : item.label ?? item.href;
                            return (
                              <span
                                key={item.href}
                                className="group relative flex items-center justify-between rounded-xl px-4 py-2.5 pl-6 text-white/40"
                                aria-disabled
                              >
                                <span className="absolute left-2 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-white/10" />
                                <span className="truncate">{label}</span>
                                <span className="text-[10px] uppercase tracking-[0.2em] text-white/20">Soon</span>
                              </span>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

// helper for reuse
SidebarNav.getActiveCategory = CategoryNav.getActiveCategory;
