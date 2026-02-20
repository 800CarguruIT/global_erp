import React from "react";
import { resolveScopeFromPath } from "../../lib/scope/resolve-scope";
import { ScopeProvider } from "../../context/scope/ScopeProvider";
import { GlobalPermissionsProvider } from "../../lib/auth/global-permissions";

export default function GlobalLayout({ children }: { children: React.ReactNode }) {
  const scope = resolveScopeFromPath("/global");
  return (
    <ScopeProvider value={scope}>
      <GlobalPermissionsProvider>{children}</GlobalPermissionsProvider>
    </ScopeProvider>
  );
}
