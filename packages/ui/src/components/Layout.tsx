"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeProvider } from "../theme";
import { I18nProvider, useI18n, LanguageCode } from "../i18n";
import { SidebarNav } from "../layout/SidebarNav";
import { useGlobalUi } from "../providers/GlobalUiProvider";
import { CategoryNav } from "../layout/CategoryNav";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars } from "@fortawesome/free-solid-svg-icons";

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
  if (pathname.startsWith("/branches/")) {
    const parts = pathname.split("/").filter(Boolean);
    const maybeRoute = parts[1];
    const branchId =
      maybeRoute === "leads"
        ? getBranchIdFromBranchCookie() ?? undefined
        : maybeRoute;
    const companyId = getCompanyIdFromBranchCookie() ?? undefined;
    return { scope: "branch", companyId, branchId };
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
  const useBranchRoot = scopeInfo.scope === "branch" && pathname.startsWith("/branches/");
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [branchName, setBranchName] = useState<string | null>(null);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupTerm, setLookupTerm] = useState("");
  const [lookupResults, setLookupResults] = useState<any[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const branchBase = useBranchRoot
    ? `/branches/${scopeInfo.branchId ?? ""}`
    : `/company/${scopeInfo.companyId ?? ""}/branches/${scopeInfo.branchId ?? ""}`;
  const settingsHref =
    scopeInfo.scope === "global"
      ? "/global/settings"
      : scopeInfo.scope === "company"
      ? `/company/${scopeInfo.companyId}/settings`
      : scopeInfo.scope === "branch"
      ? `${branchBase}/settings`
      : `/company/${scopeInfo.companyId ?? ""}/vendors/${scopeInfo.vendorId ?? ""}/settings`;
  const brandHref =
    scopeInfo.scope === "global"
      ? "/global"
      : scopeInfo.scope === "company"
      ? `/company/${scopeInfo.companyId}`
      : scopeInfo.scope === "branch"
      ? branchBase
      : `/company/${scopeInfo.companyId ?? ""}/vendors/${scopeInfo.vendorId ?? ""}`;
  const brandLabel =
    scopeInfo.scope === "global"
      ? "GLOBAL ERP"
      : scopeInfo.scope === "branch"
      ? `GLOBAL ERP - ${branchName ?? companyName ?? scopeInfo.branchId ?? "Branch"}`
      : `GLOBAL ERP - ${companyName ?? scopeInfo.companyId ?? "Company"}`;

  const canLookupCustomers = Boolean(scopeInfo.companyId);

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

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  async function handleLookup() {
    if (!scopeInfo.companyId) return;
    const query = lookupTerm.trim();
    if (!query) return;
    setLookupLoading(true);
    setLookupError(null);
    setLookupResults([]);
    try {
      const res = await fetch(
        `/api/company/${scopeInfo.companyId}/call-center/dashboard?search=${encodeURIComponent(query)}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Lookup failed");
      const data = await res.json();
      const list = (Array.isArray(data) ? data : data.data ?? data.result ?? []).filter(
        (row: any) => row?.isActive !== false
      );
      setLookupResults(list);
    } catch (err: any) {
      setLookupError(err?.message ?? "Lookup failed");
    } finally {
      setLookupLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="relative z-50 flex flex-col gap-2 px-4 sm:px-8 py-3 sm:py-4 border-b border-white/10 bg-black/20 backdrop-blur-xl overflow-visible sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="lg:hidden rounded-full border border-white/20 bg-black/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:border-white/40"
            aria-label="Toggle navigation"
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen((prev) => !prev)}
          >
            <FontAwesomeIcon icon={faBars} className="h-3 w-3" />
          </button>
          <Link href={brandHref} className="flex items-center gap-3 rounded-lg px-2 py-1 hover:bg-white/5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-fuchsia-500 via-orange-400 to-emerald-400 shadow-lg" />
            <div className="leading-tight text-sm sm:text-base font-semibold uppercase tracking-wide">
              {brandLabel}
            </div>
          </Link>
        </div>

        <div className="relative z-50 flex flex-wrap items-center gap-3 rounded-xl bg-white/5 px-3 py-2 sm:bg-transparent sm:px-0 sm:py-0">
          <LanguageSwitcher />
          <ThemeSwitcher />
          <button
            type="button"
            onClick={() => setLookupOpen((prev) => !prev)}
            disabled={!canLookupCustomers}
            className="rounded-full border border-white/30 px-3 py-1 text-xs sm:text-sm hover:border-white disabled:cursor-not-allowed disabled:opacity-60"
            aria-expanded={lookupOpen}
            aria-controls="navbar-customer-lookup"
          >
            Find Customer
          </button>
          <Link
            href={settingsHref}
            className="rounded-full border border-white/30 px-3 py-1 text-xs sm:text-sm hover:border-white"
          >
            Settings
          </Link>
          <Link href="/api/auth/logout" className="rounded-full border border-white/30 px-3 py-1 text-xs sm:text-sm hover:border-white">
            Logout
          </Link>

          {lookupOpen && (
            <div
              id="navbar-customer-lookup"
              className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[90vw] rounded-2xl border border-white/10 bg-black p-3 shadow-xl sm:w-96"
            >
              <div className="flex items-center gap-2">
                <input
                  value={lookupTerm}
                  onChange={(e) => setLookupTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleLookup();
                  }}
                  placeholder="Search by mobile or plate"
                  className="h-9 w-full rounded-lg border border-white/15 bg-black/40 px-3 text-sm outline-none focus:ring-2 focus:ring-white/20"
                />
                <button
                  type="button"
                  onClick={handleLookup}
                  className="rounded-lg border border-white/20 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide transition hover:border-white/60 disabled:opacity-60"
                  disabled={lookupLoading}
                >
                  {lookupLoading ? "Searching" : "Search"}
                </button>
              </div>
              {lookupError && <div className="mt-2 text-xs text-red-400">{lookupError}</div>}
              {lookupResults.length > 0 && (
                <div className="mt-3 space-y-2">
                  {lookupResults.map((row: any) => {
                    const phone = row.phone ?? "";
                    const plate = row.car ?? "";
                    const carId = row.carId ?? null;
                    const customerId = row.type === "customer" ? row.id ?? null : null;
                    return (
                      <div key={`${row.type ?? "result"}-${row.id ?? row.car ?? Math.random()}`} className="rounded-lg border border-white/10 p-2">
                        <div className="text-sm font-semibold">{row.name ?? phone ?? plate ?? "Customer"}</div>
                        <div className="text-xs opacity-70">{[phone, plate].filter(Boolean).join(" • ")}</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                          {customerId && (
                            <Link
                              href={`/company/${scopeInfo.companyId}/customers/${customerId}`}
                              className="rounded-full border border-white/20 px-3 py-1 hover:border-white/70"
                              onClick={() => setLookupOpen(false)}
                            >
                              View Customer
                            </Link>
                          )}
                          {carId && (
                            <Link
                              href={`/company/${scopeInfo.companyId}/cars/${carId}`}
                              className="rounded-full border border-white/20 px-3 py-1 hover:border-white/70"
                              onClick={() => setLookupOpen(false)}
                            >
                              View Car
                            </Link>
                          )}
                          {!customerId && (
                            <Link
                              href={`/company/${scopeInfo.companyId}/customers/new${phone ? `?phone=${encodeURIComponent(phone)}` : ""}`}
                              className="rounded-full border border-white/20 px-3 py-1 hover:border-white/70"
                              onClick={() => setLookupOpen(false)}
                            >
                              Create Customer
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {!lookupLoading && lookupResults.length === 0 && lookupTerm.trim() && !lookupError && (
                <div className="mt-2 text-xs opacity-70">No results found.</div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 px-4 sm:px-6 py-4 sm:py-6">
        <SidebarNav
          scope={scopeInfo.scope as any}
          activeCategory={CategoryNav.getActiveCategory(pathname)}
          currentPathname={pathname}
          mobileSidebarOpen={sidebarOpen}
          onRequestClose={() => setSidebarOpen(false)}
        >
          <div className="w-full">{children}</div>
        </SidebarNav>
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
