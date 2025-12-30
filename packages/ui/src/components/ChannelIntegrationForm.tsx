"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card } from "./Card";
import { useTheme } from "../theme";
import type {
  ChannelCategory,
  ChannelProviderTemplate,
  ChannelType,
} from "../channelProviderCatalog";
import {
  getChannelProviderTemplate,
  getChannelProviderOptionsByCategory,
  getChannelCategoryForType,
} from "../channelProviderCatalog";

type Scope = "global" | "company";

type InitialValues = {
  id?: string;
  scope: Scope;
  companyId?: string | null;
  name: string;
  channelType: ChannelType;
  providerKey: string;
  authType: string;
  credentials: Record<string, unknown>;
  metadata?: Record<string, unknown> | null;
  webhooks?: Record<string, unknown> | null;
  isActive?: boolean;
};

type Props = {
  scope: Scope;
  companyId?: string;
  integrationId?: string;
  initialValues?: InitialValues;
  mode?: "create" | "edit";
};

function parseJsonObject(input: string): Record<string, unknown> {
  if (!input.trim()) return {};
  const parsed = JSON.parse(input);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  throw new Error("Must be a JSON object");
}

export function ChannelIntegrationForm({
  scope,
  companyId,
  integrationId,
  initialValues,
  mode = "create",
}: Props) {
  const { theme } = useTheme();
  const isEdit = mode === "edit";

  const initialCategory = initialValues
    ? getChannelCategoryForType(initialValues.channelType as ChannelType)
    : ("Messaging" as ChannelCategory);

  const [name, setName] = useState(initialValues?.name ?? "");
  const [category, setCategory] = useState<ChannelCategory>(initialCategory);
  const [channelType, setChannelType] = useState<ChannelType>(
    initialValues?.channelType ?? "messaging"
  );
  const [providerKey, setProviderKey] = useState(initialValues?.providerKey ?? "custom");
  const [authType, setAuthType] = useState(initialValues?.authType ?? "");
  const [isActive, setIsActive] = useState(initialValues?.isActive ?? true);
  const [credentialsJson, setCredentialsJson] = useState(
    initialValues?.credentials ? JSON.stringify(initialValues.credentials, null, 2) : "{}"
  );
  const [metadataJson, setMetadataJson] = useState(
    initialValues?.metadata ? JSON.stringify(initialValues.metadata, null, 2) : "{}"
  );
  const [webhooksJson, setWebhooksJson] = useState(
    initialValues?.webhooks ? JSON.stringify(initialValues.webhooks, null, 2) : "{}"
  );
  const [dynamicCreds, setDynamicCreds] = useState<Record<string, unknown>>(
    initialValues?.credentials ?? {}
  );
  const [dynamicMeta, setDynamicMeta] = useState<Record<string, unknown>>(
    initialValues?.metadata ?? {}
  );
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const providerOptions = useMemo(
    () => getChannelProviderOptionsByCategory(category),
    [category]
  );

  const template: ChannelProviderTemplate | undefined = useMemo(
    () => getChannelProviderTemplate(providerKey),
    [providerKey]
  );

  useEffect(() => {
    if (!initialValues) return;
    setName(initialValues.name);
    setChannelType(initialValues.channelType as ChannelType);
    setProviderKey(initialValues.providerKey);
    setAuthType(initialValues.authType);
    setIsActive(initialValues.isActive ?? true);
    setCredentialsJson(JSON.stringify(initialValues.credentials ?? {}, null, 2));
    setMetadataJson(JSON.stringify(initialValues.metadata ?? {}, null, 2));
    setWebhooksJson(JSON.stringify(initialValues.webhooks ?? {}, null, 2));
    setDynamicCreds(initialValues.credentials ?? {});
    setDynamicMeta(initialValues.metadata ?? {});
    setCategory(getChannelCategoryForType(initialValues.channelType as ChannelType));
  }, [initialValues]);

  useEffect(() => {
    if (template) {
      setChannelType(template.channelType);
      if (!authType && template.defaultAuthType) {
        setAuthType(template.defaultAuthType);
      }
    }
  }, [template, authType]);

  function handleDynamicChange(
    fieldId: string,
    value: unknown,
    section: "credentials" | "metadata"
  ) {
    if (section === "metadata") {
      setDynamicMeta((prev) => ({ ...prev, [fieldId]: value }));
    } else {
      setDynamicCreds((prev) => ({ ...prev, [fieldId]: value }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!providerKey.trim()) {
      setError("Provider is required.");
      return;
    }

    // Validate required fields
    const missing =
      template?.fields
        ?.filter((f) => f.required)
        .filter((f) => {
          const val =
            f.section === "metadata" ? dynamicMeta?.[f.id] : dynamicCreds?.[f.id];
          return val === undefined || val === "";
        }) ?? [];
    if (missing.length) {
      setError(`Missing required fields: ${missing.map((f) => f.label).join(", ")}`);
      return;
    }

    let credentials: Record<string, unknown> = {};
    let metadata: Record<string, unknown> = {};
    let webhooks: unknown = [];

    try {
      credentials = parseJsonObject(credentialsJson);
    } catch {
      setError("Credentials must be valid JSON.");
      return;
    }
    try {
      metadata = parseJsonObject(metadataJson);
    } catch {
      setError("Metadata must be valid JSON.");
      return;
    }
    try {
      webhooks = webhooksJson.trim() ? JSON.parse(webhooksJson) : [];
    } catch {
      setError("Webhooks must be valid JSON.");
      return;
    }

    // Merge dynamic fields
    credentials = { ...credentials, ...dynamicCreds };
    metadata = { ...metadata, ...dynamicMeta };

    const qs =
      scope === "company" && companyId
        ? `?scope=company&companyId=${companyId}`
        : "?scope=global";

    const isEditMode = mode === "edit" && integrationId;
    const url = isEditMode
      ? `/api/channels/integrations/${integrationId}${qs}`
      : `/api/channels/integrations${qs}`;
    const method = isEditMode ? "PUT" : "POST";

    setSubmitting(true);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: integrationId,
          scope,
          companyId: scope === "company" ? companyId : null,
          name: name.trim(),
          channelType,
          providerKey,
          authType: authType || template?.defaultAuthType || "apiKey",
          credentials,
          metadata,
          webhooks,
          isActive,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save integration");
      }

      const data = await res.json();
      setSuccess(
        isEditMode
          ? "Channel integration updated."
          : `Channel integration created (id: ${data.id ?? "unknown"})`
      );
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to save integration");
    } finally {
      setSubmitting(false);
    }
  }

  const providerTemplate = template;
  const showOnlyAdvanced = !providerTemplate && providerKey !== "";

  return (
    <Card
      title={`${isEdit ? "Edit" : "Create"} ${
        scope === "company" ? "Company" : "Global"
      } Channel Integration`}
      className="space-y-4"
    >
      <p className={`text-xs sm:text-sm opacity-80 ${theme.mutedText}`}>
        Configure a channel integration. Pick a category and provider to see required fields. Use
        Advanced JSON for custom/legacy providers.
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
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Marketing Email / SMS Provider"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-medium">Category</label>
            <select
              className={theme.input}
              value={category}
              onChange={(e) => {
                const next = e.target.value as ChannelCategory;
                setCategory(next);
                // reset provider when category changes
                const options = getChannelProviderOptionsByCategory(next);
                const first = options[0];
                if (first) setProviderKey(first.value);
              }}
            >
              <option value="Advertising">Advertising</option>
              <option value="Analytics">Analytics</option>
              <option value="Social">Social</option>
              <option value="Email">Email</option>
              <option value="Messaging">Messaging</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-medium">Provider</label>
            <select
              className={theme.input}
              value={providerKey}
              onChange={(e) => setProviderKey(e.target.value)}
            >
              {providerOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
              <option value="custom">Custom / Other</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-medium">Auth Type</label>
            <input
              className={theme.input}
              value={authType || providerTemplate?.defaultAuthType || ""}
              onChange={(e) => setAuthType(e.target.value)}
              placeholder="apiKey / oauth2 / basic"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="channel-active"
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <label htmlFor="channel-active" className="text-xs sm:text-sm">
            Active / enabled
          </label>
        </div>

        {!showOnlyAdvanced && providerTemplate && providerTemplate.fields.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide opacity-70">
              {providerTemplate.label} Required Fields
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {providerTemplate.fields.map((field) => {
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
                    : field.type === "email"
                    ? "email"
                    : "text";
                return (
                  <div key={`${providerTemplate.key}-${field.id}`} className="flex flex-col gap-1.5">
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
                        value={(current as string | number | undefined | null) ?? ""}
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

        {showOnlyAdvanced && (
          <div className="text-[11px] text-yellow-200/80">
            Provider not recognized; using advanced JSON only. Please fill credentials/metadata manually.
          </div>
        )}

        <div className="border border-white/10 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold">Advanced JSON</div>
            {!showOnlyAdvanced && (
              <button
                type="button"
                className="text-[11px] px-2 py-1 rounded bg-white/10 hover:bg-white/20"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                {showAdvanced ? "Hide" : "Show"}
              </button>
            )}
          </div>
          {(showOnlyAdvanced || showAdvanced) && (
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
          {!showOnlyAdvanced && !showAdvanced && (
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
              ? "Update Channel Integration"
              : "Create Channel Integration"}
          </button>
        </div>
      </form>
    </Card>
  );
}
