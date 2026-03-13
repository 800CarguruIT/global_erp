"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LeadsTable } from "../components/leads/LeadsTable";
import { MainPageShell } from "./MainPageShell";
import { useI18n } from "../i18n";
import { Card } from "../components/Card";

export type LeadsMainProps = {
  companyId: string;
  companyName?: string;
  initialTab?: "all" | "rsa" | "recovery" | "workshop" | "closed";
  initialStatus?: string;
  initialAssignedOnly?: boolean;
};

type SortKey =
  | "lead"
  | "customer"
  | "car"
  | "status"
  | "source"
  | "branch"
  | "agent"
  | "service"
  | "health"
  | "created";

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

function normalize(value: string | number | null | undefined) {
  return (value ?? "").toString().trim().toLowerCase();
}

function extractEmbedSrc(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes("<iframe")) {
    const match = trimmed.match(/src=["']([^"']+)["']/i);
    return match?.[1] ?? null;
  }
  return trimmed;
}

function buildSearchEmbedUrl(query?: string | null) {
  const q = String(query ?? "").trim();
  if (!q) return "https://www.google.com/maps?q=24.4539,54.3773&z=11&output=embed";
  return `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
}

function buildCoordinateEmbedUrl(center?: string | null) {
  const c = String(center ?? "").trim();
  if (!/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(c)) return null;
  return `https://www.google.com/maps?q=${encodeURIComponent(`loc:${c}`)}&z=17&output=embed`;
}

function buildGoogleEmbedUrl(apiKey: string, opts: { placeId?: string; query?: string }) {
  if (opts.placeId) {
    return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(apiKey)}&q=place_id:${encodeURIComponent(opts.placeId)}`;
  }
  if (opts.query) {
    return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(opts.query)}`;
  }
  return null;
}

function extractUrlFromMapInput(rawInput: string): string {
  const raw = String(rawInput ?? "").trim();
  if (!raw) return "";
  if (raw.toLowerCase().includes("<iframe")) {
    const srcMatch = raw.match(/src=["']([^"']+)["']/i);
    return String(srcMatch?.[1] ?? "").trim();
  }
  return raw;
}

function isGoogleShortMapUrl(rawInput: string): boolean {
  const raw = extractUrlFromMapInput(rawInput);
  if (!raw) return false;
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase();
    return host === "maps.app.goo.gl" || host === "goo.gl";
  } catch {
    return false;
  }
}

function tryParseGoogleMapsUrl(rawInput: string): { embedUrl: string | null; label: string } {
  const raw = extractUrlFromMapInput(rawInput);
  if (!raw) return { embedUrl: null, label: "" };
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase();
    const isGoogleMapHost =
      host.includes("google.com") || host.includes("google.") || host.includes("maps.app.goo.gl") || host.includes("goo.gl");
    if (!isGoogleMapHost) return { embedUrl: null, label: "" };

    const qParam =
      parsed.searchParams.get("q") ||
      parsed.searchParams.get("query") ||
      parsed.searchParams.get("destination") ||
      parsed.searchParams.get("daddr") ||
      "";
    const llParam = parsed.searchParams.get("ll") || "";
    const pbParam = parsed.searchParams.get("pb") || "";
    const placePathMatch = parsed.pathname.match(/\/place\/([^/]+)/i);
    const latLngMatch = `${parsed.pathname}${parsed.search}`.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    const pbLatLngMatch = pbParam.match(/!2d(-?\d+(?:\.\d+)?)!3d(-?\d+(?:\.\d+)?)/);
    const label = decodeURIComponent((qParam || placePathMatch?.[1] || "").replace(/\+/g, " ")).trim();
    if (label) return { embedUrl: buildSearchEmbedUrl(label), label };
    if (llParam) return { embedUrl: buildCoordinateEmbedUrl(llParam) ?? buildSearchEmbedUrl(llParam), label: llParam };
    if (latLngMatch) {
      const center = `${latLngMatch[1]},${latLngMatch[2]}`;
      return { embedUrl: buildCoordinateEmbedUrl(center) ?? buildSearchEmbedUrl(center), label: center };
    }
    if (pbLatLngMatch?.[1] && pbLatLngMatch?.[2]) {
      // pb packs longitude as !2d and latitude as !3d
      const center = `${pbLatLngMatch[2]},${pbLatLngMatch[1]}`;
      return { embedUrl: buildCoordinateEmbedUrl(center) ?? buildSearchEmbedUrl(center), label: center };
    }
    return { embedUrl: null, label: "" };
  } catch {
    return { embedUrl: null, label: "" };
  }
}

