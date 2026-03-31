"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CategoryNav, Category } from "./CategoryNav";
import { SIDEBAR_CONFIG, SIDEBAR_TREE, NavScope, SidebarItem } from "./sidebarConfig";
import { isModuleVisibleForScope, CURRENT_MODULE_PHASE } from "@repo/ai-core/shared/scopes-and-modules";
import { useI18n } from "../i18n";
import { DOCUMENTATION_STRUCTURE } from "../docs/docsStructure";

/* ------------------------------------------------------------------ */
/*  Breadcrumb context — consumed by any descendant to show path       */
/* ------------------------------------------------------------------ */
interface BreadcrumbEntry { label: string; href: string | null }
const BreadcrumbCtx = createContext<BreadcrumbEntry[]>([]);
export function useSidebarBreadcrumb() { return useContext(BreadcrumbCtx); }

/* ------------------------------------------------------------------ */
/*  Section accent colours                                             */
/* ------------------------------------------------------------------ */
const SECTION_COLORS: Record<string, { bg: string; text: string; dot: string; glow: string; iconBg: string; iconText: string }> = {
  Sales:                  { bg: "bg-blue-500/15",    text: "text-blue-300",    dot: "bg-blue-400",    glow: "shadow-[0_0_8px_rgba(96,165,250,0.8)]",  iconBg: "bg-blue-500/20",    iconText: "text-blue-300" },
  "Service Center":       { bg: "bg-orange-500/15",  text: "text-orange-300",  dot: "bg-orange-400",  glow: "shadow-[0_0_8px_rgba(251,146,60,0.8)]",  iconBg: "bg-orange-500/20",  iconText: "text-orange-300" },
  "Operations Dashboard": { bg: "bg-violet-500/15",  text: "text-violet-300",  dot: "bg-violet-400",  glow: "shadow-[0_0_8px_rgba(167,139,250,0.8)]", iconBg: "bg-violet-500/20",  iconText: "text-violet-300" },
  "Parts Quotes":         { bg: "bg-amber-500/15",   text: "text-amber-300",   dot: "bg-amber-400",   glow: "shadow-[0_0_8px_rgba(251,191,36,0.8)]",  iconBg: "bg-amber-500/20",   iconText: "text-amber-300" },
};
const DEFAULT_COLOR = { bg: "bg-emerald-500/15", text: "text-emerald-300", dot: "bg-emerald-400", glow: "shadow-[0_0_8px_rgba(52,211,153,0.8)]", iconBg: "bg-emerald-500/20", iconText: "text-emerald-300" };

/* ------------------------------------------------------------------ */
/*  localStorage helpers                                               */
/* ------------------------------------------------------------------ */
const LS_PREFIX = "sidebar_";
function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const v = localStorage.getItem(LS_PREFIX + key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function lsSet(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(value)); } catch { /* quota */ }
}

type PermissionScopeKey = {
  scope: NavScope;
  companyId?: string;
  branchId?: string;
  vendorId?: string;
};

const PERMISSIONS_TTL_MS = 30_000;
const permissionsCache = new Map<string, { ts: number; permissions: string[] }>();
const permissionsInflight = new Map<string, Promise<string[]>>();

function buildPermissionsCacheKey(input: PermissionScopeKey): string {
  return [
    input.scope,
    input.companyId ?? "",
    input.branchId ?? "",
    input.vendorId ?? "",
  ].join("|");
}

async function fetchPermissionsOnce(input: PermissionScopeKey): Promise<string[]> {
  const cacheKey = buildPermissionsCacheKey(input);
  const now = Date.now();
  const cached = permissionsCache.get(cacheKey);
  if (cached && now - cached.ts < PERMISSIONS_TTL_MS) {
    return cached.permissions;
  }

  const inflight = permissionsInflight.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const params = new URLSearchParams();
  params.set("scope", input.scope);
  if (input.scope !== "global" && input.companyId) {
    params.set("companyId", input.companyId);
    if (input.branchId) params.set("branchId", input.branchId);
    if (input.vendorId) params.set("vendorId", input.vendorId);
  }

  const request = fetch(`/api/auth/permissions/me?${params.toString()}`)
    .then(async (res) => {
      if (!res.ok) return [];
      const data = await res.json().catch(() => ({}));
      const permissions = Array.isArray(data?.permissions) ? data.permissions : [];
      permissionsCache.set(cacheKey, { ts: Date.now(), permissions });
      return permissions;
    })
    .catch(() => [])
    .finally(() => {
      permissionsInflight.delete(cacheKey);
    });

  permissionsInflight.set(cacheKey, request);
  return request;
}

