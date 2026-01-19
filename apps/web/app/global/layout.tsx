import React from "react";
import { resolveScopeFromPath } from "../../lib/scope/resolve-scope";
import { ScopeProvider } from "../../context/scope/ScopeProvider";

export default function GlobalLayout({ children }: { children: React.ReactNode }) {
  const scope = resolveScopeFromPath("/global");
  return <ScopeProvider value={scope}>{children}</ScopeProvider>;
}
