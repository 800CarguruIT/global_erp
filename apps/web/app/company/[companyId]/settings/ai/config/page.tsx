"use client";

import { AppLayout, useTheme } from "@repo/ui";
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

type VoicePolicy = {
  companyId: string;
  enabled: boolean;
  mode: "dry_run" | "live";
  timezone: string;
  businessHours: {
    enabled: boolean;
    start: string;
    end: string;
    days: number[];
  };
  restrictions: {
    blockUnknownNumbers: boolean;
    blockedPrefixes: string[];
    allowedPrefixes: string[];
  };
  guidance: {
    welcomeMessage: string;
    systemPrompt: string;
    escalationKeywords: string[];
    automationEnabled: boolean;
    simulationMode: boolean;
  };
  updatedByUserId: string | null;
  updatedAt: string | null;
};

type DecisionRow = {
  id: string;
  decision: string;
  reason: string;
  mode: string;
  matched_rule: string | null;
  provider_key: string;
  provider_call_id: string;
  from_number: string | null;
  details?: Record<string, any> | null;
  created_at: string;
};

type VoicePolicyResponse = {
  companyId: string;
  policy: VoicePolicy;
  recentDecisions: DecisionRow[];
};

type Params = { params: { companyId: string } | Promise<{ companyId: string }> };

type TabKey = "provider" | "voice" | "logs";

