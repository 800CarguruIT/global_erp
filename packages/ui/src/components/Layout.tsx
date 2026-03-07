"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  hideSidebar?: boolean;
  disableIncomingCallRealtime?: boolean;
};

type IncomingPopupState = {
  callId: string;
  fromNumber: string;
  toNumber: string;
  createdAtMs: number;
  customer?: {
    id?: string | null;
    name?: string | null;
    carId?: string | null;
    car?: string | null;
    phone?: string | null;
    type?: string | null;
  } | null;
};

function normalizeAgentToken(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return raw.replace(/\s+/g, "");
}

function agentTokenVariants(value: string | null | undefined): string[] {
  const normalized = normalizeAgentToken(value);
  if (!normalized) return [];
  const digits = normalized.replace(/\D+/g, "");
  const out = new Set<string>([normalized.toLowerCase()]);
  if (digits) out.add(digits);
  return Array.from(out);
}

function buildAgentTokenSet(values: Array<string | null | undefined>): Set<string> {
  const set = new Set<string>();
  for (const value of values) {
    for (const token of agentTokenVariants(value)) set.add(token);
  }
  return set;
}

function tokenMatchesAgent(set: Set<string>, value: string | null | undefined): boolean {
  if (!set.size) return false;
  for (const token of agentTokenVariants(value)) {
    if (set.has(token)) return true;
  }
  return false;
}

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

