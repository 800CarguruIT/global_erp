"use client";

import Link from "next/link";
import { LogoutButton } from "../auth/LogoutButton";
import { useScope } from "../../../context/scope/ScopeProvider";
import { useTheme, useI18n } from "@repo/ui";
import { useEffect, useState } from "react";

export function HeaderBar() {
  const scope = useScope();
  const { themes, setThemeId, theme } = useTheme();
  const { languages, lang, setLang } = useI18n();
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupTerm, setLookupTerm] = useState("");
  const [lookupResults, setLookupResults] = useState<any[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  let title = "Global ERP";
  let subtitle: string | undefined;

  if (scope.scope === "company" || scope.scope === "branch") {
    title = "Company";
    subtitle = companyName ?? scope.companyId ?? undefined;
  } else if (scope.scope === "vendor") {
    title = "Vendor Portal";
    subtitle = scope.vendorId ?? undefined;
  }

  useEffect(() => {
    let active = true;
    async function loadCompanyName(id: string) {
      try {
        const res = await fetch(`/api/master/companies/${id}`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!active) return;
        const name =
          json?.data?.company?.displayName ||
          json?.data?.company?.display_name ||
          json?.data?.displayName ||
          json?.data?.display_name ||
          null;
        if (name) setCompanyName(name);
      } catch {
        // ignore
      }
    }
    if ((scope.scope === "company" || scope.scope === "branch") && scope.companyId) {
      loadCompanyName(scope.companyId);
    } else {
      setCompanyName(null);
    }
    return () => {
      active = false;
    };
  }, [scope.scope, scope.companyId]);

  const customerSearchHref = scope.companyId ? `/company/${scope.companyId}/customers` : "#";
  const canSearchCustomers = Boolean(scope.companyId);

  function cycleTheme() {
    if (!themes.length) return;
    const index = themes.findIndex((t) => t.id === theme.id);
    const next = themes[(index + 1) % themes.length];
    if (next) setThemeId(next.id as any);
  }

  function cycleLanguage() {
    if (!languages.length) return;
    const index = languages.findIndex((l) => l.code === lang);
    const next = languages[(index + 1) % languages.length];
    if (next) setLang(next.code as any);
  }

  async function handleLookup() {
    if (!scope.companyId) return;
    const query = lookupTerm.trim();
    if (!query) return;
    setLookupLoading(true);
    setLookupError(null);
    setLookupResults([]);
    try {
      const res = await fetch(
        `/api/company/${scope.companyId}/call-center/dashboard?search=${encodeURIComponent(query)}`,
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
    <header className="flex items-center justify-between border-b border-border/60 bg-gradient-to-r from-primary/10 via-card/70 to-primary/5 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-primary/80 flex items-center justify-center text-white text-xs">
          ERP
        </div>
        <div>
          <div className="font-semibold text-foreground">{title}</div>
          {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
        </div>
      </div>

      <div className="flex items-center gap-3 relative">
        <Link href="/profile" aria-label="Profile">
          <button className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-background text-foreground transition hover:bg-muted">
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path
                d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </Link>

        <button
          type="button"
          aria-label="Theme"
          onClick={cycleTheme}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-background text-foreground transition hover:bg-muted"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              d="M12 3a1 1 0 0 1 1 1v2a1 1 0 0 1-2 0V4a1 1 0 0 1 1-1Zm0 14a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm8-5a1 1 0 0 1-1 1h-2a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1ZM7 12a1 1 0 0 1-1 1H4a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1Zm9.07 6.07a1 1 0 0 1 1.41 0l1.41 1.41a1 1 0 1 1-1.41 1.41l-1.41-1.41a1 1 0 0 1 0-1.41ZM5.52 6.34A1 1 0 0 1 4.1 4.93l1.41-1.41a1 1 0 1 1 1.41 1.41Zm12.14-1.41a1 1 0 0 1 1.41 0l1.41 1.41a1 1 0 1 1-1.41 1.41l-1.41-1.41a1 1 0 0 1 0-1.41ZM5.52 17.66a1 1 0 0 1 1.41 0l1.41 1.41a1 1 0 1 1-1.41 1.41L5.52 19.07a1 1 0 0 1 0-1.41Z"
              fill="currentColor"
            />
          </svg>
        </button>

        <button
          type="button"
          aria-label="Language"
          onClick={cycleLanguage}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-border/70 bg-background px-3 text-xs font-semibold text-foreground transition hover:bg-muted"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              d="M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9Zm0 2a7 7 0 0 1 6.7 5h-3.2a12.7 12.7 0 0 0-1.2-3.2A7 7 0 0 0 12 5Zm-2.3.8A10.7 10.7 0 0 1 10.9 10H6.3a7 7 0 0 1 3.4-4.2ZM5 12h6a10.6 10.6 0 0 1-1.4 4.4A7 7 0 0 1 5 12Zm7 7a7 7 0 0 1-2.1-3.2A12.7 12.7 0 0 0 12 19a12.7 12.7 0 0 0 2.1-.2A7 7 0 0 1 12 19Zm2.3-2.8A10.7 10.7 0 0 1 13.1 12h6.6a7 7 0 0 1-5.4 4.2Z"
              fill="currentColor"
            />
          </svg>
          <span className="uppercase">{lang}</span>
        </button>

        <Link href={customerSearchHref} aria-disabled={!canSearchCustomers}>
          <button
            className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-3 py-1 text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canSearchCustomers}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path
                d="M15.5 15.5L21 21M10.5 18a7.5 7.5 0 1 1 0-15a7.5 7.5 0 0 1 0 15Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            <span>Customers</span>
          </button>
        </Link>

        <button
          type="button"
          onClick={() => setLookupOpen((prev) => !prev)}
          className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-3 py-1 text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canSearchCustomers}
          aria-expanded={lookupOpen}
          aria-controls="navbar-customer-lookup"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              d="M15.5 15.5L21 21M10.5 18a7.5 7.5 0 1 1 0-15a7.5 7.5 0 0 1 0 15Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          <span>Find Customer</span>
        </button>

        <Link href="/settings">
          <button className="text-sm border border-border rounded-full px-3 py-1 bg-background hover:bg-muted transition">
            Settings
          </button>
        </Link>

        <LogoutButton className="text-sm border border-border rounded-full px-3 py-1 bg-background hover:bg-muted transition" />

        {lookupOpen && (
          <div
            id="navbar-customer-lookup"
            className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] rounded-2xl border border-border/60 bg-background p-3 shadow-lg sm:w-96"
          >
            <div className="flex items-center gap-2">
              <input
                value={lookupTerm}
                onChange={(e) => setLookupTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleLookup();
                }}
                placeholder="Search by mobile or plate"
                className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                type="button"
                onClick={handleLookup}
                className="rounded-lg border border-border/60 px-3 py-2 text-xs font-semibold uppercase tracking-wide transition hover:bg-muted disabled:opacity-60"
                disabled={lookupLoading}
              >
                {lookupLoading ? "Searching" : "Search"}
              </button>
            </div>
            {lookupError && <div className="mt-2 text-xs text-red-500">{lookupError}</div>}
            {lookupResults.length > 0 && (
              <div className="mt-3 space-y-2">
                {lookupResults.map((row: any) => {
                  const phone = row.phone ?? "";
                  const plate = row.car ?? "";
                  const carId = row.carId ?? null;
                  const customerId = row.type === "customer" ? row.id ?? null : null;
                  return (
                    <div key={`${row.type ?? "result"}-${row.id ?? row.car ?? Math.random()}`} className="rounded-lg border border-border/60 p-2">
                      <div className="text-sm font-semibold">{row.name ?? phone ?? plate ?? "Customer"}</div>
                      <div className="text-xs text-muted-foreground">{[phone, plate].filter(Boolean).join(" • ")}</div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        {customerId && (
                          <Link
                            href={`/company/${scope.companyId}/customers/${customerId}`}
                            className="rounded-full border px-3 py-1 hover:border-primary"
                            onClick={() => setLookupOpen(false)}
                          >
                            View Customer
                          </Link>
                        )}
                        {carId && (
                          <Link
                            href={`/company/${scope.companyId}/cars/${carId}`}
                            className="rounded-full border px-3 py-1 hover:border-primary"
                            onClick={() => setLookupOpen(false)}
                          >
                            View Car
                          </Link>
                        )}
                        {!customerId && (
                          <Link
                            href={`/company/${scope.companyId}/customers/new${phone ? `?phone=${encodeURIComponent(phone)}` : ""}`}
                            className="rounded-full border px-3 py-1 hover:border-primary"
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
              <div className="mt-2 text-xs text-muted-foreground">No results found.</div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
