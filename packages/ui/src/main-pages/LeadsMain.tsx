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
  const [bookingLead, setBookingLead] = useState<any | null>(null);
  const [bookingSaving, setBookingSaving] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingLeadType, setBookingLeadType] = useState<"rsa" | "recovery" | "workshop">("rsa");
  const [bookingLeadTypeConfirmed, setBookingLeadTypeConfirmed] = useState(false);
  const [bookingScheduledAt, setBookingScheduledAt] = useState("");
  const [bookingWorkshopType, setBookingWorkshopType] = useState<"walkin" | "recovery">("walkin");
  const [bookingPriority, setBookingPriority] = useState<"low" | "medium" | "high">("medium");
  const [bookingPickupLocation, setBookingPickupLocation] = useState("");
  const [bookingPickupGoogleLocation, setBookingPickupGoogleLocation] = useState("");
  const [bookingDropoffLocation, setBookingDropoffLocation] = useState("");
  const [bookingDropoffGoogleLocation, setBookingDropoffGoogleLocation] = useState("");
  const [bookingNotes, setBookingNotes] = useState("");
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

  function resolveWorkshopVisitMode(lead: any): "walkin" | "recovery" {
    const explicit = String(lead?.workshopVisitMode ?? "").trim().toLowerCase();
    if (explicit === "walkin" || explicit === "recovery") return explicit;
    const serviceType = String(lead?.serviceType ?? "").trim().toLowerCase();
    if (serviceType === "pickup" || serviceType === "recovery") return "recovery";
    if (String(lead?.pickupFrom ?? "").trim() || String(lead?.dropoffTo ?? "").trim()) return "recovery";
    return "walkin";
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
        const res = await fetch(`/api/company/${companyId}/admin/users?department=RSA+Operations&status=active`);
        if (!res.ok) throw new Error(t("leads.assign.loadUsers") ?? "Failed to load users");
        const data = await res.json();
        const users = data.data ?? data ?? [];
        // Fallback: if no RSA department users found, load all active company users
        if (users.length === 0) {
          const fallback = await fetch(`/api/company/${companyId}/admin/users?status=active`);
          if (fallback.ok) {
            const fbData = await fallback.json();
            setAssignUsers(fbData.data ?? fbData ?? []);
          } else {
            setAssignUsers([]);
          }
        } else {
          setAssignUsers(users);
        }
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

  async function openBooking(leadId: string, lead?: any) {
    const nextLead = lead ?? leads.find((l) => l.id === leadId) ?? null;
    if (!nextLead) return;
    const initialLeadType =
      String(nextLead?.leadType ?? "").trim().toLowerCase() === "recovery"
        ? "recovery"
        : String(nextLead?.leadType ?? "").trim().toLowerCase() === "workshop"
        ? "workshop"
        : "rsa";
    setBookingLead(nextLead);
    setBookingError(null);
    setBookingSaving(false);
    setBookingLeadType(initialLeadType);
    setBookingLeadTypeConfirmed(false);
    setBookingScheduledAt("");
    setBookingWorkshopType(resolveWorkshopVisitMode(nextLead));
    setBookingPriority("medium");
    setBookingPickupLocation(String(nextLead?.pickupFrom ?? "").trim());
    setBookingPickupGoogleLocation(extractEmbedSrc(String(nextLead?.pickupGoogleLocation ?? "")) ?? "");
    setBookingDropoffLocation(String(nextLead?.dropoffTo ?? "").trim());
    setBookingDropoffGoogleLocation(extractEmbedSrc(String(nextLead?.dropoffGoogleLocation ?? "")) ?? "");
    setBookingNotes("");
    try {
      const res = await fetch(`/api/company/${companyId}/sales/leads/${nextLead.id}/booking`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      const defaults = data?.data ?? {};
      const previousLeadType =
        String(defaults?.leadType ?? "").trim().toLowerCase() === "recovery"
          ? "recovery"
          : String(defaults?.leadType ?? "").trim().toLowerCase() === "workshop"
          ? "workshop"
          : "rsa";
      setBookingLeadType(previousLeadType);
      setBookingWorkshopType(String(defaults?.workshopType ?? "").trim().toLowerCase() === "recovery" ? "recovery" : "walkin");
      setBookingPriority(
        String(defaults?.priority ?? "").trim().toLowerCase() === "low" || String(defaults?.priority ?? "").trim().toLowerCase() === "high"
          ? (String(defaults?.priority ?? "").trim().toLowerCase() as "low" | "high")
          : "medium"
      );
    } catch {
      // keep local defaults
    }
  }

  async function submitBooking() {
    if (!bookingLead?.id) return;
    if (!bookingLeadTypeConfirmed) {
      setBookingError("Please confirm lead type before saving.");
      return;
    }
    const workshopMode = bookingLeadType === "workshop" ? bookingWorkshopType : null;
    const requiresPickup = bookingLeadType === "rsa" || bookingLeadType === "recovery" || workshopMode === "recovery";
    const requiresDropoff = bookingLeadType === "recovery" && workshopMode !== "recovery";
    const scheduledAt = bookingScheduledAt.trim();
    const pickupLocation = bookingPickupLocation.trim();
    const dropoffLocation = bookingDropoffLocation.trim();
    if (!scheduledAt) {
      setBookingError("Date/time is required.");
      return;
    }
    if (requiresPickup && !pickupLocation) {
      setBookingError("Pickup location is required.");
      return;
    }
    if (requiresDropoff && !dropoffLocation) {
      setBookingError("Dropoff location is required.");
      return;
    }

    setBookingSaving(true);
    setBookingError(null);
    try {
      const res = await fetch(`/api/company/${companyId}/sales/leads/${bookingLead.id}/booking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledAt,
          leadType: bookingLeadType,
          bookingType: bookingLeadType === "workshop" ? bookingWorkshopType : undefined,
          priority: bookingPriority,
          pickupLocation: requiresPickup ? pickupLocation : null,
          pickupGoogleLocation: requiresPickup ? bookingPickupGoogleLocation.trim() || null : null,
          dropoffLocation: requiresDropoff ? dropoffLocation : null,
          dropoffGoogleLocation: requiresDropoff ? bookingDropoffGoogleLocation.trim() || null : null,
          notes: bookingNotes.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error ?? "Failed to save booking"));
      setBulkMessage("Booking saved.");
      setBookingLead(null);
      await refreshLeads();
    } catch (err: any) {
      setBookingError(err?.message ?? "Failed to save booking.");
    } finally {
      setBookingSaving(false);
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

  function resetBooking() {
    setBookingLead(null);
    setBookingSaving(false);
    setBookingError(null);
    setBookingLeadType("rsa");
    setBookingLeadTypeConfirmed(false);
    setBookingScheduledAt("");
    setBookingWorkshopType("walkin");
    setBookingPriority("medium");
    setBookingPickupLocation("");
    setBookingPickupGoogleLocation("");
    setBookingDropoffLocation("");
    setBookingDropoffGoogleLocation("");
    setBookingNotes("");
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

      <div className="grid gap-6">
        <div className="space-y-3">
          {/* Summary stats */}
          {(() => {
            const openCount = leads.filter(l => String(l.leadStatus ?? "").toLowerCase() === "open").length;
            const bookedCount = leads.filter(l => (l as any).bookingId).length;
            const closedCount = leads.filter(l => ["closed", "closed_won", "lost", "done", "completed"].includes(String(l.leadStatus ?? "").toLowerCase())).length;
            const assignedCount = leads.filter(l => l.assignedUserId).length;
            const unassignedCount = leads.length - assignedCount;

            const rsaLeads = leads.filter(l => String(l.leadType ?? "").toLowerCase() === "rsa");
            const recoveryLeads = leads.filter(l => String(l.leadType ?? "").toLowerCase() === "recovery");
            const workshopLeads = leads.filter(l => String(l.leadType ?? "").toLowerCase() === "workshop");

            // RSA division breakdown
            const rsaDivisions: Record<string, number> = {};
            rsaLeads.forEach(l => {
              const div = String((l as any).serviceType ?? "").trim() || "unspecified";
              rsaDivisions[div] = (rsaDivisions[div] ?? 0) + 1;
            });

            // Recovery division breakdown
            const recoveryDivisions: Record<string, number> = {};
            recoveryLeads.forEach(l => {
              const div = String((l as any).serviceType ?? "").trim() || "unspecified";
              recoveryDivisions[div] = (recoveryDivisions[div] ?? 0) + 1;
            });

            const kpiCard = (value: number, label: string, dotColor: string, textColor: string) => (
              <div className="flex flex-1 min-w-[100px] flex-col items-center gap-1.5 rounded-xl border border-border bg-card/30 px-4 py-4">
                <span className={`text-3xl font-extrabold ${textColor}`}>{value}</span>
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${dotColor}`} />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
                </div>
              </div>
            );

            const typeCard = (value: number, label: string, dotColor: string, textColor: string, borderColor: string, divisions: Record<string, number>) => (
              <div className={`flex flex-1 min-w-[140px] flex-col rounded-xl border p-4 ${borderColor} bg-card/30`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />
                    <span className="text-sm font-bold uppercase tracking-wider text-foreground/70">{label}</span>
                  </div>
                  <span className={`text-3xl font-extrabold ${textColor}`}>{value}</span>
                </div>
                {Object.keys(divisions).length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(divisions).sort((a, b) => b[1] - a[1]).map(([div, count]) => (
                      <span key={div} className={`inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/50 px-2.5 py-1 text-xs`}>
                        <span className={`font-bold ${textColor}`}>{count}</span>
                        <span className="text-muted-foreground capitalize">{div.replace(/_/g, " ")}</span>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            );

            return (
              <div className="space-y-3 pb-2">
                {/* Row 1: Main KPIs — full width cards */}
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                  {kpiCard(leads.length, "Total", "bg-foreground/40", "text-foreground")}
                  {kpiCard(openCount, "Open", "bg-emerald-400", "text-emerald-400")}
                  {kpiCard(bookedCount, "Booked", "bg-indigo-400", "text-indigo-400")}
                  {kpiCard(assignedCount, "Assigned", "bg-sky-400", "text-sky-400")}
                  {kpiCard(unassignedCount, "Unassigned", "bg-amber-400", "text-amber-400")}
                  {kpiCard(closedCount, "Closed", "bg-foreground/30", "text-muted-foreground")}
                </div>

                {/* Row 2: By Lead Type with division breakdown */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {typeCard(rsaLeads.length, "RSA", "bg-blue-400", "text-blue-400", "border-blue-500/25", rsaDivisions)}
                  {typeCard(recoveryLeads.length, "Recovery", "bg-purple-400", "text-purple-400", "border-purple-500/25", {})}
                  {typeCard(workshopLeads.length, "Workshop", "bg-orange-400", "text-orange-400", "border-orange-500/25", {})}
                </div>
              </div>
            );
          })()}

          <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
            {selected.size > 0 ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{selected.size} selected</span>
                <button
                  className="inline-flex items-center rounded-md border border-border bg-muted/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground shadow-sm transition hover:bg-muted disabled:opacity-50"
                  onClick={() => bulkAction("archive")}
                  disabled={bulkWorking}
                >
                  {bulkWorking ? t("leads.working") ?? "Working..." : t("leads.bulk.archive") ?? "Archive selected"}
                </button>
                <button
                  className="inline-flex items-center rounded-md border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-destructive shadow-sm transition hover:bg-red-500/20 disabled:opacity-50"
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
              className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              <svg viewBox="0 0 24 24" className="-ml-0.5 mr-1.5 h-4 w-4" aria-hidden="true">
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
              <Card className="border border-border/60 p-0 shadow-none">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
                  <div className="inline-flex rounded-lg bg-muted/40 p-1 text-xs">
                    {tabs.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setTab(t.key)}
                        className={`rounded-md px-3 py-1.5 font-medium transition ${
                          tab === t.key
                            ? "bg-muted text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
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
                      className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
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
                  onBook={(id, lead) => void openBooking(id, lead)}
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
                    className="inline-flex items-center rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
                    disabled={safePage <= 1}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  >
                    <svg viewBox="0 0 24 24" className="-ml-0.5 mr-1.5 h-3.5 w-3.5" aria-hidden="true">
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
                    className="inline-flex items-center rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  >
                    Next
                    <svg viewBox="0 0 24 24" className="-mr-0.5 ml-1.5 h-3.5 w-3.5" aria-hidden="true">
                      <path
                        d="M9 6l6 6-6 6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>
              {bookingLead && (() => {
                const leadType = bookingLeadType;
                const workshopMode = leadType === "workshop" ? bookingWorkshopType : null;
                const scenarioLabel =
                  leadType === "rsa"
                    ? "RSA booking"
                    : leadType === "recovery"
                    ? "Recovery booking"
                    : workshopMode === "recovery"
                    ? "Workshop recovery booking"
                    : "Workshop walk-in booking";
                const requiresPickup = leadType === "rsa" || leadType === "recovery" || workshopMode === "recovery";
                const requiresDropoff = leadType === "recovery" && workshopMode !== "recovery";
                return (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <Card className="w-full max-w-2xl space-y-4 rounded-2xl border border-border bg-background text-foreground shadow-xl">
                      <div className="flex items-center justify-between border-b border-border pb-3">
                        <div>
                          <div className="text-sm font-semibold text-foreground">Book Lead</div>
                          <div className="text-xs text-foreground/70">{scenarioLabel}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => resetBooking()}
                          disabled={bookingSaving}
                          className="inline-flex items-center rounded-md border border-border bg-muted px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground shadow-sm transition hover:bg-muted/80 hover:shadow-md disabled:opacity-60"
                        >
                          Close
                        </button>
                      </div>
                      {bookingError ? <p className="text-sm text-destructive">{bookingError}</p> : null}
                      <div className="grid gap-3">
                        <div className="rounded border border-border bg-muted/40 p-3">
                          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/70">Lead Type Verification</div>
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={bookingLeadType}
                              onChange={(e) => {
                                const nextType =
                                  e.target.value === "recovery"
                                    ? "recovery"
                                    : e.target.value === "workshop"
                                    ? "workshop"
                                    : "rsa";
                                setBookingLeadType(nextType);
                                setBookingLeadTypeConfirmed(false);
                              }}
                              className="rounded border border-border bg-muted px-3 py-2 text-sm text-foreground"
                            >
                              <option value="rsa" style={{ color: "#0f172a", backgroundColor: "#ffffff" }}>RSA</option>
                              <option value="recovery" style={{ color: "#0f172a", backgroundColor: "#ffffff" }}>Recovery</option>
                              <option value="workshop" style={{ color: "#0f172a", backgroundColor: "#ffffff" }}>Workshop</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => setBookingLeadTypeConfirmed(true)}
                              className={`rounded px-3 py-2 text-xs font-semibold uppercase tracking-wide ${
                                bookingLeadTypeConfirmed
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : "bg-muted text-foreground hover:bg-muted/80"
                              }`}
                            >
                              {bookingLeadTypeConfirmed ? "Confirmed" : "Confirm Type"}
                            </button>
                            <span className="text-xs text-muted-foreground">Default uses previous selected type (if found).</span>
                          </div>
                        </div>
                        {!bookingLeadTypeConfirmed ? (
                          <div className="rounded border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                            Confirm lead type to continue booking form.
                          </div>
                        ) : null}
                        {leadType === "workshop" ? (
                          <div>
                            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Booking Type</label>
                            <select
                              value={bookingWorkshopType}
                              onChange={(e) => {
                                setBookingWorkshopType(e.target.value === "recovery" ? "recovery" : "walkin");
                              }}
                              className="w-full rounded border border-border bg-muted px-3 py-2 text-sm text-foreground"
                              disabled={!bookingLeadTypeConfirmed}
                            >
                              <option value="walkin" style={{ color: "#0f172a", backgroundColor: "#ffffff" }}>
                                Walk-in
                              </option>
                              <option value="recovery" style={{ color: "#0f172a", backgroundColor: "#ffffff" }}>
                                Recovery
                              </option>
                            </select>
                          </div>
                        ) : null}
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Priority</label>
                          <select
                            value={bookingPriority}
                            onChange={(e) =>
                              setBookingPriority(
                                e.target.value === "low" || e.target.value === "high" ? e.target.value : "medium"
                              )
                            }
                            className="w-full rounded border border-border bg-muted px-3 py-2 text-sm text-foreground"
                            disabled={!bookingLeadTypeConfirmed}
                          >
                            <option value="low" style={{ color: "#0f172a", backgroundColor: "#ffffff" }}>
                              Low
                            </option>
                            <option value="medium" style={{ color: "#0f172a", backgroundColor: "#ffffff" }}>
                              Medium
                            </option>
                            <option value="high" style={{ color: "#0f172a", backgroundColor: "#ffffff" }}>
                              High
                            </option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Scheduled Date & Time</label>
                          <input
                            type="datetime-local"
                            value={bookingScheduledAt}
                            onChange={(e) => setBookingScheduledAt(e.target.value)}
                            className="w-full rounded border border-border bg-muted px-3 py-2 text-sm text-foreground"
                            disabled={!bookingLeadTypeConfirmed}
                          />
                        </div>
                        {requiresPickup ? (
                          <div>
                            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pickup Location</label>
                            <input
                              value={bookingPickupLocation}
                              onChange={(e) => setBookingPickupLocation(e.target.value)}
                              placeholder="Enter pickup address"
                              className="w-full rounded border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                              disabled={!bookingLeadTypeConfirmed}
                            />
                            {bookingPickupGoogleLocation ? (
                              <div className="mt-1 flex items-center gap-2">
                                <a href={bookingPickupGoogleLocation} target="_blank" rel="noopener noreferrer" className="text-[11px] text-sky-400 hover:underline truncate">
                                  Maps: {bookingPickupGoogleLocation.slice(0, 50)}...
                                </a>
                                <button type="button" onClick={() => setBookingPickupGoogleLocation("")} className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground">Clear</button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        {requiresDropoff ? (
                          <div>
                            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Dropoff Location</label>
                            <input
                              value={bookingDropoffLocation}
                              onChange={(e) => setBookingDropoffLocation(e.target.value)}
                              placeholder="Enter dropoff address"
                              className="w-full rounded border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                              disabled={!bookingLeadTypeConfirmed}
                            />
                            {bookingDropoffGoogleLocation ? (
                              <div className="mt-1 flex items-center gap-2">
                                <a href={bookingDropoffGoogleLocation} target="_blank" rel="noopener noreferrer" className="text-[11px] text-sky-400 hover:underline truncate">
                                  Maps: {bookingDropoffGoogleLocation.slice(0, 50)}...
                                </a>
                                <button type="button" onClick={() => setBookingDropoffGoogleLocation("")} className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground">Clear</button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Notes <span className="normal-case font-normal text-muted-foreground/50">(optional)</span></label>
                          <textarea
                            value={bookingNotes}
                            onChange={(e) => setBookingNotes(e.target.value)}
                            placeholder="Add any remarks or special instructions"
                            className="h-20 w-full rounded border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                            disabled={!bookingLeadTypeConfirmed}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => resetBooking()}
                          disabled={bookingSaving}
                          className="rounded border border-border bg-muted px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground hover:bg-muted/80 disabled:opacity-60"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void submitBooking()}
                          disabled={bookingSaving || !bookingLeadTypeConfirmed}
                          className="rounded bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                        >
                          {bookingSaving ? "Saving..." : "Save Booking"}
                        </button>
                      </div>
                    </Card>
                  </div>
                );
              })()}
              {requestRecoveryLead && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                  <Card className="w-full max-w-4xl space-y-4 rounded-2xl border border-border bg-background text-foreground shadow-xl">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Request Recovery</div>
                        <div className="text-xs text-foreground/70">
                          Add pickup/dropoff map locations, datetime, and remarks.
                        </div>
                      </div>
                      <button
                        className="inline-flex items-center rounded-md border border-border bg-muted px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground shadow-sm transition hover:bg-muted/80 hover:shadow-md"
                        onClick={() => resetRecoveryRequest()}
                        disabled={requestRecoverySaving}
                      >
                        Close
                      </button>
                    </div>
                    {requestRecoveryError ? <p className="text-sm text-destructive">{requestRecoveryError}</p> : null}
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-foreground/80">Pickup Location (Google Map)</div>
                        <input
                          value={requestPickupLocationText}
                          onChange={(e) => setRequestPickupLocationText(e.target.value)}
                          placeholder="Pickup location label"
                          className="w-full rounded border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
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
                              className="w-full rounded border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                            />
                            {requestPickupSuggestionsOpen && requestPickupSuggestions.length > 0 ? (
                              <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-[120] max-h-44 overflow-auto rounded border border-border bg-popover shadow-xl">
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
                                    className="block w-full border-b border-border px-3 py-2 text-left text-xs text-foreground hover:bg-muted"
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
                            className="rounded border border-border bg-muted px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground hover:bg-muted/80"
                          >
                            Search
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <input
                            value={requestPickupMapUrlInput}
                            onChange={(e) => setRequestPickupMapUrlInput(e.target.value)}
                            placeholder="Paste Google Maps URL (e.g. https://maps.app.goo.gl/...)"
                            className="w-full rounded border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
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
                            className="rounded border border-border bg-muted px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground hover:bg-muted/80 disabled:opacity-60"
                          >
                            {requestPickupMapUrlParsing ? "Parsing..." : "Use URL"}
                          </button>
                        </div>
                        <iframe
                          title="Recovery pickup map preview"
                          src={requestPickupMapPreviewSrc}
                          className="h-44 w-full rounded border border-border"
                          loading="lazy"
                        />
                      </div>

                      <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-foreground/80">Dropoff Location (Google Map)</div>
                        <input
                          value={requestDropoffLocationText}
                          onChange={(e) => setRequestDropoffLocationText(e.target.value)}
                          placeholder="Dropoff location label"
                          className="w-full rounded border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
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
                              className="w-full rounded border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                            />
                            {requestDropoffSuggestionsOpen && requestDropoffSuggestions.length > 0 ? (
                              <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-[120] max-h-44 overflow-auto rounded border border-border bg-popover shadow-xl">
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
                                    className="block w-full border-b border-border px-3 py-2 text-left text-xs text-foreground hover:bg-muted"
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
                            className="rounded border border-border bg-muted px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground hover:bg-muted/80"
                          >
                            Search
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <input
                            value={requestDropoffMapUrlInput}
                            onChange={(e) => setRequestDropoffMapUrlInput(e.target.value)}
                            placeholder="Paste Google Maps URL (e.g. https://maps.app.goo.gl/...)"
                            className="w-full rounded border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
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
                            className="rounded border border-border bg-muted px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground hover:bg-muted/80 disabled:opacity-60"
                          >
                            {requestDropoffMapUrlParsing ? "Parsing..." : "Use URL"}
                          </button>
                        </div>
                        <iframe
                          title="Recovery dropoff map preview"
                          src={requestDropoffMapPreviewSrc}
                          className="h-44 w-full rounded border border-border"
                          loading="lazy"
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        type="datetime-local"
                        value={requestRecoveryScheduledAt}
                        onChange={(e) => setRequestRecoveryScheduledAt(e.target.value)}
                        className="w-full rounded border border-border bg-muted px-3 py-2 text-sm text-foreground"
                      />
                      <textarea
                        value={requestRecoveryRemarks}
                        onChange={(e) => setRequestRecoveryRemarks(e.target.value)}
                        placeholder="Remarks"
                        className="h-20 w-full rounded border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => resetRecoveryRequest()}
                        disabled={requestRecoverySaving}
                        className="rounded border border-border bg-muted px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground hover:bg-muted/80 disabled:opacity-60"
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
                  <Card className="w-full max-w-2xl space-y-4 rounded-2xl border border-border bg-background text-foreground shadow-xl">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">
                          {assignLeadType === "recovery"
                            ? t("leads.assign.recovery")
                            : assignLeadType === "workshop"
                            ? t("leads.assign.workshop")
                            : t("leads.assign.rsa")}
                        </div>
                        <div className="text-xs text-foreground/70">
                          {assignLeadType === "workshop"
                            ? t("leads.assign.workshop.helper")
                            : t("leads.assign.helper")}
                        </div>
                      </div>
                      <button
                        className="inline-flex items-center rounded-md border border-border bg-muted px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground shadow-sm transition hover:bg-muted/80 hover:shadow-md"
                        onClick={() => resetAssign()}
                      >
                        {t("leads.assign.close")}
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-foreground">
                      {assignLeadType !== "rsa" && (
                        <select
                          className="rounded border border-border bg-popover px-3 py-2 text-sm text-foreground [&>option]:bg-popover [&>option]:text-foreground"
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
                        <div className="w-full">
                          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {assignLeadType === "rsa" ? "Select RSA Technician" : t("leads.assign.selectUser")}
                          </div>
                          <input
                            type="text"
                            placeholder="Search by name or email..."
                            className="mb-1.5 w-full rounded-lg border border-border bg-popover/80 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-ring focus:outline-none"
                            onChange={(e) => {
                              const q = e.target.value.toLowerCase().trim();
                              (e.target as any).dataset.filter = q;
                              // Force re-render by toggling a data attribute on the list
                              const list = e.target.nextElementSibling;
                              if (list) list.setAttribute("data-filter", q);
                              // Filter items visibility via DOM (avoids extra state)
                              const items = list?.querySelectorAll("[data-user-item]");
                              items?.forEach((item) => {
                                const name = (item.getAttribute("data-user-item") ?? "").toLowerCase();
                                (item as HTMLElement).style.display = !q || name.includes(q) ? "" : "none";
                              });
                            }}
                          />
                          <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-popover/80">
                            {!assignUsers.length ? (
                              <div className="px-3 py-4 text-center text-xs text-muted-foreground">No technicians found</div>
                            ) : (
                              assignUsers.map((u) => {
                                const isSelected = assignUserId === u.id;
                                return (
                                  <button
                                    key={u.id}
                                    type="button"
                                    data-user-item={`${u.full_name || ""} ${u.email || ""}`}
                                    onClick={() => setAssignUserId(u.id)}
                                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition ${
                                      isSelected
                                        ? "bg-sky-500/20 text-sky-300"
                                        : "text-foreground/80 hover:bg-muted/40"
                                    }`}
                                  >
                                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                                      isSelected ? "bg-sky-500/30 text-sky-200" : "bg-muted text-muted-foreground"
                                    }`}>
                                      {(u.full_name || u.email || "?").charAt(0).toUpperCase()}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <div className="truncate font-medium">{u.full_name || u.email}</div>
                                      {u.full_name && u.email && (
                                        <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                                      )}
                                    </div>
                                    {u.last_login_at && (
                                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                        Online
                                      </span>
                                    )}
                                    {isSelected && (
                                      <svg className="h-4 w-4 shrink-0 text-sky-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    )}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                      {assignLeadType === "rsa" ? (
                        <div className="w-full space-y-2 rounded-lg border border-border bg-muted/40 p-3">
                          <div className="text-xs font-semibold uppercase tracking-wide text-foreground/80">Pickup Location</div>
                          <input
                            value={assignLocationText}
                            onChange={(e) => setAssignLocationText(e.target.value)}
                            placeholder="Location name (e.g. Al Barsha, Dubai)"
                            className="w-full rounded border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                          />
                          <input
                            value={assignGoogleLocation}
                            onChange={(e) => setAssignGoogleLocation(e.target.value)}
                            placeholder="Paste Google Maps URL here"
                            className="w-full rounded border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                          />
                          <div className="text-[11px] text-muted-foreground">
                            Paste a Google Maps link (e.g. https://maps.google.com/...)
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
        {/* AI sidebar cards removed — AI Intelligence panel is now in the page layout */}
      </div>
    </MainPageShell>
  );
}
