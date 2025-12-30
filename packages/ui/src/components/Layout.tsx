"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeProvider } from "../theme";
import { I18nProvider, useI18n, LanguageCode } from "../i18n";
import { SidebarNav } from "../layout/SidebarNav";
import { useGlobalUi } from "../providers/GlobalUiProvider";
import { CategoryNav } from "../layout/CategoryNav";

function ThemeSwitcher() {
  const { theme, setTheme } = useGlobalUi();
  const themes = [
    { id: "midnight", label: "Midnight Neon" },
    { id: "sunset", label: "Sunset Glow" },
    { id: "ocean", label: "Deep Ocean" },
    { id: "forest", label: "Neon Forest" },
    { id: "light", label: "Clean Light" },
  ];

  return (
    <div className="flex items-center gap-2 text-xs sm:text-sm">
      <span className="opacity-70 hidden sm:inline">Theme</span>
      <select
        value={theme}
        onChange={(e) => setTheme(e.target.value as any)}
        className="rounded-xl border border-white/20 bg-black/40 px-2 py-1 text-xs sm:text-sm outline-none"
      >
        {themes.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function LanguageSwitcher() {
  const { setLang, languages, loadingLang } = useI18n();
  const { language, setLanguage } = useGlobalUi();

  return (
    <div className="flex items-center gap-2 text-xs sm:text-sm">
      <span className="opacity-70 hidden sm:inline">Language</span>
      <select
        value={language}
        onChange={(e) => {
          const next = e.target.value as LanguageCode;
          setLanguage(next);
          setLang(next);
        }}
        className="rounded-xl border border-white/20 bg-black/40 px-2 py-1 text-xs sm:text-sm outline-none"
      >
        {languages.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
      {loadingLang && (
        <span className="text-[10px] uppercase tracking-wide opacity-60">
          AI loading…
        </span>
      )}
    </div>
  );
}

type ScopeInfo =
  | { scope: "global" }
  | { scope: "company"; companyId?: string }
  | { scope: "branch"; companyId?: string; branchId?: string }
  | { scope: "vendor"; companyId?: string; vendorId?: string };

type LayoutProps = {
  children: React.ReactNode;
  forceScope?: ScopeInfo;
};

function detectScope(pathname: string): ScopeInfo {
  if (pathname.startsWith("/company/")) {
    const parts = pathname.split("/").filter(Boolean);
    const companyId = parts[1];
    if (parts[2] === "branches" && parts[3] && parts[3] !== "new") {
      return { scope: "branch", companyId, branchId: parts[3] };
    }
    if (parts[2] === "vendors" && parts[3] && parts[3] !== "new") {
      return { scope: "vendor", companyId, vendorId: parts[3] };
    }
    return { scope: "company", companyId };
  }
  if (pathname.startsWith("/vendor/")) {
    const parts = pathname.split("/").filter(Boolean);
    return { scope: "vendor", vendorId: parts[1] };
  }
  return { scope: "global" };
}

function LayoutInner({ children, forceScope }: LayoutProps) {
  const pathname = usePathname() || "/";
  const scopeInfo = forceScope ?? detectScope(pathname);
  const hideSidebar = scopeInfo.scope === "global" && pathname === "/global";
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [branchName, setBranchName] = useState<string | null>(null);
  const settingsHref =
    scopeInfo.scope === "global"
      ? "/global/settings"
      : scopeInfo.scope === "company"
      ? `/company/${scopeInfo.companyId}/settings`
      : scopeInfo.scope === "branch"
      ? `/company/${scopeInfo.companyId}/branches/${scopeInfo.branchId}/settings`
      : `/company/${scopeInfo.companyId ?? ""}/vendors/${scopeInfo.vendorId ?? ""}/settings`;
  const brandHref =
    scopeInfo.scope === "global"
      ? "/global"
      : scopeInfo.scope === "company"
      ? `/company/${scopeInfo.companyId}`
      : scopeInfo.scope === "branch"
      ? `/company/${scopeInfo.companyId}/branches/${scopeInfo.branchId}`
      : `/company/${scopeInfo.companyId ?? ""}/vendors/${scopeInfo.vendorId ?? ""}`;
  const brandLabel =
    scopeInfo.scope === "global"
      ? "GLOBAL ERP"
      : scopeInfo.scope === "branch"
      ? `GLOBAL ERP - ${branchName ?? companyName ?? scopeInfo.branchId ?? "Branch"}`
      : `GLOBAL ERP - ${companyName ?? scopeInfo.companyId ?? "Company"}`;

  useEffect(() => {
    const isCompanyScope =
      scopeInfo.scope === "company" ||
      scopeInfo.scope === "branch" ||
      scopeInfo.scope === "vendor";
    const id = isCompanyScope ? scopeInfo.companyId : null;
    if (!id) {
      setCompanyName(null);
      return;
    }
    let cancelled = false;
    // use cached name instantly if present
    const cachedKey = `company-name-${id}`;
    const cached = typeof window !== "undefined" ? window.localStorage.getItem(cachedKey) : null;
    if (cached) {
      setCompanyName(cached);
    }

    async function load() {
      try {
        const res = await fetch(`/api/master/companies/${id}`);
        if (!res.ok) throw new Error("fail");
        const raw = await res.json();
        if (cancelled) return;
        const company = raw?.data?.company ?? raw?.data ?? raw ?? {};
        const name =
          company.display_name ||
          company.displayName ||
          company.legal_name ||
          company.legalName ||
          company.name ||
          null;
        setCompanyName(name);
        if (name && typeof window !== "undefined") {
          window.localStorage.setItem(cachedKey, name);
        }
      } catch (_err) {
        if (!cancelled) setCompanyName(null);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [scopeInfo.scope, scopeInfo.companyId]);

  useEffect(() => {
    if (scopeInfo.scope !== "branch" || !scopeInfo.companyId || !scopeInfo.branchId) {
      setBranchName(null);
      return;
    }
    let cancelled = false;
    const cachedKey = `branch-name-${scopeInfo.branchId}`;
    const cached = typeof window !== "undefined" ? window.localStorage.getItem(cachedKey) : null;
    if (cached) setBranchName(cached);

    async function loadBranch() {
      try {
        const res = await fetch(`/api/company/${scopeInfo.companyId}/branches/${scopeInfo.branchId}`);
        if (!res.ok) throw new Error("fail");
        const data = await res.json();
        if (cancelled) return;
        const branch = data?.data?.branch ?? data?.data ?? data ?? {};
        const name =
          branch.displayName ||
          branch.display_name ||
          branch.name ||
          branch.legal_name ||
          branch.code ||
          scopeInfo.branchId;
        setBranchName(name);
        if (name && typeof window !== "undefined") {
          window.localStorage.setItem(cachedKey, name);
        }
      } catch (_err) {
        if (!cancelled) setBranchName(null);
      }
    }
    loadBranch();
    return () => {
      cancelled = true;
    };
  }, [scopeInfo.scope, scopeInfo.companyId, scopeInfo.branchId]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-4 sm:px-8 py-3 sm:py-4 border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <Link href={brandHref} className="flex items-center gap-3 rounded-lg px-2 py-1 hover:bg-white/5">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-fuchsia-500 via-orange-400 to-emerald-400 shadow-lg" />
          <div className="leading-tight text-sm sm:text-base font-semibold uppercase tracking-wide">
            {brandLabel}
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <ThemeSwitcher />
          <Link
            href={settingsHref}
            className="rounded-full border border-white/30 px-3 py-1 text-xs sm:text-sm hover:border-white"
          >
            Settings
          </Link>
          <Link href="/api/auth/logout" className="rounded-full border border-white/30 px-3 py-1 text-xs sm:text-sm hover:border-white">
            Logout
          </Link>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 px-4 sm:px-6 py-4 sm:py-6">
        {hideSidebar ? (
          <div className="mx-auto max-w-6xl w-full">{children}</div>
        ) : (
          <SidebarNav
            scope={scopeInfo.scope as any}
            activeCategory={CategoryNav.getActiveCategory(pathname)}
            currentPathname={pathname}
          >
            <div className="w-full">{children}</div>
          </SidebarNav>
        )}
      </div>
    </div>
  );
}

export function AppLayout({ children, forceScope }: LayoutProps) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <LayoutInner forceScope={forceScope}>{children}</LayoutInner>
      </I18nProvider>
    </ThemeProvider>
  );
}
