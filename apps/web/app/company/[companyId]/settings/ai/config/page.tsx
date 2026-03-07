"use client";

import { AppLayout } from "@repo/ui";
import { useEffect, useMemo, useState } from "react";

type CompanyAiProviderResponse = {
  companyId: string;
  provider: "openai";
  configured: boolean;
  isActive: boolean;
  baseUrl: string | null;
  apiKeyMasked: string | null;
  updatedAt: string | null;
};

type Params = { params: { companyId: string } | Promise<{ companyId: string }> };

export default function CompanyAiConfigPage({ params }: Params) {
  const [companyId, setCompanyId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [existingMask, setExistingMask] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    Promise.resolve(params).then((p: any) => {
      const id = String(p?.companyId ?? "").trim();
      setCompanyId(id);
    });
  }, [params]);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setSuccess(null);
      try {
        const res = await fetch(`/api/company/${companyId}/ai/provider`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to load company AI provider config");
        const json: CompanyAiProviderResponse = await res.json();
        if (cancelled) return;
        setIsActive(Boolean(json.isActive));
        setBaseUrl(json.baseUrl ?? "");
        setExistingMask(json.apiKeyMasked ?? null);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "Failed to load company AI provider config");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const canSubmit = useMemo(
    () => !loading && !saving && !clearing && !!companyId,
    [loading, saving, clearing, companyId]
  );

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!companyId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: Record<string, unknown> = {
        isActive,
        baseUrl: baseUrl.trim() || null,
      };
      if (apiKey.trim()) payload.apiKey = apiKey.trim();

      const res = await fetch(`/api/company/${companyId}/ai/provider`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save company AI provider config");
      const json: CompanyAiProviderResponse = await res.json();
      setExistingMask(json.apiKeyMasked ?? null);
      setApiKey("");
      setSuccess("Saved successfully.");
    } catch (err: any) {
      setError(err?.message ?? "Failed to save company AI provider config");
    } finally {
      setSaving(false);
    }
  }

  async function onClear() {
    if (!companyId) return;
    setClearing(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/company/${companyId}/ai/provider`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to clear company AI provider config");
      setBaseUrl("");
      setApiKey("");
      setExistingMask(null);
      setIsActive(false);
      setSuccess("Company AI provider config cleared.");
    } catch (err: any) {
      setError(err?.message ?? "Failed to clear company AI provider config");
    } finally {
      setClearing(false);
    }
  }

  return (
    <AppLayout>
      <div className="max-w-2xl space-y-4 py-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">AI Provider Configuration</h1>
          <p className="text-sm text-muted-foreground">
            Set OpenAI credentials for this company. Company credentials are used first; global env key is fallback.
          </p>
        </div>

        {error && <div className="text-sm text-red-500">{error}</div>}
        {success && <div className="text-sm text-green-600">{success}</div>}

        {!companyId ? (
          <div className="text-sm text-muted-foreground">Company is required.</div>
        ) : loading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (
          <form onSubmit={onSave} className="space-y-4 rounded-2xl border p-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Provider</label>
              <input
                value="OpenAI"
                disabled
                className="w-full rounded-md border px-3 py-2 text-sm bg-muted/30"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Base URL (optional)</label>
              <input
                type="url"
                placeholder="https://api.openai.com/v1"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">API Key</label>
              <input
                type="password"
                placeholder={existingMask ? `Current: ${existingMask}` : "sk-..."}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to keep the current key unchanged.
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Enable company AI provider
            </label>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={!canSubmit}
                className="rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={onClear}
                disabled={loading || saving || clearing || !companyId}
                className="rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-60"
              >
                {clearing ? "Clearing..." : "Clear"}
              </button>
            </div>
          </form>
        )}
      </div>
    </AppLayout>
  );
}
