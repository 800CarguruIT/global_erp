"use client";

import React, { createContext, useContext } from "react";
import type { ScopeContext } from "@repo/ai-core/shared/scopes-and-modules";

const ScopeContextReact = createContext<ScopeContext | null>(null);

export function ScopeProvider({ value, children }: { value: ScopeContext; children: React.ReactNode }) {
  return <ScopeContextReact.Provider value={value}>{children}</ScopeContextReact.Provider>;
}

export function useScope() {
  const ctx = useContext(ScopeContextReact);
  if (!ctx) {
    throw new Error("useScope must be used inside ScopeProvider");
  }
  return ctx;
}
