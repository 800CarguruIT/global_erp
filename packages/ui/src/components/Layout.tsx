"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ThemeProvider } from "../theme";
import { I18nProvider, useI18n, LanguageCode } from "../i18n";
import { SidebarNav } from "../layout/SidebarNav";
import { useGlobalUi } from "../providers/GlobalUiProvider";
import { CategoryNav } from "../layout/CategoryNav";
import { getLinkusClient, type LinkusStatus } from "../call-center/linkusClient";
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
  ringingExtensions?: string[];
  answeredByOther?: boolean;
  answeredByExtension?: string | null;
  aiText?: string | null;
  pickupHint?: string | null;
  createdAtMs: number;
  stage?: "new" | "connection" | "ringing" | "talking" | "held" | "ended";
  endReason?: "ended" | "missed" | "answered_other" | null;
  lastStageBeforeEnded?: "new" | "connection" | "ringing" | "talking" | "held" | null;
  connectionSinceMs?: number | null;
  syncDelay?: boolean;
  answeredAtMs?: number | null;
  endedAtMs?: number | null;
  lastEventAtMs?: number | null;
  customer?: {
    id?: string | null;
    name?: string | null;
    carId?: string | null;
    car?: string | null;
    phone?: string | null;
    type?: string | null;
  } | null;
};

type SdkNoticeState = {
  key: string;
  title: string;
  message: string;
  suggestions: string[];
};

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function labelForStage(stage: IncomingPopupState["stage"]): string {
  switch (stage) {
    case "connection":
      return "Connection";
    case "ringing":
      return "Ringing";
    case "talking":
      return "In Call";
    case "held":
      return "On Hold";
    case "ended":
      return "Ended";
    case "new":
    default:
      return "New Call";
  }
}

const POPUP_TIMELINE: Array<{ key: IncomingPopupState["stage"]; label: string }> = [
  { key: "new", label: "New" },
  { key: "ringing", label: "Ringing" },
  { key: "connection", label: "Connect" },
  { key: "talking", label: "In Call" },
  { key: "held", label: "Hold" },
  { key: "ended", label: "Ended" },
];

function stageOrder(stage: IncomingPopupState["stage"]): number {
  switch (stage) {
    case "new":
      return 0;
    case "ringing":
      return 1;
    case "connection":
      return 2;
    case "talking":
      return 3;
    case "held":
      return 4;
    case "ended":
      return 5;
    default:
      return 0;
  }
}

function mergeStage(
  current: IncomingPopupState["stage"] | undefined,
  incoming: IncomingPopupState["stage"] | undefined
): IncomingPopupState["stage"] {
  const cur = current ?? "new";
  const next = incoming ?? cur;
  if (cur === "ended" || next === "ended") return "ended";
  // Allow hold/talking to toggle, but do not regress to early stages.
  if (cur === "held" && next === "talking") return "talking";
  if (cur === "talking" && next === "held") return "held";
  if (stageOrder(next) < stageOrder(cur)) return cur;
  return next;
}

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

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out = new Set<string>();
  for (const item of value) {
    const token = String(item ?? "").trim();
    if (token) out.add(token);
  }
  return Array.from(out);
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

