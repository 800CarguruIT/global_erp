"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card } from "./Card";
import { useTheme } from "../theme";
import {
  BUILT_IN_DIALER_PROVIDER_OPTIONS,
  DialerProviderTemplate,
  getDialerProviderTemplate,
} from "../dialerProviderCatalog";

type AuthType = string;
type Mode = "create" | "edit";
type Scope = "global" | "company";

type Initial = {
  label: string;
  provider: string;
  authType: AuthType;
  isActive: boolean;
  credentials: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  webhooks?: Record<string, unknown> | unknown;
};

type Props = {
  mode?: Mode;
  integrationId?: string;
  initial?: Initial;
  scope?: Scope;
  companyId?: string;
};

function parseJsonObject(input: string): Record<string, unknown> | undefined {
  if (!input.trim()) return {};
  const parsed = JSON.parse(input);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  throw new Error("Must be a JSON object");
}

export function DialerIntegrationForm({
  mode = "create",
  integrationId,
  initial,
  scope = "global",
  companyId,
}: Props) {
  const { theme } = useTheme();
  const isEdit = mode === "edit";

  const [label, setLabel] = useState(initial?.label ?? "");
  const [providerKey, setProviderKey] = useState(initial?.provider ?? "custom");
  const [authType, setAuthType] = useState<AuthType>(initial?.authType ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [credentialsJson, setCredentialsJson] = useState(
    initial?.credentials ? JSON.stringify(initial.credentials, null, 2) : "{}"
  );
  const [metadataJson, setMetadataJson] = useState(
    initial?.metadata ? JSON.stringify(initial.metadata, null, 2) : "{}"
  );
  const [webhooksJson, setWebhooksJson] = useState(
    initial?.webhooks ? JSON.stringify(initial.webhooks, null, 2) : "[]"
  );

  const [dynamicCreds, setDynamicCreds] = useState<Record<string, unknown>>({});
  const [dynamicMeta, setDynamicMeta] = useState<Record<string, unknown>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const template: DialerProviderTemplate | undefined = useMemo(
    () => getDialerProviderTemplate(providerKey),
    [providerKey]
  );

  useEffect(() => {
    if (!initial) return;
    const credObj = initial.credentials ?? {};
    const metaObj = initial.metadata ?? {};
    setDynamicCreds(credObj);
    setDynamicMeta(metaObj);
    if (!authType && template?.defaultAuthType) {
      setAuthType(template.defaultAuthType);
    }
  }, [initial, template, authType]);

  function handleDynamicChange(
    fieldId: string,
    value: unknown,
    section: "credentials" | "metadata"
  ) {
    if (section === "credentials") {
      setDynamicCreds((prev) => ({ ...prev, [fieldId]: value }));
    } else {
      setDynamicMeta((prev) => ({ ...prev, [fieldId]: value }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!label.trim()) {
      setError("Label is required.");
      return;
    }
    if (!providerKey.trim()) {
      setError("Provider is required.");
      return;
    }

    const tpl = template;
    const missingRequired =
      tpl?.fields
        ?.filter((f) => f.required)
        .filter((f) => {
          const current =
            f.section === "metadata" ? dynamicMeta?.[f.id] : dynamicCreds?.[f.id];
          return current === undefined || current === "";
        }) ?? [];
    if (tpl && missingRequired.length > 0) {
      setError(`Missing required fields: ${missingRequired.map((f) => f.label).join(", ")}`);
      return;
    }

    let credentials: Record<string, unknown> = {};
    let metadata: Record<string, unknown> | undefined;
    let webhooks: Record<string, unknown> | unknown;

    try {
      credentials = parseJsonObject(credentialsJson) ?? {};
    } catch {
      setError("Credentials must be valid JSON object.");
      return;
    }
    try {
      metadata = parseJsonObject(metadataJson);
    } catch {
      setError("Metadata must be valid JSON object.");
      return;
    }
    try {
      webhooks = webhooksJson.trim() ? JSON.parse(webhooksJson) : [];
    } catch {
      setError("Webhooks must be valid JSON.");
      return;
    }

    // Merge dynamic fields over raw JSON
    credentials = { ...credentials, ...dynamicCreds };
    metadata = { ...(metadata ?? {}), ...dynamicMeta };

    const qs =
      scope === "company" && companyId
        ? `?scope=company&companyId=${companyId}`
        : "?scope=global";
    const isEditMode = mode === "edit" && integrationId;
    const url = isEditMode
      ? `/api/dialer/integrations/${integrationId}${qs}`
      : `/api/dialer/integrations${qs}`;
    const method = isEditMode ? "PUT" : "POST";

    setSubmitting(true);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: integrationId,
          provider: providerKey,
          label: label.trim(),
          authType: authType || tpl?.defaultAuthType || "api_key",
          isActive,
          credentials,
          metadata,
          webhooks,
          scope,
          companyId: scope === "company" ? companyId : null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save integration");
      }

      const data = await res.json();
      setSuccess(
        isEditMode
          ? "Dialer integration updated."
          : `Dialer integration created (id: ${data.id ?? "unknown"})`
      );
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to save integration");
    } finally {
      setSubmitting(false);
    }
  }

  const isCustom = !template || providerKey === "custom";

  return (
    <Card
      title={
        isEdit
          ? `Edit ${scope === "company" ? "Company" : "Global"} Dialer Integration`
          : `Create ${scope === "company" ? "Company" : "Global"} Dialer Integration`
      }
      className="space-y-4"
    >
      <p className={`text-xs sm:text-sm opacity-80 ${theme.mutedText}`}>
        Configure a dialer connection (PBX or provider). Select a provider to autofill required
        fields, or use custom to manage JSON directly.
      </p>

      {error && (
        <div className="text-xs text-red-400 border border-red-400/40 rounded-lg px-3 py-2 bg-red-500/5">
          {error}
        </div>
      )}

      {success && (
        <div className="text-xs text-emerald-400 border border-emerald-400/40 rounded-lg px-3 py-2 bg-emerald-500/5">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="font-medium">Name</label>
            <input
              className={theme.input}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Main PBX / Twilio / etc."
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-medium">Provider</label>
            <select
              className={theme.input}
              value={providerKey}
              onChange={(e) => setProviderKey(e.target.value)}
            >
              {BUILT_IN_DIALER_PROVIDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-medium">Auth type</label>
            <input
              className={theme.input}
              value={authType || template?.defaultAuthType || ""}
              onChange={(e) => setAuthType(e.target.value)}
              placeholder="api_key / oauth2 / sip"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-medium">Scope</label>
            <input
              className={`${theme.input} opacity-70`}
              value={scope === "company" ? "Company" : "Global"}
              disabled
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="dialer-active"
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <label htmlFor="dialer-active" className="text-xs sm:text-sm">
            Active / enabled
          </label>
        </div>

        {!isCustom && template && template.fields.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide opacity-70">
              {template.label} Required Fields
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {template.fields.map((field) => {
                const current =
                  field.section === "metadata" ? dynamicMeta?.[field.id] : dynamicCreds?.[field.id];
                const inputType =
                  field.type === "password"
                    ? "password"
                    : field.type === "number"
                    ? "number"
                    : field.type === "boolean"
                    ? "checkbox"
                    : field.type === "url"
                    ? "url"
                    : "text";
                return (
                  <div key={`${template.key}-${field.id}`} className="flex flex-col gap-1.5">
                    <label className="font-medium">
                      {field.label} {field.required ? "*" : ""}
                    </label>
                    {inputType === "checkbox" ? (
                      <input
                        type="checkbox"
                        checked={Boolean(current)}
                        onChange={(e) =>
                          handleDynamicChange(field.id, e.target.checked, field.section ?? "credentials")
                        }
                      />
                    ) : (
                      <input
                        type={inputType}
                        className={theme.input}
                        value={current as string | number | undefined | null ?? ""}
                        placeholder={field.placeholder}
                        onChange={(e) => {
                          const value =
                            field.type === "number"
                              ? Number(e.target.value)
                              : e.target.value;
                          handleDynamicChange(field.id, value, field.section ?? "credentials");
                        }}
                      />
                    )}
                    {field.helpText && (
                      <span className="text-[11px] opacity-70">{field.helpText}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="border border-white/10 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold">Advanced JSON</div>
            {!isCustom && (
              <button
                type="button"
                className="text-[11px] px-2 py-1 rounded bg-white/10 hover:bg-white/20"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                {showAdvanced ? "Hide" : "Show"}
              </button>
            )}
          </div>
          {(isCustom || showAdvanced) && (
            <div className="space-y-3">
              <div className="flex flex-col gap-1.5">
                <label className="font-medium">Credentials (JSON)</label>
                <textarea
                  className={`${theme.input} font-mono text-xs min-h-[120px]`}
                  value={credentialsJson}
                  onChange={(e) => setCredentialsJson(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-medium">Metadata (JSON)</label>
                <textarea
                  className={`${theme.input} font-mono text-xs min-h-[100px]`}
                  value={metadataJson}
                  onChange={(e) => setMetadataJson(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-medium">Webhooks (JSON)</label>
                <textarea
                  className={`${theme.input} font-mono text-xs min-h-[80px]`}
                  value={webhooksJson}
                  onChange={(e) => setWebhooksJson(e.target.value)}
                />
              </div>
            </div>
          )}
          {!isCustom && !showAdvanced && (
            <div className="text-[11px] opacity-70">
              Advanced JSON is hidden. Toggle to edit raw credentials/metadata/webhooks.
            </div>
          )}
        </div>

        <div className="pt-2">
          <button
            type="submit"
            className="px-4 py-2 rounded-lg text-xs sm:text-sm font-medium bg-white/10 hover:bg-white/20 transition disabled:opacity-50"
            disabled={submitting}
          >
            {submitting
              ? "Saving…"
              : isEdit
              ? "Update Dialer Integration"
              : "Create Dialer Integration"}
          </button>
        </div>
      </form>
    </Card>
  );
}
