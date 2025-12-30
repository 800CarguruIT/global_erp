"use client";

import Link from "next/link";
import { LogoutButton } from "../auth/LogoutButton";
import { useScope } from "../../../context/scope/ScopeProvider";
import { useTheme } from "@repo/ui";
import { useEffect, useState } from "react";

export function HeaderBar() {
  const scope = useScope();
  const { themes, setThemeId, theme } = useTheme();
  const [companyName, setCompanyName] = useState<string | null>(null);

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

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background px-2 py-1 text-xs text-muted-foreground">
          <span className="px-2 py-1 rounded-full bg-primary/10 text-primary/90 border border-primary/20">
            EN
          </span>
          <span className="h-4 w-px bg-border/60" />
          <select
            aria-label="Theme"
            value={theme.id}
            onChange={(e) => setThemeId(e.target.value as any)}
            className="bg-transparent outline-none text-xs text-foreground"
          >
            {themes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <Link href="/settings">
          <button className="text-sm border border-border rounded-full px-3 py-1 bg-background hover:bg-muted transition">
            Settings
          </button>
        </Link>

        <LogoutButton className="text-sm border border-border rounded-full px-3 py-1 bg-background hover:bg-muted transition" />
      </div>
    </header>
  );
}