export function LeadsMain({
  companyId,
  companyName,
  initialTab = "all",
  initialStatus,
  initialAssignedOnly = false,
}: LeadsMainProps) {
  const { t } = useI18n();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "rsa" | "recovery" | "workshop" | "closed">(initialTab);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [bulkWorking, setBulkWorking] = useState(false);
  const [assignLeadId, setAssignLeadId] = useState<string | null>(null);
  const [assignLeadType, setAssignLeadType] = useState<"rsa" | "recovery" | "workshop" | null>(null);
  const [assignBranchId, setAssignBranchId] = useState<string | null>(null);
  const [assignUserId, setAssignUserId] = useState<string | null>(null);
  const [assignBranches, setAssignBranches] = useState<any[]>([]);
  const [assignUsers, setAssignUsers] = useState<any[]>([]);
  const [assignServiceType, setAssignServiceType] = useState<string>("");
  const [assignRecoveryDirection, setAssignRecoveryDirection] = useState<"pickup" | "dropoff" | "">("");
  const [assignRecoveryFlow, setAssignRecoveryFlow] = useState<
    "customer_to_branch" | "customer_to_customer" | "branch_to_branch" | "branch_to_customer" | ""
  >("");
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState<string | null>(null);
  const [mapsReady, setMapsReady] = useState(false);
  const [assignLocationText, setAssignLocationText] = useState("");
  const [assignLocationSearch, setAssignLocationSearch] = useState("");
  const [assignGoogleLocation, setAssignGoogleLocation] = useState("");
  const [assignLocationSuggestions, setAssignLocationSuggestions] = useState<Array<{ placeId: string; label: string }>>([]);
  const [assignLocationSuggestionsOpen, setAssignLocationSuggestionsOpen] = useState(false);
  const assignLocationSearchRef = useRef<HTMLInputElement | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);
  const [requestRecoveryLead, setRequestRecoveryLead] = useState<any | null>(null);
  const [requestRecoverySaving, setRequestRecoverySaving] = useState(false);
  const [requestRecoveryError, setRequestRecoveryError] = useState<string | null>(null);
  const [requestPickupLocationText, setRequestPickupLocationText] = useState("");
  const [requestPickupLocationSearch, setRequestPickupLocationSearch] = useState("");
  const [requestPickupGoogleLocation, setRequestPickupGoogleLocation] = useState("");
  const [requestPickupMapUrlInput, setRequestPickupMapUrlInput] = useState("");
  const [requestPickupMapUrlParsing, setRequestPickupMapUrlParsing] = useState(false);
  const [requestPickupSuggestions, setRequestPickupSuggestions] = useState<Array<{ placeId: string; label: string }>>([]);
  const [requestPickupSuggestionsOpen, setRequestPickupSuggestionsOpen] = useState(false);
  const [requestDropoffLocationText, setRequestDropoffLocationText] = useState("");
  const [requestDropoffLocationSearch, setRequestDropoffLocationSearch] = useState("");
  const [requestDropoffGoogleLocation, setRequestDropoffGoogleLocation] = useState("");
  const [requestDropoffMapUrlInput, setRequestDropoffMapUrlInput] = useState("");
  const [requestDropoffMapUrlParsing, setRequestDropoffMapUrlParsing] = useState(false);
  const [requestDropoffSuggestions, setRequestDropoffSuggestions] = useState<Array<{ placeId: string; label: string }>>([]);
  const [requestDropoffSuggestionsOpen, setRequestDropoffSuggestionsOpen] = useState(false);
  const [requestRecoveryScheduledAt, setRequestRecoveryScheduledAt] = useState("");
  const [requestRecoveryRemarks, setRequestRecoveryRemarks] = useState("");
  const requestPickupSearchRef = useRef<HTMLInputElement | null>(null);
  const requestDropoffSearchRef = useRef<HTMLInputElement | null>(null);
  const requestPickupDropdownRef = useRef<HTMLDivElement | null>(null);
  const requestDropoffDropdownRef = useRef<HTMLDivElement | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiAppreciation, setAiAppreciation] = useState<string | null>(null);

  function normalizeList(value: unknown): string[] {
    if (Array.isArray(value)) return value.map((v) => String(v ?? "").trim().toLowerCase()).filter(Boolean);
    if (typeof value === "string") {
      return value
        .split(",")
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean);
    }
    return [];
  }

  const refreshLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/company/${companyId}/sales/leads`);
      if (!res.ok) throw new Error("Failed to load leads");
      const data = await res.json();
      setLeads(data.data ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    refreshLeads();
  }, [refreshLeads]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/company/${companyId}/profile`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        const company = data?.data?.company ?? data?.data ?? data;
        if (active) setGoogleMapsApiKey(company?.googleMapsApiKey ?? null);
      } catch {
        if (active) setGoogleMapsApiKey(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [companyId]);

  useEffect(() => {
    const needsPlaces =
      (Boolean(assignLeadId) && assignLeadType === "rsa") || Boolean(requestRecoveryLead);
    if (!googleMapsApiKey || typeof window === "undefined" || !needsPlaces) return;
    const existing = document.querySelector("script[data-google-maps='leads-assign-places']");
    if (existing) {
      if ((window as any).google?.maps?.places) setMapsReady(true);
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(googleMapsApiKey)}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.setAttribute("data-google-maps", "leads-assign-places");
    script.onload = () => setMapsReady(true);
    script.onerror = () => setMapsReady(false);
    document.head.appendChild(script);
  }, [googleMapsApiKey, assignLeadId, assignLeadType, requestRecoveryLead]);

  useEffect(() => {
    if (!mapsReady || !googleMapsApiKey || !assignLeadId || assignLeadType !== "rsa") return;
    const term = assignLocationSearch.trim();
    if (term.length < 2) {
      setAssignLocationSuggestions([]);
      return;
    }
    const google = (window as any).google;
    const service = google?.maps?.places ? new google.maps.places.AutocompleteService() : null;
    if (!service) return;
    const timer = window.setTimeout(() => {
      service.getPlacePredictions(
        { input: term },
        (predictions: Array<{ place_id?: string; description?: string }> | null, status: string) => {
          if (status !== "OK" || !Array.isArray(predictions)) {
            setAssignLocationSuggestions([]);
            return;
          }
          setAssignLocationSuggestions(
            predictions
              .map((p) => ({ placeId: String(p.place_id ?? "").trim(), label: String(p.description ?? "").trim() }))
              .filter((p) => p.placeId && p.label)
              .slice(0, 6)
          );
          setAssignLocationSuggestionsOpen(true);
        }
      );
    }, 220);
    return () => window.clearTimeout(timer);
  }, [mapsReady, googleMapsApiKey, assignLeadId, assignLeadType, assignLocationSearch]);

  useEffect(() => {
    if (!mapsReady || !googleMapsApiKey || !requestRecoveryLead) return;
    const term = requestPickupLocationSearch.trim();
    if (term.length < 2) {
      setRequestPickupSuggestions([]);
      return;
    }
    const google = (window as any).google;
    const service = google?.maps?.places ? new google.maps.places.AutocompleteService() : null;
    if (!service) return;
    const timer = window.setTimeout(() => {
      service.getPlacePredictions(
        { input: term },
        (predictions: Array<{ place_id?: string; description?: string }> | null, status: string) => {
          if (status !== "OK" || !Array.isArray(predictions)) {
            setRequestPickupSuggestions([]);
            return;
          }
          setRequestPickupSuggestions(
            predictions
              .map((p) => ({ placeId: String(p.place_id ?? "").trim(), label: String(p.description ?? "").trim() }))
              .filter((p) => p.placeId && p.label)
              .slice(0, 6)
          );
          setRequestPickupSuggestionsOpen(true);
        }
      );
    }, 220);
    return () => window.clearTimeout(timer);
  }, [mapsReady, googleMapsApiKey, requestRecoveryLead, requestPickupLocationSearch]);

  useEffect(() => {
    if (!mapsReady || !googleMapsApiKey || !requestRecoveryLead) return;
    const term = requestDropoffLocationSearch.trim();
    if (term.length < 2) {
      setRequestDropoffSuggestions([]);
      return;
    }
    const google = (window as any).google;
    const service = google?.maps?.places ? new google.maps.places.AutocompleteService() : null;
    if (!service) return;
    const timer = window.setTimeout(() => {
      service.getPlacePredictions(
        { input: term },
        (predictions: Array<{ place_id?: string; description?: string }> | null, status: string) => {
          if (status !== "OK" || !Array.isArray(predictions)) {
            setRequestDropoffSuggestions([]);
            return;
          }
          setRequestDropoffSuggestions(
            predictions
              .map((p) => ({ placeId: String(p.place_id ?? "").trim(), label: String(p.description ?? "").trim() }))
              .filter((p) => p.placeId && p.label)
              .slice(0, 6)
          );
          setRequestDropoffSuggestionsOpen(true);
        }
      );
    }, 220);
    return () => window.clearTimeout(timer);
  }, [mapsReady, googleMapsApiKey, requestRecoveryLead, requestDropoffLocationSearch]);

  useEffect(() => {
    if (!requestRecoveryLead) return;
    const onDocMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (
        requestPickupDropdownRef.current &&
        !requestPickupDropdownRef.current.contains(target)
      ) {
        setRequestPickupSuggestionsOpen(false);
      }
      if (
        requestDropoffDropdownRef.current &&
        !requestDropoffDropdownRef.current.contains(target)
      ) {
        setRequestDropoffSuggestionsOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [requestRecoveryLead]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const filteredLeads = useMemo(() => {
    const term = normalize(query);
    const isClosedLead = (lead: any) => {
      const status = String(lead?.leadStatus ?? "").trim().toLowerCase();
      const stage = String(lead?.leadStage ?? "").trim().toLowerCase();
      return (
        status === "closed" ||
        status === "closed_won" ||
        status === "done" ||
        status === "completed" ||
        stage === "closed"
      );
    };
    const isRsaDoneLead = (lead: any) => {
      if (String(lead?.leadType ?? "").trim().toLowerCase() !== "rsa") return false;
      const status = String(lead?.leadStatus ?? "").trim().toLowerCase();
      const stage = String(lead?.leadStage ?? "").trim().toLowerCase();
      return (
        status === "done" ||
        status === "closed" ||
        status === "closed_won" ||
        status === "completed" ||
        stage === "completed" ||
        stage === "post_service_signed" ||
        stage === "closed"
      );
    };
    let rows = tab === "all" ? leads : tab === "closed" ? leads.filter((l) => isClosedLead(l)) : leads.filter((l) => l.leadType === tab);
    if (tab === "rsa") {
      rows = rows.filter((l) => !isRsaDoneLead(l));
    }
    if (initialStatus) {
      const expected = initialStatus.trim().toLowerCase();
      rows = rows.filter((l) => String(l?.leadStatus ?? "").trim().toLowerCase() === expected);
    }
    if (initialAssignedOnly) {
      rows = rows.filter((l) => {
        const stage = String(l?.leadStage ?? "")
          .trim()
          .toLowerCase();
        const stageLooksAssigned =
          stage === "assigned" ||
          stage === "dispatched" ||
          stage === "enroute" ||
          stage === "processing" ||
          stage === "car_in";
        return Boolean(
          l?.assignedUserId ??
            l?.agentEmployeeId ??
            l?.branchId ??
            l?.assignedAt ??
            stageLooksAssigned
        );
      });
    }

    if (!term) return rows;

    return rows.filter((lead) => {
      const haystack = [
        lead.id,
        lead.customerName,
        lead.customerPhone,
        lead.customerEmail,
        lead.carPlateNumber,
        lead.carModel,
        lead.leadType,
        lead.leadStage,
        lead.leadStatus,
        lead.source,
        lead.branchId,
        lead.agentName,
        lead.serviceType,
        lead.healthScore,
      ]
        .map(normalize)
        .join(" ");
      return haystack.includes(term);
    });
  }, [leads, query, tab, initialStatus, initialAssignedOnly]);

  const sortedLeads = useMemo(() => {
    const rows = [...filteredLeads];
    rows.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "lead":
          return dir * collator.compare(normalize(a.id), normalize(b.id));
        case "customer":
          return dir * collator.compare(normalize(a.customerName), normalize(b.customerName));
        case "car":
          return dir * collator.compare(normalize(a.carPlateNumber), normalize(b.carPlateNumber));
        case "status":
          return dir * collator.compare(normalize(a.leadStatus), normalize(b.leadStatus));
        case "source":
          return dir * collator.compare(normalize(a.source), normalize(b.source));
        case "branch":
          return dir * collator.compare(normalize(a.branchId), normalize(b.branchId));
        case "agent":
          return dir * collator.compare(normalize(a.agentName), normalize(b.agentName));
        case "service":
          return dir * collator.compare(normalize(a.serviceType), normalize(b.serviceType));
        case "health": {
          const diff = Number(a.healthScore ?? 0) - Number(b.healthScore ?? 0);
          return dir * diff;
        }
        case "created": {
          const left = new Date(a.createdAt ?? 0).getTime();
          const right = new Date(b.createdAt ?? 0).getTime();
          return dir * (left - right);
        }
        default:
          return 0;
      }
    });
    return rows;
  }, [filteredLeads, sortDir, sortKey]);

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(sortedLeads.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedLeads = sortedLeads.slice((safePage - 1) * pageSize, safePage * pageSize);
  const tabs = useMemo(
    () =>
      [
        { key: "all", label: t("leads.tab.all") ?? "All" },
        { key: "rsa", label: t("leads.tab.rsa") ?? "RSA" },
        { key: "recovery", label: t("leads.tab.recovery") ?? "Recovery" },
        { key: "workshop", label: t("leads.tab.workshop") ?? "Workshop" },
        { key: "closed", label: t("leads.tab.closed") ?? "Closed" },
      ] as const,
    [t]
  );

  function toggleSelect(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function bulkAction(action: "archive" | "delete") {
    if (selected.size === 0) return;
    setBulkWorking(true);
    setBulkMessage(null);
    try {
      const ids = Array.from(selected);
      const res = await fetch(`/api/company/${companyId}/sales/leads`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Failed");
      }
      setLeads((prev) => prev.filter((l) => !selected.has(l.id)));
      setSelected(new Set());
      setBulkMessage(
        `${action === "archive" ? t("leads.bulk.archived") ?? "Archived" : t("leads.bulk.deleted") ?? "Deleted"} ${
          ids.length
        }`
      );
    } catch (err: any) {
      setBulkMessage(err?.message ?? t("leads.bulk.failed") ?? "Bulk action failed.");
    } finally {
      setBulkWorking(false);
    }
  }

  const counts = useMemo(() => {
    const map: Record<string, number> = {
      open: 0,
      assigned: 0,
      onboarding: 0,
      inprocess: 0,
      completed: 0,
      closed: 0,
      lost: 0,
    };
    leads.forEach((l) => {
      map[l.status] = (map[l.status] ?? 0) + 1;
    });
    return map;
  }, [leads]);

  useEffect(() => {
    const suggestions: string[] = [];
    if (counts.open > 5 || counts.assigned > 5) suggestions.push(t("leads.ai.actions.backlog"));
    if (counts.assigned > 0 && counts.open === 0) suggestions.push(t("leads.ai.actions.assigned"));
    if ((counts.onboarding ?? 0) + (counts.inprocess ?? 0) > 0) suggestions.push(t("leads.ai.actions.stalled"));
    if (counts.lost > 0) suggestions.push(t("leads.ai.actions.lost"));
    setAiSuggestions(suggestions);

    if ((counts.completed ?? 0) + (counts.closed ?? 0) > 0) {
      setAiAppreciation(t("leads.ai.appreciation.closed").replace("{count}", String((counts.completed ?? 0) + (counts.closed ?? 0))));
    } else if (counts.assigned > 0) {
      setAiAppreciation(t("leads.ai.appreciation.assigned").replace("{count}", String(counts.assigned)));
    } else {
      setAiAppreciation(t("leads.ai.appreciation.empty"));
    }
  }, [counts, t]);

  function toggleSort(nextKey: SortKey) {
    if (nextKey === sortKey) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDir("asc");
  }

  const sortLabel = sortDir === "asc" ? "ASC" : "DESC";

  async function openAssign(leadId: string, lead?: any) {
    setAssignLeadId(leadId);
    const lt = (lead?.leadType as "rsa" | "recovery" | "workshop" | undefined) ?? null;
    if (
      lt === "workshop" &&
      lead?.leadStage !== "inspection_queue" &&
      lead?.leadStage !== "checkin"
    ) {
      setAssignError(t("leads.assign.onlyInspection") ?? "Only inspection leads can be assigned to branches.");
      setAssignLeadId(null);
      return;
    }
    setAssignLeadType(lt);
    setAssignServiceType(lead?.serviceType ?? "");
    setAssignRecoveryDirection((lead?.recoveryDirection as any) ?? (lt === "recovery" ? "pickup" : ""));
    setAssignRecoveryFlow((lead?.recoveryFlow as any) ?? (lt === "recovery" ? "customer_to_branch" : ""));
    setAssignLocationText(String(lead?.pickupFrom ?? ""));
    setAssignGoogleLocation(extractEmbedSrc(String(lead?.pickupGoogleLocation ?? "")) ?? "");
    setAssignLocationSearch(String(lead?.pickupFrom ?? ""));
    setAssignError(null);
    setAssignSuccess(null);
    setAssignBranches([]);
    setAssignUsers([]);
    setAssignBranchId(null);
    setAssignUserId(null);
    if (lt === "rsa") {
      try {
        const res = await fetch(`/api/company/${companyId}/admin/users`);
        if (!res.ok) throw new Error(t("leads.assign.loadUsers") ?? "Failed to load users");
        const data = await res.json();
        setAssignUsers(data.data ?? data ?? []);
      } catch (err: any) {
        setAssignError(err?.message ?? t("leads.assign.loadUsers") ?? "Failed to load users");
      }
    }
    try {
      const res = await fetch(`/api/company/${companyId}/branches`);
      if (!res.ok) throw new Error(t("leads.assign.loadBranches") ?? "Failed to load branches");
      const data = await res.json();
      const list = data.data ?? data.branches ?? [];
      const filtered = list.filter((b: any) => {
        const rawTypes = b.branch_types ?? b.branchTypes ?? [];
        const rawServices = b.service_types ?? b.serviceTypes ?? [];
        const types = normalizeList(rawTypes);
        const services = normalizeList(rawServices);
        if (lt === "recovery") {
          const base =
            types.includes("recovery") ||
            services.some((s: string) =>
              [
                "recovery",
                "any",
                "regular",
                "flatbed",
                "covered",
                "recovery_regular",
                "recovery_flatbed",
                "recovery_covered",
              ].includes(`${s}`.toLowerCase())
            );
          if (!base) return false;
          if (assignServiceType) {
            return services.length === 0 || services.includes(assignServiceType.toLowerCase());
          }
          return true;
        }
        if (lt === "workshop") {
          const typesOk = types.includes("workshop");
          const servicesOk = services.some((s: string) => `${s}`.toLowerCase() === "workshop");
          return typesOk || servicesOk || services.length === 0;
        }
        // default RSA
        if (!(types.includes("rsa") || services.length > 0 || (types.length === 0 && services.length === 0))) return false;
        if (assignServiceType) {
          return services.length === 0 || services.includes(assignServiceType.toLowerCase());
        }
        return true;
      });
      // Fallback: if branch metadata is incomplete, show all branches instead of empty dropdown.
      setAssignBranches(filtered.length > 0 ? filtered : list);
    } catch (err: any) {
      setAssignError(err?.message ?? t("leads.assign.loadBranches") ?? "Failed to load branches");
    }
  }

  async function loadAssignUsers(branchId: string) {
    setAssignUsers([]);
    try {
      const res = await fetch(`/api/company/${companyId}/admin/users?branchId=${branchId}`);
      if (!res.ok) throw new Error(t("leads.assign.loadUsers") ?? "Failed to load users");
      const data = await res.json();
      setAssignUsers(data.data ?? data ?? []);
    } catch (err: any) {
      setAssignError(err?.message ?? t("leads.assign.loadUsers") ?? "Failed to load users");
    }
  }

  async function assignLead() {
    if (!assignLeadId) return;
    if (assignLeadType !== "rsa" && !assignBranchId) return;
    if (assignLeadType === "recovery" && (!assignRecoveryDirection || !assignRecoveryFlow)) return;
    if ((assignLeadType === "rsa" || assignLeadType === "workshop") && !assignUserId && assignLeadType !== "workshop") return;
    setAssignLoading(true);
    setAssignError(null);
    setAssignSuccess(null);
    try {
      const currentLead = leads.find((l) => l.id === assignLeadId);
      const res = await fetch(`/api/company/${companyId}/sales/leads/${assignLeadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: assignLeadType === "rsa" ? null : assignBranchId,
          assignedUserId: assignLeadType === "workshop" ? null : assignUserId,
          serviceType: assignServiceType || (currentLead?.serviceType as any) || null,
          leadStage: assignLeadType === "workshop" ? currentLead?.leadStage ?? "assigned" : "assigned",
          recoveryDirection: assignLeadType === "recovery" ? assignRecoveryDirection : undefined,
          recoveryFlow: assignLeadType === "recovery" ? assignRecoveryFlow : undefined,
          pickupFrom: assignLeadType === "rsa" ? (assignLocationText.trim() || null) : undefined,
          pickupGoogleLocation:
            assignLeadType === "rsa"
              ? (assignGoogleLocation.trim() || buildSearchEmbedUrl(assignLocationText) || null)
              : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to assign lead");
      }
      const assignedUserLabel =
        assignLeadType === "workshop"
          ? null
          : assignUsers.find((u) => String(u?.id ?? "") === String(assignUserId ?? ""))?.full_name ??
            assignUsers.find((u) => String(u?.id ?? "") === String(assignUserId ?? ""))?.email ??
            null;
      const assignedBranchLabel =
        assignBranches.find((b) => String(b?.id ?? "") === String(assignBranchId ?? ""))?.display_name ??
        assignBranches.find((b) => String(b?.id ?? "") === String(assignBranchId ?? ""))?.name ??
        null;
      if (assignedUserLabel) {
        setAssignSuccess(`Lead assigned to ${assignedUserLabel}`);
      } else if (assignedBranchLabel) {
        setAssignSuccess(`Lead assigned to ${assignedBranchLabel}`);
      } else {
        setAssignSuccess(t("leads.assign.success") ?? "Lead assigned");
      }
      // refresh leads
      const refreshed = await fetch(`/api/company/${companyId}/sales/leads`);
      if (refreshed.ok) {
        const data = await refreshed.json();
        setLeads(data.data ?? []);
      }
    } catch (err: any) {
      setAssignError(err?.message ?? t("leads.assign.error") ?? "Failed to assign lead");
    } finally {
      setAssignLoading(false);
    }
  }

  async function moveLeadToCarIn(leadId: string, lead?: any) {
    try {
      const res = await fetch(`/api/company/${companyId}/sales/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "car_in",
          leadStage: "checkin",
          ensureInspection: true,
          branchId: lead?.branchId ?? null,
          assignedUserId: lead?.assignedUserId ?? null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(data?.error ?? "Failed to set Car In"));
      }
      setBulkMessage("Lead moved to Car In.");
      await refreshLeads();
    } catch (err: any) {
      setBulkMessage(err?.message ?? "Failed to set Car In.");
    }
  }

  async function requestRecoveryForLead(leadId: string, lead?: any) {
    const nextLead = lead ?? leads.find((l) => l.id === leadId) ?? null;
    const pickupDefault =
      String(nextLead?.pickupFrom ?? "").trim() ||
      [String(nextLead?.customerName ?? "").trim(), String(nextLead?.customerPhone ?? "").trim()]
        .filter(Boolean)
        .join(" - ");
    const dropoffDefault = String(nextLead?.dropoffTo ?? "").trim();
    setRequestRecoveryLead(nextLead);
    setRequestRecoveryError(null);
    setRequestPickupLocationText(pickupDefault);
    setRequestPickupLocationSearch(pickupDefault);
    setRequestPickupGoogleLocation(extractEmbedSrc(String(nextLead?.pickupGoogleLocation ?? "")) ?? "");
    setRequestPickupMapUrlInput(extractEmbedSrc(String(nextLead?.pickupGoogleLocation ?? "")) ?? "");
    setRequestPickupSuggestions([]);
    setRequestPickupSuggestionsOpen(false);
    setRequestDropoffLocationText(dropoffDefault);
    setRequestDropoffLocationSearch(dropoffDefault);
    setRequestDropoffGoogleLocation(extractEmbedSrc(String(nextLead?.dropoffGoogleLocation ?? "")) ?? "");
    setRequestDropoffMapUrlInput(extractEmbedSrc(String(nextLead?.dropoffGoogleLocation ?? "")) ?? "");
    setRequestDropoffSuggestions([]);
    setRequestDropoffSuggestionsOpen(false);
    setRequestRecoveryScheduledAt("");
    setRequestRecoveryRemarks("");
    setRequestPickupMapUrlParsing(false);
    setRequestDropoffMapUrlParsing(false);
  }

  async function submitRecoveryRequest() {
    if (!requestRecoveryLead?.id) return;
    const pickupLocation = requestPickupLocationText.trim();
    const dropoffLocation = requestDropoffLocationText.trim();
    const scheduledAt = requestRecoveryScheduledAt.trim();
    const remarks = requestRecoveryRemarks.trim();
    if (!pickupLocation || !dropoffLocation || !scheduledAt) {
      setRequestRecoveryError("Pickup, dropoff, and date/time are required.");
      return;
    }

    setRequestRecoverySaving(true);
    setRequestRecoveryError(null);
    setBulkMessage(null);
    try {
      const recoveryLeadRes = await fetch(`/api/company/${companyId}/sales/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: requestRecoveryLead.customerId ?? null,
          leadType: "recovery",
          division: "recovery",
          serviceType: requestRecoveryLead.serviceType ?? "recovery",
          recoveryDirection: "pickup",
          recoveryFlow: "customer_to_branch",
          pickupFrom: pickupLocation,
          pickupGoogleLocation:
            requestPickupGoogleLocation.trim() || buildSearchEmbedUrl(pickupLocation) || null,
          dropoffTo: dropoffLocation,
          dropoffGoogleLocation:
            requestDropoffGoogleLocation.trim() || buildSearchEmbedUrl(dropoffLocation) || null,
          source: "rsa_recovery_request",
          car: requestRecoveryLead.carId
            ? { id: requestRecoveryLead.carId }
            : undefined,
          agentRemarks: `Recovery requested from RSA lead ${String(requestRecoveryLead.id).slice(0, 8)}.`,
        }),
      });
      const recoveryLeadJson = await recoveryLeadRes.json().catch(() => ({}));
      if (!recoveryLeadRes.ok) {
        throw new Error(String(recoveryLeadJson?.error ?? "Failed to create recovery lead"));
      }
      const newRecoveryLeadId = String(recoveryLeadJson?.data?.id ?? "").trim();
      if (!newRecoveryLeadId) {
        throw new Error("Recovery lead created without id.");
      }

      const requestRes = await fetch(`/api/company/${companyId}/recovery-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: newRecoveryLeadId,
          type: "dropoff",
          pickupLocation,
          dropoffLocation,
          scheduledAt,
          remarks: remarks || null,
        }),
      });
      const data = await requestRes.json().catch(() => ({}));
      if (!requestRes.ok) {
        throw new Error(String(data?.error ?? "Failed to create recovery request"));
      }

      setBulkMessage(`Recovery lead created and request submitted (${newRecoveryLeadId.slice(0, 8)}).`);
      setRequestRecoveryLead(null);
      await refreshLeads();
    } catch (err: any) {
      setRequestRecoveryError(err?.message ?? "Failed to create recovery request.");
    } finally {
      setRequestRecoverySaving(false);
    }
  }

  async function resolveMapUrl(input: string): Promise<{ url: string; label: string; center: string }> {
    const res = await fetch(
      `/api/company/${companyId}/maps/resolve?url=${encodeURIComponent(input)}`,
      { cache: "no-store" }
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(String(json?.error ?? "Failed to resolve map URL"));
    }
    return {
      url: String(json?.data?.url ?? "").trim() || input,
      label: String(json?.data?.label ?? "").trim(),
      center: String(json?.data?.center ?? "").trim(),
    };
  }

  function resetRecoveryRequest() {
    setRequestRecoveryLead(null);
    setRequestRecoverySaving(false);
    setRequestRecoveryError(null);
    setRequestPickupLocationText("");
    setRequestPickupLocationSearch("");
    setRequestPickupGoogleLocation("");
    setRequestPickupMapUrlInput("");
    setRequestPickupSuggestions([]);
    setRequestPickupSuggestionsOpen(false);
    setRequestDropoffLocationText("");
    setRequestDropoffLocationSearch("");
    setRequestDropoffGoogleLocation("");
    setRequestDropoffMapUrlInput("");
    setRequestDropoffSuggestions([]);
    setRequestDropoffSuggestionsOpen(false);
    setRequestRecoveryScheduledAt("");
    setRequestRecoveryRemarks("");
  }

  function resetAssign() {
    setAssignLeadId(null);
    setAssignLeadType(null);
    setAssignBranchId(null);
    setAssignUserId(null);
    setAssignBranches([]);
    setAssignUsers([]);
    setAssignError(null);
    setAssignSuccess(null);
    setAssignRecoveryDirection("");
    setAssignRecoveryFlow("");
    setAssignLocationText("");
    setAssignLocationSearch("");
    setAssignGoogleLocation("");
    setAssignLocationSuggestions([]);
    setAssignLocationSuggestionsOpen(false);
  }

  useEffect(() => {
    setPage(1);
  }, [query, tab, sortKey, sortDir]);

  const assignMapPreviewSrc = useMemo(() => {
    const savedSrc = extractEmbedSrc(assignGoogleLocation);
    if (savedSrc) return savedSrc;
    return buildSearchEmbedUrl(assignLocationSearch || assignLocationText);
  }, [assignGoogleLocation, assignLocationSearch, assignLocationText]);

  const requestPickupMapPreviewSrc = useMemo(() => {
    const savedSrc = extractEmbedSrc(requestPickupGoogleLocation);
    if (savedSrc) return savedSrc;
    return buildSearchEmbedUrl(requestPickupLocationSearch || requestPickupLocationText);
  }, [requestPickupGoogleLocation, requestPickupLocationSearch, requestPickupLocationText]);

  const requestDropoffMapPreviewSrc = useMemo(() => {
    const savedSrc = extractEmbedSrc(requestDropoffGoogleLocation);
    if (savedSrc) return savedSrc;
    return buildSearchEmbedUrl(requestDropoffLocationSearch || requestDropoffLocationText);
  }, [requestDropoffGoogleLocation, requestDropoffLocationSearch, requestDropoffLocationText]);

  return (
    <MainPageShell
      title={companyName ? t("leads.company.title") ?? t("leads.title") : t("leads.title")}
      subtitle={companyName ? t("leads.company.subtitle") ?? t("leads.subtitle") : t("leads.subtitle")}
      scopeLabel={companyName ? `${t("leads.scopePrefix") ?? "Company"}: ${companyName}` : t("scope.company") ?? "Company workspace"}
      contentClassName="p-0 bg-transparent"
    >
      {error && <p className="text-sm text-destructive">{t("leads.loadError") ?? "Failed to load leads. Please try again."}</p>}
      {assignError && <p className="text-sm text-destructive">{assignError}</p>}
      {assignSuccess && <p className="text-sm text-emerald-500">{assignSuccess}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
            {selected.size > 0 ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{selected.size} selected</span>
                <button
                  className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 hover:shadow-md disabled:opacity-50"
                  onClick={() => bulkAction("archive")}
                  disabled={bulkWorking}
                >
                  {bulkWorking ? t("leads.working") ?? "Working..." : t("leads.bulk.archive") ?? "Archive selected"}
                </button>
                <button
                  className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-destructive shadow-sm transition hover:bg-slate-50 hover:shadow-md disabled:opacity-50"
                  onClick={() => bulkAction("delete")}
                  disabled={bulkWorking}
                >
                  {bulkWorking ? t("leads.working") ?? "Working..." : t("leads.bulk.delete") ?? "Delete selected"}
                </button>
                {bulkMessage && <span className="text-xs text-muted-foreground">{bulkMessage}</span>}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">&nbsp;</span>
            )}
            <a
              href={`/company/${companyId}/leads/new`}
              className="inline-flex items-center rounded-md border border-white/30 bg-primary px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground shadow-md transition hover:opacity-90 hover:shadow-lg"
            >
              <svg viewBox="0 0 24 24" className="-ml-1 mr-2 h-4 w-4" aria-hidden="true">
                <path
                  d="M12 5v14M5 12h14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              {t("leads.create") ?? "Create Lead"}
            </a>
          </div>
          {loading && !error ? (
            <p className="text-sm text-muted-foreground">{t("leads.loading") ?? "Loading leads..."}</p>
          ) : (
            <>
              <Card className="border-0 p-0 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/30 px-4 py-3">
                  <div className="inline-flex rounded-lg bg-muted/40 p-1 text-xs">
                    {tabs.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setTab(t.key)}
                        className={`rounded-md px-3 py-1.5 font-medium transition ${
                          tab === t.key
                            ? "bg-background text-foreground shadow-sm border border-border/40"
                            : "border border-transparent text-muted-foreground hover:bg-muted/50"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <div className="relative w-full max-w-xs">
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                        <path
                          d="M15.5 15.5L21 21M10.5 18a7.5 7.5 0 1 1 0-15a7.5 7.5 0 0 1 0 15Z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                  </div>
                </div>
                <LeadsTable
                  companyId={companyId}
                  leads={pagedLeads}
                  selectable
                  selectedIds={selected}
                  onSelectChange={toggleSelect}
                  onAssign={(id, lead) => openAssign(id, lead)}
                  onCarIn={(id, lead) => void moveLeadToCarIn(id, lead)}
                  onRequestRecovery={(id, lead) => void requestRecoveryForLead(id, lead)}
                  onRefresh={refreshLeads}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  sortLabel={sortLabel}
                />
              </Card>
              <div className="flex items-center justify-between px-4 py-3 text-xs text-muted-foreground">
                <span>
                  Page {safePage} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                    disabled={safePage <= 1}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  >
                    <svg viewBox="0 0 24 24" className="-ml-1 mr-2 h-4 w-4" aria-hidden="true">
                      <path
                        d="M15 6l-6 6 6 6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Previous
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  >
                    <svg viewBox="0 0 24 24" className="-ml-1 mr-2 h-4 w-4" aria-hidden="true">
                      <path
                        d="M9 6l6 6-6 6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Next
                  </button>
                </div>
              </div>
              {requestRecoveryLead && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                  <Card className="w-full max-w-4xl space-y-4 rounded-2xl border border-white/10 bg-slate-950 text-white shadow-xl">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <div>
                        <div className="text-sm font-semibold text-white">Request Recovery</div>
                        <div className="text-xs text-white/70">
                          Add pickup/dropoff map locations, datetime, and remarks.
                        </div>
                      </div>
                      <button
                        className="inline-flex items-center rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm transition hover:bg-white/20 hover:shadow-md"
                        onClick={() => resetRecoveryRequest()}
                        disabled={requestRecoverySaving}
                      >
                        Close
                      </button>
                    </div>
                    {requestRecoveryError ? <p className="text-sm text-red-400">{requestRecoveryError}</p> : null}
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2 rounded-lg border border-white/15 bg-white/5 p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-white/80">Pickup Location (Google Map)</div>
                        <input
                          value={requestPickupLocationText}
                          onChange={(e) => setRequestPickupLocationText(e.target.value)}
                          placeholder="Pickup location label"
                          className="w-full rounded border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/60"
                        />
                        <div className="flex gap-2">
                          <div ref={requestPickupDropdownRef} className="relative w-full">
                            <input
                              ref={requestPickupSearchRef}
                              value={requestPickupLocationSearch}
                              onChange={(e) => setRequestPickupLocationSearch(e.target.value)}
                              onFocus={() => {
                                if (requestPickupSuggestions.length > 0) setRequestPickupSuggestionsOpen(true);
                              }}
                              onBlur={() => {
                                window.setTimeout(() => setRequestPickupSuggestionsOpen(false), 120);
                              }}
                              placeholder="Search pickup location"
                              className="w-full rounded border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/60"
                            />
                            {requestPickupSuggestionsOpen && requestPickupSuggestions.length > 0 ? (
                              <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-[120] max-h-44 overflow-auto rounded border border-white/20 bg-slate-900 shadow-xl">
                                {requestPickupSuggestions.map((s) => (
                                  <button
                                    key={s.placeId}
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                      setRequestPickupLocationSearch(s.label);
                                      if (!requestPickupLocationText.trim()) setRequestPickupLocationText(s.label);
                                      const embedUrl = googleMapsApiKey
                                        ? buildGoogleEmbedUrl(googleMapsApiKey, { placeId: s.placeId }) ?? buildSearchEmbedUrl(s.label)
                                        : buildSearchEmbedUrl(s.label);
                                      if (embedUrl) {
                                        setRequestPickupGoogleLocation(embedUrl);
                                        setRequestPickupMapUrlInput(embedUrl);
                                      }
                                      setRequestPickupSuggestions([]);
                                      setRequestPickupSuggestionsOpen(false);
                                    }}
                                    className="block w-full border-b border-white/10 px-3 py-2 text-left text-xs text-white hover:bg-white/10"
                                  >
                                    {s.label}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const embedUrl = googleMapsApiKey
                                ? buildGoogleEmbedUrl(googleMapsApiKey, { query: requestPickupLocationSearch }) ??
                                  buildSearchEmbedUrl(requestPickupLocationSearch)
                                : buildSearchEmbedUrl(requestPickupLocationSearch);
                              if (!embedUrl) return;
                              setRequestPickupGoogleLocation(embedUrl);
                              setRequestPickupMapUrlInput(embedUrl);
                              if (!requestPickupLocationText.trim()) setRequestPickupLocationText(requestPickupLocationSearch.trim());
                            }}
                            className="rounded border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white hover:bg-white/20"
                          >
                            Search
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <input
                            value={requestPickupMapUrlInput}
                            onChange={(e) => setRequestPickupMapUrlInput(e.target.value)}
                            placeholder="Paste Google Maps URL (e.g. https://maps.app.goo.gl/...)"
                            className="w-full rounded border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/60"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              const originalInput = requestPickupMapUrlInput.trim();
                              let input = originalInput;
                              let resolvedLabel = "";
                              let resolvedCenter = "";
                              if (!input) {
                                setRequestRecoveryError("Enter Google Maps URL for pickup location.");
                                return;
                              }
                              setRequestPickupMapUrlParsing(true);
                              try {
                                if (isGoogleShortMapUrl(input)) {
                                  const resolved = await resolveMapUrl(input);
                                  input = resolved.url;
                                  resolvedLabel = resolved.label;
                                  resolvedCenter = resolved.center;
                                }
                                const parsed = tryParseGoogleMapsUrl(input);
                                const finalLabel =
                                  parsed.label ||
                                  resolvedLabel ||
                                  requestPickupLocationText.trim() ||
                                  requestPickupLocationSearch.trim();
                                const finalEmbedUrl =
                                  (resolvedCenter ? buildCoordinateEmbedUrl(resolvedCenter) : null) ||
                                  parsed.embedUrl ||
                                  (finalLabel ? buildSearchEmbedUrl(finalLabel) : null);
                                if (!finalEmbedUrl) {
                                  setRequestRecoveryError("Invalid Google Maps URL for pickup location.");
                                  return;
                                }
                                setRequestRecoveryError(null);
                                setRequestPickupGoogleLocation(finalEmbedUrl);
                                setRequestPickupMapUrlInput(finalEmbedUrl);
                                if (finalLabel && !requestPickupLocationText.trim()) setRequestPickupLocationText(finalLabel);
                                if (!finalLabel && resolvedCenter && !requestPickupLocationText.trim()) {
                                  setRequestPickupLocationText(resolvedCenter);
                                }
                                if (finalLabel) setRequestPickupLocationSearch(finalLabel);
                                else if (resolvedCenter) setRequestPickupLocationSearch(resolvedCenter);
                                setRequestPickupSuggestions([]);
                                setRequestPickupSuggestionsOpen(false);
                              } catch (err: any) {
                                setRequestRecoveryError(err?.message ?? "Failed to resolve pickup map URL.");
                              } finally {
                                setRequestPickupMapUrlParsing(false);
                              }
                            }}
                            disabled={requestPickupMapUrlParsing}
                            className="rounded border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white hover:bg-white/20 disabled:opacity-60"
                          >
                            {requestPickupMapUrlParsing ? "Parsing..." : "Use URL"}
                          </button>
                        </div>
                        <iframe
                          title="Recovery pickup map preview"
                          src={requestPickupMapPreviewSrc}
                          className="h-44 w-full rounded border border-white/20"
                          loading="lazy"
                        />
                      </div>

                      <div className="space-y-2 rounded-lg border border-white/15 bg-white/5 p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-white/80">Dropoff Location (Google Map)</div>
                        <input
                          value={requestDropoffLocationText}
                          onChange={(e) => setRequestDropoffLocationText(e.target.value)}
                          placeholder="Dropoff location label"
                          className="w-full rounded border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/60"
                        />
                        <div className="flex gap-2">
                          <div ref={requestDropoffDropdownRef} className="relative w-full">
                            <input
                              ref={requestDropoffSearchRef}
                              value={requestDropoffLocationSearch}
                              onChange={(e) => setRequestDropoffLocationSearch(e.target.value)}
                              onFocus={() => {
                                if (requestDropoffSuggestions.length > 0) setRequestDropoffSuggestionsOpen(true);
                              }}
                              onBlur={() => {
                                window.setTimeout(() => setRequestDropoffSuggestionsOpen(false), 120);
                              }}
                              placeholder="Search dropoff location"
                              className="w-full rounded border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/60"
                            />
                            {requestDropoffSuggestionsOpen && requestDropoffSuggestions.length > 0 ? (
                              <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-[120] max-h-44 overflow-auto rounded border border-white/20 bg-slate-900 shadow-xl">
                                {requestDropoffSuggestions.map((s) => (
                                  <button
                                    key={s.placeId}
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                      setRequestDropoffLocationSearch(s.label);
                                      if (!requestDropoffLocationText.trim()) setRequestDropoffLocationText(s.label);
                                      const embedUrl = googleMapsApiKey
                                        ? buildGoogleEmbedUrl(googleMapsApiKey, { placeId: s.placeId }) ?? buildSearchEmbedUrl(s.label)
                                        : buildSearchEmbedUrl(s.label);
                                      if (embedUrl) {
                                        setRequestDropoffGoogleLocation(embedUrl);
                                        setRequestDropoffMapUrlInput(embedUrl);
                                      }
                                      setRequestDropoffSuggestions([]);
                                      setRequestDropoffSuggestionsOpen(false);
                                    }}
                                    className="block w-full border-b border-white/10 px-3 py-2 text-left text-xs text-white hover:bg-white/10"
                                  >
                                    {s.label}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const embedUrl = googleMapsApiKey
                                ? buildGoogleEmbedUrl(googleMapsApiKey, { query: requestDropoffLocationSearch }) ??
                                  buildSearchEmbedUrl(requestDropoffLocationSearch)
                                : buildSearchEmbedUrl(requestDropoffLocationSearch);
                              if (!embedUrl) return;
                              setRequestDropoffGoogleLocation(embedUrl);
                              setRequestDropoffMapUrlInput(embedUrl);
                              if (!requestDropoffLocationText.trim()) setRequestDropoffLocationText(requestDropoffLocationSearch.trim());
                            }}
                            className="rounded border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white hover:bg-white/20"
                          >
                            Search
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <input
                            value={requestDropoffMapUrlInput}
                            onChange={(e) => setRequestDropoffMapUrlInput(e.target.value)}
                            placeholder="Paste Google Maps URL (e.g. https://maps.app.goo.gl/...)"
                            className="w-full rounded border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/60"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              const originalInput = requestDropoffMapUrlInput.trim();
                              let input = originalInput;
                              let resolvedLabel = "";
                              let resolvedCenter = "";
                              if (!input) {
                                setRequestRecoveryError("Enter Google Maps URL for dropoff location.");
                                return;
                              }
                              setRequestDropoffMapUrlParsing(true);
                              try {
                                if (isGoogleShortMapUrl(input)) {
                                  const resolved = await resolveMapUrl(input);
                                  input = resolved.url;
                                  resolvedLabel = resolved.label;
                                  resolvedCenter = resolved.center;
                                }
                                const parsed = tryParseGoogleMapsUrl(input);
                                const finalLabel =
                                  parsed.label ||
                                  resolvedLabel ||
                                  requestDropoffLocationText.trim() ||
                                  requestDropoffLocationSearch.trim();
                                const finalEmbedUrl =
                                  (resolvedCenter ? buildCoordinateEmbedUrl(resolvedCenter) : null) ||
                                  parsed.embedUrl ||
                                  (finalLabel ? buildSearchEmbedUrl(finalLabel) : null);
                                if (!finalEmbedUrl) {
                                  setRequestRecoveryError("Invalid Google Maps URL for dropoff location.");
                                  return;
                                }
                                setRequestRecoveryError(null);
                                setRequestDropoffGoogleLocation(finalEmbedUrl);
                                setRequestDropoffMapUrlInput(finalEmbedUrl);
                                if (finalLabel && !requestDropoffLocationText.trim()) setRequestDropoffLocationText(finalLabel);
                                if (!finalLabel && resolvedCenter && !requestDropoffLocationText.trim()) {
                                  setRequestDropoffLocationText(resolvedCenter);
                                }
                                if (finalLabel) setRequestDropoffLocationSearch(finalLabel);
                                else if (resolvedCenter) setRequestDropoffLocationSearch(resolvedCenter);
                                setRequestDropoffSuggestions([]);
                                setRequestDropoffSuggestionsOpen(false);
                              } catch (err: any) {
                                setRequestRecoveryError(err?.message ?? "Failed to resolve dropoff map URL.");
                              } finally {
                                setRequestDropoffMapUrlParsing(false);
                              }
                            }}
                            disabled={requestDropoffMapUrlParsing}
                            className="rounded border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white hover:bg-white/20 disabled:opacity-60"
                          >
                            {requestDropoffMapUrlParsing ? "Parsing..." : "Use URL"}
                          </button>
                        </div>
                        <iframe
                          title="Recovery dropoff map preview"
                          src={requestDropoffMapPreviewSrc}
                          className="h-44 w-full rounded border border-white/20"
                          loading="lazy"
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        type="datetime-local"
                        value={requestRecoveryScheduledAt}
                        onChange={(e) => setRequestRecoveryScheduledAt(e.target.value)}
                        className="w-full rounded border border-white/20 bg-white/10 px-3 py-2 text-sm text-white"
                      />
                      <textarea
                        value={requestRecoveryRemarks}
                        onChange={(e) => setRequestRecoveryRemarks(e.target.value)}
                        placeholder="Remarks"
                        className="h-20 w-full rounded border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/60"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => resetRecoveryRequest()}
                        disabled={requestRecoverySaving}
                        className="rounded border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white hover:bg-white/20 disabled:opacity-60"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void submitRecoveryRequest()}
                        disabled={requestRecoverySaving}
                        className="rounded bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                      >
                        {requestRecoverySaving ? "Submitting..." : "Submit Recovery Request"}
                      </button>
                    </div>
                  </Card>
                </div>
              )}
              {assignLeadId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                  <Card className="w-full max-w-2xl space-y-4 rounded-2xl border border-white/10 bg-slate-950 text-white shadow-xl">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {assignLeadType === "recovery"
                            ? t("leads.assign.recovery")
                            : assignLeadType === "workshop"
                            ? t("leads.assign.workshop")
                            : t("leads.assign.rsa")}
                        </div>
                        <div className="text-xs text-white/70">
                          {assignLeadType === "workshop"
                            ? t("leads.assign.workshop.helper")
                            : t("leads.assign.helper")}
                        </div>
                      </div>
                      <button
                        className="inline-flex items-center rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm transition hover:bg-white/20 hover:shadow-md"
                        onClick={() => resetAssign()}
                      >
                        {t("leads.assign.close")}
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-white">
                      {assignLeadType !== "rsa" && (
                        <select
                          className="rounded border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/60"
                          value={assignBranchId ?? ""}
                          onChange={(e) => {
                            const val = e.target.value || null;
                            setAssignBranchId(val);
                            setAssignUserId(null);
                            if (val) loadAssignUsers(val);
                            else setAssignUsers([]);
                          }}
                        >
                          <option value="">{t("leads.assign.selectBranch")}</option>
                          {assignBranches.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.display_name || b.name || b.code || b.id.slice(0, 8)}
                            </option>
                          ))}
                        </select>
                      )}
                      {assignLeadType !== "workshop" && (
                        <select
                          className="rounded border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/60"
                          value={assignUserId ?? ""}
                          onChange={(e) => setAssignUserId(e.target.value || null)}
                          disabled={!assignUsers.length}
                        >
                          <option value="">{t("leads.assign.selectUser")}</option>
                          {assignUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.full_name || u.email} {u.last_login_at ? t("leads.assign.online") : ""}
                            </option>
                          ))}
                        </select>
                      )}
                      {assignLeadType === "rsa" ? (
                        <div className="w-full space-y-2 rounded-lg border border-white/15 bg-white/5 p-3">
                          <div className="text-xs font-semibold uppercase tracking-wide text-white/80">Pickup Location (Google Map)</div>
                          <input
                            value={assignLocationText}
                            onChange={(e) => setAssignLocationText(e.target.value)}
                            placeholder="Location label (e.g. Mohammed Bin Zayed City)"
                            className="w-full rounded border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/60"
                          />
                          <div className="flex gap-2">
                            <div className="relative w-full">
                              <input
                                ref={assignLocationSearchRef}
                                value={assignLocationSearch}
                                onChange={(e) => setAssignLocationSearch(e.target.value)}
                                onFocus={() => {
                                  if (assignLocationSuggestions.length > 0) setAssignLocationSuggestionsOpen(true);
                                }}
                                onBlur={() => {
                                  window.setTimeout(() => setAssignLocationSuggestionsOpen(false), 120);
                                }}
                                placeholder="Search location for map URL"
                                className="w-full rounded border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/60"
                              />
                              {assignLocationSuggestionsOpen && assignLocationSuggestions.length > 0 ? (
                                <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-[120] max-h-44 overflow-auto rounded border border-white/20 bg-slate-900 shadow-xl">
                                  {assignLocationSuggestions.map((s) => (
                                    <button
                                      key={s.placeId}
                                      type="button"
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => {
                                        setAssignLocationSearch(s.label);
                                        if (!assignLocationText.trim()) setAssignLocationText(s.label);
                                        const embedUrl = googleMapsApiKey
                                          ? buildGoogleEmbedUrl(googleMapsApiKey, { placeId: s.placeId }) ?? buildSearchEmbedUrl(s.label)
                                          : buildSearchEmbedUrl(s.label);
                                        if (embedUrl) setAssignGoogleLocation(embedUrl);
                                        setAssignLocationSuggestionsOpen(false);
                                      }}
                                      className="block w-full border-b border-white/10 px-3 py-2 text-left text-xs text-white hover:bg-white/10"
                                    >
                                      {s.label}
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const embedUrl = googleMapsApiKey
                                  ? buildGoogleEmbedUrl(googleMapsApiKey, { query: assignLocationSearch }) ??
                                    buildSearchEmbedUrl(assignLocationSearch)
                                  : buildSearchEmbedUrl(assignLocationSearch);
                                if (!embedUrl) return;
                                setAssignGoogleLocation(embedUrl);
                                if (!assignLocationText.trim()) setAssignLocationText(assignLocationSearch.trim());
                              }}
                              className="rounded border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white hover:bg-white/20"
                            >
                              Search
                            </button>
                          </div>
                          <div className="text-[11px] text-white/60">
                            {assignGoogleLocation
                              ? "Location URL will be saved to this lead."
                              : "Search and select location to save map URL."}
                          </div>
                          <div className="space-y-2">
                            <div className="text-[11px] text-white/70">Google Map Preview</div>
                            <iframe
                              title="RSA pickup map live preview"
                              src={assignMapPreviewSrc}
                              className="h-44 w-full rounded border border-white/20"
                              loading="lazy"
                            />
                          </div>
                        </div>
                      ) : null}
                      <button
                        className="rounded bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                        onClick={() => assignLead()}
                        disabled={
                          (assignLeadType !== "rsa" && !assignBranchId) ||
                          assignLoading ||
                          (assignLeadType !== "workshop" && assignLeadType !== "recovery" && !assignUserId) ||
                          (assignLeadType === "recovery" && (!assignRecoveryDirection || !assignRecoveryFlow)) ||
                          (assignLeadType === "rsa" && !assignLocationText.trim())
                        }
                      >
                        {assignLoading ? t("leads.assign.working") : t("leads.assign.submit")}
                      </button>
                    </div>
                  </Card>
                </div>
              )}
            </>
          )}
        </div>
        <aside className="space-y-3">
          <Card>
            <div className="space-y-2">
              <div className="text-sm font-semibold">{t("leads.ai.title")}</div>
              {loading ? (
                <div className="text-sm text-muted-foreground">{t("leads.ai.loading")}</div>
              ) : aiSuggestions.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t("leads.ai.actions.empty")}</div>
              ) : (
                <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                  {aiSuggestions.map((a, idx) => (
                    <li key={idx}>{a}</li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
          <Card>
            <div className="space-y-2">
              <div className="text-sm font-semibold">{t("leads.ai.appreciation.title")}</div>
              <div className="text-sm text-muted-foreground">{loading ? t("leads.ai.loading") : aiAppreciation}</div>
            </div>
          </Card>
        </aside>
      </div>
    </MainPageShell>
  );
}
