"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Card, useTheme } from "@repo/ui";

type TabId = "whatsapp" | "email";

type TemplateRow = {
  id: string;
  type: TabId;
  name: string;
  status: string;
  provider_key: string;
  provider_status: string | null;
  published_at: string | null;
  created_at: string;
  content: Record<string, unknown>;
};

type Props = {
  companyId: string;
  type: TabId;
  initial?: TemplateRow | null;
  onSaved?: (item: TemplateRow) => void;
};

const WHATSAPP_STATUSES = ["draft", "submitted", "approved", "rejected"] as const;
const EMAIL_STATUSES = ["draft", "ready", "archived"] as const;
const WHATSAPP_PROVIDERS = [{ key: "meta", label: "Meta (WhatsApp Cloud)" }] as const;
const EMAIL_PROVIDERS = [{ key: "aws", label: "AWS SES" }] as const;
const WHATSAPP_CATEGORIES = ["marketing", "utility", "authentication", "service"] as const;
const RTL_LANGS = ["ar", "he", "fa", "ur"] as const;

const defaultWaForm = {
  name: "",
  language: "en",
  category: "marketing",
  headerType: "none",
  headerText: "",
  mediaUrl: "",
  body: "",
  footer: "",
  button1Type: "none",
  button1Label: "",
  button1Value: "",
  button2Type: "none",
  button2Label: "",
  button2Value: "",
  status: "draft",
  providerKey: "meta",
};

const defaultEmailForm = {
  name: "",
  subject: "",
  from: "",
  body: "",
  status: "draft",
  providerKey: "aws",
};

const EmailEditor = dynamic(async () => (await import("react-email-editor")).default, {
  ssr: false,
});

