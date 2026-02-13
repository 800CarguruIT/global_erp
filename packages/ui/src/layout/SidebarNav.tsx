"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CategoryNav, Category } from "./CategoryNav";
import { SIDEBAR_CONFIG, SIDEBAR_TREE, NavScope, SidebarItem } from "./sidebarConfig";
import { isModuleVisibleForScope, CURRENT_MODULE_PHASE } from "@repo/ai-core/shared/scopes-and-modules";
import { useI18n } from "../i18n";
import { DOCUMENTATION_STRUCTURE } from "../docs/docsStructure";

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function getCompanyIdFromBranchCookie(): string | null {
  const lastBranchPath = getCookieValue("last_branch_path");
  const match = lastBranchPath?.match(/^\/company\/([^/]+)\/branches\/([^/]+)/);
  return match?.[1] ?? null;
}

function getBranchIdFromBranchCookie(): string | null {
  const lastBranchPath = getCookieValue("last_branch_path");
  const match = lastBranchPath?.match(/^\/company\/([^/]+)\/branches\/([^/]+)/);
  return match?.[2] ?? null;
}

export function SidebarNav({
  scope,
  activeCategory,
  currentPathname,
  children,
  mobileSidebarOpen,
  onRequestClose,
}: {
  scope: NavScope;
  activeCategory: Category;
  currentPathname: string;
  children: React.ReactNode;
  mobileSidebarOpen?: boolean;
  onRequestClose?: () => void;
}) {
  const { t } = useI18n();

  const isDocsRoute = currentPathname.startsWith("/global/docs");
  if (isDocsRoute) {
    return (
    <div className="mx-auto flex gap-6">
      <aside className="w-64 shrink-0">
        <DocsSidebar currentPathname={currentPathname} />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

  const [permissions, setPermissions] = useState<string[] | null>(null);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  const hasAnyPermission = useMemo(() => {
    const permSet = new Set(permissions ?? []);
    return (keys: string[]) =>
      keys.some(
        (key) =>
          permSet.has(key) ||
          permSet.has("global.admin") ||
          permSet.has("company.admin") ||
          permSet.has("branch.admin")
      );
  }, [permissions]);

  const hasAnyExactPermission = useMemo(() => {
    const permSet = new Set(permissions ?? []);
    return (keys: string[]) => keys.some((key) => permSet.has(key));
  }, [permissions]);

  const resolveItems = (category: Category) =>
    (SIDEBAR_CONFIG[scope]?.[category] || []).filter((item) => {
      if (scope === "global" && item.href === "/global") return false;
      if (item.moduleKey && !isModuleVisibleForScope(scope as any, item.moduleKey as any, CURRENT_MODULE_PHASE)) {
        return false;
      }
      if (item.permissionKeys?.length) {
        if (!permissionsLoaded) return false;
        const strict = scope === "branch";
        return strict ? hasAnyExactPermission(item.permissionKeys) : hasAnyPermission(item.permissionKeys);
      }
      return true;
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

  const pathParts = currentPathname.split("/").filter(Boolean);
  const isBranchRoot = pathParts[0] === "branches";
  const companyId =
    pathParts[0] === "company"
      ? pathParts[1]
      : isBranchRoot
      ? getCompanyIdFromBranchCookie() ?? undefined
      : undefined;
  const branchId =
    pathParts[0] === "company" && pathParts[2] === "branches"
      ? pathParts[3]
      : isBranchRoot
      ? pathParts[1] === "leads"
        ? getBranchIdFromBranchCookie() ?? undefined
        : pathParts[1]
      : undefined;
  const vendorId = pathParts[2] === "vendors" ? pathParts[3] : undefined;

  useEffect(() => {
    let cancelled = false;
    async function loadPermissions() {
      if (scope !== "global" && !companyId) {
        setPermissions(null);
        setPermissionsLoaded(false);
        return;
      }
      setPermissionsLoaded(false);
      try {
        const params = new URLSearchParams();
        params.set("scope", scope);
        if (scope !== "global" && companyId) {
          params.set("companyId", companyId);
          if (branchId) params.set("branchId", branchId);
          if (vendorId) params.set("vendorId", vendorId);
        }
        const res = await fetch(`/api/auth/permissions/me?${params.toString()}`);
        if (!res.ok) {
          if (!cancelled) {
            setPermissions([]);
            setPermissionsLoaded(true);
          }
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setPermissions(Array.isArray(data?.permissions) ? data.permissions : []);
          setPermissionsLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setPermissions([]);
          setPermissionsLoaded(true);
        }
      }
    }
    loadPermissions();
    return () => {
      cancelled = true;
    };
  }, [scope, companyId, branchId, vendorId]);

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
    if (isBranchRoot && companyId && branchId) {
      const branchPrefix = `/company/${companyId}/branches/${branchId}`;
      if (next.startsWith(branchPrefix)) {
        next = `/branches/${branchId}${next.slice(branchPrefix.length)}`;
      }
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
  const filteredTreeItems = useMemo(() => {
    if (!treeItems?.length) return treeItems;
    if (!permissionsLoaded) return treeItems;
    const filterTree = (items: SidebarItem[]): SidebarItem[] =>
      items.flatMap((item) => {
        const childItems = item.children ? filterTree(item.children) : undefined;
        const strict = scope === "branch";
        const allowed = !item.permissionKeys?.length
          ? true
          : permissionsLoaded
          ? strict
            ? hasAnyExactPermission(item.permissionKeys)
            : hasAnyPermission(item.permissionKeys)
          : false;
        if (!allowed && (!childItems || childItems.length === 0)) return [];
        return [{ ...item, children: childItems }];
      });
    return filterTree(treeItems);
  }, [treeItems, permissionsLoaded, permissions, scope, hasAnyPermission, hasAnyExactPermission]);
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
    if (!filteredTreeItems?.length) return;
    const activeKeys = new Set<string>();
    const walk = (items: SidebarItem[], parentKey: string) => {
      items.forEach((item) => {
        const key = getItemKey(item, parentKey);
        const active = isTreeItemActive(item);
        if (active) activeKeys.add(key);
        if (item.children?.length) walk(item.children, key);
      });
    };
    walk(filteredTreeItems, "tree");
    setOpenTree((prev) => {
      const next = { ...prev };
      activeKeys.forEach((key) => {
        if (!next[key]) next[key] = true;
      });
      return next;
    });
  }, [treeItems, currentPathname, companyId, branchId, vendorId]);


  if (!sections.length && !filteredTreeItems?.length) {
    return <div className="mx-auto max-w-6xl">{children}</div>;
  }

  const navBaseClass =
    "relative max-h-[calc(100vh-2.5rem)] overflow-y-auto rounded-2xl border border-white/10 p-4 text-sm shadow-[0_24px_60px_-32px_rgba(15,23,42,0.85)] [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.45)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/25 hover:[&::-webkit-scrollbar-thumb]:bg-white/40";
  const desktopNavClass = "bg-gradient-to-b from-slate-950/85 via-slate-900/70 to-slate-950/85";
  const mobileNavClass = "bg-slate-950 border-white/20 shadow-2xl";

  const renderNav = (outerClass = desktopNavClass) => (
    <nav className={`${navBaseClass} ${outerClass}`}>
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
          {filteredTreeItems?.length ? (
            <div className="relative flex flex-col gap-2">
              {filteredTreeItems.map((item) => {
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
  );

  const overlayStateClass = mobileSidebarOpen
    ? "opacity-100 pointer-events-auto"
    : "opacity-0 pointer-events-none";
  const panelTransformClass = mobileSidebarOpen ? "translate-x-0" : "-translate-x-full";

  return (
    <div className="relative">
      <div className="mx-auto flex gap-6">
        <aside className="hidden lg:block shrink-0">{renderNav()}</aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      <div className={`lg:hidden fixed inset-0 z-50 flex transition-opacity duration-300 ${overlayStateClass}`}>
        <button
          type="button"
          className="absolute inset-0 bg-black/40 transition-opacity duration-300"
          aria-label="Close sidebar"
          onClick={onRequestClose}
        />
        <div className={`relative h-full w-72 p-4 transition-transform duration-300 ${panelTransformClass}`}>
          {renderNav(mobileNavClass)}
        </div>
      </div>
    </div>
  );
}

function DocsSidebar({ currentPathname }: { currentPathname: string }) {
  const [openChapters, setOpenChapters] = useState<Record<string, boolean>>(() => ({
    [DOCUMENTATION_STRUCTURE[0]?.key ?? ""]: true,
  }));

  const toggleChapter = (key: string) => {
    setOpenChapters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <nav className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-slate-950/85 via-slate-900/70 to-slate-950/85 p-4 text-sm shadow-[0_24px_60px_-32px_rgba(15,23,42,0.85)]">
      <div className="relative mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Documentation</p>
          <p className="text-xs text-white/70">Global system handbook</p>
        </div>
        <Link
          href="/global"
          className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white transition hover:border-white/40"
        >
          Dashboard
        </Link>
      </div>

      <div className="space-y-3">
        {DOCUMENTATION_STRUCTURE.map((chapter) => {
          const isOpen = Boolean(openChapters[chapter.key]);
          return (
            <div key={chapter.key} className="rounded-2xl border border-white/5 bg-white/[0.03] p-3">
              <button
                type="button"
                onClick={() => toggleChapter(chapter.key)}
                className="flex w-full flex-col items-start gap-1 text-left"
              >
                <span className="text-sm font-semibold uppercase tracking-[0.2em] text-white">{chapter.title}</span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-white/50">{chapter.tagline}</span>
              </button>
              {chapter.key === "global" && isOpen && (
                <div className="mt-3 space-y-2">
                  {GLOBAL_SUBTITLES.map((subtitle) => (
                    <DocNavItem
                      key={subtitle.label}
                      href={subtitle.href}
                      label={subtitle.label}
                      currentPathname={currentPathname}
                    />
                  ))}
                </div>
              )}
              {isOpen && chapter.key !== "global" && (
                <div className="mt-3 space-y-1">
                  {chapter.sessions.map((session) => (
                    <DocNavItem
                      key={session.slug}
                      href={`/global/docs/${session.slug}`}
                      label={session.title}
                      badge={session.badge}
                      currentPathname={currentPathname}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

function DocNavItem({
  href,
  label,
  badge,
  currentPathname,
}: {
  href: string;
  label: string;
  badge?: string;
  currentPathname: string;
}) {
  const active = currentPathname === href || currentPathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={`group relative flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm font-semibold uppercase tracking-[0.15em] text-white transition hover:border-white/50 ${
        active ? "bg-white/[0.08]" : ""
      }`}
    >
      <span
        className={`h-6 w-1 rounded-full transition ${
          active ? "bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.8)]" : "bg-white/25 group-hover:bg-white/40"
        }`}
      />
      <span className="flex-1 text-left">{label}</span>
      {badge && (
        <span className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {badge}
        </span>
      )}
    </Link>
  );
}
