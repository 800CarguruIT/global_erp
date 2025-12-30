"use client";

import "drawflow/dist/drawflow.min.css";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppLayout, Card, useI18n, useTheme } from "@repo/ui";

type FieldOption = { value: string; labelKey: string };

type Field = {
  key: string;
  labelKey: string;
  type?: "text" | "textarea" | "select";
  placeholderKey?: string;
  options?: FieldOption[];
};

type ChannelConfig = {
  titleKey: string;
  descriptionKey: string;
  typeLabelKey: string;
  typePluralKey: string;
  fields: Field[];
  statusKeys?: string[];
  builder?: BuilderConfig;
  mode?: "all" | "builder" | "manager";
};

type Item = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  [key: string]: any;
};

type BuilderNode = {
  key: string;
  labelKey: string;
  descriptionKey?: string;
  inputs?: number;
  outputs?: number;
  x: number;
  y: number;
  className?: string;
};

type BuilderTemplate = {
  key: string;
  labelKey: string;
  descriptionKey?: string;
  inputs?: number;
  outputs?: number;
  className?: string;
};

type BuilderConnection = {
  from: string;
  to: string;
  output?: string;
  input?: string;
};

type BuilderConfig = {
  titleKey: string;
  descriptionKey?: string;
  nodes: BuilderNode[];
  connections: BuilderConnection[];
  palette?: BuilderTemplate[];
  storageKey?: string;
};

const DEFAULT_STATUS_KEYS = [
  "marketing.status.draft",
  "marketing.status.scheduled",
  "marketing.status.live",
  "marketing.status.paused",
  "marketing.status.completed",
] as const;