export function TemplateForm({ companyId, type, initial, onSaved }: Props) {
  const { theme } = useTheme();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waForm, setWaForm] = useState({ ...defaultWaForm });
  const [emailForm, setEmailForm] = useState({ ...defaultEmailForm });
  const [emailHtmlPreview, setEmailHtmlPreview] = useState("");
  const [emailDesign, setEmailDesign] = useState<Record<string, unknown> | null>(null);
  const emailEditorRef = useRef<any>(null);
  const emailDesignLoaded = useRef(false);
  const emailUpdateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [testNumber, setTestNumber] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    if (!initial) {
      setWaForm({ ...defaultWaForm });
      setEmailForm({ ...defaultEmailForm });
      setEmailHtmlPreview("");
      setEmailDesign(null);
      emailDesignLoaded.current = false;
      return;
    }
    if (initial.type === "whatsapp") {
      setWaForm({
        ...defaultWaForm,
        name: initial.name ?? "",
        language: String(initial.content?.language ?? "en"),
        category: String(initial.content?.category ?? "marketing"),
        headerType: String(initial.content?.headerType ?? "none"),
        headerText: String(initial.content?.headerText ?? ""),
        mediaUrl: String(initial.content?.mediaUrl ?? ""),
        body: String(initial.content?.body ?? ""),
        footer: String(initial.content?.footer ?? ""),
        button1Type: String(initial.content?.actions?.[0]?.type ?? "none"),
        button1Label: String(initial.content?.actions?.[0]?.label ?? ""),
        button1Value: String(initial.content?.actions?.[0]?.value ?? ""),
        button2Type: String(initial.content?.actions?.[1]?.type ?? "none"),
        button2Label: String(initial.content?.actions?.[1]?.label ?? ""),
        button2Value: String(initial.content?.actions?.[1]?.value ?? ""),
        status: initial.status ?? "draft",
        providerKey: initial.provider_key ?? "meta",
      });
    }
    if (initial.type === "email") {
      const bodyText = String(initial.content?.body ?? "");
      const design =
        initial.content && typeof initial.content === "object"
          ? (initial.content as Record<string, unknown>).design
          : null;
      setEmailForm({
        ...defaultEmailForm,
        name: initial.name ?? "",
        subject: String(initial.content?.subject ?? ""),
        from: String(initial.content?.from ?? ""),
        body: bodyText,
        status: initial.status ?? "draft",
        providerKey: initial.provider_key ?? "aws",
      });
      setEmailHtmlPreview(bodyText);
      setEmailDesign(
        design && typeof design === "object" ? (design as Record<string, unknown>) : null
      );
      emailDesignLoaded.current = false;
    }
  }, [initial]);

  const isWhatsAppRtl = useMemo(() => {
    const lang = (waForm.language || "").toLowerCase().trim();
    return RTL_LANGS.some((rtl) => lang === rtl || lang.startsWith(`${rtl}-`));
  }, [waForm.language]);

  async function exportEmailHtml() {
    const editor = emailEditorRef.current?.editor;
    if (!editor?.exportHtml) {
      return { html: emailForm.body, design: emailDesign ?? {} };
    }
    return new Promise<{ html: string; design: Record<string, unknown> }>((resolve) => {
      editor.exportHtml((data: { html: string; design: Record<string, unknown> }) => {
        resolve({ html: data?.html ?? "", design: data?.design ?? {} });
      });
    });
  }

  function handleEmailEditorLoad() {
    const editor = emailEditorRef.current?.editor;
    if (!editor?.addEventListener) return;
    editor.addEventListener("design:updated", () => {
      if (emailUpdateTimer.current) clearTimeout(emailUpdateTimer.current);
      emailUpdateTimer.current = setTimeout(() => {
        exportEmailHtml()
          .then(({ html, design }) => {
            setEmailHtmlPreview(html);
            setEmailDesign(design);
            setEmailForm((prev) => ({ ...prev, body: html }));
          })
          .catch(() => {});
      }, 300);
    });
  }

  function handleEmailEditorReady() {
    const editor = emailEditorRef.current?.editor;
    if (!editor?.loadDesign || emailDesignLoaded.current) return;
    if (emailDesign) {
      editor.loadDesign(emailDesign);
      emailDesignLoaded.current = true;
    }
  }

  async function handleWhatsAppSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!waForm.name.trim() || !waForm.body.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const isEdit = Boolean(initial?.id);
      const res = await fetch(
        isEdit
          ? `/api/company/${companyId}/marketing/templates/${initial?.id}`
          : `/api/company/${companyId}/marketing/templates`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providerKey: waForm.providerKey,
            name: waForm.name.trim(),
            status: waForm.status,
            content: {
              language: waForm.language.trim() || "en",
              category: waForm.category.trim() || "marketing",
              headerType: waForm.headerType,
              headerText: waForm.headerType === "text" ? waForm.headerText.trim() : "",
              mediaUrl: waForm.headerType === "media" ? waForm.mediaUrl.trim() : "",
              body: waForm.body.trim(),
              footer: waForm.footer.trim(),
              actions: [
                waForm.button1Type !== "none"
                  ? {
                      type: waForm.button1Type,
                      label: waForm.button1Label.trim(),
                      value: waForm.button1Value.trim(),
                    }
                  : null,
                waForm.button2Type !== "none"
                  ? {
                      type: waForm.button2Type,
                      label: waForm.button2Label.trim(),
                      value: waForm.button2Value.trim(),
                    }
                  : null,
              ].filter(Boolean),
            },
            ...(isEdit ? {} : { type: "whatsapp" }),
          }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Failed to save template");
      }
      onSaved?.(body.item as TemplateRow);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  async function handleWhatsAppTest() {
    if (!initial?.id || !testNumber.trim()) return;
    setTestSending(true);
    setTestResult(null);
    setError(null);
    try {
      const res = await fetch(
        `/api/company/${companyId}/marketing/templates/${initial.id}/test`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: testNumber.trim() }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Failed to send test");
      }
      setTestResult("Test message sent.");
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to send test");
    } finally {
      setTestSending(false);
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!emailForm.name.trim() || !emailForm.subject.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const exported = await exportEmailHtml();
      const bodyHtml = exported.html?.trim() || emailForm.body.trim();
      setEmailHtmlPreview(bodyHtml);
      setEmailForm((prev) => ({ ...prev, body: bodyHtml }));
      setEmailDesign(exported.design ?? {});
      const isEdit = Boolean(initial?.id);
      const res = await fetch(
        isEdit
          ? `/api/company/${companyId}/marketing/templates/${initial?.id}`
          : `/api/company/${companyId}/marketing/templates`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providerKey: emailForm.providerKey,
            name: emailForm.name.trim(),
            status: emailForm.status,
            content: {
              subject: emailForm.subject.trim(),
              from: emailForm.from.trim(),
              body: bodyHtml,
              design: exported.design ?? undefined,
            },
            ...(isEdit ? {} : { type: "email" }),
          }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Failed to save template");
      }
      onSaved?.(body.item as TemplateRow);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  if (type === "whatsapp") {
    return (
      <div className="space-y-4">
        {error && (
          <div className="text-xs sm:text-sm text-red-400 border border-red-400/40 rounded-lg px-3 py-2 bg-red-500/5">
            {error}
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-12">
          <Card className={`space-y-3 md:col-span-9 ${isWhatsAppRtl ? "order-2" : "order-1"}`}>
            <div className="text-sm font-semibold">Template form</div>
            <form onSubmit={handleWhatsAppSubmit} className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs text-muted-foreground">Template name</label>
                <input
                  className={`${theme.input} mt-1 w-full`}
                  value={waForm.name}
                  onChange={(e) => setWaForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="order_update"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Language</label>
                <input
                  className={`${theme.input} mt-1 w-full`}
                  value={waForm.language}
                  onChange={(e) => setWaForm((prev) => ({ ...prev, language: e.target.value }))}
                  placeholder="en"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Provider</label>
                <select
                  className={`${theme.input} mt-1 w-full`}
                  value={waForm.providerKey}
                  onChange={(e) => setWaForm((prev) => ({ ...prev, providerKey: e.target.value }))}
                >
                  {WHATSAPP_PROVIDERS.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Category</label>
                <select
                  className={`${theme.input} mt-1 w-full`}
                  value={waForm.category}
                  onChange={(e) => setWaForm((prev) => ({ ...prev, category: e.target.value }))}
                >
                  {WHATSAPP_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Status</label>
                <select
                  className={`${theme.input} mt-1 w-full`}
                  value={waForm.status}
                  onChange={(e) => setWaForm((prev) => ({ ...prev, status: e.target.value }))}
                >
                  {WHATSAPP_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Header type</label>
                <select
                  className={`${theme.input} mt-1 w-full`}
                  value={waForm.headerType}
                  onChange={(e) => setWaForm((prev) => ({ ...prev, headerType: e.target.value }))}
                >
                  <option value="none">None</option>
                  <option value="text">Text</option>
                  <option value="media">Media</option>
                </select>
              </div>
              {waForm.headerType === "text" && (
                <div>
                  <label className="text-xs text-muted-foreground">Header text</label>
                  <input
                    className={`${theme.input} mt-1 w-full`}
                    value={waForm.headerText}
                    onChange={(e) => setWaForm((prev) => ({ ...prev, headerText: e.target.value }))}
                    placeholder="Order update"
                  />
                </div>
              )}
              {waForm.headerType === "media" && (
                <div>
                  <label className="text-xs text-muted-foreground">Media URL</label>
                  <input
                    className={`${theme.input} mt-1 w-full`}
                    value={waForm.mediaUrl}
                    onChange={(e) => setWaForm((prev) => ({ ...prev, mediaUrl: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
              )}
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground">Body</label>
                <textarea
                  className={`${theme.input} mt-1 w-full min-h-[120px]`}
                  value={waForm.body}
                  onChange={(e) => setWaForm((prev) => ({ ...prev, body: e.target.value }))}
                  placeholder="Hi {{1}}, your order {{2}} is ready."
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground">Footer</label>
                <input
                  className={`${theme.input} mt-1 w-full`}
                  value={waForm.footer}
                  onChange={(e) => setWaForm((prev) => ({ ...prev, footer: e.target.value }))}
                  placeholder="Reply STOP to unsubscribe"
                />
              </div>
              <div className="md:col-span-2">
                <div className="text-xs text-muted-foreground">Action buttons</div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2 rounded-lg border border-white/10 p-3">
                    <div className="text-[11px] uppercase text-muted-foreground">Button 1</div>
                    <select
                      className={`${theme.input} mt-1 w-full`}
                      value={waForm.button1Type}
                      onChange={(e) => setWaForm((prev) => ({ ...prev, button1Type: e.target.value }))}
                    >
                      <option value="none">None</option>
                      <option value="quick_reply">Quick reply</option>
                      <option value="url">Visit website</option>
                      <option value="phone">Call phone</option>
                    </select>
                    <input
                      className={`${theme.input} mt-1 w-full`}
                      value={waForm.button1Label}
                      onChange={(e) => setWaForm((prev) => ({ ...prev, button1Label: e.target.value }))}
                      placeholder="Button label"
                    />
                    {waForm.button1Type !== "none" && (
                      <input
                        className={`${theme.input} mt-1 w-full`}
                        value={waForm.button1Value}
                        onChange={(e) =>
                          setWaForm((prev) => ({ ...prev, button1Value: e.target.value }))
                        }
                        placeholder={
                          waForm.button1Type === "phone"
                            ? "+971500000000"
                            : waForm.button1Type === "url"
                            ? "https://..."
                            : "payload"
                        }
                      />
                    )}
                  </div>
                  <div className="space-y-2 rounded-lg border border-white/10 p-3">
                    <div className="text-[11px] uppercase text-muted-foreground">Button 2</div>
                    <select
                      className={`${theme.input} mt-1 w-full`}
                      value={waForm.button2Type}
                      onChange={(e) => setWaForm((prev) => ({ ...prev, button2Type: e.target.value }))}
                    >
                      <option value="none">None</option>
                      <option value="quick_reply">Quick reply</option>
                      <option value="url">Visit website</option>
                      <option value="phone">Call phone</option>
                    </select>
                    <input
                      className={`${theme.input} mt-1 w-full`}
                      value={waForm.button2Label}
                      onChange={(e) => setWaForm((prev) => ({ ...prev, button2Label: e.target.value }))}
                      placeholder="Button label"
                    />
                    {waForm.button2Type !== "none" && (
                      <input
                        className={`${theme.input} mt-1 w-full`}
                        value={waForm.button2Value}
                        onChange={(e) =>
                          setWaForm((prev) => ({ ...prev, button2Value: e.target.value }))
                        }
                        placeholder={
                          waForm.button2Type === "phone"
                            ? "+971500000000"
                            : waForm.button2Type === "url"
                            ? "https://..."
                            : "payload"
                        }
                      />
                    )}
                  </div>
                </div>
              </div>
              <div className="md:col-span-2">
                <button
                  type="submit"
                  className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                  disabled={saving}
                >
                  {saving ? "Saving..." : initial?.id ? "Update template" : "Create template"}
                </button>
                {initial?.id && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      className={`${theme.input} w-full sm:w-[240px]`}
                      value={testNumber}
                      onChange={(e) => setTestNumber(e.target.value)}
                      placeholder="Test mobile number"
                    />
                    <button
                      type="button"
                      className="rounded-full border border-white/10 px-4 py-2 text-xs hover:border-primary disabled:opacity-50"
                      onClick={handleWhatsAppTest}
                      disabled={testSending || !testNumber.trim()}
                    >
                      {testSending ? "Sending..." : "Send test"}
                    </button>
                    {testResult && (
                      <span className="text-xs text-emerald-300">{testResult}</span>
                    )}
                  </div>
                )}
              </div>
            </form>
          </Card>
          <Card className={`space-y-3 md:col-span-3 ${isWhatsAppRtl ? "order-1" : "order-2"}`}>
            <div className="text-sm font-semibold">Preview</div>
            <div className="rounded-2xl border border-white/10 bg-[#0b141a] p-4">
              <div className="text-[11px] uppercase text-white/60">WhatsApp</div>
              <div className={`mt-3 flex ${isWhatsAppRtl ? "justify-start" : "justify-end"}`}>
                <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-[#25d366] px-3 py-2 text-xs text-black">
                  {waForm.headerType === "text" && waForm.headerText.trim() && (
                    <div className="mb-2 text-[12px] font-semibold">{waForm.headerText}</div>
                  )}
                  {waForm.headerType === "media" && (
                    <div className="mb-2 rounded-lg border border-black/10 bg-white/70 px-2 py-6 text-[10px] uppercase text-black/70">
                      Media
                    </div>
                  )}
                  <div className="whitespace-pre-wrap">
                    {waForm.body?.trim() ? waForm.body : "Template body preview will appear here."}
                  </div>
                  {waForm.footer.trim() && (
                    <div className="mt-2 text-[10px] text-black/50">{waForm.footer}</div>
                  )}
                  <div className="mt-1 text-[10px] text-black/60">
                    {waForm.category || "marketing"} / {waForm.language || "en"} / 12:34
                  </div>
                </div>
              </div>
              {(waForm.button1Type !== "none" || waForm.button2Type !== "none") && (
                <div className="mt-3 space-y-2">
                  {[1, 2].map((idx) => {
                    const typeValue = idx === 1 ? waForm.button1Type : waForm.button2Type;
                    const label = idx === 1 ? waForm.button1Label : waForm.button2Label;
                    if (typeValue === "none" || !label.trim()) return null;
                    return (
                      <div
                        key={`btn-${idx}`}
                        className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-center text-[11px] text-white"
                      >
                        {label}
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="mt-3 text-[11px] text-white/60">
                Provider: {waForm.providerKey || "meta"}
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="text-xs sm:text-sm text-red-400 border border-red-400/40 rounded-lg px-3 py-2 bg-red-500/5">
          {error}
        </div>
      )}
      <form onSubmit={handleEmailSubmit} className="grid gap-4 md:grid-cols-12">
        <Card className="space-y-3 md:col-span-4 self-start">
          <div className="text-sm font-semibold">Details</div>
          <div>
            <label className="text-xs text-muted-foreground">Template name</label>
            <input
              className={`${theme.input} mt-1 w-full`}
              value={emailForm.name}
              onChange={(e) => setEmailForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="new_offer"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">From</label>
            <input
              className={`${theme.input} mt-1 w-full`}
              value={emailForm.from}
              onChange={(e) => setEmailForm((prev) => ({ ...prev, from: e.target.value }))}
              placeholder="marketing@yourco.com"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Provider</label>
            <select
              className={`${theme.input} mt-1 w-full`}
              value={emailForm.providerKey}
              onChange={(e) => setEmailForm((prev) => ({ ...prev, providerKey: e.target.value }))}
            >
              {EMAIL_PROVIDERS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Subject</label>
            <input
              className={`${theme.input} mt-1 w-full`}
              value={emailForm.subject}
              onChange={(e) => setEmailForm((prev) => ({ ...prev, subject: e.target.value }))}
              placeholder="Special offer inside"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <select
              className={`${theme.input} mt-1 w-full`}
              value={emailForm.status}
              onChange={(e) => setEmailForm((prev) => ({ ...prev, status: e.target.value }))}
            >
              {EMAIL_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div>
            <button
              type="submit"
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              disabled={saving}
            >
              {saving ? "Saving..." : initial?.id ? "Update template" : "Create template"}
            </button>
          </div>
        </Card>
        <Card className="space-y-3 md:col-span-8">
          <div className="text-sm font-semibold">Email builder</div>
          <div className="min-h-[70vh] rounded-lg border border-white/10 bg-white/5 p-2">
            <EmailEditor
              ref={emailEditorRef}
              onLoad={handleEmailEditorLoad}
              onReady={handleEmailEditorReady}
              minHeight={680}
            />
          </div>
          <div className="text-[11px] text-muted-foreground">
            Build the template with Unlayer and we will save the exported HTML.
          </div>
        </Card>
      </form>
    </div>
  );
}