const GLOBAL_SUBTITLES = [
  { label: "Overview", href: "/global/docs" },
  ...(DOCUMENTATION_STRUCTURE.find((chapter) => chapter.key === "global")?.sessions ?? []).map((session) => ({
    label: session.title,
    href: `/global/docs/${session.slug}`,
  })),
];

const COMPANY_SESSIONS = DOCUMENTATION_STRUCTURE.find((chapter) => chapter.key === "company")?.sessions ?? [];
const COMPANY_SUBTITLES = [
  { label: "Overview", href: COMPANY_SESSIONS[0] ? `/global/docs/${COMPANY_SESSIONS[0].slug}` : "/global/docs" },
  ...COMPANY_SESSIONS.map((session) => ({
    label: session.title,
    href: `/global/docs/${session.slug}`,
  })),
];
const getChapterSubtitles = (key: string) => {
  if (key === "global") {
    return GLOBAL_SUBTITLES;
  }
  if (key === "company") {
    return COMPANY_SUBTITLES;
  }
  const sessions = DOCUMENTATION_STRUCTURE.find((chapter) => chapter.key === key)?.sessions ?? [];
  const firstHref = sessions[0] ? `/global/docs/${sessions[0].slug}` : "/global/docs";
  return [
    { label: "Overview", href: firstHref },
    ...sessions.map((session) => ({
      label: session.title,
      href: `/global/docs/${session.slug}`,
    })),
  ];
};

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
    <div className="mx-auto flex w-full max-w-[1720px] gap-6">
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
        const strict = scope === "branch" || scope === "company";
        return strict ? hasAnyExactPermission(item.permissionKeys) : hasAnyPermission(item.permissionKeys);
      }
      return true;
    });

  const categorySectionOrder: Category[] = [
    "Sales",
    "Service Center",
  ];

  const sections = categorySectionOrder
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
        const data = await fetchPermissionsOnce({ scope, companyId, branchId, vendorId });
        if (!cancelled) {
          setPermissions(data);
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

  const targetMainGroupKey = useMemo(() => {
    if (!mainGroups.length) return null;
    const activeGroup = mainGroups.find((group) =>
      group.items.some((entry) => entry.resolvedHref && currentPathname.startsWith(entry.resolvedHref))
    );
    return activeGroup?.key ?? mainGroups[0]?.key ?? null;
  }, [mainGroups, currentPathname]);

  useEffect(() => {
    if (!targetMainGroupKey) return;
    setOpenMainGroups((prev) =>
      prev[targetMainGroupKey] ? prev : { ...prev, [targetMainGroupKey]: true }
    );
  }, [targetMainGroupKey]);

  const treeItems = SIDEBAR_TREE[scope];
  const filteredTreeItems = useMemo(() => {
    if (!treeItems?.length) return treeItems;
    if (!permissionsLoaded) return [];
    const filterTree = (items: SidebarItem[]): SidebarItem[] =>
      items.flatMap((item) => {
        const childItems = item.children ? filterTree(item.children) : undefined;
        const strict = scope === "branch" || scope === "company";
        const allowed = !item.permissionKeys?.length
          ? true
          : permissionsLoaded
          ? strict
            ? hasAnyExactPermission(item.permissionKeys)
            : hasAnyPermission(item.permissionKeys)
          : false;
        if (!allowed) return [];
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
      let changed = false;
      const next = { ...prev };
      activeKeys.forEach((key) => {
        if (!next[key]) {
          next[key] = true;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [treeItems, currentPathname, companyId, branchId, vendorId]);


  // --- #1 Auto-link parent to first child ---
  const getParentHref = useCallback((item: SidebarItem): string | null => {
    if (item.children?.length) {
      const firstChild = item.children[0]!;
      return resolveHref(firstChild.href);
    }
    return resolveItemHref(item);
  }, [companyId, branchId, vendorId]);

  // --- #2 Remember last visited child per section ---
  const [lastVisited, setLastVisited] = useState<Record<string, string>>(() => lsGet("last_visited", {}));
  const getSmartHref = useCallback((item: SidebarItem): string | null => {
    const label = item.label ?? "";
    const saved = lastVisited[label];
    if (saved) {
      const resolved = resolveHref(saved);
      if (resolved) return resolved;
    }
    return getParentHref(item);
  }, [lastVisited, getParentHref]);

  // Track child visits
  useEffect(() => {
    if (!filteredTreeItems?.length) return;
    for (const item of filteredTreeItems) {
      if (!item.children?.length) continue;
      const label = item.label ?? "";
      for (const child of item.children) {
        const childHref = resolveItemHref(child);
        if (childHref && (currentPathname === childHref || currentPathname.startsWith(childHref + "/"))) {
          if (lastVisited[label] !== child.href) {
            const next = { ...lastVisited, [label]: child.href };
            setLastVisited(next);
            lsSet("last_visited", next);
          }
          break;
        }
      }
    }
  }, [currentPathname, filteredTreeItems]);

  // --- #4 Accordion: collapse others on expand ---
  const toggleSection = useCallback((key: string) => {
    setOpenTree((prev) => {
      const willOpen = !prev[key];
      if (!willOpen) return { ...prev, [key]: false };
      // Close all others, open this one
      const next: Record<string, boolean> = {};
      for (const k of Object.keys(prev)) next[k] = false;
      next[key] = true;
      return next;
    });
  }, []);

  // --- #5 Auto-scroll active child into view ---
  const activeChildRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (activeChildRef.current) {
      activeChildRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [currentPathname, openTree]);

  // --- #7 Section order (drag to reorder via localStorage) ---
  const [sectionOrder, setSectionOrder] = useState<string[]>(() => {
    const saved = lsGet<string[]>("section_order", []);
    return saved.length ? saved : (filteredTreeItems ?? []).map((i) => i.label ?? i.href);
  });
  // Sync if tree items change
  useEffect(() => {
    if (!filteredTreeItems?.length) return;
    const labels = filteredTreeItems.map((i) => i.label ?? i.href);
    const needsSync = labels.some((l) => !sectionOrder.includes(l)) || sectionOrder.some((l) => !labels.includes(l));
    if (needsSync) {
      const ordered = [...sectionOrder.filter((l) => labels.includes(l)), ...labels.filter((l) => !sectionOrder.includes(l))];
      setSectionOrder(ordered);
      lsSet("section_order", ordered);
    }
  }, [filteredTreeItems]);

  const moveSection = useCallback((label: string, dir: -1 | 1) => {
    setSectionOrder((prev) => {
      const idx = prev.indexOf(label);
      if (idx < 0) return prev;
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const a = next[idx]!; const b = next[target]!;
      next[idx] = b; next[target] = a;
      lsSet("section_order", next);
      return next;
    });
  }, []);

  // --- #8 Pinned favorites ---
  const [pinnedItems, setPinnedItems] = useState<string[]>(() => lsGet("pinned", []));
  const togglePin = useCallback((href: string) => {
    setPinnedItems((prev) => {
      const next = prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href];
      lsSet("pinned", next);
      return next;
    });
  }, []);

  // Collect all pinned child items
  const pinnedEntries = useMemo(() => {
    if (!filteredTreeItems?.length || !pinnedItems.length) return [];
    const entries: { label: string; href: string; parentLabel: string; color: typeof DEFAULT_COLOR }[] = [];
    for (const item of filteredTreeItems) {
      const color = SECTION_COLORS[item.label ?? ""] ?? DEFAULT_COLOR;
      for (const child of item.children ?? []) {
        if (pinnedItems.includes(child.href)) {
          const resolved = resolveItemHref(child);
          if (resolved) entries.push({ label: child.label ?? child.href, href: resolved, parentLabel: item.label ?? "", color });
        }
      }
    }
    return entries;
  }, [filteredTreeItems, pinnedItems, companyId, branchId, vendorId]);

  // --- #3 Keyboard shortcuts ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement)?.isContentEditable) return;

      // Number keys 1-4 to jump to sections
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 4 && filteredTreeItems?.length) {
          const orderedItems = sectionOrder
            .map((label) => filteredTreeItems.find((i) => (i.label ?? i.href) === label))
            .filter(Boolean) as SidebarItem[];
          const target = orderedItems[num - 1];
          if (target) {
            e.preventDefault();
            const href = getSmartHref(target);
            if (href) window.location.href = href;
          }
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filteredTreeItems, sectionOrder, getSmartHref]);

  // --- #10 Breadcrumb ---
  const breadcrumb = useMemo<BreadcrumbEntry[]>(() => {
    if (!filteredTreeItems?.length) return [];
    for (const item of filteredTreeItems) {
      const label = item.labelKey ? t(item.labelKey) : item.label ?? item.href;
      if (item.children?.length) {
        for (const child of item.children) {
          const childHref = resolveItemHref(child);
          if (childHref && (currentPathname === childHref || currentPathname.startsWith(childHref + "/"))) {
            const childLabel = child.labelKey ? t(child.labelKey) : child.label ?? child.href;
            return [{ label, href: getSmartHref(item) }, { label: childLabel, href: childHref }];
          }
        }
      }
      const href = resolveItemHref(item);
      if (href && (currentPathname === href || currentPathname.startsWith(href + "/"))) {
        return [{ label, href }];
      }
    }
    return [];
  }, [filteredTreeItems, currentPathname]);

  // --- Scroll fade detection ---
  const scrollRef = useRef<HTMLElement>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => setCanScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 8);
    check();
    el.addEventListener("scroll", check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", check); ro.disconnect(); };
  }, [filteredTreeItems]);

  // --- #6 Hover preview tooltip state ---
  const [hoverPreview, setHoverPreview] = useState<{ label: string; children: string[]; top: number } | null>(null);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  if (!sections.length && !filteredTreeItems?.length) {
    return <div className="w-full">{children}</div>;
  }

  // Sort tree items by user-defined order
  const orderedTreeItems = useMemo(() => {
    if (!filteredTreeItems?.length) return filteredTreeItems;
    return sectionOrder
      .map((label) => filteredTreeItems.find((i) => (i.label ?? i.href) === label))
      .filter(Boolean) as SidebarItem[];
  }, [filteredTreeItems, sectionOrder]);

  const navBaseClass =
    "relative max-h-[calc(100vh-2.5rem)] overflow-y-auto rounded-2xl border border-white/10 p-4 text-sm shadow-[0_24px_60px_-32px_rgba(15,23,42,0.85)] [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.45)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/25 hover:[&::-webkit-scrollbar-thumb]:bg-white/40";
  const desktopNavClass = "bg-gradient-to-b from-slate-950/85 via-slate-900/70 to-slate-950/85";
  const mobileNavClass = "bg-slate-950 border-white/20 shadow-2xl";

  const ChevronIcon = ({ open, className = "" }: { open: boolean; className?: string }) => (
    <svg className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-90" : ""} ${className}`} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
    </svg>
  );

  const PinIcon = ({ filled }: { filled: boolean }) => (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );

  const renderNav = (outerClass = desktopNavClass) => (
    <div className="relative">
      <nav ref={scrollRef} className={`${navBaseClass} ${outerClass}`} role="navigation" aria-label="Sidebar navigation">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="absolute -left-24 -bottom-24 h-52 w-52 rounded-full bg-amber-400/20 blur-3xl" />
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/5 to-transparent" />
        </div>
        <div className="relative mb-3">
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/50">Navigation</div>
        </div>

        {/* #8 Pinned favorites quick access */}
        {pinnedEntries.length > 0 ? (
          <div className="relative mb-3">
            <div className="mb-1.5 text-[10px] uppercase tracking-[0.2em] text-white/35">Pinned</div>
            <div className="flex flex-col gap-1">
              {pinnedEntries.map((pin) => (
                <Link
                  key={pin.href}
                  href={pin.href}
                  className={`group relative flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12px] transition duration-150 ${
                    currentPathname === pin.href || currentPathname.startsWith(pin.href + "/")
                      ? `${pin.color.bg} ${pin.color.text} shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]`
                      : "text-white/55 hover:bg-white/5 hover:text-white/80"
                  }`}
                >
                  <span className={`h-1 w-1 rounded-full ${pin.color.dot}`} />
                  <span className="truncate">{pin.label}</span>
                </Link>
              ))}
            </div>
            <div className="mt-2 border-b border-white/5" />
          </div>
        ) : null}

        {orderedTreeItems?.length ? (
          <div className="relative flex flex-col gap-2" role="tree">
            {orderedTreeItems.map((item, idx) => {
              const key = getItemKey(item, "tree");
              const isOpen = openTree[key];
              const active = isTreeItemActive(item);
              const hasActiveChild = item.children?.some((c) => isTreeItemActive(c)) ?? false;
              const label = item.labelKey ? t(item.labelKey) : item.label ?? item.href;
              const hasChildren = Boolean(item.children?.length);
              const childCount = item.children?.length ?? 0;
              const icon = SECTION_ICONS[label] ?? SECTION_ICONS.default;
              const color = SECTION_COLORS[label] ?? DEFAULT_COLOR;
              const smartHref = getSmartHref(item);

              const parentBg = active && !hasActiveChild
                ? `${color.bg} text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]`
                : hasActiveChild
                ? "bg-white/6 text-white"
                : "text-white/80 hover:bg-white/6";

              return (
                <div
                  key={key}
                  className="group/section rounded-xl border border-white/5 bg-white/[0.02]"
                  role="treeitem"
                  aria-expanded={hasChildren ? isOpen : undefined}
                  /* #6 Hover preview */
                  onMouseEnter={(e) => {
                    if (hasChildren && !isOpen) {
                      clearTimeout(hoverTimeout.current);
                      const rect = e.currentTarget.getBoundingClientRect();
                      hoverTimeout.current = setTimeout(() => {
                        setHoverPreview({
                          label,
                          children: (item.children ?? []).map((c) => c.label ?? c.href),
                          top: rect.top,
                        });
                      }, 400);
                    }
                  }}
                  onMouseLeave={() => { clearTimeout(hoverTimeout.current); setHoverPreview(null); }}
                >
                  <div className="flex items-center">
                    {smartHref ? (
                      <Link href={smartHref} className={`group relative flex flex-1 items-center gap-3 rounded-xl px-3 py-2.5 transition duration-150 ${parentBg}`}>
                        <span
                          className={`absolute left-1.5 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full transition ${
                            active ? `${color.dot} ${color.glow}` : hasActiveChild ? `${color.dot} opacity-50` : "bg-white/10 group-hover:bg-white/30"
                          }`}
                        />
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition ${active || hasActiveChild ? `${color.iconBg} ${color.iconText}` : "bg-white/5 text-white/50 group-hover:bg-white/10 group-hover:text-white/70"}`}>
                          {icon}
                        </span>
                        <span className="flex-1 truncate text-[13px] font-medium">{label}</span>
                        {hasChildren ? (
                          <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] tabular-nums text-white/40">{childCount}</span>
                        ) : null}
                      </Link>
                    ) : (
                      <span className={`group relative flex flex-1 items-center gap-3 rounded-xl px-3 py-2.5 opacity-50 cursor-not-allowed ${parentBg}`} aria-disabled>
                        <span className="absolute left-1.5 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-white/10" />
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/5 text-white/50">{icon}</span>
                        <span className="flex-1 truncate text-[13px] font-medium">{label}</span>
                      </span>
                    )}
                    <div className="flex shrink-0 items-center">
                      {/* #7 Reorder buttons */}
                      <div className="mr-0.5 flex flex-col opacity-0 transition-opacity group-hover/section:opacity-100">
                        {idx > 0 ? (
                          <button type="button" onClick={() => moveSection(label, -1)} className="px-0.5 text-white/30 hover:text-white/70" aria-label={`Move ${label} up`}>
                            <svg className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M14.77 12.79a.75.75 0 01-1.06-.02L10 9.168l-3.71 3.6a.75.75 0 11-1.08-1.04l4.25-4.5a.75.75 0 011.08 0l4.25 4.5a.75.75 0 01-.02 1.06z" clipRule="evenodd" /></svg>
                          </button>
                        ) : <span className="h-2.5" />}
                        {idx < (orderedTreeItems?.length ?? 0) - 1 ? (
                          <button type="button" onClick={() => moveSection(label, 1)} className="px-0.5 text-white/30 hover:text-white/70" aria-label={`Move ${label} down`}>
                            <svg className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.832l3.71-3.6a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                          </button>
                        ) : <span className="h-2.5" />}
                      </div>
                      {hasChildren ? (
                        <button
                          type="button"
                          onClick={() => toggleSection(key)}
                          className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/10 hover:text-white"
                          aria-label={isOpen ? `Collapse ${label}` : `Expand ${label}`}
                        >
                          <ChevronIcon open={!!isOpen} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {hasChildren ? (
                    <div
                      className="overflow-hidden transition-all duration-200 ease-in-out"
                      style={{ maxHeight: isOpen ? `${(childCount + 1) * 48}px` : "0px", opacity: isOpen ? 1 : 0 }}
                    >
                      <div className="flex flex-col gap-1 px-2 pb-2 pt-1" role="group">
                        {item.children?.map((child) => {
                          const childKey = getItemKey(child, key);
                          const childHref = resolveItemHref(child);
                          const childActive = isActivePath(childHref, child.href, child.exactMatch);
                          const childLabel = child.labelKey ? t(child.labelKey) : child.label ?? child.href;
                          const isPinned = pinnedItems.includes(child.href);
                          return childHref ? (
                            <div key={childKey} className="group/child flex items-center">
                              <Link
                                href={childHref}
                                role="treeitem"
                                ref={childActive ? activeChildRef : undefined}
                                className={`group relative flex flex-1 items-center rounded-lg px-3 py-2 pl-[2.75rem] text-[13px] transition duration-150 ${
                                  childActive
                                    ? `${color.bg} ${color.text} shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]`
                                    : "text-white/60 hover:bg-white/5 hover:text-white/90"
                                }`}
                              >
                                <span
                                  className={`absolute left-6 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full transition ${
                                    childActive ? `${color.dot} ${color.glow}` : "bg-white/20 group-hover:bg-white/40"
                                  }`}
                                />
                                <span className="truncate">{childLabel}</span>
                              </Link>
                              {/* #8 Pin toggle */}
                              <button
                                type="button"
                                onClick={() => togglePin(child.href)}
                                className={`ml-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded transition ${
                                  isPinned ? `${color.iconText}` : "text-white/15 opacity-0 group-hover/child:opacity-100 hover:text-white/50"
                                }`}
                                aria-label={isPinned ? `Unpin ${childLabel}` : `Pin ${childLabel}`}
                              >
                                <PinIcon filled={isPinned} />
                              </button>
                            </div>
                          ) : (
                            <span key={childKey} className="group relative flex items-center rounded-lg px-3 py-2 pl-[2.75rem] text-[13px] text-white/30 cursor-not-allowed" aria-disabled role="treeitem">
                              <span className="absolute left-6 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-white/10" />
                              <span className="truncate">{childLabel}</span>
                            </span>
                          );
                        })}
                      </div>
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
                      <button type="button" onClick={() => setOpenMainGroups((prev) => ({ ...prev, [group.key]: !prev[group.key] }))} className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] uppercase tracking-[0.2em] text-white/70 hover:text-white">
                        <span>{group.key}</span>
                        <span className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/40">
                          <span>{group.items.length}</span>
                          <ChevronIcon open={!!isOpen} />
                        </span>
                      </button>
                      <div className="overflow-hidden transition-all duration-200 ease-in-out" style={{ maxHeight: isOpen ? "600px" : "0px", opacity: isOpen ? 1 : 0 }}>
                        <div className="flex flex-col gap-1.5 px-2 pb-2">
                          {enabledItems.map(({ item, resolvedHref }) => {
                            const active = resolvedHref ? currentPathname.startsWith(resolvedHref) : false;
                            const label = item.labelKey ? t(item.labelKey) : item.label ?? item.href;
                            return (
                              <Link key={item.href} href={resolvedHref as string} className={`group relative flex items-center rounded-lg px-3 py-2 pl-6 text-[13px] transition duration-150 ${active ? "bg-emerald-500/15 text-white shadow-[inset_0_0_0_1px_rgba(52,211,153,0.25)]" : "text-white/60 hover:bg-white/5 hover:text-white/90"}`}>
                                <span className={`absolute left-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full transition ${active ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-white/20 group-hover:bg-white/40"}`} />
                                <span className="truncate">{label}</span>
                              </Link>
                            );
                          })}
                          {disabledItems.map(({ item }) => {
                            const label = item.labelKey ? t(item.labelKey) : item.label ?? item.href;
                            return (
                              <span key={item.href} className="relative flex items-center rounded-lg px-3 py-2 pl-6 text-[13px] text-white/30 cursor-not-allowed" aria-disabled>
                                <span className="absolute left-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-white/10" />
                                <span className="truncate">{label}</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </>
        )}
      </nav>
      {/* Scroll fade indicator */}
      <div className={`pointer-events-none absolute inset-x-0 bottom-0 h-8 rounded-b-2xl bg-gradient-to-t from-slate-950/90 to-transparent transition-opacity duration-200 ${canScrollDown ? "opacity-100" : "opacity-0"}`} />
      {/* #6 Hover preview tooltip */}
      {hoverPreview ? (
        <div
          className="fixed left-[17.5rem] z-50 w-44 rounded-xl border border-white/10 bg-slate-900/95 p-3 shadow-xl backdrop-blur-lg"
          style={{ top: hoverPreview.top }}
          onMouseEnter={() => clearTimeout(hoverTimeout.current)}
          onMouseLeave={() => setHoverPreview(null)}
        >
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/60">{hoverPreview.label}</div>
          <div className="flex flex-col gap-1">
            {hoverPreview.children.map((c) => (
              <div key={c} className="flex items-center gap-2 text-[12px] text-white/50">
                <span className="h-1 w-1 rounded-full bg-white/30" />
                {c}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );

  // --- Mobile bottom tab items ---
  const mobileTabItems = useMemo(() => {
    if (!orderedTreeItems?.length) return [];
    return orderedTreeItems.slice(0, 4).map((item) => {
      const label = item.label ?? item.href;
      const color = SECTION_COLORS[label] ?? DEFAULT_COLOR;
      return {
        label,
        href: getSmartHref(item),
        active: isTreeItemActive(item),
        icon: SECTION_ICONS[label] ?? SECTION_ICONS.default,
        color,
      };
    });
  }, [orderedTreeItems, currentPathname]);

  const overlayStateClass = mobileSidebarOpen
    ? "opacity-100 pointer-events-auto"
    : "opacity-0 pointer-events-none";
  const panelTransformClass = mobileSidebarOpen ? "translate-x-0" : "-translate-x-full";

  return (
    <BreadcrumbCtx.Provider value={breadcrumb}>
      <div className="relative">
        <div className="mx-auto flex gap-6">
          <aside className="hidden lg:block w-64 shrink-0 sticky top-4 self-start">{renderNav()}</aside>
          <div className="min-w-0 flex-1 pb-20 lg:pb-0">
            {/* #10 Breadcrumb bar */}
            {breadcrumb.length > 0 ? (
              <div className="mb-4 flex items-center gap-1.5 text-[12px] text-white/40">
                {breadcrumb.map((entry, i) => (
                  <React.Fragment key={entry.label}>
                    {i > 0 ? (
                      <svg className="h-3 w-3 text-white/20" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                      </svg>
                    ) : null}
                    {entry.href ? (
                      <Link href={entry.href} className={`rounded px-1.5 py-0.5 transition hover:bg-white/5 hover:text-white/70 ${i === breadcrumb.length - 1 ? "text-white/70 font-medium" : ""}`}>
                        {entry.label}
                      </Link>
                    ) : (
                      <span className={i === breadcrumb.length - 1 ? "text-white/70 font-medium" : ""}>{entry.label}</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            ) : null}
            {children}
          </div>
        </div>
        {/* Mobile slide-out drawer */}
        <div className={`lg:hidden fixed inset-0 z-50 flex transition-opacity duration-300 ${overlayStateClass}`}>
          <button type="button" className="absolute inset-0 bg-black/40 transition-opacity duration-300" aria-label="Close sidebar" onClick={onRequestClose} />
          <div className={`relative h-full w-72 p-4 transition-transform duration-300 ${panelTransformClass}`}>
            {renderNav(mobileNavClass)}
          </div>
        </div>
        {/* Mobile bottom tab bar with section colors */}
        {mobileTabItems.length > 0 ? (
          <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-white/10 bg-slate-950/95 backdrop-blur-lg">
            <div className="flex items-stretch justify-around px-2 py-1">
              {mobileTabItems.map((tab) =>
                tab.href ? (
                  <Link
                    key={tab.label}
                    href={tab.href}
                    className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-center transition ${
                      tab.active ? tab.color.text : "text-white/50 hover:text-white/80"
                    }`}
                  >
                    <span className={`flex h-6 w-6 items-center justify-center ${tab.active ? tab.color.iconText : ""}`}>
                      {tab.icon}
                    </span>
                    <span className="text-[10px] font-medium leading-tight truncate max-w-[4.5rem]">{tab.label}</span>
                    {tab.active ? <span className={`mt-0.5 h-0.5 w-4 rounded-full ${tab.color.dot}`} /> : null}
                  </Link>
                ) : (
                  <span key={tab.label} className="flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-center text-white/25 cursor-not-allowed">
                    <span className="flex h-6 w-6 items-center justify-center">{tab.icon}</span>
                    <span className="text-[10px] font-medium leading-tight truncate max-w-[4.5rem]">{tab.label}</span>
                  </span>
                )
              )}
            </div>
          </div>
        ) : null}
      </div>
    </BreadcrumbCtx.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  Section icons (inline SVG, no external deps)                       */
/* ------------------------------------------------------------------ */
const SECTION_ICONS: Record<string, React.ReactNode> = {
  Sales: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
    </svg>
  ),
  "Service Center": (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
    </svg>
  ),
  "Operations Dashboard": (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="4" rx="1" />
      <rect x="14" y="10" width="7" height="11" rx="1" />
      <rect x="3" y="13" width="7" height="8" rx="1" />
    </svg>
  ),
  "Parts Quotes": (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
    </svg>
  ),
  default: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4l3 3" />
    </svg>
  ),
};

function DocsSidebar({ currentPathname }: { currentPathname: string }) {
  const [openChapters, setOpenChapters] = useState<Record<string, boolean>>(() => ({
    [DOCUMENTATION_STRUCTURE[0]?.key ?? ""]: true,
  }));

  useEffect(() => {
    const activeChapter = DOCUMENTATION_STRUCTURE.find((chapter) =>
      chapter.sessions.some((session) => currentPathname === `/global/docs/${session.slug}`)
    );
    if (!activeChapter) return;
    setOpenChapters((prev) => ({ ...prev, [activeChapter.key]: true }));
  }, [currentPathname]);

  const toggleChapter = (key: string) => {
    setOpenChapters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <nav className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-slate-950/85 via-slate-900/70 to-slate-950/85 p-4 text-sm shadow-[0_24px_60px_-32px_rgba(15,23,42,0.85)]">
      <div className="relative mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/60">Documentation</p>
          <p className="text-xs text-white/85">Global system handbook</p>
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
                <span className="text-sm font-semibold uppercase tracking-[0.16em] text-white">{chapter.title}</span>
                <span className="text-[10px] uppercase tracking-[0.14em] text-white/65">{chapter.tagline}</span>
              </button>
              {isOpen && (
                <div className="mt-3 space-y-2">
                  {getChapterSubtitles(chapter.key).map((subtitle) => (
                    <DocNavItem
                      key={subtitle.label}
                      href={subtitle.href}
                      label={subtitle.label}
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
  const active =
    href === "/global/docs"
      ? currentPathname === href
      : currentPathname === href || currentPathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={`group relative flex items-center gap-3 rounded-2xl border px-3 py-2 text-sm font-semibold uppercase tracking-[0.12em] text-white transition duration-200 ${
        active
          ? "border-primary/60 bg-primary/20 text-white shadow-[inset_0_0_0_1px_rgba(16,185,129,0.35)]"
          : "border-white/10 bg-black/40 hover:border-white/50 hover:bg-white/[0.06]"
      }`}
    >
      <span
        className={`h-6 w-1 rounded-full transition ${
          active ? "bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.8)]" : "bg-white/30 group-hover:bg-white/55"
        }`}
      />
      <span className="flex-1 text-left">{label}</span>
      {badge && (
        <span className="rounded-full border border-white/25 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-white/80">
          {badge}
        </span>
      )}
    </Link>
  );
}
