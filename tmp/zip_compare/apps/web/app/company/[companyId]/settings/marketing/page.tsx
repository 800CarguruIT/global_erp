"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppLayout, Card, useTheme } from "@repo/ui";

type SettingsData = {
  companyId: string;
  easycronApiKey: string | null;
  easycronTimezone: string | null;
  scheduleLaunch: boolean;
  scheduleDelay: boolean;
};

export default function CompanyMarketingSettingsPage() {
  const params = useParams();
  const companyId = Array.isArray(params?.companyId) ? params.companyId[0] : (params?.companyId as string | undefined);
  const { theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<SettingsData | null>(null);

  useEffect(() => {
    if (!companyId) return;
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/company/${companyId}/marketing/settings`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load marketing settings");
        const body = await res.json().catch(() => ({}));
        if (active) {
          setForm(body?.data ?? null);
        }
      } catch (err: any) {
        if (active) setError(err?.message ?? "Failed to load marketing settings");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [companyId]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!companyId || !form) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/company/${companyId}/marketing/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Failed to save settings");
      }
      setForm(body?.data ?? form);
      setMessage("Saved");
    } catch (err: any) {
      setError(err?.message ?? "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = `${theme.input} w-full`;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6 py-6">
        <div className="space-y-1">
          <p className="text-xs uppercase text-muted-foreground">Marketing</p>
          <h1 className="text-2xl font-semibold">Scheduling</h1>
          <p className="text-sm text-muted-foreground">
            Configure EasyCron settings for campaign launches and delay nodes.
          </p>
        </div>

        {error && <div className="text-sm text-red-400">{error}</div>}
        {message && <div className="text-sm text-green-400">{message}</div>}

        {loading || !form ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (
          <Card className="p-5">
            <form className="space-y-4" onSubmit={handleSave}>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">EasyCron API key</label>
                <input
                  className={`${inputClass} mt-1`}
                  type="password"
                  value={form.easycronApiKey ?? ""}
                  onChange={(event) =>
                    setForm((prev) =>
                      prev
                        ? { ...prev, easycronApiKey: event.target.value }
                        : prev
                    )
                  }
                  placeholder="EasyCron token"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Timezone</label>
                <input
                  className={`${inputClass} mt-1`}
                  value={form.easycronTimezone ?? ""}
                  onChange={(event) =>
                    setForm((prev) =>
                      prev
                        ? { ...prev, easycronTimezone: event.target.value }
                        : prev
                    )
                  }
                  placeholder="e.g., Asia/Dubai"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.scheduleLaunch}
                    onChange={(event) =>
                      setForm((prev) =>
                        prev
                          ? { ...prev, scheduleLaunch: event.target.checked }
                          : prev
                      )
                    }
                  />
                  Schedule Launch nodes
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.scheduleDelay}
                    onChange={(event) =>
                      setForm((prev) =>
                        prev
                          ? { ...prev, scheduleDelay: event.target.checked }
                          : prev
                      )
                    }
                  />
                  Schedule Delay nodes
                </label>
              </div>
              <div>
                <button
                  type="submit"
                  className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save settings"}
                </button>
              </div>
            </form>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