function format(t: (key: string) => string, key: string, replacements: Record<string, string | number>) {
  return Object.entries(replacements).reduce(
    (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
    t(key)
  );
}

export function ChannelManager({ config }: { config: ChannelConfig }) {
  return (
    <AppLayout>
      <ChannelManagerContent config={config} />
    </AppLayout>
  );
}

function ChannelManagerContent({ config }: { config: ChannelConfig }) {
  const { t } = useI18n();
  const { theme } = useTheme();
  const typeLabel = t(config.typeLabelKey);
  const typePluralLabel = t(config.typePluralKey);
  const mode = config.mode ?? "all";
  const showBuilder = mode !== "manager";
  const showManager = mode !== "builder";
  const statuses = useMemo(
    () => (config.statusKeys ?? [...DEFAULT_STATUS_KEYS]).map((key) => ({ key, label: t(key) })),
    [config.statusKeys, t]
  );
  const defaultStatus = statuses[0]?.key ?? DEFAULT_STATUS_KEYS[0];

  const initialForm = useMemo(
    () =>
      config.fields.reduce(
        (acc, field) => ({
          ...acc,
          [field.key]: "",
        }),
        { status: defaultStatus } as Record<string, string>
      ),
    [config.fields, defaultStatus]
  );

  const [items, setItems] = useState<Item[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>(initialForm);
  const builderRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<any | null>(null);
  const [builderSeed, setBuilderSeed] = useState(0);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null);
  const [selectedNodeData, setSelectedNodeData] = useState<Record<string, unknown> | null>(null);
  const [nodeModalPos, setNodeModalPos] = useState<{ x: number; y: number } | null>(null);
  const [builderNotice, setBuilderNotice] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );
  const [segmentOptions, setSegmentOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [segmentStatus, setSegmentStatus] = useState<"idle" | "loading" | "error">("idle");
  const [templateOptions, setTemplateOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [templateStatus, setTemplateStatus] = useState<"idle" | "loading" | "error">("idle");

  const filtered = useMemo(
    () => (statusFilter === "all" ? items : items.filter((i) => i.status === statusFilter)),
    [items, statusFilter]
  );

  const inputClass = `${theme.input} w-full`;
  const textAreaClass = `${theme.input} w-full`;

  function updateField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resolveOptionLabel(field: Field, value: string) {
    const match = field.options?.find((opt) => opt.value === value);
    if (match) return t(match.labelKey);
    return value || "-";
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const name = form.name || form.title || form.subject || typeLabel;
    const item: Item = {
      id,
      name,
      status: form.status || defaultStatus,
      createdAt,
    };
    for (const field of config.fields) {
      item[field.key] = form[field.key] ?? "";
    }
    setItems((prev) => [item, ...prev]);
    setForm(initialForm);
  }

  function setItemStatus(id: string, status: string) {
    setSavingId(id);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
    setSavingId(null);
  }

  const statusOptions = statuses.map((s) => ({ value: s.key, label: s.label }));
  const filterOptions = [{ value: "all", label: t("marketing.manager.filter.all") }, ...statusOptions];

  const paletteTemplates = useMemo(
    () =>
      config.builder?.palette ?? config.builder?.nodes.map(({ x, y, ...rest }) => rest) ?? [],
    [config.builder]
  );

  function getBuilderApiUrl() {
    if (typeof window === "undefined") return "";
    const match = window.location.pathname.match(/\/company\/([^/]+)/i);
    if (match?.[1]) {
      return `/api/company/${match[1]}/marketing/campaigns/builder`;
    }
    return "/api/global/marketing/campaigns/builder";
  }

  function getStorageKey() {
    if (!config.builder) return "";
    if (config.builder.storageKey) return config.builder.storageKey;
    if (typeof window !== "undefined") return `builder:${window.location.pathname}`;
    return "builder:campaigns";
  }

  async function loadSegments() {
    if (typeof window === "undefined") return;
    const match = window.location.pathname.match(/\/company\/([^/]+)/i);
    const companyId = match?.[1];
    if (!companyId) return;
    setSegmentStatus("loading");
    try {
      const res = await fetch(`/api/company/${companyId}/marketing/segments`);
      if (!res.ok) throw new Error("Failed to fetch segments");
      const payload = await res.json();
      const items = Array.isArray(payload?.items) ? payload.items : [];
      setSegmentOptions(
        items.map((item: any) => ({
          id: String(item.id),
          name: String(item.name),
        }))
      );
      setSegmentStatus("idle");
    } catch (error) {
      console.warn("Failed to load marketing segments.", error);
      setSegmentStatus("error");
    }
  }

  async function loadTemplates(type: "email" | "whatsapp") {
    if (typeof window === "undefined") return;
    const match = window.location.pathname.match(/\/company\/([^/]+)/i);
    const companyId = match?.[1];
    if (!companyId) return;
    setTemplateStatus("loading");
    try {
      const res = await fetch(`/api/company/${companyId}/marketing/templates?type=${type}`);
      if (!res.ok) throw new Error("Failed to fetch templates");
      const payload = await res.json();
      const items = Array.isArray(payload?.items) ? payload.items : [];
      setTemplateOptions(
        items.map((item: any) => ({
          id: String(item.id),
          name: String(item.name),
        }))
      );
      setTemplateStatus("idle");
    } catch (error) {
      console.warn("Failed to load marketing templates.", error);
      setTemplateStatus("error");
    }
  }

  function buildNodeHtml(node: BuilderTemplate) {
    const label = t(node.labelKey);
    const description = node.descriptionKey ? t(node.descriptionKey) : "";
    const nodeClass = `rounded-xl ${theme.cardBg} ${theme.cardBorder} p-3 text-sm text-foreground shadow-sm`;
    const labelClass = "font-semibold text-white";
    const descriptionClass = "mt-1 text-xs text-white/70";
    return `<div class="${nodeClass}"><div class="${labelClass}">${label}</div>${
      description ? `<div class="${descriptionClass}">${description}</div>` : ""
    }</div>`;
  }

  function getNodeFromEditor(id: number) {
    const editor = editorRef.current;
    if (!editor) return null;
    const direct = editor.drawflow?.Home?.data?.[id];
    if (direct) return direct;
    try {
      const exported = editor.export();
      return exported?.drawflow?.Home?.data?.[id] ?? null;
    } catch (error) {
      console.warn("Failed to read builder node data.", error);
      return null;
    }
  }

  function updateSelectedNodeData(next: Record<string, unknown>) {
    if (!editorRef.current || selectedNodeId == null) return;
    editorRef.current.updateNodeDataFromId(selectedNodeId, next);
    setSelectedNodeData(next);
  }

  function addTemplateNode(template: BuilderTemplate, x: number, y: number) {
    if (!editorRef.current) return;
    editorRef.current.addNode(
      template.key,
      template.inputs ?? 1,
      template.outputs ?? 1,
      x,
      y,
      template.className ?? "",
      { key: template.key, settings: {} },
      buildNodeHtml(template)
    );
  }

  useEffect(() => {
    if (!config.builder || !builderRef.current) return;
    let editor: any;
    let canceled = false;
    const nodes = config.builder.nodes;
    const connections = config.builder.connections;
    async function init() {
      const Drawflow = (await import("drawflow")).default;
      if (canceled || !builderRef.current) return;
      builderRef.current.innerHTML = "";
      editor = new Drawflow(builderRef.current);
      editor.reroute = true;
      editor.editor_mode = "edit";
      editor.start();
      editorRef.current = editor;

      const storageKey = getStorageKey();
      const saved = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;
      if (saved) {
        try {
          editor.import(JSON.parse(saved));
          return;
        } catch (error) {
          console.warn("Failed to load campaign builder state.", error);
        }
      }

      const nodeIds = new Map<string, number>();
      for (const node of nodes) {
        const html = buildNodeHtml(node);
        const id = editor.addNode(
          node.key,
          node.inputs ?? 1,
          node.outputs ?? 1,
          node.x,
          node.y,
          node.className ?? "",
          { key: node.key, settings: {} },
          html
        );
        nodeIds.set(node.key, id);
      }

      for (const link of connections) {
        const fromId = nodeIds.get(link.from);
        const toId = nodeIds.get(link.to);
        if (!fromId || !toId) continue;
        editor.addConnection(fromId, toId, link.output ?? "output_1", link.input ?? "input_1");
      }
    }

    init();

    return () => {
      canceled = true;
      editorRef.current = null;
      if (builderRef.current) builderRef.current.innerHTML = "";
    };
  }, [config.builder, t, builderSeed]);

  useEffect(() => {
    const container = builderRef.current;
    if (!container) return;
    function handleDoubleClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const nodeElement = target?.closest?.(".drawflow-node") as HTMLElement | null;
      if (!nodeElement) return;
      const idText = nodeElement.id?.replace("node-", "");
      const nodeId = Number(idText);
      if (!Number.isFinite(nodeId)) return;
      const node = getNodeFromEditor(nodeId);
      setSelectedNodeId(nodeId);
      setSelectedNodeKey((node?.data?.key as string) ?? node?.name ?? null);
      setSelectedNodeData((node?.data as Record<string, unknown>) ?? null);
      if (builderRef.current) {
        const canvasRect = builderRef.current.getBoundingClientRect();
        const nodeRect = nodeElement.getBoundingClientRect();
        const x = nodeRect.right - canvasRect.left + 12;
        const y = nodeRect.top - canvasRect.top;
        setNodeModalPos({ x, y });
      }
    }
    container.addEventListener("dblclick", handleDoubleClick);
    return () => {
      container.removeEventListener("dblclick", handleDoubleClick);
    };
  }, [builderSeed, config.builder]);

  async function handleSave() {
    if (!editorRef.current || typeof window === "undefined") return;
    const data = editorRef.current.export();
    const storageKey = getStorageKey();
    const apiUrl = getBuilderApiUrl();
    let saved = false;
    if (apiUrl) {
      try {
        const res = await fetch(apiUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ graph: data }),
        });
        saved = res.ok;
        if (!res.ok) {
          console.warn("Failed to save builder graph to API.");
        }
      } catch (error) {
        console.warn("Failed to save builder graph to API.", error);
      }
    }
    window.localStorage.setItem(storageKey, JSON.stringify(data));
    setBuilderNotice({
      type: saved ? "success" : "error",
      message: saved
        ? t("marketing.campaigns.builder.notice.save.success")
        : t("marketing.campaigns.builder.notice.save.error"),
    });
  }

  async function handleLoad() {
    if (!editorRef.current || typeof window === "undefined") return;
    const storageKey = getStorageKey();
    const apiUrl = getBuilderApiUrl();
    let loaded = false;
    if (apiUrl) {
      try {
        const res = await fetch(apiUrl);
        if (res.ok) {
          const payload = await res.json();
          if (payload?.graph) {
            editorRef.current.import(payload.graph);
            loaded = true;
          }
        }
      } catch (error) {
        console.warn("Failed to load builder graph from API.", error);
      }
    }

    if (!loaded) {
      const saved = window.localStorage.getItem(storageKey);
      if (!saved) {
        setBuilderNotice({
          type: "error",
          message: t("marketing.campaigns.builder.notice.load.empty"),
        });
        return;
      }
      try {
        editorRef.current.import(JSON.parse(saved));
      } catch (error) {
        console.warn("Failed to load campaign builder state.", error);
        setBuilderNotice({
          type: "error",
          message: t("marketing.campaigns.builder.notice.load.error"),
        });
        return;
      }
    }

    setSelectedNodeId(null);
    setSelectedNodeKey(null);
    setSelectedNodeData(null);
    setNodeModalPos(null);
    setBuilderNotice({
      type: "success",
      message: t("marketing.campaigns.builder.notice.load.success"),
    });
  }

  function handleReset() {
    if (!editorRef.current || typeof window === "undefined" || !config.builder) return;
    const storageKey = getStorageKey();
    window.localStorage.removeItem(storageKey);
    setBuilderSeed((prev) => prev + 1);
    setSelectedNodeId(null);
    setSelectedNodeKey(null);
    setSelectedNodeData(null);
    setNodeModalPos(null);
  }

  return (
    <div className="space-y-6 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t(config.titleKey)}</h1>
          <p className="text-sm text-muted-foreground">{t(config.descriptionKey)}</p>
        </div>
        {showManager && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">{t("marketing.manager.filter")}</label>
            <select
              className={inputClass}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {filterOptions.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {showBuilder && config.builder && (
        <Card className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-lg font-semibold">{t(config.builder.titleKey)}</div>
              {config.builder.descriptionKey && (
                <p className="text-sm text-muted-foreground">{t(config.builder.descriptionKey)}</p>
              )}
              {builderNotice && (
                <div
                  className={`mt-2 text-xs ${
                    builderNotice.type === "success" ? "text-emerald-200" : "text-red-200"
                  }`}
                >
                  {builderNotice.message}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-foreground hover:border-white/40"
                onClick={handleSave}
              >
                {t("marketing.campaigns.builder.save")}
              </button>
              <button
                type="button"
                className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-foreground hover:border-white/40"
                onClick={handleLoad}
              >
                {t("marketing.campaigns.builder.load")}
              </button>
              <button
                type="button"
                className="rounded-full border border-red-300/30 px-3 py-1 text-xs font-semibold text-red-200 hover:border-red-300/60"
                onClick={handleReset}
              >
                {t("marketing.campaigns.builder.reset")}
              </button>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 shadow-sm">
              <div className="text-xs font-semibold text-muted-foreground">
                {t("marketing.campaigns.builder.palette")}
              </div>
              <div className="mt-3 space-y-2">
                {paletteTemplates.map((node) => (
                  <div
                    key={node.key}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData("application/x-node-key", node.key);
                    }}
                    className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-foreground shadow-sm hover:border-white/40"
                  >
                    <div className="font-semibold">{t(node.labelKey)}</div>
                    {node.descriptionKey && (
                      <div className="mt-1 text-[11px] text-muted-foreground">{t(node.descriptionKey)}</div>
                    )}
                    <button
                      type="button"
                      className="mt-2 rounded-full border border-white/10 px-2 py-1 text-[11px] font-semibold text-foreground hover:border-white/40"
                      onClick={() => addTemplateNode(node, 120, 120)}
                    >
                      {t("marketing.campaigns.builder.add")}
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative h-[560px] w-full overflow-hidden rounded-xl border border-white/10 bg-white/5 shadow-sm">
              <div
                ref={builderRef}
                className="drawflow h-full w-full"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const key = event.dataTransfer.getData("application/x-node-key");
                  const template = paletteTemplates.find((item) => item.key === key);
                  if (!template || !builderRef.current) return;
                  const rect = builderRef.current.getBoundingClientRect();
                  const x = event.clientX - rect.left;
                  const y = event.clientY - rect.top;
                  addTemplateNode(template, x, y);
                }}
              />
              {selectedNodeId != null && nodeModalPos && (
                <div
                  className="absolute z-20 w-64 rounded-xl border border-white/10 bg-slate-950/95 p-3 shadow-xl backdrop-blur"
                  style={{ left: nodeModalPos.x, top: nodeModalPos.y }}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-white">
                      {selectedNodeKey ? t(`marketing.campaigns.builder.node.${selectedNodeKey}`) : "-"}
                    </div>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-white"
                      onClick={() => {
                        setSelectedNodeId(null);
                        setSelectedNodeKey(null);
                        setSelectedNodeData(null);
                        setNodeModalPos(null);
                      }}
                    >
                      {t("marketing.campaigns.builder.settings.close")}
                    </button>
                  </div>
                  <div className="mt-3 space-y-3">
                    {selectedNodeKey === "channel" && (
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground">
                          {t("marketing.campaigns.builder.settings.channel.label")}
                        </label>
                        <select
                          className={`${inputClass} mt-1`}
                          value={
                            (selectedNodeData?.settings as Record<string, unknown> | undefined)?.channel ?? ""
                          }
                          onChange={(event) => {
                            const settings =
                              (selectedNodeData?.settings as Record<string, unknown> | undefined) ?? {};
                            updateSelectedNodeData({
                              ...selectedNodeData,
                              key: selectedNodeKey,
                              settings: { ...settings, channel: event.target.value },
                            });
                          }}
                        >
                          <option value="">
                            {format(t, "marketing.manager.selectDefault", {
                              field: t("marketing.campaigns.field.channel.label").toLowerCase(),
                            })}
                          </option>
                          <option value="sms">{t("marketing.campaigns.field.channel.options.sms")}</option>
                          <option value="email">{t("marketing.campaigns.field.channel.options.email")}</option>
                          <option value="whatsapp">{t("marketing.campaigns.field.channel.options.whatsapp")}</option>
                          <option value="ads">{t("marketing.campaigns.field.channel.options.ads")}</option>
                        </select>
                        {["email", "whatsapp"].includes(
                          String(
                            (selectedNodeData?.settings as Record<string, unknown> | undefined)?.channel ?? ""
                          )
                        ) && (
                          <div className="mt-2">
                            <label className="text-xs font-semibold text-muted-foreground">
                              {t("marketing.campaigns.builder.settings.template.label")}
                            </label>
                            <select
                              className={`${inputClass} mt-1`}
                              value={
                                (selectedNodeData?.settings as Record<string, unknown> | undefined)?.templateId ?? ""
                              }
                              onFocus={() => {
                                const channel = String(
                                  (selectedNodeData?.settings as Record<string, unknown> | undefined)?.channel ?? ""
                                );
                                if (channel === "email" || channel === "whatsapp") {
                                  if (templateStatus === "idle") {
                                    loadTemplates(channel);
                                  }
                                }
                              }}
                              onChange={(event) => {
                                const settings =
                                  (selectedNodeData?.settings as Record<string, unknown> | undefined) ?? {};
                                updateSelectedNodeData({
                                  ...selectedNodeData,
                                  key: selectedNodeKey,
                                  settings: { ...settings, templateId: event.target.value },
                                });
                              }}
                            >
                              <option value="">
                                {format(t, "marketing.manager.selectDefault", {
                                  field: t("marketing.campaigns.builder.settings.template.label").toLowerCase(),
                                })}
                              </option>
                              {templateStatus === "loading" && (
                                <option value="" disabled>
                                  {t("marketing.campaigns.builder.settings.template.loading")}
                                </option>
                              )}
                              {templateStatus === "error" && (
                                <option value="" disabled>
                                  {t("marketing.campaigns.builder.settings.template.error")}
                                </option>
                              )}
                              {templateOptions.length === 0 && templateStatus === "idle" && (
                                <option value="" disabled>
                                  {t("marketing.campaigns.builder.settings.template.empty")}
                                </option>
                              )}
                              {templateOptions.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                    {selectedNodeKey === "audience" && (
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground">
                          {t("marketing.campaigns.builder.settings.audience.label")}
                        </label>
                        <select
                          className={`${inputClass} mt-1`}
                          value={
                            (selectedNodeData?.settings as Record<string, unknown> | undefined)?.audience ?? ""
                          }
                          onChange={(event) => {
                            const settings =
                              (selectedNodeData?.settings as Record<string, unknown> | undefined) ?? {};
                            updateSelectedNodeData({
                              ...selectedNodeData,
                              key: selectedNodeKey,
                              settings: { ...settings, audience: event.target.value },
                            });
                          }}
                        >
                          <option value="">
                            {format(t, "marketing.manager.selectDefault", {
                              field: t("marketing.campaigns.builder.settings.audience.label").toLowerCase(),
                            })}
                          </option>
                          <option value="all">{t("marketing.campaigns.builder.settings.audience.all")}</option>
                          <option value="segment">
                            {t("marketing.campaigns.builder.settings.audience.segment")}
                          </option>
                        </select>
                        {(selectedNodeData?.settings as Record<string, unknown> | undefined)?.audience ===
                          "segment" && (
                          <div className="mt-2">
                            <label className="text-xs font-semibold text-muted-foreground">
                              {t("marketing.campaigns.builder.settings.audience.segment.label")}
                            </label>
                            <select
                              className={`${inputClass} mt-1`}
                              value={
                                (selectedNodeData?.settings as Record<string, unknown> | undefined)?.segmentId ?? ""
                              }
                              onFocus={() => {
                                if (segmentStatus === "idle" && segmentOptions.length === 0) {
                                  loadSegments();
                                }
                              }}
                              onChange={(event) => {
                                const settings =
                                  (selectedNodeData?.settings as Record<string, unknown> | undefined) ?? {};
                                updateSelectedNodeData({
                                  ...selectedNodeData,
                                  key: selectedNodeKey,
                                  settings: { ...settings, segmentId: event.target.value },
                                });
                              }}
                            >
                              <option value="">
                                {format(t, "marketing.manager.selectDefault", {
                                  field: t("marketing.campaigns.builder.settings.audience.segment.label").toLowerCase(),
                                })}
                              </option>
                              {segmentStatus === "loading" && (
                                <option value="" disabled>
                                  {t("marketing.campaigns.builder.settings.audience.segment.loading")}
                                </option>
                              )}
                              {segmentStatus === "error" && (
                                <option value="" disabled>
                                  {t("marketing.campaigns.builder.settings.audience.segment.error")}
                                </option>
                              )}
                              {segmentOptions.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                    {selectedNodeKey === "condition" && (
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground">
                          {t("marketing.campaigns.builder.settings.condition.label")}
                        </label>
                        <select
                          className={`${inputClass} mt-1`}
                          value={
                            (selectedNodeData?.settings as Record<string, unknown> | undefined)?.condition ?? ""
                          }
                          onChange={(event) => {
                            const settings =
                              (selectedNodeData?.settings as Record<string, unknown> | undefined) ?? {};
                            updateSelectedNodeData({
                              ...selectedNodeData,
                              key: selectedNodeKey,
                              settings: { ...settings, condition: event.target.value },
                            });
                          }}
                        >
                          <option value="">
                            {format(t, "marketing.manager.selectDefault", {
                              field: t("marketing.campaigns.builder.settings.condition.label").toLowerCase(),
                            })}
                          </option>
                          <option value="opened">
                            {t("marketing.campaigns.builder.settings.condition.opened")}
                          </option>
                          <option value="clicked">
                            {t("marketing.campaigns.builder.settings.condition.clicked")}
                          </option>
                          <option value="replied">
                            {t("marketing.campaigns.builder.settings.condition.replied")}
                          </option>
                          <option value="converted">
                            {t("marketing.campaigns.builder.settings.condition.converted")}
                          </option>
                          <option value="custom">
                            {t("marketing.campaigns.builder.settings.condition.custom")}
                          </option>
                        </select>
                        {(selectedNodeData?.settings as Record<string, unknown> | undefined)?.condition ===
                          "custom" && (
                          <div className="mt-2">
                            <label className="text-xs font-semibold text-muted-foreground">
                              {t("marketing.campaigns.builder.settings.condition.custom.label")}
                            </label>
                            <input
                              className={`${inputClass} mt-1`}
                              value={
                                (selectedNodeData?.settings as Record<string, unknown> | undefined)?.conditionValue ??
                                ""
                              }
                              onChange={(event) => {
                                const settings =
                                  (selectedNodeData?.settings as Record<string, unknown> | undefined) ?? {};
                                updateSelectedNodeData({
                                  ...selectedNodeData,
                                  key: selectedNodeKey,
                                  settings: { ...settings, conditionValue: event.target.value },
                                });
                              }}
                              placeholder={t("marketing.campaigns.builder.settings.condition.custom.placeholder")}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {showManager && (
        <>
          <Card className="space-y-4" id="form">
            <div className="text-lg font-semibold">{format(t, "marketing.manager.create", { type: typeLabel })}</div>
            <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {config.fields.map((field) => {
                const label = t(field.labelKey);
                const placeholder = field.placeholderKey ? t(field.placeholderKey) : "";
                if (field.type === "textarea") {
                  return (
                    <div key={field.key} className="md:col-span-2">
                      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
                      <textarea
                        className={`${textAreaClass} mt-1`}
                        placeholder={placeholder}
                        value={form[field.key] ?? ""}
                        onChange={(e) => updateField(field.key, e.target.value)}
                      />
                    </div>
                  );
                }
                if (field.type === "select") {
                  return (
                    <div key={field.key}>
                      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
                      <select
                        className={`${inputClass} mt-1`}
                        value={form[field.key] ?? ""}
                        onChange={(e) => updateField(field.key, e.target.value)}
                      >
                        <option value="">
                          {format(t, "marketing.manager.selectDefault", {
                            field: label.toLowerCase(),
                          })}
                        </option>
                        {field.options?.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {t(opt.labelKey)}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                }
                return (
                  <div key={field.key}>
                    <label className="text-xs font-semibold text-muted-foreground">{label}</label>
                    <input
                      className={`${inputClass} mt-1`}
                      placeholder={placeholder}
                      value={form[field.key] ?? ""}
                      onChange={(e) => updateField(field.key, e.target.value)}
                    />
                  </div>
                );
              })}
              <div>
                <label className="text-xs font-semibold text-muted-foreground">{t("marketing.manager.status")}</label>
                <select
                  className={`${inputClass} mt-1`}
                  value={form.status ?? defaultStatus}
                  onChange={(e) => updateField("status", e.target.value)}
                >
                  {statuses.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <button
                  type="submit"
                  className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                >
                  {format(t, "marketing.manager.create", { type: typeLabel })}
                </button>
              </div>
            </form>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-lg font-semibold">
                {format(t, "marketing.manager.manage", { typePlural: typePluralLabel })}
              </div>
              {items.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  {format(t, "marketing.manager.showing", { shown: filtered.length, total: items.length })}
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2">{t("marketing.manager.name")}</th>
                    {config.fields.map((f) => (
                      <th key={f.key} className="px-3 py-2 capitalize">
                        {t(f.labelKey)}
                      </th>
                    ))}
                    <th className="px-3 py-2">{t("marketing.manager.status")}</th>
                    <th className="px-3 py-2">{t("marketing.manager.created")}</th>
                    <th className="px-3 py-2 text-right">{t("marketing.manager.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.id} className="border-b border-white/5">
                      <td className="px-3 py-2 font-medium">{item.name}</td>
                      {config.fields.map((f) => (
                        <td key={f.key} className="px-3 py-2 text-muted-foreground">
                          {f.type === "select" ? resolveOptionLabel(f, item[f.key]) : item[f.key] || "-"}
                        </td>
                      ))}
                      <td className="px-3 py-2">
                        <span className="rounded-full bg-white/10 px-2 py-1 text-xs">
                          {t(item.status) ?? item.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-2">
                          {statuses
                            .filter((s) => s.key !== item.status)
                            .slice(0, 2)
                            .map((s) => (
                              <button
                                key={s.key}
                                className="rounded-full border border-white/10 px-2 py-1 text-xs hover:border-white/40 disabled:opacity-50"
                                onClick={() => setItemStatus(item.id, s.key)}
                                disabled={savingId === item.id}
                              >
                                {format(t, "marketing.manager.set", { status: s.label })}
                              </button>
                            ))}
                          <button
                            className="rounded-full border border-red-300/30 px-2 py-1 text-xs text-red-200 hover:border-red-300/60"
                            onClick={() => setItems((prev) => prev.filter((p) => p.id !== item.id))}
                          >
                            {t("marketing.manager.delete")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td className="px-3 py-4 text-sm text-muted-foreground" colSpan={config.fields.length + 3}>
                        {format(t, "marketing.manager.empty", { typePlural: typePluralLabel })}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