export default function CompanyAiConfigPage({ params }: Params) {
  const { theme } = useTheme();
  const [companyId, setCompanyId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<TabKey>("provider");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [policyLoading, setPolicyLoading] = useState(true);
  const [policySaving, setPolicySaving] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [logsRefreshing, setLogsRefreshing] = useState(false);

  const [existingMask, setExistingMask] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [policyEnabled, setPolicyEnabled] = useState(false);
  const [policyMode, setPolicyMode] = useState<"dry_run" | "live">("dry_run");
  const [policyTimezone, setPolicyTimezone] = useState("Asia/Dubai");
  const [policyBhEnabled, setPolicyBhEnabled] = useState(false);
  const [policyBhStart, setPolicyBhStart] = useState("09:00");
  const [policyBhEnd, setPolicyBhEnd] = useState("18:00");
  const [policyBhDaysText, setPolicyBhDaysText] = useState("1,2,3,4,5");
  const [policyBlockUnknown, setPolicyBlockUnknown] = useState(false);
  const [policyBlockedPrefixesText, setPolicyBlockedPrefixesText] = useState("");
  const [policyAllowedPrefixesText, setPolicyAllowedPrefixesText] = useState("");
  const [policyWelcomeMessage, setPolicyWelcomeMessage] = useState("");
  const [policySystemPrompt, setPolicySystemPrompt] = useState("");
  const [policyEscalationKeywordsText, setPolicyEscalationKeywordsText] = useState("");
  const [policyAutomationEnabled, setPolicyAutomationEnabled] = useState(false);
  const [policySimulationMode, setPolicySimulationMode] = useState(true);
  const [recentDecisions, setRecentDecisions] = useState<DecisionRow[]>([]);

  useEffect(() => {
    Promise.resolve(params).then((p: any) => {
      setCompanyId(String(p?.companyId ?? "").trim());
    });
  }, [params]);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;

    async function loadAll() {
      setLoading(true);
      setPolicyLoading(true);
      setError(null);
      setPolicyError(null);
      setSuccess(null);

      const [providerRes, policyRes] = await Promise.allSettled([
        fetch(`/api/company/${companyId}/ai/provider`, { cache: "no-store" }),
        fetch(`/api/company/${companyId}/ai/voice-policy`, { cache: "no-store" }),
      ]);

      if (cancelled) return;

      if (providerRes.status === "fulfilled" && providerRes.value.ok) {
        const json: CompanyAiProviderResponse = await providerRes.value.json();
        setIsActive(Boolean(json.isActive));
        setBaseUrl(json.baseUrl ?? "");
        setExistingMask(json.apiKeyMasked ?? null);
      } else {
        setError("Failed to load company AI provider config");
      }

      if (policyRes.status === "fulfilled" && policyRes.value.ok) {
        const policyJson: VoicePolicyResponse = await policyRes.value.json();
        setPolicyEnabled(Boolean(policyJson.policy?.enabled));
        setPolicyMode(policyJson.policy?.mode === "live" ? "live" : "dry_run");
        setPolicyTimezone(String(policyJson.policy?.timezone ?? "Asia/Dubai"));
        setPolicyBhEnabled(Boolean(policyJson.policy?.businessHours?.enabled));
        setPolicyBhStart(String(policyJson.policy?.businessHours?.start ?? "09:00"));
        setPolicyBhEnd(String(policyJson.policy?.businessHours?.end ?? "18:00"));
        setPolicyBhDaysText((policyJson.policy?.businessHours?.days ?? [1, 2, 3, 4, 5]).join(","));
        setPolicyBlockUnknown(Boolean(policyJson.policy?.restrictions?.blockUnknownNumbers));
        setPolicyBlockedPrefixesText((policyJson.policy?.restrictions?.blockedPrefixes ?? []).join(","));
        setPolicyAllowedPrefixesText((policyJson.policy?.restrictions?.allowedPrefixes ?? []).join(","));
        setPolicyWelcomeMessage(String(policyJson.policy?.guidance?.welcomeMessage ?? ""));
        setPolicySystemPrompt(String(policyJson.policy?.guidance?.systemPrompt ?? ""));
        setPolicyEscalationKeywordsText((policyJson.policy?.guidance?.escalationKeywords ?? []).join(","));
        setPolicyAutomationEnabled(Boolean(policyJson.policy?.guidance?.automationEnabled));
        setPolicySimulationMode(
          policyJson.policy?.guidance?.simulationMode === undefined
            ? true
            : Boolean(policyJson.policy?.guidance?.simulationMode)
        );
        setRecentDecisions(policyJson.recentDecisions ?? []);
      } else {
        setPolicyError("Failed to load voice AI policy");
      }

      setLoading(false);
      setPolicyLoading(false);
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  async function refreshDecisionLogs() {
    if (!companyId) return;
    setLogsRefreshing(true);
    try {
      const res = await fetch(`/api/company/${companyId}/ai/voice-policy`, { cache: "no-store" });
      if (!res.ok) return;
      const json: VoicePolicyResponse = await res.json();
      setRecentDecisions(json.recentDecisions ?? []);
    } finally {
      setLogsRefreshing(false);
    }
  }

  useEffect(() => {
    if (!companyId || activeTab !== "logs") return;
    void refreshDecisionLogs();
    const timer = setInterval(() => {
      void refreshDecisionLogs();
    }, 5000);
    return () => clearInterval(timer);
  }, [companyId, activeTab]);

  const canSubmitProvider = useMemo(
    () => !loading && !saving && !clearing && !!companyId,
    [loading, saving, clearing, companyId]
  );
  const inputClass = `${theme.input} border-0 outline-none focus:outline-none focus:ring-0`;
  const tabBaseClass =
    "rounded-xl px-4 py-2 text-sm font-medium border shadow-sm transition outline-none focus:outline-none focus:ring-0";
  const neutralButtonClass = `rounded-xl px-4 py-2 text-sm font-semibold border shadow-sm transition outline-none focus:outline-none focus:ring-0 disabled:opacity-60 ${theme.surfaceSubtle} ${theme.cardBorder} ${theme.appText} hover:border-primary/60`;
  const primaryButtonClass = `rounded-xl px-4 py-2 text-sm font-semibold border shadow-sm transition outline-none focus:outline-none focus:ring-0 disabled:opacity-60 ${theme.surfaceSubtle} ${theme.cardBorder} ${theme.appText} hover:border-primary/60`;

  function splitCsv(input: string): string[] {
    return input
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }

  async function onSaveProvider(e: React.FormEvent<HTMLFormElement>) {
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
      setSuccess("Provider saved successfully.");
    } catch (err: any) {
      setError(err?.message ?? "Failed to save company AI provider config");
    } finally {
      setSaving(false);
    }
  }

  async function onClearProvider() {
    if (!companyId) return;
    setClearing(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/company/${companyId}/ai/provider`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to clear company AI provider config");
      setBaseUrl("");
      setApiKey("");
      setExistingMask(null);
      setIsActive(false);
      setSuccess("Provider config cleared.");
    } catch (err: any) {
      setError(err?.message ?? "Failed to clear company AI provider config");
    } finally {
      setClearing(false);
    }
  }

  async function onSaveVoicePolicy(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!companyId) return;
    setPolicySaving(true);
    setPolicyError(null);
    setSuccess(null);
    try {
      const days = splitCsv(policyBhDaysText)
        .map((v) => Number(v))
        .filter((v) => Number.isFinite(v) && v >= 0 && v <= 6);

      const payload = {
        enabled: policyEnabled,
        mode: policyMode,
        timezone: policyTimezone.trim() || "Asia/Dubai",
        businessHours: {
          enabled: policyBhEnabled,
          start: policyBhStart || "09:00",
          end: policyBhEnd || "18:00",
          days: days.length ? days : [1, 2, 3, 4, 5],
        },
        restrictions: {
          blockUnknownNumbers: policyBlockUnknown,
          blockedPrefixes: splitCsv(policyBlockedPrefixesText),
          allowedPrefixes: splitCsv(policyAllowedPrefixesText),
        },
        guidance: {
          welcomeMessage: policyWelcomeMessage,
          systemPrompt: policySystemPrompt,
          escalationKeywords: splitCsv(policyEscalationKeywordsText),
          automationEnabled: policyAutomationEnabled,
          simulationMode: policySimulationMode,
        },
      };

      const res = await fetch(`/api/company/${companyId}/ai/voice-policy`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save voice AI policy");

      const reload = await fetch(`/api/company/${companyId}/ai/voice-policy`, { cache: "no-store" });
      if (reload.ok) {
        const json: VoicePolicyResponse = await reload.json();
        setRecentDecisions(json.recentDecisions ?? []);
      }
      setSuccess(
        policyMode === "live"
          ? "Voice AI policy saved (live mode)."
          : "Voice AI policy saved (dry run)."
      );
    } catch (err: any) {
      setPolicyError(err?.message ?? "Failed to save voice AI policy");
    } finally {
      setPolicySaving(false);
    }
  }

  return (
    <AppLayout>
      <div className="max-w-4xl space-y-4 py-4">
        <div>
          <h1 className="text-2xl font-semibold">AI Configuration</h1>
          <p className={`text-sm ${theme.mutedText}`}>
            Manage provider and inbound voice policy per company.
          </p>
        </div>

        {error && <div className="text-sm text-red-400">{error}</div>}
        {policyError && <div className="text-sm text-red-400">{policyError}</div>}
        {success && <div className="text-sm text-green-400">{success}</div>}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("provider")}
            className={`${tabBaseClass} ${
              activeTab === "provider"
                ? `${theme.surfaceSubtle} ${theme.cardBorder} ${theme.appText}`
                : `${theme.surfaceSubtle} ${theme.cardBorder} ${theme.appText} hover:border-primary/60`
            } ${activeTab === "provider" ? "active" : ""}`}
          >
            Provider
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("voice")}
            className={`${tabBaseClass} ${
              activeTab === "voice"
                ? `${theme.surfaceSubtle} ${theme.cardBorder} ${theme.appText}`
                : `${theme.surfaceSubtle} ${theme.cardBorder} ${theme.appText} hover:border-primary/60`
            } ${activeTab === "voice" ? "active" : ""}`}
          >
            Voice Policy
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("logs")}
            className={`${tabBaseClass} ${
              activeTab === "logs"
                ? `${theme.surfaceSubtle} ${theme.cardBorder} ${theme.appText}`
                : `${theme.surfaceSubtle} ${theme.cardBorder} ${theme.appText} hover:border-primary/60`
            } ${activeTab === "logs" ? "active" : ""}`}
          >
            Decision Logs
          </button>
        </div>

        {activeTab === "provider" && (
          <div className={`rounded-2xl p-4 ${theme.cardBg} ${theme.cardBorder}`}>
            {!companyId ? (
              <div className={`text-sm ${theme.mutedText}`}>Company is required.</div>
            ) : loading ? (
              <div className={`text-sm ${theme.mutedText}`}>Loading...</div>
            ) : (
              <form onSubmit={onSaveProvider} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Provider</label>
                  <input value="OpenAI" disabled className={inputClass} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Base URL (optional)</label>
                  <input
                    type="url"
                    placeholder="https://api.openai.com/v1"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">API Key</label>
                  <input
                    type="password"
                    placeholder={existingMask ? `Current: ${existingMask}` : "sk-..."}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className={inputClass}
                  />
                  <p className={`text-xs ${theme.mutedText}`}>Leave empty to keep current key.</p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                  Enable company AI provider
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={!canSubmitProvider}
                    className={primaryButtonClass}
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={onClearProvider}
                    disabled={loading || saving || clearing || !companyId}
                    className={neutralButtonClass}
                  >
                    {clearing ? "Clearing..." : "Clear"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {activeTab === "voice" && (
          <div className={`rounded-2xl p-4 ${theme.cardBg} ${theme.cardBorder}`}>
            {!companyId ? (
              <div className={`text-sm ${theme.mutedText}`}>Company is required.</div>
            ) : policyLoading ? (
              <div className={`text-sm ${theme.mutedText}`}>Loading voice policy...</div>
            ) : (
              <form onSubmit={onSaveVoicePolicy} className="space-y-4">
                <p className={`text-xs ${theme.mutedText}`}>
                  Phase 2: `live` mode generates AI live reply text per inbound call and stores it in logs.
                </p>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={policyEnabled}
                    onChange={(e) => setPolicyEnabled(e.target.checked)}
                  />
                  Enable inbound voice AI policy
                </label>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Policy mode</label>
                  <select
                    value={policyMode}
                    onChange={(e) =>
                      setPolicyMode(e.target.value === "live" ? "live" : "dry_run")
                    }
                    className={inputClass}
                  >
                    <option value="dry_run">Dry run (log only)</option>
                    <option value="live">Live (execute AI response generation)</option>
                  </select>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Timezone</label>
                    <input
                      value={policyTimezone}
                      onChange={(e) => setPolicyTimezone(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Business days (0-6)</label>
                    <input
                      value={policyBhDaysText}
                      onChange={(e) => setPolicyBhDaysText(e.target.value)}
                      className={inputClass}
                      placeholder="1,2,3,4,5"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Business hours start</label>
                    <input
                      type="time"
                      value={policyBhStart}
                      onChange={(e) => setPolicyBhStart(e.target.value)}
                      className={inputClass}
                      style={{ colorScheme: "light" }}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Business hours end</label>
                    <input
                      type="time"
                      value={policyBhEnd}
                      onChange={(e) => setPolicyBhEnd(e.target.value)}
                      className={inputClass}
                      style={{ colorScheme: "light" }}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={policyBhEnabled}
                    onChange={(e) => setPolicyBhEnabled(e.target.checked)}
                  />
                  Enforce business hours
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={policyBlockUnknown}
                    onChange={(e) => setPolicyBlockUnknown(e.target.checked)}
                  />
                  Block unknown/invalid caller numbers
                </label>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Blocked prefixes</label>
                  <input
                    value={policyBlockedPrefixesText}
                    onChange={(e) => setPolicyBlockedPrefixesText(e.target.value)}
                    className={inputClass}
                    placeholder="+97150,+9199"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Allowed prefixes (optional)</label>
                  <input
                    value={policyAllowedPrefixesText}
                    onChange={(e) => setPolicyAllowedPrefixesText(e.target.value)}
                    className={inputClass}
                    placeholder="+971"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Welcome message</label>
                  <textarea
                    value={policyWelcomeMessage}
                    onChange={(e) => setPolicyWelcomeMessage(e.target.value)}
                    className={`${inputClass} min-h-20`}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">System prompt</label>
                  <textarea
                    value={policySystemPrompt}
                    onChange={(e) => setPolicySystemPrompt(e.target.value)}
                    className={`${inputClass} min-h-24`}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Escalation keywords</label>
                  <input
                    value={policyEscalationKeywordsText}
                    onChange={(e) => setPolicyEscalationKeywordsText(e.target.value)}
                    className={inputClass}
                    placeholder="lawyer,complaint,refund"
                  />
                </div>
                <div className="space-y-2 rounded-xl border border-white/10 p-3">
                  <div className="text-sm font-semibold">AI Workflow Automation</div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={policyAutomationEnabled}
                      onChange={(e) => setPolicyAutomationEnabled(e.target.checked)}
                    />
                    Enable AI workflow automation (inquiry to lead to outcome)
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={policySimulationMode}
                      onChange={(e) => setPolicySimulationMode(e.target.checked)}
                      disabled={!policyAutomationEnabled}
                    />
                    Simulation mode (no CRM writes, log-only)
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={policySaving || !companyId}
                  className={primaryButtonClass}
                >
                  {policySaving ? "Saving..." : "Save Voice Policy"}
                </button>
              </form>
            )}
          </div>
        )}

        {activeTab === "logs" && (
          <div className={`rounded-2xl p-4 ${theme.cardBg} ${theme.cardBorder}`}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Recent Decision Logs</h2>
              <button
                type="button"
                onClick={() => void refreshDecisionLogs()}
                disabled={logsRefreshing}
                className={neutralButtonClass}
              >
                {logsRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
            {recentDecisions.length === 0 ? (
              <p className={`mt-2 text-sm ${theme.mutedText}`}>No decision logs yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {recentDecisions.map((d) => (
                  <div key={d.id} className={`rounded-xl p-3 text-xs ${theme.surfaceSubtle}`}>
                    <div>
                      <span className="font-semibold">{d.decision}</span> - {d.reason}
                    </div>
                    <div className={theme.mutedText}>
                      {d.provider_key} | call: {d.provider_call_id} | from: {d.from_number ?? "-"}
                    </div>
                    {d.details?.liveExecution?.replyPreview ? (
                      <div className={theme.mutedText}>
                        AI: {String(d.details.liveExecution.replyPreview)}
                      </div>
                    ) : null}
                    {d.details?.automationWorkflow?.enabled ? (
                      <div className={theme.mutedText}>
                        Workflow: {d.details?.automationWorkflow?.simulationMode ? "simulation" : "live"} | stage:{" "}
                        {String(d.details?.automationWorkflow?.currentStage ?? "inquiry")}
                      </div>
                    ) : null}
                    <div className={theme.mutedText}>{new Date(d.created_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
