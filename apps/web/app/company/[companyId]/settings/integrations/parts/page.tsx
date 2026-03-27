"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AppLayout, Card } from "@repo/ui";

type Params = { params: { companyId: string } | Promise<{ companyId: string }> };

type PartsConfigResponse = {
  ok: boolean;
  provider: "vin17";
  enabled: boolean;
  baseUrl: string;
  username: string;
  usernameParam: string;
  signatureParam: string;
  hasPassword: boolean;
};

export default function CompanyPartsIntegrationsPage({ params }: Params) {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [enabled, setEnabled] = useState(true);
  const [baseUrl, setBaseUrl] = useState("http://api.17vin.com:8080");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [usernameParam, setUsernameParam] = useState("user");
  const [signatureParam, setSignatureParam] = useState("token");
  const [hasSavedPassword, setHasSavedPassword] = useState(false);

  useEffect(() => {
    Promise.resolve(params).then((p) => setCompanyId(p?.companyId ?? null));
  }, [params]);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setSuccess(null);
      try {
        const res = await fetch(`/api/company/${companyId}/integrations/parts`, { cache: "no-store" });
        const body = (await res.json().catch(() => ({}))) as Partial<PartsConfigResponse> & { error?: string };
        if (!res.ok) throw new Error(body.error || "Failed to load parts integration.");
        if (cancelled) return;

        setEnabled(Boolean(body.enabled ?? true));
        setBaseUrl(String(body.baseUrl ?? "http://api.17vin.com:8080"));
        setUsername(String(body.username ?? ""));
        setUsernameParam(String(body.usernameParam ?? "user"));
        setSignatureParam(String(body.signatureParam ?? "token"));
        setHasSavedPassword(Boolean(body.hasPassword));
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load parts integration.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const canSave = useMemo(() => {
    if (!baseUrl.trim() || !username.trim()) return false;
    if (!hasSavedPassword && !password.trim()) return false;
    return true;
  }, [baseUrl, username, password, hasSavedPassword]);

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!companyId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/company/${companyId}/integrations/parts`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          baseUrl,
          username,
          password,
          usernameParam,
          signatureParam,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; hasPassword?: boolean };
      if (!res.ok) throw new Error(body.error || "Failed to save parts integration.");
      setHasSavedPassword(Boolean(body.hasPassword ?? true));
      setPassword("");
      setSuccess("Parts integration saved.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save parts integration.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout>
      <div className="space-y-6 py-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Parts Integrations</h1>
          <p className="text-sm text-muted-foreground">Configure VIN decoding provider used by inspection auto-fill.</p>
        </div>

        <Card className="space-y-4">
          <div className="text-base font-semibold">17VIN</div>
          <div className="text-sm text-slate-300">
            Auth token is generated as MD5(MD5(username)+MD5(password)+"/?vin=VIN").
          </div>

          {loading ? <div className="text-sm text-muted-foreground">Loading configuration...</div> : null}
          {error ? <div className="text-sm text-red-500">{error}</div> : null}
          {success ? <div className="text-sm text-emerald-500">{success}</div> : null}

          <form className="space-y-3" onSubmit={onSave}>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4"
              />
              Enable 17VIN for this company
            </label>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Base URL</label>
              <input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="e.g. http://api.17vin.com:8080"
                className="w-full rounded-md border border-white/20 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="17VIN username"
                className="w-full rounded-md border border-white/20 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={hasSavedPassword ? "Leave empty to keep current password" : "17VIN password"}
                className="w-full rounded-md border border-white/20 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Username Param</label>
                <input
                  value={usernameParam}
                  onChange={(e) => setUsernameParam(e.target.value)}
                  placeholder="default: user"
                  className="w-full rounded-md border border-white/20 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Token Param</label>
                <input
                  value={signatureParam}
                  onChange={(e) => setSignatureParam(e.target.value)}
                  placeholder="default: token"
                  className="w-full rounded-md border border-white/20 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={loading || saving || !canSave}
                className="rounded-md border border-input px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </Card>
      </div>
    </AppLayout>
  );
}
