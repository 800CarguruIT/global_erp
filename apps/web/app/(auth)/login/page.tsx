"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTheme, useI18n, I18nProvider } from "@repo/ui";

const REMEMBER_EMAIL_KEY = "global-erp-login-email";
const REMEMBER_PASSWORD_KEY = "global-erp-login-password";
const REMEMBER_EMAIL_OPT_KEY = "global-erp-login-remember-email";
const REMEMBER_PASSWORD_OPT_KEY = "global-erp-login-remember-password";

export default function LoginPage() {
  return (
    <I18nProvider>
      <LoginContent />
    </I18nProvider>
  );
}

function LoginContent() {
  const router = useRouter();
  const { theme, themes, setThemeId } = useTheme();
  const { t, languages, lang, setLang, loadingLang } = useI18n();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(true);
  const [rememberPassword, setRememberPassword] = useState(false);

  // Hydrate saved credentials/preferences on first paint
  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") return;
    const savedEmail = window.localStorage.getItem(REMEMBER_EMAIL_KEY) ?? "";
    const savedPassword = window.localStorage.getItem(REMEMBER_PASSWORD_KEY) ?? "";
    const savedRememberEmail = window.localStorage.getItem(REMEMBER_EMAIL_OPT_KEY);
    const savedRememberPassword = window.localStorage.getItem(REMEMBER_PASSWORD_OPT_KEY);

    setEmail(savedEmail);
    if (savedRememberPassword === "true" && savedPassword) {
      setPassword(savedPassword);
      setRememberPassword(true);
    }
    setRememberEmail(savedRememberEmail !== "false");
  }, []);

  // Theme options for dropdown
  const themeOptions = useMemo(
    () => themes.map((t) => ({ value: t.id, label: t.label })),
    [themes]
  );

  const isLight = theme.id === "light";
  const panelBg = isLight ? "bg-white/85" : "bg-black/20";
  const panelBorder = isLight ? "border border-slate-200" : "border border-white/10";
  const panelShadow = isLight ? "shadow-[0_20px_60px_rgba(15,23,42,0.08)]" : "shadow-2xl";
  const textPrimary = isLight ? "text-slate-900" : "text-white";
  const textMuted = isLight ? "text-slate-600" : "text-white/70";
  const chipBg = isLight ? "bg-slate-100" : "bg-white/5";
  const chipBorder = isLight ? "border border-slate-200" : "border border-white/10";
  const selectBg = isLight ? "bg-white" : "bg-white/5";
  const selectBorder = isLight ? "border border-slate-200" : "border border-white/15";
  const selectHover = isLight ? "hover:bg-slate-100" : "hover:bg-white/10";

  function FancySelect({
    label,
    value,
    options,
    onChange,
  }: {
    label: string;
    value: string;
    options: { value: string; label: string; disabled?: boolean }[];
    onChange: (val: string) => void;
  }) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      function handleClickOutside(e: MouseEvent) {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setOpen(false);
        }
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const activeLabel = options.find((o) => o.value === value)?.label ?? value;

    return (
      <div className="flex flex-col gap-2" ref={containerRef}>
        <label className={`text-[11px] uppercase ${textMuted}`}>{label}</label>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`flex w-full items-center justify-between rounded-full ${selectBorder} ${selectBg} px-4 py-3 text-left text-sm shadow-inner shadow-black/10 focus:outline-none focus:ring-2 focus:ring-primary/50 ${textPrimary}`}
        >
          <span>{activeLabel}</span>
          <span className={`transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
        </button>
        {open && (
          <div
            className={`mt-2 w-full rounded-2xl ${selectBorder} ${
              isLight ? "bg-white/95" : "bg-black/80"
            } p-1 shadow-2xl shadow-black/30 backdrop-blur`}
          >
            <div className="max-h-56 overflow-y-auto">
              {options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={opt.disabled}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition ${selectHover} ${
                    opt.value === value
                      ? isLight
                        ? "bg-slate-100 font-semibold text-slate-900"
                        : "bg-white/10 font-semibold text-white"
                      : isLight
                      ? "text-slate-800"
                      : "text-white/80"
                  } ${opt.disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  <span>{opt.label}</span>
                  {opt.value === value && (
                    <span className={`text-xs ${isLight ? "text-primary" : "text-primary"}`}>●</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Invalid credentials");
      }
      const target = body.redirect || "/global";
      // Use full navigation to ensure cookies and middleware pick up the new session.
      window.location.assign(target);
    } catch (err: any) {
      setError(err?.message ?? "Login failed");
    } finally {
      setLoading(false);
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(REMEMBER_EMAIL_OPT_KEY, String(rememberEmail));
      window.localStorage.setItem(REMEMBER_PASSWORD_OPT_KEY, String(rememberPassword));

      if (rememberEmail) {
        window.localStorage.setItem(REMEMBER_EMAIL_KEY, email);
      } else {
        window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
      }

      if (rememberPassword) {
        window.localStorage.setItem(REMEMBER_PASSWORD_KEY, password);
      } else {
        window.localStorage.removeItem(REMEMBER_PASSWORD_KEY);
      }
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <div
      className={`min-h-screen ${theme.appBg} ${theme.appText} relative overflow-hidden flex items-center justify-center px-4 py-10`}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-10 top-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-10 bottom-10 h-80 w-80 rounded-full bg-fuchsia-500/15 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-3xl">
        <div className={`rounded-2xl ${panelBorder} ${panelBg} p-8 backdrop-blur-2xl ${panelShadow}`}>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className={`text-2xl font-semibold ${textPrimary}`}>{t("login.title")}</h2>
                <p className={`text-sm ${textMuted}`}>{t("login.subtitle")}</p>
              </div>
              <div className="flex flex-col gap-3 min-w-[220px]">
                <FancySelect
                  label={t("login.language")}
                  value={lang}
                  options={languages.map((l) => ({ value: l.code, label: l.label }))}
                  onChange={(val) => setLang(val as any)}
                />
                <FancySelect
                  label={t("login.theme")}
                  value={theme.id}
                  options={themeOptions}
                  onChange={(val) => setThemeId(val as any)}
                />
                {loadingLang && (
                  <div className={`text-[11px] ${textMuted}`}>{t("translator.buttonLoading")}</div>
                )}
              </div>
            </div>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className={`text-sm ${textPrimary}`}>{t("login.email")}</label>
              <input
                type="email"
                autoComplete="email"
                required
                className={`${theme.input}`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className={`text-sm ${textPrimary}`}>{t("login.password")}</label>
              <input
                type="password"
                autoComplete="current-password"
                required
                className={`${theme.input}`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className={`flex flex-col gap-2 rounded-xl ${chipBorder} ${chipBg} p-3 text-xs ${textPrimary}`}>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  className={`h-4 w-4 rounded ${isLight ? "border-slate-400" : "border-white/30"} bg-transparent`}
                  checked={rememberEmail}
                  onChange={(e) => setRememberEmail(e.target.checked)}
                />
                {t("login.rememberEmail")}
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  className={`h-4 w-4 rounded ${isLight ? "border-slate-400" : "border-white/30"} bg-transparent`}
                  checked={rememberPassword}
                  onChange={(e) => setRememberPassword(e.target.checked)}
                />
                {t("login.rememberPassword")}
              </label>
            </div>

            {error && <div className="text-sm text-red-500">{error}</div>}
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex justify-center rounded-lg bg-gradient-to-r from-sky-500 via-indigo-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_35px_rgba(59,130,246,0.35)] transition hover:scale-[1.01] focus:outline-none disabled:opacity-60"
            >
              {loading ? t("login.button.loading") : t("login.button")}
            </button>
          </form>

          <div className={`mt-4 text-xs ${textMuted}`}>
            <span>{t("login.needAccess")}</span>{" "}
            <Link href="#" className="text-sky-300 hover:underline">
              {t("login.contactAdmin")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
