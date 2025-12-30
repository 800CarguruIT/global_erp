"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type ThemeId = "midnight" | "sunset" | "ocean" | "forest" | "light";
export type LanguageId = "en" | "ar";

interface GlobalUiState {
  theme: ThemeId;
  language: LanguageId;
  setTheme: (theme: ThemeId) => void;
  setLanguage: (language: LanguageId) => void;
}

const GlobalUiContext = createContext<GlobalUiState | undefined>(undefined);
export const useOptionalGlobalUiContext = () => useContext(GlobalUiContext);

const THEME_STORAGE_KEY = "global-erp-theme";
const LANG_STORAGE_KEY = "global-erp-lang";

function getInitialTheme(): ThemeId {
  if (typeof window === "undefined") return "midnight";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null;
  return stored ?? "midnight";
}

function getInitialLanguage(): LanguageId {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(LANG_STORAGE_KEY) as LanguageId | null;
  return stored ?? "en";
}

export const GlobalUiProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<ThemeId>(getInitialTheme);
  const [language, setLanguage] = useState<LanguageId>(getInitialLanguage);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = language === "ar" ? "ar" : "en";
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    window.localStorage.setItem(LANG_STORAGE_KEY, language);
  }, [language]);

  const value = useMemo<GlobalUiState>(
    () => ({ theme, language, setTheme, setLanguage }),
    [theme, language]
  );

  return <GlobalUiContext.Provider value={value}>{children}</GlobalUiContext.Provider>;
};

export function useGlobalUi() {
  const ctx = useContext(GlobalUiContext);
  if (!ctx) throw new Error("useGlobalUi must be used inside GlobalUiProvider");
  return ctx;
}