function isWorkshopPortalPath(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length < 1) return false;

  if (parts[0] === "company" && parts[1]) {
    const section = parts[2] ?? "";
    if (
      section === "workshop" ||
      section === "queue-system" ||
      section === "car-in-dashboard" ||
      section === "inspections"
    ) {
      return true;
    }
    if (section === "jobs" && parts[3] === "workshop") return true;
    if (section === "branches" && parts[3] && parts[4] === "jobs" && parts[5] === "workshop") return true;
    return false;
  }

  if (parts[0] === "branches" && parts[1]) {
    const section = parts[2] ?? "";
    return section === "workshop" || section === "queue-system" || section === "car-in-dashboard";
  }

  return false;
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
  const [aiSimulationEnabled, setAiSimulationEnabled] = useState(false);
  const [aiSimulationLoading, setAiSimulationLoading] = useState(false);
  const [incomingPopups, setIncomingPopups] = useState<IncomingPopupState[]>([]);
  const [expandedPopups, setExpandedPopups] = useState<Record<string, boolean>>({});
  const [popupClock, setPopupClock] = useState(0);
  const [linkusStatus, setLinkusStatus] = useState<LinkusStatus>({
    state: "idle",
    message: null,
    extension: null,
  });
  const [sdkNotice, setSdkNotice] = useState<SdkNoticeState | null>(null);
  const seenIncomingCallIdsRef = useRef<Map<string, number>>(new Map());
  const incomingPopupsRef = useRef<IncomingPopupState[]>([]);
  const agentTokensRef = useRef<Set<string>>(new Set());
  const persistedSdkFromRef = useRef<Set<string>>(new Set());
  const linkusClientRef = useRef(getLinkusClient());
  const signRefreshRef = useRef<{ key: string; at: number }>({ key: "", at: 0 });
  const settingsRefreshRef = useRef<{ key: string; at: number }>({ key: "", at: 0 });
  const autoSdkApiPausedRef = useRef<{ settings: boolean; sign: boolean }>({
    settings: false,
    sign: false,
  });
  const answeredPopupHideTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const terminalCallsRef = useRef<Map<string, number>>(new Map());
  const recentlyClosedTargetsRef = useRef<Map<string, number>>(new Map());
  const sdkNoticeKeyRef = useRef<string>("");
  const showSdkNotice = useCallback((notice: SdkNoticeState) => {
    if (sdkNoticeKeyRef.current === notice.key) return;
    sdkNoticeKeyRef.current = notice.key;
    setSdkNotice(notice);
  }, []);
  const clearSdkNotice = useCallback(() => {
    sdkNoticeKeyRef.current = "";
    setSdkNotice(null);
  }, []);
  const resumeAutoSdkApi = useCallback(() => {
    autoSdkApiPausedRef.current = { settings: false, sign: false };
    settingsRefreshRef.current = { key: "", at: 0 };
    signRefreshRef.current = { key: "", at: 0 };
    sdkNoticeKeyRef.current = "";
    setSdkNotice(null);
  }, []);
  const readLinkusConfig = useCallback(() => {
    const extension = (() => {
      try {
        const raw = window.localStorage.getItem("dialer_agent_extension") ?? "";
        return (
          raw
            .split(",")
            .map((v) => v.trim())
            .find(Boolean) ?? ""
        );
      } catch {
        return "";
      }
    })();
    const serverUrl = (() => {
      try {
        return window.localStorage.getItem("dialer_linkus_server") ?? "";
      } catch {
        return "";
      }
    })();
    const password = (() => {
      try {
        return window.localStorage.getItem("dialer_linkus_password") ?? "";
      } catch {
        return "";
      }
    })();
    const token = (() => {
      try {
        return window.localStorage.getItem("dialer_linkus_token") ?? "";
      } catch {
        return "";
      }
    })();
    return { extension, serverUrl, password, token };
  }, []);
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
  const simulationCompanyId =
    scopeInfo.scope === "company" || scopeInfo.scope === "branch" || scopeInfo.scope === "vendor"
      ? String(scopeInfo.companyId ?? "").trim()
      : "";
  const sdkCompanyId =
    scopeInfo.scope === "company" || scopeInfo.scope === "branch" || scopeInfo.scope === "vendor"
      ? String(scopeInfo.companyId ?? "").trim()
      : "";
  const dialerEnabled = Boolean(sdkCompanyId) && !isWorkshopPortalPath(pathname);

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
    const active = new Set(incomingPopups.map((p) => p.callId));
    setExpandedPopups((prev) => {
      const next: Record<string, boolean> = {};
      let changed = false;
      for (const [key, value] of Object.entries(prev)) {
        if (active.has(key)) {
          next[key] = value;
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [incomingPopups]);

  useEffect(() => {
    if (
      incomingPopups.length === 0 ||
      !incomingPopups.some((p) => (p.stage === "talking" || p.stage === "held") && p.answeredAtMs)
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      setPopupClock(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [incomingPopups]);

  useEffect(() => {
    if (!dialerEnabled) return;
    const timer = window.setInterval(() => {
      const companyId =
        scopeInfo.scope === "company" || scopeInfo.scope === "branch" || scopeInfo.scope === "vendor"
          ? String(scopeInfo.companyId ?? "").trim()
          : "";
      if (!companyId) return;
      const open = incomingPopupsRef.current;
      if (!open.length) return;
      const updates: Array<{ callId: string; fromNumber: string }> = [];
      for (const popup of open) {
        const currentFrom = String(popup.fromNumber ?? "").trim().toLowerCase();
        if (currentFrom && currentFrom !== "unknown") continue;
        const fallback = String(
          linkusClientRef.current.getBestCallerNumber({
            callId: popup.callId,
            toNumber: popup.toNumber,
          }) ?? ""
        ).trim();
        if (!fallback) continue;
        updates.push({ callId: popup.callId, fromNumber: fallback });
      }
      if (!updates.length) return;
      setIncomingPopups((prev) =>
        prev.map((p) => {
          const found = updates.find((u) => u.callId === p.callId);
          if (!found) return p;
          return { ...p, fromNumber: found.fromNumber };
        })
      );
      for (const item of updates) {
        const key = `${item.callId}|${item.fromNumber}`;
        if (persistedSdkFromRef.current.has(key)) continue;
        persistedSdkFromRef.current.add(key);
        void fetch(`/api/company/${companyId}/call-center/history/enrich-from`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providerCallId: item.callId,
            fromNumber: item.fromNumber,
          }),
        }).catch(() => {
          // ignore background enrich failures
        });
      }
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [dialerEnabled, scopeInfo.scope, scopeInfo.companyId]);

  useEffect(() => {
    if (!dialerEnabled) {
      clearSdkNotice();
      setLinkusStatus({ state: "idle", message: null, extension: null });
      return;
    }
    let stopped = false;
    const client = linkusClientRef.current;
    const unsubscribe = client.subscribe((status) => {
      if (!stopped) setLinkusStatus(status);
    });
    const ensureSdkSign = async (cfg: {
      extension?: string | null;
      password?: string | null;
      token?: string | null;
      serverUrl?: string | null;
    }) => {
      if (autoSdkApiPausedRef.current.sign) return cfg;
      const extension = String(cfg.extension ?? "").trim();
      const serverUrl = String(cfg.serverUrl ?? "").trim();
      const token = String(cfg.token ?? "").trim();
      if (!extension || !sdkCompanyId) return cfg;

      const tokenCreatedAtRaw = window.localStorage.getItem("dialer_linkus_token_created_at") ?? "";
      const tokenForExt = window.localStorage.getItem("dialer_linkus_token_extension") ?? "";
      const tokenForServer = window.localStorage.getItem("dialer_linkus_token_server") ?? "";
      const tokenCreatedAt = Number(tokenCreatedAtRaw || 0);
      const tokenAgeMs = tokenCreatedAt > 0 ? Date.now() - tokenCreatedAt : Number.POSITIVE_INFINITY;
      const hasFreshToken =
        !!token &&
        tokenForExt === extension &&
        tokenForServer === serverUrl &&
        Number.isFinite(tokenAgeMs) &&
        tokenAgeMs < 25 * 60 * 1000;

      const currentStatus = client.getStatus();
      const loginFailed =
        String(currentStatus.state ?? "").toLowerCase() === "error" &&
        /login failed|init failed|failure/i.test(String(currentStatus.message ?? ""));
      if (hasFreshToken && !loginFailed) return cfg;

      const refreshKey = `${sdkCompanyId}|${extension}|${serverUrl}`;
      const now = Date.now();
      if (
        signRefreshRef.current.key === refreshKey &&
        now - signRefreshRef.current.at < 15_000
      ) {
        return cfg;
      }
      signRefreshRef.current = { key: refreshKey, at: now };

      const signRes = await fetch(`/api/company/${sdkCompanyId}/dialer/linkus-sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extension }),
      }).catch(() => null);
      if (!signRes?.ok) {
        autoSdkApiPausedRef.current.sign = true;
        showSdkNotice({
          key: `sign-failed:${sdkCompanyId}:${extension}`,
          title: "Auto sign-in paused",
          message: "Linkus sign API failed. Auto retry is stopped until manual resume.",
          suggestions: [
            "Check Dialer integration and extension assignment.",
            "Click Resume Auto Setup after fixing configuration.",
          ],
        });
        return cfg;
      }

      const payload = await signRes.json().catch(() => ({}));
      const sign = String(payload?.sign ?? "").trim();
      const serverFromApi = String(payload?.serverUrl ?? "").trim();
      const resolvedServerUrl = serverUrl || serverFromApi;
      if (!serverUrl && serverFromApi) {
        window.localStorage.setItem("dialer_linkus_server", serverFromApi);
      }
      if (!sign) return cfg;

      window.localStorage.setItem("dialer_linkus_token", sign);
      window.localStorage.setItem("dialer_linkus_token_created_at", String(Date.now()));
      window.localStorage.setItem("dialer_linkus_token_extension", extension);
      window.localStorage.setItem("dialer_linkus_token_server", resolvedServerUrl);
      window.localStorage.removeItem("dialer_linkus_password");
      return {
        ...cfg,
        serverUrl: resolvedServerUrl,
        token: sign,
        password: "",
      };
    };
    const ensureSdkSettings = async (cfg: {
      extension?: string | null;
      password?: string | null;
      token?: string | null;
      serverUrl?: string | null;
    }) => {
      if (autoSdkApiPausedRef.current.settings) return cfg;
      const extension = String(cfg.extension ?? "").trim();
      const serverUrl = String(cfg.serverUrl ?? "").trim();
      if ((!extension || !serverUrl) && sdkCompanyId) {
        const refreshKey = `settings|${sdkCompanyId}`;
        const now = Date.now();
        if (
          settingsRefreshRef.current.key !== refreshKey ||
          now - settingsRefreshRef.current.at > 15_000
        ) {
          settingsRefreshRef.current = { key: refreshKey, at: now };
          const res = await fetch(`/api/company/${sdkCompanyId}/dialer/linkus-settings`, {
            cache: "no-store",
          }).catch(() => null);
          if (!res) {
            autoSdkApiPausedRef.current.settings = true;
            showSdkNotice({
              key: `settings-fetch-failed:${sdkCompanyId}`,
              title: "Dialer settings request failed",
              message: "Could not load Linkus settings from server. Auto retry is stopped.",
              suggestions: [
                "Check network and reload the page.",
                "Verify company dialer integration is active.",
                "Click Resume Auto Setup after fixing configuration.",
              ],
            });
          } else if (res.ok) {
            const payload = await res.json().catch(() => ({}));
            const server = String(payload?.serverUrl ?? "").trim();
            const ext = String(payload?.defaultExtension ?? "").trim();
            if (!serverUrl && server) {
              window.localStorage.setItem("dialer_linkus_server", server);
              cfg = { ...cfg, serverUrl: server };
            }
            if (!extension && ext) {
              window.localStorage.setItem("dialer_agent_extension", ext);
              cfg = { ...cfg, extension: ext };
            }
            const missing: string[] = [];
            if (!String(cfg.serverUrl ?? "").trim()) missing.push("Linkus server URL");
            if (!String(cfg.extension ?? "").trim()) missing.push("PBX extension");
            if (missing.length > 0) {
              showSdkNotice({
                key: `settings-missing:${sdkCompanyId}:${missing.join(",")}`,
                title: "Linkus config is incomplete",
                message: `Missing ${missing.join(" and ")}.`,
                suggestions: [
                  "Set server URL in Dialer integration settings.",
                  "Assign your extension in User Extensions.",
                ],
              });
            } else if (linkusStatus.state === "connected") {
              clearSdkNotice();
            }
          } else {
            autoSdkApiPausedRef.current.settings = true;
            const payload = await res.json().catch(() => ({}));
            const reason = String(payload?.error ?? `HTTP ${res.status}`).trim();
            showSdkNotice({
              key: `settings-http:${sdkCompanyId}:${res.status}:${reason}`,
              title: "Linkus settings not available",
              message: `${reason}. Auto retry is stopped.`,
              suggestions:
                res.status === 404
                  ? [
                      "Create/activate a Yeastar dialer integration.",
                      "Assign your PBX extension in User Extensions.",
                      "Click Resume Auto Setup after fixing configuration.",
                    ]
                  : [
                      "Confirm permissions and integration setup, then retry.",
                      "Click Resume Auto Setup after fixing configuration.",
                    ],
            });
          }
        }
      }
      return cfg;
    };
    const connectFromStorage = async () => {
      const current = client.getStatus().state;
      if (current === "connected" || current === "connecting") return;
      const cfg = await ensureSdkSign(await ensureSdkSettings(readLinkusConfig()));
      const extension = String(cfg.extension ?? "").trim();
      const serverUrl = String(cfg.serverUrl ?? "").trim();
      if (!extension) {
        showSdkNotice({
          key: `missing-extension:${sdkCompanyId}`,
          title: "PBX extension is not assigned",
          message: "SDK cannot connect without an extension.",
          suggestions: [
            "Open User Extensions and assign your PBX extension.",
            "Re-login after extension assignment if needed.",
          ],
        });
      } else if (!serverUrl) {
        showSdkNotice({
          key: `missing-server:${sdkCompanyId}`,
          title: "Linkus server URL is missing",
          message: "SDK cannot connect without dialer server URL.",
          suggestions: [
            "Open Dialer Integration and set Linkus server URL.",
            "Ensure the integration is active for this company.",
          ],
        });
      }
      await client.connect(cfg);
    };
    void connectFromStorage();

    const timer = window.setInterval(() => {
      void connectFromStorage();
    }, 4000);

    return () => {
      stopped = true;
      window.clearInterval(timer);
      unsubscribe();
    };
  }, [clearSdkNotice, dialerEnabled, linkusStatus.state, readLinkusConfig, sdkCompanyId, showSdkNotice]);

  useEffect(() => {
    if (!dialerEnabled) return;
    if (linkusStatus.state === "connected") {
      clearSdkNotice();
      return;
    }
    if (linkusStatus.state !== "error") return;
    const msg = String(linkusStatus.message ?? "").trim();
    if (!msg) return;
    const lower = msg.toLowerCase();
    if (lower.includes("extension missing")) {
      showSdkNotice({
        key: `status-extension-missing:${sdkCompanyId}`,
        title: "PBX extension is not assigned",
        message: msg,
        suggestions: [
          "Open User Extensions and assign your PBX extension.",
          "Refresh this page after saving.",
        ],
      });
      return;
    }
    if (lower.includes("dialer_linkus_server missing")) {
      showSdkNotice({
        key: `status-server-missing:${sdkCompanyId}`,
        title: "Linkus server URL is missing",
        message: msg,
        suggestions: [
          "Open Dialer Integration and set Linkus server URL.",
          "Verify Yeastar integration credentials are valid.",
        ],
      });
      return;
    }
    if (lower.includes("dialer_linkus_token") && lower.includes("missing")) {
      showSdkNotice({
        key: `status-token-missing:${sdkCompanyId}`,
        title: "Linkus token or password is missing",
        message: msg,
        suggestions: [
          "Open Dialer Integration and save your Yeastar credentials.",
          "A token will be fetched automatically once credentials are set.",
        ],
      });
      return;
    }
    showSdkNotice({
      key: `status-error:${sdkCompanyId}:${msg}`,
      title: "SDK connection error",
      message: msg,
      suggestions: ["Review dialer integration, extension assignment, and SDK token."],
    });
  }, [clearSdkNotice, dialerEnabled, linkusStatus.message, linkusStatus.state, sdkCompanyId, showSdkNotice]);

  useEffect(() => {
    if (!dialerEnabled) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      for (const [key, at] of terminalCallsRef.current.entries()) {
        if (now - at > 3 * 60 * 1000) terminalCallsRef.current.delete(key);
      }
      const snapshots = linkusClientRef.current.getSessionsSnapshot();
      if (!snapshots.length) return;
      setIncomingPopups((prev) => {
        let changed = false;
        const next = prev.map((popup) => {
          if (popup.answeredByOther) return popup;
          const byCallId = snapshots.find((s) => String(s.sessionId || "") === popup.callId);
          const byToNumber = snapshots.find(
            (s) => String(s.toNumber ?? "").trim() && String(s.toNumber ?? "").trim() === popup.toNumber
          );
          const snap = byCallId ?? byToNumber;
          if (!snap) return popup;

          let stage = popup.stage ?? "new";
          if (snap.isHold || snap.callStatus.includes("hold")) {
            stage = mergeStage(popup.stage, "held");
          } else if (snap.callStatus === "talking") {
            stage = mergeStage(popup.stage, "talking");
          } else if (snap.isRing || snap.callStatus.includes("ring")) {
            stage = mergeStage(popup.stage, "ringing");
          } else if (snap.callStatus.includes("progress") || snap.callStatus.includes("connect")) {
            stage = mergeStage(popup.stage, "connection");
          } else {
            stage = mergeStage(popup.stage, stage);
          }
          const nextAnsweredAt =
            stage === "talking" || stage === "held"
              ? popup.answeredAtMs ?? (snap.callStartTime > 0 ? snap.callStartTime : now)
              : popup.answeredAtMs ?? null;
          const nextConnectionSinceMs =
            stage === "connection"
              ? popup.stage === "connection"
                ? popup.connectionSinceMs ?? now
                : now
              : null;
          const nextSyncDelay =
            stage === "connection" && nextConnectionSinceMs
              ? now - nextConnectionSinceMs > 8_000
              : false;
          if (nextSyncDelay) {
            // Force an extra SDK snapshot pull while connection appears stale.
            void linkusClientRef.current.getSessionsSnapshot();
          }
          if (
            stage !== popup.stage ||
            nextAnsweredAt !== (popup.answeredAtMs ?? null) ||
            nextConnectionSinceMs !== (popup.connectionSinceMs ?? null) ||
            nextSyncDelay !== Boolean(popup.syncDelay)
          ) {
            changed = true;
            return {
              ...popup,
              stage,
              endReason: stage === "ended" ? popup.endReason ?? "ended" : null,
              connectionSinceMs: nextConnectionSinceMs,
              syncDelay: nextSyncDelay,
              answeredAtMs: nextAnsweredAt,
              endedAtMs: stage === "ended" ? popup.endedAtMs ?? now : popup.endedAtMs ?? null,
              lastEventAtMs: now,
            };
          }
          return popup;
        });
        return changed ? next : prev;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [dialerEnabled]);

  useEffect(() => {
    if (disableIncomingCallRealtime || !dialerEnabled) return;

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
      ringingExtensions?: string[] | null;
      aiText?: string | null;
      pickupHint?: string | null;
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
      if (terminalCallsRef.current.has(callId)) return;
      const alreadySeenAt = seenIncomingCallIdsRef.current.get(callId);
      const existingPopup = incomingPopupsRef.current.find((p) => p.callId === callId);
      if (alreadySeenAt && now - alreadySeenAt <= dedupeTtlMs && !existingPopup) return;
      seenIncomingCallIdsRef.current.set(callId, now);
      if (stopped) return;

      const fromNumber = String(input.fromNumber ?? "").trim();
      const rawToNumber = String(input.toNumber ?? "").trim();
      const toNumber = rawToNumber.toLowerCase() === "[object object]" ? "" : rawToNumber;
      const closeCooldownMs = 45_000;
      for (const [key, seenAt] of recentlyClosedTargetsRef.current.entries()) {
        if (now - seenAt > closeCooldownMs) recentlyClosedTargetsRef.current.delete(key);
      }
      if (toNumber) {
        const recentlyClosedAt = recentlyClosedTargetsRef.current.get(toNumber);
        if (recentlyClosedAt && now - recentlyClosedAt <= closeCooldownMs) return;
      }
      const sdkFallbackFrom =
        !fromNumber || fromNumber.toLowerCase() === "unknown"
          ? String(
              linkusClientRef.current.getBestCallerNumber({
                callId,
                toNumber,
              }) ?? ""
            ).trim()
          : "";
      const resolvedFromNumber =
        fromNumber && fromNumber.toLowerCase() !== "unknown"
          ? fromNumber
          : sdkFallbackFrom;
      const ringingExtensions = normalizeStringList(input.ringingExtensions ?? []);
      const hasAgentTokens = agentTokensRef.current.size > 0;
      const candidateTargets =
        ringingExtensions.length > 0 ? ringingExtensions : toNumber ? [toNumber] : [];
      if (
        hasAgentTokens &&
        candidateTargets.length > 0 &&
        !candidateTargets.some((target) => tokenMatchesAgent(agentTokensRef.current, target))
      ) {
        return;
      }
      const aiText = String(input.aiText ?? "").trim();
      const pickupHint = String(input.pickupHint ?? "").trim();
      const safeFromNumber = resolvedFromNumber && resolvedFromNumber.toLowerCase() !== "unknown" ? resolvedFromNumber : "";
      if (safeFromNumber && callId && companyId) {
        const key = `${callId}|${safeFromNumber}`;
        if (!persistedSdkFromRef.current.has(key)) {
          persistedSdkFromRef.current.add(key);
          void fetch(`/api/company/${companyId}/call-center/history/enrich-from`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              providerCallId: callId,
              fromNumber: safeFromNumber,
            }),
          }).catch(() => {
            // ignore background enrich failures
          });
        }
      }

      setIncomingPopups((prev) => {
        const nextItem: IncomingPopupState = {
          callId,
          fromNumber: safeFromNumber || "Unknown",
          toNumber: toNumber || "Unknown",
          ringingExtensions,
          aiText: aiText || null,
          pickupHint: pickupHint || null,
          createdAtMs: Date.now(),
          stage: "new",
          endReason: null,
          connectionSinceMs: null,
          syncDelay: false,
          answeredAtMs: null,
          endedAtMs: null,
          lastEventAtMs: now,
          customer: null,
        };
        const idx = prev.findIndex((p) => p.callId === callId);
        if (idx >= 0) {
          const copy = [...prev];
          const current = copy[idx];
          if (!current) return prev;
          copy[idx] = {
            ...current,
            fromNumber:
              current.fromNumber && current.fromNumber.toLowerCase() !== "unknown"
                ? current.fromNumber
                : nextItem.fromNumber,
            toNumber: nextItem.toNumber || current.toNumber,
            ringingExtensions:
              nextItem.ringingExtensions && nextItem.ringingExtensions.length > 0
                ? nextItem.ringingExtensions
                : current.ringingExtensions ?? [],
            aiText: nextItem.aiText ?? current.aiText ?? null,
            pickupHint: nextItem.pickupHint ?? current.pickupHint ?? null,
            createdAtMs: current.createdAtMs || nextItem.createdAtMs,
            stage: current.stage ?? nextItem.stage,
            answeredAtMs: current.answeredAtMs ?? nextItem.answeredAtMs,
            endedAtMs: current.endedAtMs ?? nextItem.endedAtMs,
            lastEventAtMs: now,
            customer: nextItem.customer ?? current.customer ?? null,
          };
          return copy;
        }
        return [...prev, nextItem].slice(-4);
      });

      if (safeFromNumber) {
        void loadCustomerHintByPhone(safeFromNumber)
          .then((customer) => {
            if (stopped || !customer) return;
            setIncomingPopups((prev) =>
              prev.map((p) => (p.callId === callId ? { ...p, customer } : p))
            );
          })
          .catch(() => {
            // ignore best-effort customer enrichment failures
          });
      }
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
          const incomingFromNumberRaw = String(payload.fromNumber ?? "").trim();
          const incomingToNumber = String(payload.toNumber ?? "").trim();
          const incomingFromNumber =
            incomingFromNumberRaw && incomingFromNumberRaw.toLowerCase() !== "unknown"
              ? incomingFromNumberRaw
              : String(
                  linkusClientRef.current.getBestCallerNumber({
                    callId: incomingCallId,
                    toNumber: incomingToNumber,
                  }) ?? ""
                ).trim();
          const incomingRingingExtensions = normalizeStringList(payload.ringingExtensions ?? []);
          const incomingAiText = String(payload.aiText ?? "").trim();
          const incomingPickupHint = String(payload.pickupHint ?? "").trim();
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
              const existing = copy[idx];
              if (!existing) return prev;
              copy[idx] = { ...existing, fromNumber: incomingFromNumber };
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

          if (isAnswered && (incomingCallId || incomingToNumber)) {
            const openByCallId = incomingCallId
              ? incomingPopupsRef.current.find((p) => p.callId === incomingCallId)
              : null;
            const openByToNumber =
              !openByCallId && incomingToNumber
                ? [...incomingPopupsRef.current]
                    .reverse()
                    .find(
                      (p) =>
                        p.toNumber === incomingToNumber &&
                        p.stage !== "ended" &&
                        Date.now() - (p.createdAtMs || 0) <= 120_000
                    ) ?? null
                : null;
            const targetPopup = openByCallId ?? openByToNumber;
            const targetCallId = String(targetPopup?.callId ?? incomingCallId ?? "").trim();
            if (!targetCallId) return;
            if (terminalCallsRef.current.has(targetCallId)) return;
            const hasAgentTokens = agentTokensRef.current.size > 0;
            // For "answered by other", prefer the explicit answered extension (`toNumber`).
            // Ring-group extension lists can include many agents and cause false positives.
            const answeredToNumber = incomingToNumber.trim();
            const fallbackToNumber = String(
              targetPopup?.toNumber ?? ""
            ).trim();
            const answeredTargets = answeredToNumber
              ? [answeredToNumber]
              : fallbackToNumber
              ? [fallbackToNumber]
              : [];
            const belongsToCurrentUser =
              hasAgentTokens && answeredTargets.length > 0
                ? answeredTargets.some((target) => tokenMatchesAgent(agentTokensRef.current, target))
                : false;

            if (hasAgentTokens && answeredTargets.length > 0 && !belongsToCurrentUser) {
              if (answeredToNumber) {
                recentlyClosedTargetsRef.current.set(answeredToNumber, Date.now());
              } else if (fallbackToNumber) {
                recentlyClosedTargetsRef.current.set(fallbackToNumber, Date.now());
              }
              const existingTimer = answeredPopupHideTimersRef.current.get(targetCallId);
              if (existingTimer) clearTimeout(existingTimer);
              answeredPopupHideTimersRef.current.delete(targetCallId);
              setIncomingPopups((prev) => prev.filter((p) => p.callId !== targetCallId));
              return;
            }

                    setIncomingPopups((prev) =>
              prev.map((p) =>
                p.callId === targetCallId
                  ? {
                      ...p,
                      toNumber: incomingToNumber || p.toNumber,
                      ringingExtensions:
                        incomingRingingExtensions.length > 0
                          ? incomingRingingExtensions
                          : p.ringingExtensions ?? [],
                      aiText: incomingAiText || p.aiText || null,
                      pickupHint: incomingPickupHint || p.pickupHint || null,
                      stage:
                        mergeStage(
                          p.stage,
                          status.includes("answer") || status.includes("in_progress") || status.includes("in-progress")
                            ? "talking"
                            : "connection"
                        ),
                      endReason: null,
                      connectionSinceMs:
                        status.includes("answer") || status.includes("in_progress") || status.includes("in-progress")
                          ? null
                          : p.stage === "connection"
                          ? p.connectionSinceMs ?? Date.now()
                          : Date.now(),
                      syncDelay: false,
                      answeredAtMs:
                        status.includes("answer") || status.includes("in_progress") || status.includes("in-progress")
                          ? p.answeredAtMs ?? Date.now()
                          : p.answeredAtMs ?? null,
                      endedAtMs: null,
                      lastEventAtMs: Date.now(),
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
            const now = Date.now();
            const isMissedTerminal =
              status.includes("no answer") ||
              status.includes("no_answer") ||
              status.includes("missed") ||
              status.includes("declin") ||
              status.includes("reject") ||
              status.includes("cancel") ||
              status.includes("failed");
            if (incomingCallId) terminalCallsRef.current.set(incomingCallId, now);
            const openByCallId = incomingCallId
              ? incomingPopupsRef.current.find((p) => p.callId === incomingCallId)
              : null;
            const openByToNumber =
              !openByCallId && incomingToNumber
                ? [...incomingPopupsRef.current]
                    .reverse()
                    .find(
                      (p) =>
                        p.toNumber === incomingToNumber &&
                        p.stage !== "ended" &&
                        now - (p.createdAtMs || 0) <= 180_000
                    ) ?? null
                : null;
            const targetPopup = openByCallId ?? openByToNumber;
            const targetCallId = String(targetPopup?.callId ?? incomingCallId ?? "").trim();
            const hasOpen = targetCallId
              ? incomingPopupsRef.current.some((p) => p.callId === targetCallId)
              : false;
            if (hasOpen && targetCallId) {
              terminalCallsRef.current.set(targetCallId, now);
              const targetToNumber = String(
                incomingPopupsRef.current.find((p) => p.callId === targetCallId)?.toNumber ??
                  incomingToNumber ??
                  ""
              ).trim();
              if (targetToNumber) {
                recentlyClosedTargetsRef.current.set(targetToNumber, Date.now());
              }
              setIncomingPopups((prev) =>
                prev.map((p) =>
                  p.callId === targetCallId
                    ? {
                        ...p,
                        stage: "ended",
                        endReason: isMissedTerminal ? "missed" : "ended",
                        lastStageBeforeEnded:
                          p.stage && p.stage !== "ended" ? p.stage : p.lastStageBeforeEnded ?? null,
                        connectionSinceMs: null,
                        syncDelay: false,
                        endedAtMs: Date.now(),
                        lastEventAtMs: Date.now(),
                      }
                    : p
                )
              );
              const closeAfterMs = isMissedTerminal ? 15_000 : 4_000;
              setTimeout(() => {
                setIncomingPopups((prev) => prev.filter((p) => p.callId !== targetCallId));
              }, closeAfterMs);
            }
            return;
          }

          if (direction !== "inbound") return;
          if (!(status.includes("ring") || status.includes("incoming"))) return;
          if (incomingCallId && terminalCallsRef.current.has(incomingCallId)) return;
          if (incomingCallId) {
            setIncomingPopups((prev) =>
              prev.map((p) =>
                p.callId === incomingCallId
                  ? { ...p, stage: mergeStage(p.stage, "ringing"), lastEventAtMs: Date.now() }
                  : p
              )
            );
          }
          void handleIncomingCall({
            callId: incomingCallId,
            fromNumber: payload.fromNumber ?? null,
            toNumber: payload.toNumber ?? null,
            ringingExtensions: payload.ringingExtensions ?? null,
            aiText: payload.aiText ?? null,
            pickupHint: payload.pickupHint ?? null,
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
      for (const timer of answeredPopupHideTimersRef.current.values()) {
        clearTimeout(timer);
      }
      answeredPopupHideTimersRef.current.clear();
    };
  }, [dialerEnabled, scopeInfo.scope, scopeInfo.companyId, disableIncomingCallRealtime]);

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

  function canSdkAnswerToNumber(
    toNumber: string | null | undefined,
    ringingExtensions?: string[] | null
  ): boolean {
    const sdkExtTokens = buildAgentTokenSet([linkusStatus.extension ?? ""]);
    if (!sdkExtTokens.size) return true;
    const candidates = [
      String(toNumber ?? "").trim(),
      ...normalizeStringList(ringingExtensions ?? []),
    ].filter(Boolean);
    if (!candidates.length) return true;
    return candidates.some((candidate) =>
      agentTokenVariants(candidate).some((token) => sdkExtTokens.has(token))
    );
  }

  async function handleAnswerWithSdk(
    callId: string,
    toNumber?: string | null,
    ringingExtensions?: string[] | null
  ) {
    if (!canSdkAnswerToNumber(toNumber, ringingExtensions)) {
      const target = String(toNumber ?? "").trim() || normalizeStringList(ringingExtensions ?? []).join(", ") || "unknown";
      setLinkusStatus((prev) => ({
        ...prev,
        message: `Cannot answer via SDK: call is ringing on ext ${target}, SDK is on ext ${prev.extension ?? "unknown"}`,
      }));
      return;
    }
    const ok = await linkusClientRef.current.answer(callId);
    if (!ok) return;
    setIncomingPopups((prev) =>
      prev.map((p) =>
        p.callId === callId
          ? {
              ...p,
              stage: "connection",
              endReason: null,
              connectionSinceMs: Date.now(),
              syncDelay: false,
              answeredAtMs: p.answeredAtMs ?? Date.now(),
              endedAtMs: null,
            }
          : p
      )
    );
  }

  async function handleHangWithSdk(callId: string, toNumber?: string | null) {
    const ok = await linkusClientRef.current.hang(callId, toNumber ?? null);
    if (!ok) return;
    const companyId =
      scopeInfo.scope === "company" || scopeInfo.scope === "branch" || scopeInfo.scope === "vendor"
        ? String(scopeInfo.companyId ?? "").trim()
        : "";
    if (companyId) {
      void fetch(`/api/company/${companyId}/call-center/history/mark-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerCallId: callId,
          status: "completed",
          endedAt: new Date().toISOString(),
        }),
      }).catch(() => {
        // best-effort status sync
      });
    }
    setIncomingPopups((prev) =>
      prev.map((p) =>
        p.callId === callId
          ? {
              ...p,
              stage: "ended",
              endReason: "ended",
              lastStageBeforeEnded:
                p.stage && p.stage !== "ended" ? p.stage : p.lastStageBeforeEnded ?? null,
              connectionSinceMs: null,
              syncDelay: false,
              endedAtMs: Date.now(),
              lastEventAtMs: Date.now(),
            }
          : p
      )
    );
    const targetTo = String(toNumber ?? "").trim();
    if (targetTo) {
      recentlyClosedTargetsRef.current.set(targetTo, Date.now());
    }
    terminalCallsRef.current.set(callId, Date.now());
    setTimeout(() => {
      setIncomingPopups((prev) => prev.filter((p) => p.callId !== callId));
    }, 4000);
  }

  async function handleHoldToggleWithSdk(callId: string, toNumber?: string | null) {
    const current = incomingPopupsRef.current.find((p) => p.callId === callId);
    const shouldHold = current?.stage !== "held";
    const ok = await linkusClientRef.current.setHold(callId, toNumber ?? null, shouldHold);
    if (!ok) return;
    setIncomingPopups((prev) =>
      prev.map((p) =>
        p.callId === callId
          ? {
              ...p,
              stage: mergeStage(p.stage, shouldHold ? "held" : "talking"),
              endReason: null,
              connectionSinceMs: null,
              syncDelay: false,
              answeredAtMs: p.answeredAtMs ?? Date.now(),
              lastEventAtMs: Date.now(),
            }
          : p
      )
    );
  }

  useEffect(() => {
    let active = true;
    if (!simulationCompanyId) {
      setAiSimulationEnabled(false);
      return () => {
        active = false;
      };
    }
    setAiSimulationLoading(true);
    fetch(`/api/company/${simulationCompanyId}/ai/voice-policy`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to load AI policy"))))
      .then((data) => {
        if (!active) return;
        setAiSimulationEnabled(Boolean(data?.policy?.guidance?.simulationMode));
      })
      .catch(() => {
        if (!active) return;
        setAiSimulationEnabled(false);
      })
      .finally(() => {
        if (!active) return;
        setAiSimulationLoading(false);
      });
    return () => {
      active = false;
    };
  }, [simulationCompanyId]);

  async function updateSimulationMode(next: boolean) {
    if (!simulationCompanyId || aiSimulationLoading) return;
    setAiSimulationLoading(true);
    try {
      const currentRes = await fetch(`/api/company/${simulationCompanyId}/ai/voice-policy`, {
        cache: "no-store",
      });
      if (!currentRes.ok) throw new Error("Failed to load AI policy");
      const currentJson = await currentRes.json().catch(() => ({}));
      const policy = currentJson?.policy ?? {};
      const payload = {
        enabled: Boolean(policy?.enabled),
        mode: policy?.mode === "live" ? "live" : "dry_run",
        timezone: String(policy?.timezone ?? "Asia/Dubai"),
        businessHours: policy?.businessHours ?? {
          enabled: false,
          start: "09:00",
          end: "18:00",
          days: [1, 2, 3, 4, 5],
        },
        restrictions: policy?.restrictions ?? {
          blockUnknownNumbers: false,
          blockedPrefixes: [],
          allowedPrefixes: [],
        },
        guidance: {
          welcomeMessage: String(policy?.guidance?.welcomeMessage ?? ""),
          systemPrompt: String(policy?.guidance?.systemPrompt ?? ""),
          escalationKeywords: Array.isArray(policy?.guidance?.escalationKeywords)
            ? policy.guidance.escalationKeywords
            : [],
          automationEnabled: Boolean(policy?.guidance?.automationEnabled),
          simulationMode: next,
        },
      };
      const patchRes = await fetch(`/api/company/${simulationCompanyId}/ai/voice-policy`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!patchRes.ok) throw new Error("Failed to update simulation mode");
      setAiSimulationEnabled(next);
    } catch {
      // no-op: keep prior state
    } finally {
      setAiSimulationLoading(false);
    }
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
          {simulationCompanyId && (
            <label className="inline-flex items-center gap-2 rounded-full border border-white/30 px-3 py-1 text-xs sm:text-sm">
              <span>Simulation</span>
              <input
                type="checkbox"
                checked={aiSimulationEnabled}
                disabled={aiSimulationLoading}
                onChange={(e) => updateSimulationMode(e.target.checked)}
                className="h-4 w-4 rounded"
              />
            </label>
          )}
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
          <div className="fixed bottom-4 right-4 z-[9999] flex max-w-[92vw] flex-col-reverse gap-3">
            {incomingPopups.map((popup) => {
              const isActiveCall = popup.stage === "talking" || popup.stage === "held";
              const hasEnded = popup.stage === "ended";
              const isMissed = hasEnded && popup.endReason === "missed";
              const canControl = !popup.answeredByOther && linkusStatus.state === "connected";
              const canAnswer =
                popup.answeredByOther !== true &&
                popup.stage !== "talking" &&
                popup.stage !== "held" &&
                popup.stage !== "ended" &&
                linkusStatus.state === "connected" &&
                canSdkAnswerToNumber(popup.toNumber, popup.ringingExtensions);
              const elapsedMs =
                popup.answeredAtMs && (isActiveCall || hasEnded)
                  ? Math.max(
                      0,
                      (popup.endedAtMs ?? (popupClock || Date.now())) - popup.answeredAtMs
                    )
                  : null;
              const lastStageText = popup.lastStageBeforeEnded
                ? labelForStage(popup.lastStageBeforeEnded)
                : null;
              const currentStageOrder = stageOrder(popup.stage);
              const autoCompact =
                (popup.stage === "connection" || popup.stage === "talking" || popup.stage === "held") &&
                (elapsedMs ?? 0) >= 5000;
              const isExpanded = expandedPopups[popup.callId] ?? false;
              const isCompact = autoCompact && !isExpanded;
              const toneClasses =
                hasEnded
                  ? {
                      border: "border-slate-500/40",
                      badge: "border-slate-500/40 text-slate-300",
                      summary: "border-slate-400/25 bg-slate-700/20 text-slate-200",
                      timeline: "bg-slate-300/70",
                      timelineLabel: "text-slate-200",
                    }
                  : popup.stage === "held"
                  ? {
                      border: "border-amber-300/55 shadow-amber-500/20",
                      badge: "border-amber-300/60 text-amber-200",
                      summary: "border-amber-300/20 bg-amber-500/10 text-amber-100",
                      timeline: "bg-amber-300/90",
                      timelineLabel: "text-amber-200",
                    }
                  : popup.stage === "connection" || popup.stage === "talking"
                  ? {
                      border: "border-cyan-300/60 shadow-cyan-500/20",
                      badge: "border-cyan-300/60 text-cyan-200",
                      summary: "border-cyan-300/20 bg-cyan-500/10 text-cyan-100",
                      timeline: "bg-cyan-300/90",
                      timelineLabel: "text-cyan-200",
                    }
                  : {
                      border: "border-emerald-300/60 shadow-emerald-500/20",
                      badge: "border-emerald-300/50 text-emerald-200 animate-pulse",
                      summary: "border-emerald-200/20 bg-emerald-500/10 text-emerald-100",
                      timeline: "bg-emerald-300/90",
                      timelineLabel: "text-emerald-200",
                    };
              return (
              <div
                key={popup.callId}
                className={`isolate w-[22rem] rounded-2xl border bg-slate-950 p-4 shadow-2xl transition-all duration-300 ${toneClasses.border} ${
                  hasEnded ? "opacity-70 translate-y-1 scale-[0.99]" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-[0.18em] text-emerald-300">Incoming Call</div>
                  {autoCompact ? (
                    <button
                      type="button"
                      className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300 hover:border-white/40"
                      onClick={() =>
                        setExpandedPopups((prev) => ({
                          ...prev,
                          [popup.callId]: !isExpanded,
                        }))
                      }
                    >
                      {isExpanded ? "Compact" : "Expand"}
                    </button>
                  ) : null}
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-slate-300">
                  SDK: {linkusStatus.state}
                  {linkusStatus.extension ? ` (${linkusStatus.extension})` : ""}
                </div>
                {linkusStatus.message ? (
                  <div className="mt-1 text-[10px] text-amber-200/90">{linkusStatus.message}</div>
                ) : null}
                <div className="mt-1 text-[10px] text-slate-400">Call ID: {popup.callId}</div>
                <div className="mt-1 text-lg font-semibold">{popup.customer?.name ?? "Unknown Caller"}</div>
                <div className="mt-1 text-xs text-slate-300">To: {popup.toNumber}</div>
                <div className="mt-1 flex items-center gap-2 text-xs">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${toneClasses.badge}`}
                  >
                    {labelForStage(popup.stage)}
                  </span>
                  {elapsedMs !== null ? (
                    <span className="font-mono text-emerald-200">{formatDuration(elapsedMs)}</span>
                  ) : null}
                </div>
                {popup.syncDelay ? (
                  <div className="mt-1 text-[11px] text-amber-200">Sync delay... forcing status re-check</div>
                ) : null}
                <div className="mt-2 grid grid-cols-6 gap-1">
                  {POPUP_TIMELINE.map((step, idx) => {
                    const active = idx <= currentStageOrder;
                    const current = idx === currentStageOrder;
                    return (
                      <div key={`${popup.callId}-${step.key}`} className="flex flex-col items-center gap-1">
                        <div
                          className={`h-1.5 w-full rounded-full ${
                            active ? toneClasses.timeline : "bg-white/10"
                          } ${current && !hasEnded ? "animate-pulse" : ""}`}
                        />
                        <span className={`text-[9px] ${current ? toneClasses.timelineLabel : "text-slate-400"}`}>
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {hasEnded ? (
                  <div className={`mt-2 rounded-lg border px-2 py-1 text-[11px] ${toneClasses.summary}`}>
                    <div>Last Status: {lastStageText ?? "Unknown"}</div>
                    <div>
                      Call Count: {elapsedMs !== null ? formatDuration(elapsedMs) : "00:00"}
                    </div>
                    {isMissed ? (
                      <Link
                        href={
                          popup.fromNumber && popup.fromNumber !== "Unknown"
                            ? `/company/${scopeInfo.companyId}/leads/new?phone=${encodeURIComponent(popup.fromNumber)}`
                            : `/company/${scopeInfo.companyId}/leads/new`
                        }
                        className="mt-2 inline-flex rounded-full border border-white/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide hover:border-white/70"
                        onClick={() => setIncomingPopups((prev) => prev.filter((p) => p.callId !== popup.callId))}
                      >
                        Create Inquiry
                      </Link>
                    ) : null}
                  </div>
                ) : null}
                {popup.answeredByOther ? (
                  <div className="mt-1 text-xs text-amber-200">
                    Answered by ext {popup.answeredByExtension ?? popup.toNumber}
                  </div>
                ) : null}
                {!isCompact ? (
                  <div className="mt-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm">
                    <div className="text-xs text-slate-300">Mobile No: {popup.customer?.phone ?? popup.fromNumber}</div>
                    {popup.customer?.car ? (
                      <div className="text-xs text-slate-300">Car: {popup.customer.car}</div>
                    ) : null}
                    {popup.aiText ? (
                      <div className="mt-1 text-xs text-emerald-200">AI: {popup.aiText}</div>
                    ) : null}
                    {popup.pickupHint ? (
                      <div className="mt-1 text-xs text-amber-200">{popup.pickupHint}</div>
                    ) : null}
                  </div>
                ) : null}
                <div className="mt-3 flex flex-col gap-2 text-[11px]">
                  <button
                    type="button"
                    className="w-full rounded-xl border border-emerald-300/50 bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-100 hover:border-emerald-200/90 disabled:opacity-50"
                    disabled={!canAnswer}
                    title={
                      popup.answeredByOther
                        ? `Already answered by ext ${popup.answeredByExtension ?? popup.toNumber}`
                        : canSdkAnswerToNumber(popup.toNumber, popup.ringingExtensions)
                        ? undefined
                        : `Call is ringing on ext ${popup.toNumber}; SDK is logged on ext ${linkusStatus.extension ?? "unknown"}`
                    }
                    onClick={() =>
                      void handleAnswerWithSdk(
                        popup.callId,
                        popup.toNumber,
                        popup.ringingExtensions ?? null
                      )
                    }
                  >
                    Answer (SDK)
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className="rounded-xl border border-amber-300/40 px-3 py-2 text-amber-200 hover:border-amber-200/80 disabled:opacity-50"
                      disabled={!canControl || !(popup.stage === "talking" || popup.stage === "held")}
                      onClick={() => void handleHoldToggleWithSdk(popup.callId, popup.toNumber)}
                    >
                      {popup.stage === "held" ? "Resume" : "Hold"}
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-rose-300/40 px-3 py-2 text-rose-200 hover:border-rose-200/80 disabled:opacity-50"
                      disabled={!canControl || popup.stage === "ended"}
                      onClick={() => void handleHangWithSdk(popup.callId, popup.toNumber)}
                    >
                      Hang
                    </button>
                  </div>
                  {!isCompact ? (
                    <div className="flex flex-wrap gap-2">
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
                  ) : (
                    <button
                      type="button"
                      className="self-start rounded-full border border-white/15 px-3 py-1 opacity-80 hover:opacity-100"
                      onClick={() =>
                        setIncomingPopups((prev) => prev.filter((p) => p.callId !== popup.callId))
                      }
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              </div>
            )})}
          </div>
        )}

      {dialerEnabled ? (
        <div
          className={`fixed right-4 z-[70] ${
            incomingPopups.length > 0 ? "bottom-[22rem]" : "bottom-4"
          }`}
        >
          <div className="rounded-full border border-white/15 bg-slate-950/90 px-3 py-1.5 text-[11px] shadow-lg backdrop-blur">
            <span className="mr-2 text-slate-300">SDK</span>
            <span
              className={
                linkusStatus.state === "connected"
                  ? "text-emerald-300"
                  : linkusStatus.state === "connecting"
                  ? "text-amber-300"
                  : linkusStatus.state === "error"
                  ? "text-rose-300"
                  : "text-slate-300"
              }
            >
              {linkusStatus.state || "idle"}
            </span>
            {linkusStatus.extension ? (
              <span className="ml-2 text-slate-400">ext {linkusStatus.extension}</span>
            ) : null}
            {linkusStatus.message ? (
              <span className="ml-2 text-slate-500" title={linkusStatus.message}>
                i
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
      {dialerEnabled && sdkNotice ? (
        <div
          className={`fixed right-4 z-[71] w-[22rem] rounded-xl border border-amber-400/30 bg-amber-950/90 p-3 text-xs shadow-lg backdrop-blur ${
            incomingPopups.length > 0 ? "bottom-[25.5rem]" : "bottom-14"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="font-semibold text-amber-200">{sdkNotice.title}</div>
            <button
              type="button"
              className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] text-white/80 hover:text-white"
              onClick={() => clearSdkNotice()}
            >
              Dismiss
            </button>
            <button
              type="button"
              className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] text-white/80 hover:text-white"
              onClick={() => resumeAutoSdkApi()}
            >
              Resume Auto Setup
            </button>
          </div>
          <div className="mt-1 text-amber-100/90">{sdkNotice.message}</div>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-amber-100/80">
            {sdkNotice.suggestions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {sdkCompanyId ? (
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              <Link
                href={`/company/${sdkCompanyId}/integrations/dialer/extensions`}
                className="rounded-full border border-white/20 px-2.5 py-1 hover:border-white/40"
              >
                User Extensions
              </Link>
              <Link
                href={`/company/${sdkCompanyId}/integrations/dialer`}
                className="rounded-full border border-white/20 px-2.5 py-1 hover:border-white/40"
              >
                Dialer Integrations
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
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
