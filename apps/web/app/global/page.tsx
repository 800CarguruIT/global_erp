"use client";

import { AppLayout, useI18n, useTheme, Card } from "@repo/ui";
import { useEffect, useMemo, useState } from "react";
import { SIDEBAR_CONFIG } from "@repo/ui/layout/sidebarConfig";
import Link from "next/link";
import { useGlobalPermissions } from "../../lib/auth/global-permissions";

export default function GlobalHomePage() {
  return (
    <AppLayout>
      <GlobalHomeContent />
    </AppLayout>
  );
}

function GlobalHomeContent() {
  const { t, lang } = useI18n() as any;
  const { theme } = useTheme();
  const isLight = theme.id === "light";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiAppreciation, setAiAppreciation] = useState<string | null>(null);
  const [data, setData] = useState<{
    companies?: { total: number };
    subscriptions?: { active: number };
    leads?: { sales: number; support: number; complaint: number };
    calls?: { last24h: number };
    campaigns?: { active: number };
    agents?: { active: number };
  } | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/global/analytics", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load analytics");
        const json = await res.json();
        if (active) setData(json);
      } catch (err: any) {
        if (active) setError(err?.message ?? t("global.data.error"));
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    let active = true;
    async function loadAi() {
      setAiLoading(true);
      setAiError(null);
      try {
        const res = await fetch(`/api/global/ai-summary?lang=${encodeURIComponent(lang || "en")}`, { cache: "no-store" });
        if (!res.ok) throw new Error("AI summary failed");
        const json = await res.json();
        if (!active) return;
        setAiSuggestions(Array.isArray(json.suggestions) ? json.suggestions : []);
        setAiAppreciation(json.appreciation ?? null);
      } catch (err: any) {
        if (active) setAiError(err?.message ?? t("global.aiBox.model.error"));
      } finally {
        if (active) setAiLoading(false);
      }
    }
    loadAi();
    return () => {
      active = false;
    };
  }, [lang, t]);

  const cards = useMemo(() => {
    const d = data ?? {};
    return [
      { label: t("global.kpi.activeCompanies"), value: d.companies?.total ?? null },
      { label: t("global.kpi.activeLeads"), value: d.leads ? d.leads.sales + d.leads.support + d.leads.complaint : null },
      { label: t("global.kpi.activeCalls"), value: d.calls?.last24h ?? null },
      { label: t("global.kpi.activeCampaigns"), value: d.campaigns?.active ?? null },
    ];
  }, [data, t]);

  const actions = useMemo(() => {
    const d = data;
    const list: string[] = [];
    if (!d) return list;
    if ((d.leads?.sales ?? 0) + (d.leads?.support ?? 0) + (d.leads?.complaint ?? 0) === 0) {
      list.push(t("global.aiBox.action.noLeads"));
    }
    if ((d.calls?.last24h ?? 0) === 0) {
      list.push(t("global.aiBox.action.noCalls"));
    }
    if ((d.campaigns?.active ?? 0) === 0) {
      list.push(t("global.aiBox.action.noCampaigns"));
    }
    if ((d.companies?.total ?? 0) === 0) {
      list.push(t("global.aiBox.action.noCompanies"));
    }
    return list;
  }, [data, t]);

  const appreciation = useMemo(() => {
    const d = data;
    if (!d) return null;
    if ((d.calls?.last24h ?? 0) > 0) {
      return t("global.aiBox.appreciation.calls").replace("{count}", String(d.calls?.last24h));
    }
    if ((d.leads?.sales ?? 0) > 0) {
      return t("global.aiBox.appreciation.leads").replace("{count}", String(d.leads?.sales));
    }
    if ((d.companies?.total ?? 0) > 0) {
      return t("global.aiBox.appreciation.companies").replace("{count}", String(d.companies?.total));
    }
    return t("global.aiBox.appreciation.fallback");
  }, [data, t]);

  const { hasPermission, loading: permLoading } = useGlobalPermissions();

  const featureGroups = useMemo(
    () => [
      {
        header: "Users",
        items: [
          {
            label: t("settings.users.title"),
            description: t("settings.users.subtitle"),
            href: "/global/settings/security/users",
            permission: "global.users.list",
          },
          {
            label: t("settings.roles.title"),
            description: t("settings.roles.subtitle"),
            href: "/global/settings/security/roles",
            permission: "global.roles.list",
          },
        ],
      },
      {
        header: "Companies",
        items: [
          {
            label: t("global.nav.companies"),
            description: t("global.nav.companies"),
            href: "/global/companies",
            permission: "global.companies.list",
          },
        ],
      },
      {
        header: t("settings.title"),
        items: [
          {
            label: t("settings.title"),
            description: t("settings.subtitle"),
            href: "/global/settings",
            permission: "global.settings.manage",
          },
        ],
      },
    ],
    [t]
  );

  const visibleFeatureGroups = useMemo(() => {
    if (permLoading) return [];
    return featureGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => hasPermission(item.permission)),
      }))
      .filter((group) => group.items.length > 0);
  }, [featureGroups, permLoading, hasPermission]);

  const navLinks = (SIDEBAR_CONFIG.global?.Main ?? [])
    .filter((item) => item.href !== "/global" && !["/global/analytics", "/global/reports"].includes(item.href))
    .map((item) => ({
      href: item.href,
      label: item.labelKey ? t(item.labelKey) : item.label ?? item.href,
      permissionKeys: item.permissionKeys ?? [],
    }))
    .filter((item) => {
      if (!item.permissionKeys.length) return true;
      if (permLoading) return false;
      return hasPermission(item.permissionKeys);
    });

  return (
    <div className="space-y-6 py-6">
      <div className={`rounded-2xl ${theme.cardBg} ${theme.cardBorder} p-6 shadow-lg`}>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{t("global.hero.title")}</p>
          <h1 className="text-3xl font-semibold">{t("global.main.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("global.hero.subtitle")}</p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <Card
              key={card.label}
              className={`border ${isLight ? "bg-white" : "bg-background/60"} shadow-sm flex flex-col gap-1`}
            >
              <div className="text-xs text-muted-foreground">{card.label}</div>
              <div className="text-xl font-semibold">
                {card.value != null ? card.value : loading ? t("global.data.loading") : "—"}
              </div>
            </Card>
          ))}
        </div>

        {(error || loading || !data) && (
          <div className="mt-6 rounded-xl border border-dashed border-muted-foreground/30 bg-background/50 p-4 text-sm text-muted-foreground">
            {error && <div className="text-destructive">{error}</div>}
            {!error && loading && <div>{t("global.data.loading")}</div>}
            {!error && !loading && !data && (
              <>
                <div className="font-semibold text-foreground">{t("global.data.pending")}</div>
                <div>{t("global.data.hint")}</div>
              </>
            )}
          </div>
        )}

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card className={`${isLight ? "bg-white" : "bg-background/60"} border`}>
            <div className="space-y-2">
              <div className="text-sm font-semibold">{t("global.aiBox.actions.title")}</div>
              {aiLoading && <div className="text-sm text-muted-foreground">{t("global.aiBox.model.loading")}</div>}
              {aiError && <div className="text-sm text-destructive">{t("global.aiBox.model.error")}</div>}
              {!aiLoading && !aiError && (
                <>
                  {aiSuggestions.length === 0 && actions.length === 0 && (
                    <div className="text-sm text-muted-foreground">{t("global.aiBox.actions.empty")}</div>
                  )}
                  <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                    {aiSuggestions.map((a, idx) => (
                      <li key={`ai-${idx}`}>{a}</li>
                    ))}
                    {actions.map((a, idx) => (
                      <li key={`rule-${idx}`}>{a}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </Card>

          <Card className={`${isLight ? "bg-white" : "bg-background/60"} border`}>
            <div className="space-y-2">
              <div className="text-sm font-semibold">{t("global.aiBox.appreciation.title")}</div>
              <div className="text-sm text-muted-foreground">
                {aiLoading
                  ? t("global.aiBox.model.loading")
                  : aiAppreciation ?? appreciation ?? t("global.aiBox.appreciation.fallback")}
              </div>
            </div>
          </Card>
        </div>

        {permLoading ? (
          <div className="mt-6 rounded-2xl border border-dashed border-muted-foreground/40 bg-background/50 p-4 text-sm text-muted-foreground">
            Loading access rights...
          </div>
        ) : visibleFeatureGroups.length > 0 ? (
          <div className="mt-6 space-y-6">
            {visibleFeatureGroups.map((group) => (
              <FeatureGroup key={group.header} header={group.header} items={group.items} />
            ))}
          </div>
        ) : null}

        {navLinks.length > 0 && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="group">
                <Card className={`h-full transition hover:border-primary/50 ${isLight ? "bg-white" : "bg-background/60"}`}>
                  <div className="text-sm font-semibold group-hover:text-primary">{link.label}</div>
                  <div className="text-xs text-muted-foreground">{t("global.nav.open")}</div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type FeatureGroupItem = {
  label: string;
  description: string;
  href: string;
  permission: string;
};

function FeatureGroup({ header, items }: { header: string; items: FeatureGroupItem[] }) {
  return (
    <div className="space-y-3">
      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{header}</div>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className="group">
            <Card className="h-full border transition hover:border-primary/50">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-lg font-semibold">{item.label}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                <span className="text-xs uppercase tracking-[0.3em] text-primary">Open</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
