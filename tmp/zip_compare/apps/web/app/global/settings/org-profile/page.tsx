"use client";

import React, { useEffect, useState } from "react";
import { Card, useI18n, useTheme } from "@repo/ui";

type OrgProfile = {
  id?: string;
  name?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  tax_id?: string | null;
  website?: string | null;
  currency?: string | null;
};

export default function OrgProfilePage() {
  const { t } = useI18n();
  const { theme } = useTheme();
  const [profile, setProfile] = useState<OrgProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/accounting/org-profile", { cache: "no-store" });
        if (!res.ok) throw new Error(t("settings.org.error"));
        const data = await res.json().catch(() => ({}));
        if (active) setProfile(data?.data ?? {});
      } catch (err: any) {
        if (active) setError(err?.message ?? t("settings.org.error"));
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [t]);

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/accounting/org-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile?.name,
          address: profile?.address,
          email: profile?.email,
          phone: profile?.phone,
          taxId: profile?.tax_id,
          website: profile?.website,
          currency: profile?.currency,
        }),
      });
      if (!res.ok) throw new Error(t("settings.org.error"));
      const data = await res.json().catch(() => ({}));
      setProfile(data?.data ?? profile);
      setMessage(t("settings.org.saved"));
    } catch (err: any) {
      setError(err?.message ?? t("settings.org.error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("settings.org.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("settings.org.subtitle")}</p>
      </div>
      <Card className="space-y-3 p-4">
        {loading ? (
          <div className="text-sm text-muted-foreground">{t("settings.org.loading")}</div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label={t("settings.org.name")}
                value={profile?.name ?? ""}
                onChange={(v) => setProfile((p) => ({ ...(p ?? {}), name: v }))}
                placeholder="Global ERP"
                themeInput={theme.input}
              />
              <Field
                label={t("settings.org.email")}
                value={profile?.email ?? ""}
                onChange={(v) => setProfile((p) => ({ ...(p ?? {}), email: v }))}
                placeholder="billing@yourcompany.com"
                themeInput={theme.input}
              />
              <Field
                label={t("settings.org.phone")}
                value={profile?.phone ?? ""}
                onChange={(v) => setProfile((p) => ({ ...(p ?? {}), phone: v }))}
                placeholder="+1 555 123 4567"
                themeInput={theme.input}
              />
              <Field
                label={t("settings.org.taxId")}
                value={profile?.tax_id ?? ""}
                onChange={(v) => setProfile((p) => ({ ...(p ?? {}), tax_id: v }))}
                placeholder="VAT / Tax ID"
                themeInput={theme.input}
              />
              <Field
                label={t("settings.org.website")}
                value={profile?.website ?? ""}
                onChange={(v) => setProfile((p) => ({ ...(p ?? {}), website: v }))}
                placeholder="https://example.com"
                themeInput={theme.input}
              />
              <Field
                label={t("settings.org.currency")}
                value={profile?.currency ?? "USD"}
                onChange={(v) => setProfile((p) => ({ ...(p ?? {}), currency: v.toUpperCase() }))}
                placeholder="USD"
                themeInput={theme.input}
              />
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground">{t("settings.org.address")}</label>
                <textarea
                  className={`${theme.input}`}
                  value={profile?.address ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...(p ?? {}), address: e.target.value }))}
                  placeholder={t("settings.org.address")}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
                onClick={save}
                disabled={saving}
              >
                {saving ? t("settings.org.saving") : t("settings.org.save")}
              </button>
              {message && <span className="text-xs text-muted-foreground">{message}</span>}
              {error && <span className="text-xs text-destructive">{error}</span>}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  themeInput,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  themeInput: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <input className={themeInput} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
