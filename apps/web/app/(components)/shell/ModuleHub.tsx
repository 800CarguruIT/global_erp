"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useScope } from "../../../context/scope/ScopeProvider";
import {
  MODULES,
  isModuleVisibleForScope,
  CURRENT_MODULE_PHASE,
  type ModuleKey,
} from "@repo/ai-core/shared/scopes-and-modules";
import { useI18n } from "@repo/ui";

const MODULE_TRANSLATIONS: Partial<
  Record<
    ModuleKey,
    {
      titleKey: string;
      descriptionKey?: string;
      ctaKey?: string;
    }
  >
> = {
  companies: {
    titleKey: "global.main.cards.companies.title",
    descriptionKey: "global.main.cards.companies.description",
    ctaKey: "global.main.cards.companies.cta",
  },
  settings: {
    titleKey: "global.main.cards.settings.title",
    descriptionKey: "global.main.cards.settings.description",
    ctaKey: "global.main.cards.settings.cta",
  },
};

export function ModuleHub() {
  const { t } = useI18n();
  const scope = useScope();
  const pathname = usePathname();
  const modules = Object.values(MODULES).filter((m) =>
    isModuleVisibleForScope(scope.scope, m.key, CURRENT_MODULE_PHASE)
  );

  let basePath = "/global";
  if (scope.scope === "company") {
    basePath = `/company/${scope.companyId}`;
  } else if (scope.scope === "branch") {
    basePath =
      pathname?.startsWith("/branches/") && scope.branchId
        ? `/branches/${scope.branchId}`
        : `/company/${scope.companyId}/branches/${scope.branchId}`;
  } else if (scope.scope === "vendor") {
    basePath = scope.companyId ? `/company/${scope.companyId}/vendors/${scope.vendorId}` : `/vendor/${scope.vendorId}`;
  }

  const MODULE_PATH_OVERRIDES: Partial<Record<ModuleKey, string>> = {
    leads: "/leads",
    hr: "/hr/employees",
    customers: "/customers",
    cars: "/cars",
    aiPanel: "/settings/ai/panel",
    integrationPanel: "/settings/integrations",
    sessionPanel: "/settings/security/monitoring",
  };

  if (modules.length === 0) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card/60 p-6 text-sm text-muted-foreground">
        No modules enabled yet. Use Settings to configure this scope.
      </div>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {modules.map((m) => {
        const override = MODULE_PATH_OVERRIDES[m.key as ModuleKey];
        const modulePath = override ?? `/${m.key}`;
        const href = `${basePath}${modulePath}`;
        const translation = MODULE_TRANSLATIONS[m.key as ModuleKey];
        const title = translation ? t(translation.titleKey) : m.label;
        const description = translation?.descriptionKey ? t(translation.descriptionKey) : m.description;
        const cta = translation?.ctaKey ? t(translation.ctaKey) : `Open ${m.label}`;
        return (
          <Link
            key={m.key}
            href={href}
            className="group relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card/90 via-card/80 to-muted/40 p-[1px] shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/15 via-transparent to-primary/5 opacity-0 transition group-hover:opacity-100" />
            <div className="relative flex h-full flex-col rounded-2xl bg-card/95 px-4 py-3 transition group-hover:bg-card/100">
              <div className="flex items-center justify-between gap-2">
                <div className="text-lg font-semibold text-foreground tracking-tight">{title}</div>
                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-muted/50 text-xs text-muted-foreground transition group-hover:border-primary/50 group-hover:text-primary">
                  ?
                </div>
              </div>
              {(description ?? m.description) && (
                <p className="mt-2 text-sm text-muted-foreground leading-snug">{description ?? m.description}</p>
              )}
              <div className="mt-3 inline-flex w-fit items-center gap-2 rounded-full bg-muted/40 px-3 py-1 text-xs text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary group-hover:border-primary/40 border border-transparent">
                <span className="h-2 w-2 rounded-full bg-primary/70" />
                {cta}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
