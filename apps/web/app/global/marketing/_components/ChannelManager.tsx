"use client";

import "drawflow/dist/drawflow.min.css";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppLayout, Card, useI18n, useTheme } from "@repo/ui";

type FieldOption = { value: string; labelKey: string };

type Field = {
  key: string;
  labelKey: string;
  type?: "text" | "textarea" | "select" | "datetime";
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
  itemsApi?: "campaigns";
  hideForm?: boolean;
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
const SCHEDULED_STATUSES = new Set(["scheduled", "marketing.status.scheduled"]);

type ConditionOption = { value: string; labelKey: string };

const FALLBACK_CONDITION_OPTIONS: ConditionOption[] = [
  { value: "opened", labelKey: "marketing.campaigns.builder.settings.condition.opened" },
  { value: "clicked", labelKey: "marketing.campaigns.builder.settings.condition.clicked" },
  { value: "replied", labelKey: "marketing.campaigns.builder.settings.condition.replied" },
  { value: "converted", labelKey: "marketing.campaigns.builder.settings.condition.converted" },
  { value: "custom", labelKey: "marketing.campaigns.builder.settings.condition.custom" },
];

const CHANNEL_CONDITION_OPTIONS: Record<string, ConditionOption[]> = {
  email: [
    { value: "sent", labelKey: "marketing.campaigns.builder.settings.condition.sent" },
    { value: "delivered", labelKey: "marketing.campaigns.builder.settings.condition.delivered" },
    { value: "opened", labelKey: "marketing.campaigns.builder.settings.condition.opened" },
    { value: "clicked", labelKey: "marketing.campaigns.builder.settings.condition.clicked" },
    { value: "custom", labelKey: "marketing.campaigns.builder.settings.condition.custom" },
  ],
  whatsapp: [
    { value: "sent", labelKey: "marketing.campaigns.builder.settings.condition.sent" },
    { value: "delivered", labelKey: "marketing.campaigns.builder.settings.condition.delivered" },
    { value: "read", labelKey: "marketing.campaigns.builder.settings.condition.read" },
    { value: "custom", labelKey: "marketing.campaigns.builder.settings.condition.custom" },
  ],
  sms: [
    { value: "sent", labelKey: "marketing.campaigns.builder.settings.condition.sent" },
    { value: "delivered", labelKey: "marketing.campaigns.builder.settings.condition.delivered" },
    { value: "custom", labelKey: "marketing.campaigns.builder.settings.condition.custom" },
  ],
  push: [
    { value: "sent", labelKey: "marketing.campaigns.builder.settings.condition.sent" },
    { value: "delivered", labelKey: "marketing.campaigns.builder.settings.condition.delivered" },
    { value: "clicked", labelKey: "marketing.campaigns.builder.settings.condition.clicked" },
    { value: "custom", labelKey: "marketing.campaigns.builder.settings.condition.custom" },
  ],
};

function format(t: (key: string) => string, key: string, replacements: Record<string, string | number>) {
  return Object.entries(replacements).reduce(
    (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
    t(key)
  );
}

function isScheduledStatus(value: string) {
  return SCHEDULED_STATUSES.has(value);
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
          [field.key]:
            field.type === "datetime" ? new Date().toISOString().slice(0, 16) : "",
        }),
        { status: defaultStatus } as Record<string, string>
      ),
    [config.fields, defaultStatus]
  );

  const [items, setItems] = useState<Item[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>(initialForm);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [campaignName, setCampaignName] = useState<string>("");
  const [companyId, setCompanyId] = useState<string>("");
  const [testOpen, setTestOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [testStatus, setTestStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState<string>("");
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
  const conditionOptions = useMemo(() => {
    const settings = (selectedNodeData?.settings as Record<string, unknown> | undefined) ?? {};
    const sourceChannel = String(settings.sourceChannel ?? "");
    const currentValue = String(settings.condition ?? "");
    const baseOptions = CHANNEL_CONDITION_OPTIONS[sourceChannel] ?? FALLBACK_CONDITION_OPTIONS;
    const resolved = baseOptions.map((opt) => ({ value: opt.value, label: t(opt.labelKey) }));
    if (currentValue && !resolved.some((opt) => opt.value === currentValue)) {
      resolved.unshift({ value: currentValue, label: currentValue });
    }
    return resolved;
  }, [selectedNodeData, t]);
  const [segmentOptions, setSegmentOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [segmentStatus, setSegmentStatus] = useState<"idle" | "loading" | "error">("idle");
  const [templateOptions, setTemplateOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [templateStatus, setTemplateStatus] = useState<"idle" | "loading" | "error">("idle");
  const [scheduleModal, setScheduleModal] = useState<{
    id: string;
    status: string;
    date: string;
    time: string;
  } | null>(null);

  const filtered = useMemo(
    () => (statusFilter === "all" ? items : items.filter((i) => i.status === statusFilter)),
    [items, statusFilter]
  );

  const inputClass = `${theme.input} w-full`;
  const textAreaClass = `${theme.input} w-full`;

  function formatLocalDateTimeParts(value: Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    const hours = String(value.getHours()).padStart(2, "0");
    const minutes = String(value.getMinutes()).padStart(2, "0");
    return { date: `${year}-${month}-${day}`, time: `${hours}:${minutes}` };
  }

  function updateField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function getItemsApiUrl() {
    if (config.itemsApi !== "campaigns" || typeof window === "undefined") return "";
    const match = window.location.pathname.match(/\/company\/([^/]+)/i);
    if (match?.[1]) {
      return `/api/company/${match[1]}/marketing/campaigns`;
    }
    return "";
  }

  function resolveOptionLabel(field: Field, value: string) {
    const match = field.options?.find((opt) => opt.value === value);
    if (match) return t(match.labelKey);
    return value || "-";
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = form.name || form.title || form.subject || typeLabel;
    const status = form.status || defaultStatus;
    const apiUrl = getItemsApiUrl();
    const formFields = config.fields.reduce(
      (acc, field) => ({
        ...acc,
        [field.key]: form[field.key] ?? "",
      }),
      {}
    );
    if (apiUrl) {
      try {
        const res = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, status, ...formFields }),
        });
        if (res.ok) {
          const payload = await res.json();
          const created = payload?.item;
          if (created) {
            setItems((prev) => [
              {
                ...created,
                ...formFields,
              },
              ...prev,
            ]);
            setForm(initialForm);
            return;
          }
        }
      } catch (error) {
        console.warn("Failed to create campaign.", error);
      }
    }
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const item: Item = {
      id,
      name,
      status,
      createdAt,
      ...formFields,
    };
    setItems((prev) => [item, ...prev]);
    setForm(initialForm);
  }

  async function setItemStatus(id: string, status: string) {
    if (status === "marketing.status.scheduled") {
      const nowParts = formatLocalDateTimeParts(new Date());
      setScheduleModal({
        id,
        status,
        date: nowParts.date,
        time: nowParts.time,
      });
      return;
    }
    setSavingId(id);
    const apiUrl = getItemsApiUrl();
    if (apiUrl) {
      try {
        const res = await fetch(`${apiUrl}/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (res.ok) {
          setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
        }
      } catch (error) {
        console.warn("Failed to update campaign status.", error);
      } finally {
        setSavingId(null);
      }
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
    setSavingId(null);
  }

  async function confirmSchedule() {
    if (!scheduleModal) return;
    const { id, status, date, time } = scheduleModal;
    const startsAt = `${date}T${time}`;
    setSavingId(id);
    const apiUrl = getItemsApiUrl();
    if (apiUrl) {
      try {
        const res = await fetch(`${apiUrl}/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, startsAt }),
        });
        if (res.ok) {
          setItems((prev) =>
            prev.map((i) => (i.id === id ? { ...i, status, startsAt } : i))
          );
        }
      } catch (error) {
        console.warn("Failed to update campaign status.", error);
      } finally {
        setSavingId(null);
        setScheduleModal(null);
      }
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status, startsAt } : i)));
    setSavingId(null);
    setScheduleModal(null);
  }

  async function deleteItem(id: string) {
    setDeletingId(id);
    const apiUrl = getItemsApiUrl();
    if (apiUrl) {
      try {
        const res = await fetch(`${apiUrl}/${id}`, { method: "DELETE" });
        if (res.ok) {
          setItems((prev) => prev.filter((p) => p.id !== id));
        }
      } catch (error) {
        console.warn("Failed to delete campaign.", error);
      } finally {
        setDeletingId(null);
      }
      return;
    }
    setItems((prev) => prev.filter((p) => p.id !== id));
    setDeletingId(null);
  }

  function handleNewCampaign() {
    if (!companyId || typeof window === "undefined") return;
    const nameKey = getCampaignStorageKeyForCompany(companyId, "name");
    const idKey = getCampaignStorageKeyForCompany(companyId, "id");
    const storageKey = getBuilderStorageKeyForCompany(companyId);
    window.localStorage.removeItem(nameKey);
    window.localStorage.removeItem(idKey);
    window.localStorage.removeItem(`${storageKey}:campaign:new`);
    window.location.assign(`/company/${companyId}/marketing/campaigns/builder`);
  }

  function handleEditCampaign(item: Item) {
    if (!companyId || typeof window === "undefined") return;
    const nameKey = getCampaignStorageKeyForCompany(companyId, "name");
    const idKey = getCampaignStorageKeyForCompany(companyId, "id");
    window.localStorage.setItem(nameKey, item.name ?? "");
    window.localStorage.setItem(idKey, item.id);
    window.location.assign(`/company/${companyId}/marketing/campaigns/builder`);
  }

  function handleViewPerformance(item: Item) {
    if (!companyId || typeof window === "undefined") return;
    window.location.assign(`/company/${companyId}/marketing/campaigns/${item.id}/performance`);
  }

  async function handleTestCampaign() {
    if (!companyId || !editorRef.current) return;
    const email = testEmail.trim();
    const phone = testPhone.trim();
    if (!email && !phone) {
      setTestStatus("error");
      setTestMessage(t("marketing.campaigns.test.missing"));
      return;
    }
    setTestStatus("loading");
    setTestMessage("");
    try {
      const res = await fetch(`/api/company/${companyId}/marketing/campaigns/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email || undefined,
          phone: phone || undefined,
          campaignId: campaignId ?? undefined,
          graph: editorRef.current.export(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Failed to send test");
      }
      setTestStatus("success");
      setTestMessage(t("marketing.campaigns.test.success"));
    } catch (error: any) {
      setTestStatus("error");
      setTestMessage(error?.message ?? t("marketing.campaigns.test.error"));
    }
  }

  const statusOptions = statuses.map((s) => ({ value: s.key, label: s.label }));
  const filterOptions = [{ value: "all", label: t("marketing.manager.filter.all") }, ...statusOptions];

  const paletteTemplates = useMemo(
    () =>
      config.builder?.palette ?? config.builder?.nodes.map(({ x, y, ...rest }) => rest) ?? [],
    [config.builder]
  );

  function getBuilderApiUrl(overrideCampaignId?: string | null) {
    if (typeof window === "undefined") return "";
    const match = window.location.pathname.match(/\/company\/([^/]+)/i);
    const activeCampaignId = overrideCampaignId ?? campaignId;
    const campaignParam =
      config.itemsApi === "campaigns" && activeCampaignId
        ? `?campaignId=${encodeURIComponent(activeCampaignId)}`
        : "";
    if (match?.[1]) {
      return `/api/company/${match[1]}/marketing/campaigns/builder${campaignParam}`;
    }
    return `/api/global/marketing/campaigns/builder${campaignParam}`;
  }

  function getStorageKey(overrideCampaignId?: string | null) {
    if (!config.builder) return "";
    if (config.builder.storageKey) return config.builder.storageKey;
    if (typeof window !== "undefined") {
      const activeCampaignId = overrideCampaignId ?? campaignId;
      const suffix = config.itemsApi === "campaigns" ? `:campaign:${activeCampaignId ?? "new"}` : "";
      return `builder:${window.location.pathname}${suffix}`;
    }
    return "builder:campaigns";
  }

  function getCampaignStorageKey(suffix: "id" | "name") {
    if (config.builder?.storageKey) return `${config.builder.storageKey}:campaign:${suffix}`;
    if (typeof window !== "undefined") return `builder:${window.location.pathname}:campaign:${suffix}`;
    return `builder:campaigns:campaign:${suffix}`;
  }

  function getBuilderStorageKeyForCompany(id: string) {
    return `builder:/company/${id}/marketing/campaigns/builder`;
  }

  function getCampaignStorageKeyForCompany(id: string, suffix: "id" | "name") {
    const base = getBuilderStorageKeyForCompany(id);
    return `${base}:campaign:${suffix}`;
  }

  useEffect(() => {
    if (!config.builder || typeof window === "undefined") return;
    const nameKey = getCampaignStorageKey("name");
    const idKey = getCampaignStorageKey("id");
    const savedName = window.localStorage.getItem(nameKey) ?? "";
    const savedId = window.localStorage.getItem(idKey);
    setCampaignName(savedName);
    setCampaignId(savedId);
  }, [config.builder]);

  useEffect(() => {
    if (!config.builder || typeof window === "undefined") return;
    const nameKey = getCampaignStorageKey("name");
    if (campaignName) {
      window.localStorage.setItem(nameKey, campaignName);
      return;
    }
    window.localStorage.removeItem(nameKey);
  }, [campaignName, config.builder]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const match = window.location.pathname.match(/\/company\/([^/]+)/i);
    setCompanyId(match?.[1] ?? "");
  }, []);

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

  function getIncomingNodeId(targetId: number) {
    const node = getNodeFromEditor(targetId) as any;
    const inputs = node?.inputs ?? {};
    for (const input of Object.values(inputs)) {
      const connection = (input as any)?.connections?.[0];
      if (!connection?.node) continue;
      const id = Number(connection.node);
      if (Number.isFinite(id)) return id;
    }
    return null;
  }

  function getImmediatePreviousChannel(targetId: number) {
    const incomingId = getIncomingNodeId(targetId);
    if (!incomingId) return "";
    const incomingNode = getNodeFromEditor(incomingId) as any;
    const key = incomingNode?.data?.key ?? incomingNode?.name ?? "";
    if (key !== "channel") return "";
    return String(incomingNode?.data?.settings?.channel ?? "");
  }

  function updateSelectedNodeData(next: Record<string, unknown>) {
    if (!editorRef.current || selectedNodeId == null) return;
    editorRef.current.updateNodeDataFromId(selectedNodeId, next);
    setSelectedNodeData(next);
  }

  function addTemplateNode(template: BuilderTemplate, x: number, y: number) {
    if (!editorRef.current) return null;
    return editorRef.current.addNode(
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

  function getOutgoingNodeIds(sourceId: number) {
    const node = getNodeFromEditor(sourceId) as any;
    const outputs = node?.outputs ?? {};
    const ids = new Set<number>();
    for (const output of Object.values(outputs)) {
      const connections = (output as any)?.connections ?? [];
      for (const connection of connections) {
        const id = Number(connection?.node);
        if (Number.isFinite(id)) ids.add(id);
      }
    }
    return [...ids];
  }

  function ensureChannelChain(nodeId: number) {
    if (!editorRef.current) return;
    if (getOutgoingNodeIds(nodeId).length > 0) return;
    const node = getNodeFromEditor(nodeId) as any;
    const baseX = Number(node?.pos_x ?? node?.x ?? 0);
    const baseY = Number(node?.pos_y ?? node?.y ?? 0);
    const contentTemplate = paletteTemplates.find((item) => item.key === "content");
    const launchTemplate = paletteTemplates.find((item) => item.key === "launch");
    if (!contentTemplate || !launchTemplate) return;
    const contentId = addTemplateNode(contentTemplate, baseX + 220, baseY);
    if (!contentId) return;
    const launchId = addTemplateNode(launchTemplate, baseX + 440, baseY);
    if (!launchId) return;
    editorRef.current.addConnection(nodeId, contentId, "output_1", "input_1");
    editorRef.current.addConnection(contentId, launchId, "output_1", "input_1");
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

      if (config.itemsApi === "campaigns" && campaignId) {
        const apiUrl = getBuilderApiUrl(campaignId);
        if (apiUrl) {
          try {
            const res = await fetch(apiUrl);
            if (res.ok) {
              const payload = await res.json();
              if (payload?.graph) {
                editor.import(payload.graph);
                return;
              }
            }
          } catch (error) {
            console.warn("Failed to load campaign builder graph from API.", error);
          }
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
  }, [config.builder, t, builderSeed, campaignId]);

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

  useEffect(() => {
    const apiUrl = getItemsApiUrl();
    if (!apiUrl) return;
    let canceled = false;
    async function loadItems() {
      try {
        const res = await fetch(apiUrl);
        if (!res.ok) return;
        const payload = await res.json();
        const incoming = Array.isArray(payload?.items) ? payload.items : [];
        if (!canceled) {
          setItems(incoming);
        }
      } catch (error) {
        console.warn("Failed to load campaigns.", error);
      }
    }
    loadItems();
    return () => {
      canceled = true;
    };
  }, [config.itemsApi]);

  useEffect(() => {
    if (!editorRef.current || selectedNodeId == null || selectedNodeKey !== "condition") return;
    const sourceChannel = getImmediatePreviousChannel(selectedNodeId);
    const settings = (selectedNodeData?.settings as Record<string, unknown> | undefined) ?? {};
    if (String(settings.sourceChannel ?? "") === sourceChannel) return;
    updateSelectedNodeData({
      ...(selectedNodeData ?? {}),
      key: selectedNodeKey,
      settings: { ...settings, sourceChannel },
    });
  }, [selectedNodeId, selectedNodeKey, selectedNodeData]);

  useEffect(() => {
    if (!editorRef.current || selectedNodeId == null || selectedNodeKey !== "content") return;
    const settings = (selectedNodeData?.settings as Record<string, unknown> | undefined) ?? {};
    if (settings.templateId) return;
    const incomingId = getIncomingNodeId(selectedNodeId);
    if (!incomingId) return;
    const incoming = getNodeFromEditor(incomingId) as any;
    const incomingKey = incoming?.data?.key ?? incoming?.name ?? "";
    if (incomingKey !== "channel") return;
    const channelTemplateId = incoming?.data?.settings?.templateId;
    if (!channelTemplateId) return;
    updateSelectedNodeData({
      ...(selectedNodeData ?? {}),
      key: selectedNodeKey,
      settings: { ...settings, templateId: channelTemplateId },
    });
  }, [selectedNodeId, selectedNodeKey, selectedNodeData]);

  function formatChannelLabel(value: string) {
    if (!value) return "-";
    if (value === "sms") return t("marketing.campaigns.field.channel.options.sms");
    if (value === "email") return t("marketing.campaigns.field.channel.options.email");
    if (value === "whatsapp") return t("marketing.campaigns.field.channel.options.whatsapp");
    if (value === "ads") return t("marketing.campaigns.field.channel.options.ads");
    if (value === "push") return t("marketing.campaigns.field.channel.options.push");
    return value;
  }

  async function handleSave() {
    if (!editorRef.current || typeof window === "undefined") return;
    const data = editorRef.current.export();
    let saved = false;
    const itemsApiUrl = getItemsApiUrl();
    const fallbackName = `${typeLabel} ${new Date().toISOString().slice(0, 10)}`;
    const resolvedName = campaignName.trim() || fallbackName;
    let effectiveCampaignId = campaignId;
    if (itemsApiUrl) {
      if (!campaignName.trim()) {
        setCampaignName(resolvedName);
      }
      try {
        if (!effectiveCampaignId) {
          const res = await fetch(itemsApiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: resolvedName, status: defaultStatus }),
          });
          if (res.ok) {
            const payload = await res.json();
            const created = payload?.item;
            if (created?.id) {
              effectiveCampaignId = created.id;
              setCampaignId(created.id);
              window.localStorage.setItem(getCampaignStorageKey("id"), created.id);
            }
          }
        } else {
          await fetch(`${itemsApiUrl}/${effectiveCampaignId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: resolvedName }),
          });
        }
      } catch (error) {
        console.warn("Failed to sync campaign record.", error);
      }
    }

    const apiUrl = getBuilderApiUrl(effectiveCampaignId);
    const storageKey = getStorageKey(effectiveCampaignId);
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
              {config.itemsApi === "campaigns" && (
                <div className="mt-3 max-w-sm">
                  <label className="text-xs font-semibold text-muted-foreground">
                    {t("marketing.campaigns.field.name.label")}
                  </label>
                  <input
                    className={`${inputClass} mt-1`}
                    placeholder={t("marketing.campaigns.field.name.placeholder")}
                    value={campaignName}
                    onChange={(event) => setCampaignName(event.target.value)}
                  />
                </div>
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
              {config.itemsApi === "campaigns" && companyId && (
                <button
                  type="button"
                  className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-foreground hover:border-white/40"
                  onClick={() => {
                    setTestOpen((prev) => !prev);
                    setTestStatus("idle");
                    setTestMessage("");
                  }}
                >
                  {t("marketing.campaigns.test.action")}
                </button>
              )}
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
          {testOpen && config.itemsApi === "campaigns" && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
              <div className="font-semibold text-foreground">{t("marketing.campaigns.test.title")}</div>
              <div className="mt-2 grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">
                    {t("marketing.campaigns.test.email.label")}
                  </label>
                  <input
                    className={`${inputClass} mt-1`}
                    placeholder={t("marketing.campaigns.test.email.placeholder")}
                    value={testEmail}
                    onChange={(event) => setTestEmail(event.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">
                    {t("marketing.campaigns.test.phone.label")}
                  </label>
                  <input
                    className={`${inputClass} mt-1`}
                    placeholder={t("marketing.campaigns.test.phone.placeholder")}
                    value={testPhone}
                    onChange={(event) => setTestPhone(event.target.value)}
                  />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
                  onClick={handleTestCampaign}
                  disabled={testStatus === "loading"}
                >
                  {testStatus === "loading"
                    ? t("marketing.campaigns.test.sending")
                    : t("marketing.campaigns.test.send")}
                </button>
                <button
                  type="button"
                  className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-foreground hover:border-white/40"
                  onClick={() => setTestOpen(false)}
                >
                  {t("marketing.campaigns.test.close")}
                </button>
                {testStatus !== "idle" && testMessage && (
                  <span
                    className={`text-xs ${
                      testStatus === "success" ? "text-emerald-200" : "text-red-200"
                    }`}
                  >
                    {testMessage}
                  </span>
                )}
              </div>
            </div>
          )}
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
            <div className="relative h-[900px] w-full overflow-hidden rounded-xl border border-white/10 bg-white/5 shadow-sm">
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
                            if (selectedNodeId != null && event.target.value) {
                              ensureChannelChain(selectedNodeId);
                            }
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
                          <option value="push">{t("marketing.campaigns.field.channel.options.push")}</option>
                        </select>
                      </div>
                    )}
                    {selectedNodeKey === "content" && (
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground">
                          {t("marketing.campaigns.builder.settings.content.channel.label")}
                        </label>
                        <div className={`${inputClass} mt-1 flex items-center`}>
                          {formatChannelLabel(getImmediatePreviousChannel(selectedNodeId ?? 0))}
                        </div>
                        {(() => {
                          const channel = getImmediatePreviousChannel(selectedNodeId ?? 0);
                          if (!channel) {
                            return (
                              <p className="mt-2 text-xs text-muted-foreground">
                                {t("marketing.campaigns.builder.settings.content.channel.missing")}
                              </p>
                            );
                          }
                          if (channel !== "email" && channel !== "whatsapp") {
                            return (
                              <p className="mt-2 text-xs text-muted-foreground">
                                {t("marketing.campaigns.builder.settings.content.channel.unsupported")}
                              </p>
                            );
                          }
                          return (
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
                                  if (templateStatus === "idle") {
                                    loadTemplates(channel);
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
                          );
                        })()}
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
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground">
                            {t("marketing.campaigns.builder.settings.condition.sourceChannel.label")}
                          </label>
                          <div className={`${inputClass} mt-1 flex items-center`}>
                            {formatChannelLabel(
                              String(
                                (selectedNodeData?.settings as Record<string, unknown> | undefined)?.sourceChannel ?? ""
                              )
                            )}
                          </div>
                        </div>
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
                          {conditionOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
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
                        <div className="mt-3 grid gap-2">
                          <div>
                            <label className="text-xs font-semibold text-muted-foreground">
                              {t("marketing.campaigns.builder.settings.condition.attribute.label")}
                            </label>
                            <input
                              className={`${inputClass} mt-1`}
                              value={
                                (selectedNodeData?.settings as Record<string, unknown> | undefined)?.conditionAttribute ??
                                ""
                              }
                              onChange={(event) => {
                                const settings =
                                  (selectedNodeData?.settings as Record<string, unknown> | undefined) ?? {};
                                updateSelectedNodeData({
                                  ...selectedNodeData,
                                  key: selectedNodeKey,
                                  settings: { ...settings, conditionAttribute: event.target.value },
                                });
                              }}
                              placeholder={t("marketing.campaigns.builder.settings.condition.attribute.placeholder")}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-muted-foreground">
                              {t("marketing.campaigns.builder.settings.condition.operator.label")}
                            </label>
                            <select
                              className={`${inputClass} mt-1`}
                              value={
                                (selectedNodeData?.settings as Record<string, unknown> | undefined)?.conditionOperator ??
                                ""
                              }
                              onChange={(event) => {
                                const settings =
                                  (selectedNodeData?.settings as Record<string, unknown> | undefined) ?? {};
                                updateSelectedNodeData({
                                  ...selectedNodeData,
                                  key: selectedNodeKey,
                                  settings: { ...settings, conditionOperator: event.target.value },
                                });
                              }}
                            >
                              <option value="">
                                {format(t, "marketing.manager.selectDefault", {
                                  field: t("marketing.campaigns.builder.settings.condition.operator.label").toLowerCase(),
                                })}
                              </option>
                              <option value="equals">
                                {t("marketing.campaigns.builder.settings.condition.operator.equals")}
                              </option>
                              <option value="not_equals">
                                {t("marketing.campaigns.builder.settings.condition.operator.notEquals")}
                              </option>
                              <option value="greater_than">
                                {t("marketing.campaigns.builder.settings.condition.operator.greaterThan")}
                              </option>
                              <option value="less_than">
                                {t("marketing.campaigns.builder.settings.condition.operator.lessThan")}
                              </option>
                              <option value="contains">
                                {t("marketing.campaigns.builder.settings.condition.operator.contains")}
                              </option>
                              <option value="starts_with">
                                {t("marketing.campaigns.builder.settings.condition.operator.startsWith")}
                              </option>
                              <option value="ends_with">
                                {t("marketing.campaigns.builder.settings.condition.operator.endsWith")}
                              </option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-muted-foreground">
                              {t("marketing.campaigns.builder.settings.condition.value.label")}
                            </label>
                            <input
                              className={`${inputClass} mt-1`}
                              value={
                                (selectedNodeData?.settings as Record<string, unknown> | undefined)?.conditionRuleValue ??
                                ""
                              }
                              onChange={(event) => {
                                const settings =
                                  (selectedNodeData?.settings as Record<string, unknown> | undefined) ?? {};
                                updateSelectedNodeData({
                                  ...selectedNodeData,
                                  key: selectedNodeKey,
                                  settings: { ...settings, conditionRuleValue: event.target.value },
                                });
                              }}
                              placeholder={t("marketing.campaigns.builder.settings.condition.value.placeholder")}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    {selectedNodeKey === "delay" && (
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground">
                          {t("marketing.campaigns.builder.settings.wait.type.label")}
                        </label>
                        <select
                          className={`${inputClass} mt-1`}
                          value={(selectedNodeData?.settings as Record<string, unknown> | undefined)?.waitType ?? ""}
                          onChange={(event) => {
                            const settings =
                              (selectedNodeData?.settings as Record<string, unknown> | undefined) ?? {};
                            updateSelectedNodeData({
                              ...selectedNodeData,
                              key: selectedNodeKey,
                              settings: { ...settings, waitType: event.target.value },
                            });
                          }}
                        >
                          <option value="">
                            {format(t, "marketing.manager.selectDefault", {
                              field: t("marketing.campaigns.builder.settings.wait.type.label").toLowerCase(),
                            })}
                          </option>
                          <option value="duration">
                            {t("marketing.campaigns.builder.settings.wait.type.duration")}
                          </option>
                          <option value="datetime">
                            {t("marketing.campaigns.builder.settings.wait.type.datetime")}
                          </option>
                        </select>
                        {(selectedNodeData?.settings as Record<string, unknown> | undefined)?.waitType ===
                          "duration" && (
                          <div className="mt-2 grid gap-2">
                            <div>
                              <label className="text-xs font-semibold text-muted-foreground">
                                {t("marketing.campaigns.builder.settings.wait.duration.value.label")}
                              </label>
                              <input
                                type="number"
                                min="1"
                                className={`${inputClass} mt-1`}
                                value={
                                  (selectedNodeData?.settings as Record<string, unknown> | undefined)?.waitAmount ?? ""
                                }
                                onChange={(event) => {
                                  const settings =
                                    (selectedNodeData?.settings as Record<string, unknown> | undefined) ?? {};
                                  updateSelectedNodeData({
                                    ...selectedNodeData,
                                    key: selectedNodeKey,
                                    settings: { ...settings, waitAmount: event.target.value },
                                  });
                                }}
                                placeholder={t("marketing.campaigns.builder.settings.wait.duration.value.placeholder")}
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-muted-foreground">
                                {t("marketing.campaigns.builder.settings.wait.duration.unit.label")}
                              </label>
                              <select
                                className={`${inputClass} mt-1`}
                                value={
                                  (selectedNodeData?.settings as Record<string, unknown> | undefined)?.waitUnit ?? ""
                                }
                                onChange={(event) => {
                                  const settings =
                                    (selectedNodeData?.settings as Record<string, unknown> | undefined) ?? {};
                                  updateSelectedNodeData({
                                    ...selectedNodeData,
                                    key: selectedNodeKey,
                                    settings: { ...settings, waitUnit: event.target.value },
                                  });
                                }}
                              >
                                <option value="">
                                  {format(t, "marketing.manager.selectDefault", {
                                    field: t("marketing.campaigns.builder.settings.wait.duration.unit.label").toLowerCase(),
                                  })}
                                </option>
                                <option value="minutes">
                                  {t("marketing.campaigns.builder.settings.wait.duration.unit.minutes")}
                                </option>
                                <option value="hours">
                                  {t("marketing.campaigns.builder.settings.wait.duration.unit.hours")}
                                </option>
                                <option value="days">
                                  {t("marketing.campaigns.builder.settings.wait.duration.unit.days")}
                                </option>
                              </select>
                            </div>
                          </div>
                        )}
                        {(selectedNodeData?.settings as Record<string, unknown> | undefined)?.waitType ===
                          "datetime" && (
                          <div className="mt-2">
                            <label className="text-xs font-semibold text-muted-foreground">
                              {t("marketing.campaigns.builder.settings.wait.datetime.label")}
                            </label>
                            <input
                              type="datetime-local"
                              className={`${inputClass} mt-1`}
                              value={
                                (selectedNodeData?.settings as Record<string, unknown> | undefined)?.waitDateTime ?? ""
                              }
                              onChange={(event) => {
                                const settings =
                                  (selectedNodeData?.settings as Record<string, unknown> | undefined) ?? {};
                                updateSelectedNodeData({
                                  ...selectedNodeData,
                                  key: selectedNodeKey,
                                  settings: { ...settings, waitDateTime: event.target.value },
                                });
                              }}
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
          {!config.hideForm && (
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
                  if (field.type === "datetime") {
                    return (
                      <div key={field.key}>
                        <label className="text-xs font-semibold text-muted-foreground">{label}</label>
                        <input
                          type="datetime-local"
                          className={`${inputClass} mt-1`}
                          value={form[field.key] ?? ""}
                          onChange={(e) => updateField(field.key, e.target.value)}
                        />
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
          )}

          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-lg font-semibold">
                {format(t, "marketing.manager.manage", { typePlural: typePluralLabel })}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {items.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {format(t, "marketing.manager.showing", { shown: filtered.length, total: items.length })}
                  </div>
                )}
                {config.itemsApi === "campaigns" && companyId && (
                  <button
                    type="button"
                    className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-foreground hover:border-white/40"
                    onClick={handleNewCampaign}
                  >
                    {t("marketing.campaigns.manager.new")}
                  </button>
                )}
              </div>
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
                      {config.fields.map((f) => {
                        if (f.key === "startsAt") {
                          const raw = String(item[f.key] ?? "");
                          const shouldShow = isScheduledStatus(String(item.status ?? ""));
                          const display =
                            shouldShow && raw && !Number.isNaN(new Date(raw).getTime())
                              ? new Date(raw).toLocaleString()
                              : "-";
                          return (
                            <td key={f.key} className="px-3 py-2 text-muted-foreground">
                              {display}
                            </td>
                          );
                        }
                        return (
                          <td key={f.key} className="px-3 py-2 text-muted-foreground">
                            {f.type === "select" ? resolveOptionLabel(f, item[f.key]) : item[f.key] || "-"}
                          </td>
                        );
                      })}
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
                          {config.itemsApi === "campaigns" && (
                            <button
                              className="rounded-full border border-white/10 px-2 py-1 text-xs hover:border-white/40"
                              onClick={() => handleEditCampaign(item)}
                            >
                              {t("marketing.campaigns.manager.edit")}
                            </button>
                          )}
                          {config.itemsApi === "campaigns" && (
                            <button
                              className="rounded-full border border-white/10 px-2 py-1 text-xs hover:border-white/40"
                              onClick={() => handleViewPerformance(item)}
                            >
                              {t("marketing.campaigns.manager.performance")}
                            </button>
                          )}
                          {statuses
                            .filter((s) => s.key !== item.status)
                            .slice(0, 2)
                            .map((s) => (
                              <button
                                key={s.key}
                                className="rounded-full border border-white/10 px-2 py-1 text-xs hover:border-white/40 disabled:opacity-50"
                                onClick={() => void setItemStatus(item.id, s.key)}
                                disabled={savingId === item.id}
                              >
                                {format(t, "marketing.manager.set", { status: s.label })}
                              </button>
                            ))}
                          <button
                            className="rounded-full border border-red-300/30 px-2 py-1 text-xs text-red-200 hover:border-red-300/60"
                            onClick={() => void deleteItem(item.id)}
                            disabled={deletingId === item.id}
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

      {scheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className={`w-full max-w-sm rounded-xl ${theme.cardBg} ${theme.cardBorder} p-5`}>
            <div className="text-lg font-semibold">{t("marketing.status.scheduled")}</div>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("marketing.campaigns.builder.settings.wait.datetime.label")}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <input
                type="date"
                className={`${inputClass}`}
                value={scheduleModal.date}
                onChange={(event) =>
                  setScheduleModal((prev) => (prev ? { ...prev, date: event.target.value } : prev))
                }
              />
              <input
                type="time"
                className={`${inputClass}`}
                value={scheduleModal.time}
                onChange={(event) =>
                  setScheduleModal((prev) => (prev ? { ...prev, time: event.target.value } : prev))
                }
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-foreground hover:border-white/40"
                onClick={() => setScheduleModal(null)}
                disabled={savingId === scheduleModal.id}
              >
                {t("marketing.manager.cancel")}
              </button>
              <button
                type="button"
                className="rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
                onClick={() => void confirmSchedule()}
                disabled={savingId === scheduleModal.id}
              >
                {savingId === scheduleModal.id ? t("marketing.manager.saving") : t("marketing.manager.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
