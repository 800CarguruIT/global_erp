"use client";

import React, { createContext, useContext, useMemo, useState } from "react";
import { useOptionalGlobalUiContext } from "./providers/GlobalUiProvider";

export type ThemeId = "midnight" | "sunset" | "ocean" | "forest" | "light";

type Theme = {
  id: ThemeId;
  label: string;

  // App-level colors
  appBg: string;
  appText: string;

  // Card / surface
  cardBg: string;
  cardBorder: string;

  // Subtle surfaces (inside cards)
  surfaceSubtle: string;

  // Form controls
  inputBg: string;
  inputBorder: string;
  inputText: string;
  inputPlaceholder: string;
  input: string;

  // Secondary text
  mutedText: string;

  // Accent gradient for primary buttons
  accent: string;
};

const THEMES: Record<ThemeId, Theme> = {
  midnight: {
    id: "midnight",
    label: "Midnight Neon",
    appBg: "bg-slate-950",
    appText: "text-slate-100",
    cardBg:
      "bg-gradient-to-br from-slate-900/80 via-slate-950/90 to-black/95 backdrop-blur-xl",
    cardBorder: "border border-white/10",
    surfaceSubtle: "bg-slate-900/70",
    inputBg: "bg-slate-900/70",
    inputBorder: "border border-white/25",
    inputText: "text-slate-50",
    inputPlaceholder: "placeholder:text-slate-400",
    input:
      "w-full rounded-md px-3 py-2 text-sm bg-slate-900/70 border border-white/25 text-slate-50 placeholder:text-slate-400",
    mutedText: "text-slate-300/80",
    accent:
      "from-fuchsia-500 via-violet-500 to-emerald-400 shadow-[0_0_35px_rgba(168,85,247,0.6)]",
  },
  sunset: {
    id: "sunset",
    label: "Sunset Glow",
    appBg: "bg-gradient-to-br from-slate-950 via-purple-950 to-orange-900",
    appText: "text-orange-50",
    cardBg:
      "bg-gradient-to-br from-slate-900/80 via-slate-950/90 to-slate-950/95 backdrop-blur-xl",
    cardBorder: "border border-orange-400/40",
    surfaceSubtle: "bg-slate-900/70",
    inputBg: "bg-slate-900/70",
    inputBorder: "border border-orange-300/60",
    inputText: "text-orange-50",
    inputPlaceholder: "placeholder:text-orange-200/80",
    input:
      "w-full rounded-md px-3 py-2 text-sm bg-slate-900/70 border border-orange-300/60 text-orange-50 placeholder:text-orange-200/80",
    mutedText: "text-orange-100/80",
    accent:
      "from-orange-500 via-amber-400 to-pink-500 shadow-[0_0_35px_rgba(249,115,22,0.65)]",
  },
  ocean: {
    id: "ocean",
    label: "Deep Ocean",
    appBg: "bg-gradient-to-br from-slate-950 via-sky-950 to-cyan-900",
    appText: "text-sky-50",
    cardBg:
      "bg-gradient-to-br from-slate-900/80 via-slate-950/90 to-slate-950/95 backdrop-blur-xl",
    cardBorder: "border border-cyan-400/40",
    surfaceSubtle: "bg-slate-900/70",
    inputBg: "bg-slate-900/70",
    inputBorder: "border border-cyan-300/60",
    inputText: "text-sky-50",
    inputPlaceholder: "placeholder:text-sky-200/80",
    input:
      "w-full rounded-md px-3 py-2 text-sm bg-slate-900/70 border border-cyan-300/60 text-sky-50 placeholder:text-sky-200/80",
    mutedText: "text-sky-100/80",
    accent:
      "from-cyan-400 via-sky-500 to-indigo-500 shadow-[0_0_35px_rgba(56,189,248,0.6)]",
  },
  forest: {
    id: "forest",
    label: "Neon Forest",
    appBg: "bg-gradient-to-br from-slate-950 via-emerald-950 to-lime-900",
    appText: "text-emerald-50",
    cardBg:
      "bg-gradient-to-br from-slate-900/80 via-slate-950/90 to-slate-950/95 backdrop-blur-xl",
    cardBorder: "border border-emerald-400/40",
    surfaceSubtle: "bg-slate-900/70",
    inputBg: "bg-slate-900/70",
    inputBorder: "border border-emerald-300/60",
    inputText: "text-emerald-50",
    inputPlaceholder: "placeholder:text-emerald-200/80",
    input:
      "w-full rounded-md px-3 py-2 text-sm bg-slate-900/70 border border-emerald-300/60 text-emerald-50 placeholder:text-emerald-200/80",
    mutedText: "text-emerald-100/80",
    accent:
      "from-emerald-400 via-lime-400 to-cyan-400 shadow-[0_0_35px_rgba(16,185,129,0.6)]",
  },
  light: {
    id: "light",
    label: "Clean Light",
    appBg: "bg-slate-100",
    appText: "text-slate-900",
    cardBg: "bg-white shadow-lg",
    cardBorder: "border border-slate-200",
    surfaceSubtle: "bg-slate-100",
    inputBg: "bg-white",
    inputBorder: "border border-slate-300",
    inputText: "text-slate-900",
    inputPlaceholder: "placeholder:text-slate-400",
    input:
      "w-full rounded-md px-3 py-2 text-sm bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400",
    mutedText: "text-slate-600",
    accent:
      "from-sky-500 via-indigo-500 to-fuchsia-500 shadow-[0_0_25px_rgba(59,130,246,0.4)]",
  },
};

type ThemeContextValue = {
  theme: Theme;
  themes: Theme[];
  setThemeId: (id: ThemeId) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const globalUi = useOptionalGlobalUiContext();
  const [fallbackThemeId, setFallbackThemeId] = useState<ThemeId>("midnight");
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch by rendering the same theme on server and first client paint.
  // After mount, we sync to the stored / global UI theme.
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const themeId = mounted ? globalUi?.theme ?? fallbackThemeId : fallbackThemeId;
  const setTheme = globalUi?.setTheme ?? setFallbackThemeId;

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: THEMES[themeId],
      themes: Object.values(THEMES),
      setThemeId: setTheme,
    }),
    [themeId, setTheme]
  );

  return (
    <ThemeContext.Provider value={value}>
      <div className={`${THEMES[themeId].appBg} ${THEMES[themeId].appText}`} suppressHydrationWarning>
        {children}
      </div>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
};