function LayoutInner({ children, forceScope, hideSidebar, disableIncomingCallRealtime }: LayoutProps) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const scopeInfo = forceScope ?? detectScope(pathname);
  const useBranchRoot = scopeInfo.scope === "branch" && pathname.startsWith("/branches/");
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [branchName, setBranchName] = useState<string | null>(null);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupTerm, setLookupTerm] = useState("");
  const [lookupResults, setLookupResults] = useState<any[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupAttempted, setLookupAttempted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [incomingPopups, setIncomingPopups] = useState<IncomingPopupState[]>([]);
  const seenIncomingCallIdsRef = useRef<Map<string, number>>(new Map());
  const incomingPopupsRef = useRef<IncomingPopupState[]>([]);
  const agentTokensRef = useRef<Set<string>>(new Set());
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

  useEffect(() => {
    incomingPopupsRef.current = incomingPopups;
  }, [incomingPopups]);

  useEffect(() => {
    if (disableIncomingCallRealtime) return;

    const companyId =
      scopeInfo.scope === "company" || scopeInfo.scope === "branch" || scopeInfo.scope === "vendor"
        ? scopeInfo.companyId
        : null;
    if (!companyId) return;

    let stopped = false;

    async function loadCustomerHintByPhone(phone: string) {
      if (!phone.trim()) return null;
      try {
        const res = await fetch(
          `/api/company/${companyId}/call-center/dashboard?search=${encodeURIComponent(phone.trim())}`,
          { cache: "no-store" }
        );
        if (!res.ok) return null;
        const payload = await res.json().catch(() => ({}));
        const list = (Array.isArray(payload) ? payload : payload.data ?? payload.result ?? []) as any[];
        const first =
          list.find((row) => row?.isActive !== false && String(row?.type ?? "").toLowerCase() === "customer") ??
          list.find((row) => row?.isActive !== false);
        if (!first) return null;
        return {
          id: first.type === "customer" ? first.id ?? null : null,
          name: first.name ?? null,
          carId: first.carId ?? null,
          car: first.car ?? null,
          phone: first.phone ?? null,
          type: first.type ?? null,
        };
      } catch {
        return null;
      }
    }

    async function handleIncomingCall(input: {
      callId: string;
      fromNumber?: string | null;
      toNumber?: string | null;
    }) {
      const now = Date.now();
      const dedupeTtlMs = 10 * 1000;
      for (const [key, seenAt] of seenIncomingCallIdsRef.current.entries()) {
        if (now - seenAt > dedupeTtlMs) {
          seenIncomingCallIdsRef.current.delete(key);
        }
      }

      const callId = String(input.callId ?? "").trim();
      if (!callId) return;
      const alreadySeenAt = seenIncomingCallIdsRef.current.get(callId);
      const existingPopup = incomingPopupsRef.current.find((p) => p.callId === callId);
      if (alreadySeenAt && now - alreadySeenAt <= dedupeTtlMs && !existingPopup) return;
      seenIncomingCallIdsRef.current.set(callId, now);
      if (stopped) return;

      const fromNumber = String(input.fromNumber ?? "").trim();
      const toNumber = String(input.toNumber ?? "").trim();
      if (agentTokensRef.current.size > 0 && toNumber && !tokenMatchesAgent(agentTokensRef.current, toNumber)) {
        return;
      }
      const customer = fromNumber ? await loadCustomerHintByPhone(fromNumber) : null;
      if (stopped) return;
      const safeFromNumber = fromNumber && fromNumber.toLowerCase() !== "unknown" ? fromNumber : "";

      setIncomingPopups((prev) => {
        const nextItem: IncomingPopupState = {
          callId,
          fromNumber: safeFromNumber || "Unknown",
          toNumber: toNumber || "Unknown",
          createdAtMs: Date.now(),
          customer,
        };
        const idx = prev.findIndex((p) => p.callId === callId);
        if (idx >= 0) {
          const copy = [...prev];
          const current = copy[idx];
          copy[idx] = {
            ...current,
            fromNumber:
              current.fromNumber && current.fromNumber.toLowerCase() !== "unknown"
                ? current.fromNumber
                : nextItem.fromNumber,
            toNumber: nextItem.toNumber || current.toNumber,
            createdAtMs: current.createdAtMs || nextItem.createdAtMs,
            customer: nextItem.customer ?? current.customer ?? null,
          };
          return copy;
        }
        return [...prev, nextItem].slice(-4);
      });
    }

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let socket: WebSocket | null = null;

    const connectSocket = () => {
      if (stopped) return;
      const scheme = window.location.protocol === "https:" ? "wss" : "ws";
      const agentTokens = Array.from(agentTokensRef.current);
      const url = `${scheme}://${window.location.host}/ws/call-center/incoming?companyId=${encodeURIComponent(
        companyId
      )}&agentIds=${encodeURIComponent(agentTokens.join(","))}`;
      socket = new WebSocket(url);
      socket.onmessage = (evt) => {
        try {
          const message = JSON.parse(String(evt.data || "{}"));
          if (String(message?.type ?? "").toLowerCase() !== "incoming") return;
          const payload = message?.data ?? {};
          const incomingCallId = String(payload.providerCallId ?? payload.callId ?? "").trim();
          const incomingFromNumber = String(payload.fromNumber ?? "").trim();
          const incomingToNumber = String(payload.toNumber ?? "").trim();
          const direction = String(payload.direction ?? "").toLowerCase();
          const status = String(payload.status ?? "").toLowerCase();

          const open = incomingPopupsRef.current.find((p) => p.callId === incomingCallId);
          if (
            open &&
            incomingCallId &&
            open.callId === incomingCallId &&
            incomingFromNumber &&
            incomingFromNumber.toLowerCase() !== "unknown" &&
            (!open.fromNumber || open.fromNumber.toLowerCase() === "unknown")
          ) {
            setIncomingPopups((prev) =>
              prev.map((p) =>
                p.callId === incomingCallId ? { ...p, fromNumber: incomingFromNumber } : p
              )
            );
          } else if (
            incomingFromNumber &&
            incomingFromNumber.toLowerCase() !== "unknown" &&
            incomingToNumber
          ) {
            // Yeastar may emit different call IDs across related events. If callId doesn't match,
            // still enrich the latest unknown popup routed to the same extension.
            setIncomingPopups((prev) => {
              const reversed = [...prev].reverse();
              const reversedMatchIdx = reversed.findIndex(
                (p) =>
                  p.toNumber === incomingToNumber &&
                  (!p.fromNumber || p.fromNumber.toLowerCase() === "unknown")
              );
              let idx = -1;
              if (reversedMatchIdx >= 0) {
                idx = prev.length - 1 - reversedMatchIdx;
              } else {
                // If no extension-level match exists, enrich the most recent unknown popup.
                const fallbackIdx = reversed.findIndex(
                  (p) =>
                    (!p.fromNumber || p.fromNumber.toLowerCase() === "unknown") &&
                    Date.now() - (p.createdAtMs || 0) <= 120_000
                );
                if (fallbackIdx >= 0) idx = prev.length - 1 - fallbackIdx;
              }
              if (idx < 0) return prev;
              const copy = [...prev];
              copy[idx] = { ...copy[idx], fromNumber: incomingFromNumber };
              return copy;
            });
          } else if (incomingFromNumber && incomingFromNumber.toLowerCase() !== "unknown") {
            // Last-resort fallback: enrich the most recent unknown popup.
            // This covers providers that change call IDs and may omit target extension on follow-up events.
            setIncomingPopups((prev) => {
              const unknowns = prev
                .filter(
                  (p) =>
                    (!p.fromNumber || p.fromNumber.toLowerCase() === "unknown") &&
                    Date.now() - (p.createdAtMs || 0) <= 120_000
                )
                .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
              const target = unknowns[0];
              if (!target?.callId) return prev;
              return prev.map((p) => (p.callId === target.callId ? { ...p, fromNumber: incomingFromNumber } : p));
            });
          }

          const isTerminal =
            status.includes("complete") ||
            status.includes("hangup") ||
            status.includes("declin") ||
            status.includes("reject") ||
            status.includes("no answer") ||
            status.includes("no_answer") ||
            status.includes("missed") ||
            status.includes("cancel") ||
            status.includes("bye") ||
            status.includes("over") ||
            status.includes("failed");
          const isAnswered =
            status.includes("answer") ||
            status.includes("in_progress") ||
            status.includes("in-progress") ||
            status.includes("progress");

          if (isAnswered && incomingCallId) {
            const hasAgentTokens = agentTokensRef.current.size > 0;
            const belongsToCurrentUser =
              hasAgentTokens && incomingToNumber
                ? tokenMatchesAgent(agentTokensRef.current, incomingToNumber)
                : false;

            if (hasAgentTokens && !belongsToCurrentUser) {
              setIncomingPopups((prev) => prev.filter((p) => p.callId !== incomingCallId));
              return;
            }

            setIncomingPopups((prev) =>
              prev.map((p) =>
                p.callId === incomingCallId
                  ? {
                      ...p,
                      toNumber: incomingToNumber || p.toNumber,
                      fromNumber:
                        incomingFromNumber && incomingFromNumber.toLowerCase() !== "unknown"
                          ? incomingFromNumber
                          : p.fromNumber,
                    }
                  : p
              )
            );
            return;
          }

          if (isTerminal) {
            const hasOpen = incomingPopupsRef.current.some((p) => p.callId === incomingCallId);
            if (incomingCallId && hasOpen) {
              const canShowResolvedNumber =
                incomingFromNumber && incomingFromNumber.toLowerCase() !== "unknown";
              if (canShowResolvedNumber) {
                setTimeout(() => {
                  setIncomingPopups((prev) =>
                    prev.filter((p) => p.callId !== incomingCallId)
                  );
                }, 4000);
              } else {
                setTimeout(() => {
                  setIncomingPopups((prev) =>
                    prev.filter((p) => p.callId !== incomingCallId)
                  );
                }, 60000);
              }
            }
            return;
          }

          if (direction !== "inbound") return;
          if (!(status.includes("ring") || status.includes("incoming"))) return;
          void handleIncomingCall({
            callId: incomingCallId,
            fromNumber: payload.fromNumber ?? null,
            toNumber: payload.toNumber ?? null,
          });
        } catch {
          // ignore parse errors
        }
      };
      socket.onclose = () => {
        if (stopped) return;
        reconnectTimer = setTimeout(connectSocket, 1500);
      };
      socket.onerror = () => {
        try {
          socket?.close();
        } catch {
          // ignore
        }
      };
    };
    const initializeAgentTokensAndConnect = async () => {
      const values: string[] = [];
      try {
        const manual = window.localStorage.getItem("dialer_agent_extension") ?? "";
        manual
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
          .forEach((v) => values.push(v));
      } catch {
        // ignore localStorage errors
      }

      try {
        const meRes = await fetch("/api/auth/me", { cache: "no-store" });
        if (meRes.ok) {
          const me = await meRes.json().catch(() => ({}));
          const userMobile = String(me?.user?.mobile ?? "").trim();
          if (userMobile) values.push(userMobile);
        }
      } catch {
        // ignore auth profile errors
      }

      agentTokensRef.current = buildAgentTokenSet(values);
      connectSocket();
    };
    void initializeAgentTokensAndConnect();

    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try {
        socket?.close();
      } catch {
        // ignore
      }
    };
  }, [scopeInfo.scope, scopeInfo.companyId, disableIncomingCallRealtime]);

  async function handleLookup() {
    if (!scopeInfo.companyId) return;
    const query = lookupTerm.trim();
    if (!query) return;
    setLookupLoading(true);
    setLookupAttempted(true);
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

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/auth/login");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="relative z-50 flex flex-col gap-2 px-4 sm:px-8 py-3 sm:py-4 border-b border-white/10 bg-black/20 backdrop-blur-xl overflow-visible sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {!hideSidebar && (
            <button
              type="button"
              className="lg:hidden rounded-full border border-white/20 bg-black/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:border-white/40"
              aria-label="Toggle navigation"
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen((prev) => !prev)}
            >
              <FontAwesomeIcon icon={faBars} className="h-3 w-3" />
            </button>
          )}
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
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full border border-white/30 px-3 py-1 text-xs sm:text-sm hover:border-white"
          >
            Logout
          </button>

          {lookupOpen && (
            <div
              id="navbar-customer-lookup"
              className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[90vw] rounded-2xl border border-white/10 bg-black p-3 shadow-xl sm:w-96"
            >
              <div className="flex items-center gap-2">
                <input
                  value={lookupTerm}
                  onChange={(e) => {
                    setLookupTerm(e.target.value);
                    setLookupAttempted(false);
                  }}
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
              {!lookupLoading && lookupResults.length === 0 && lookupAttempted && !lookupError && (
                <div className="mt-3 rounded-lg border border-white/10 p-3">
                  <div className="text-sm font-medium">Customer not found</div>
                  <div className="mt-1 text-xs opacity-70">No customer matched your search.</div>
                  <Link
                    href={`/company/${scopeInfo.companyId}/customers/new`}
                    className="mt-3 inline-flex rounded-full border border-white/20 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition hover:border-white/70"
                    onClick={() => setLookupOpen(false)}
                  >
                    Add Customer
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 px-4 sm:px-6 py-4 sm:py-6">
        {hideSidebar ? (
          <div className="w-full">{children}</div>
        ) : (
          <SidebarNav
            scope={scopeInfo.scope as any}
            activeCategory={CategoryNav.getActiveCategory(pathname)}
            currentPathname={pathname}
            mobileSidebarOpen={sidebarOpen}
            onRequestClose={() => setSidebarOpen(false)}
          >
            <div className="w-full">{children}</div>
          </SidebarNav>
        )}
      </div>

      {incomingPopups.length > 0 &&
        (scopeInfo.scope === "company" || scopeInfo.scope === "branch" || scopeInfo.scope === "vendor") &&
        scopeInfo.companyId && (
          <div className="fixed bottom-4 right-4 z-[80] flex max-w-[92vw] flex-col-reverse gap-3">
            {incomingPopups.map((popup) => (
              <div
                key={popup.callId}
                className="w-[22rem] rounded-2xl border border-emerald-400/40 bg-slate-950/95 p-4 shadow-2xl backdrop-blur"
              >
                <div className="text-xs uppercase tracking-[0.18em] text-emerald-300">Incoming Call</div>
                <div className="mt-1 text-lg font-semibold">{popup.customer?.name ?? "Unknown Caller"}</div>
                <div className="mt-1 text-xs text-slate-300">To: {popup.toNumber}</div>
                <div className="mt-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm">
                  <div className="text-xs text-slate-300">Mobile No: {popup.customer?.phone ?? popup.fromNumber}</div>
                  {popup.customer?.car ? (
                    <div className="text-xs text-slate-300">Car: {popup.customer.car}</div>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                  {popup.customer?.id ? (
                    <Link
                      href={`/company/${scopeInfo.companyId}/customers/${popup.customer.id}`}
                      className="rounded-full border border-white/25 px-3 py-1 hover:border-white/60"
                      onClick={() =>
                        setIncomingPopups((prev) => prev.filter((p) => p.callId !== popup.callId))
                      }
                    >
                      Visit Customer Dashboard
                    </Link>
                  ) : (
                    <>
                      <Link
                        href={
                          popup.fromNumber && popup.fromNumber !== "Unknown"
                            ? `/company/${scopeInfo.companyId}/customers/new?phone=${encodeURIComponent(
                                popup.fromNumber
                              )}`
                            : `/company/${scopeInfo.companyId}/customers/new`
                        }
                        className="rounded-full border border-white/25 px-3 py-1 hover:border-white/60"
                        onClick={() =>
                          setIncomingPopups((prev) => prev.filter((p) => p.callId !== popup.callId))
                        }
                      >
                        Create Customer
                      </Link>
                      <Link
                        href={
                          popup.fromNumber && popup.fromNumber !== "Unknown"
                            ? `/company/${scopeInfo.companyId}/leads/new?phone=${encodeURIComponent(
                                popup.fromNumber
                              )}`
                            : `/company/${scopeInfo.companyId}/leads/new`
                        }
                        className="rounded-full border border-white/25 px-3 py-1 hover:border-white/60"
                        onClick={() =>
                          setIncomingPopups((prev) => prev.filter((p) => p.callId !== popup.callId))
                        }
                      >
                        Create Lead
                      </Link>
                    </>
                  )}
                  <button
                    type="button"
                    className="rounded-full border border-white/15 px-3 py-1 opacity-80 hover:opacity-100"
                    onClick={() =>
                      setIncomingPopups((prev) => prev.filter((p) => p.callId !== popup.callId))
                    }
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

export function AppLayout({ children, forceScope, hideSidebar, disableIncomingCallRealtime }: LayoutProps) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <LayoutInner
          forceScope={forceScope}
          hideSidebar={hideSidebar}
          disableIncomingCallRealtime={disableIncomingCallRealtime}
        >
          {children}
        </LayoutInner>
      </I18nProvider>
    </ThemeProvider>
  );
}
