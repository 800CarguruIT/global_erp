"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useGlobalUi } from "./GlobalUiProvider";

type TranslationContextValue = {
  lang: string;
  setLang: (lang: string) => void;
  translate: (text: string) => string;
};

const TranslationContext = createContext<TranslationContextValue | undefined>(undefined);

export const TranslationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { language, setLanguage } = useGlobalUi();
  const [cache, setCache] = useState<Record<string, string>>({});

  // Update <html> lang/dir based on language (GlobalUi already updates these, but keep in sync)
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);

  const translate = useMemo(() => {
    return (text: string) => {
      if (!text) return text;
      if (language === "en") return text;
      const key = `${language}:${text}`;
      const existing = cache[key];
      if (existing) return existing;

      // Fire-and-forget fetch; return original text as fallback
      void fetch("/api/translations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceTexts: [text], lang: language }),
      })
        .then((res) => res.json())
        .then((data) => {
          const translated = data?.translations?.[text];
          if (translated) {
            setCache((prev) => ({ ...prev, [key]: translated }));
          }
        })
        .catch(() => {
          /* ignore */
        });

      return text;
    };
  }, [language, cache]);

  const setLang = (lang: string) => setLanguage(lang as any);

  return (
    <TranslationContext.Provider value={{ lang: language, setLang, translate }}>
      {children}
    </TranslationContext.Provider>
  );
};

export function useTranslationContext() {
  const ctx = useContext(TranslationContext);
  if (!ctx) {
    throw new Error("useTranslationContext must be used within TranslationProvider");
  }
  return ctx;
}

export function useT() {
  const { translate } = useTranslationContext();
  return translate;
}
