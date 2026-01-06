"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@repo/ui";

type Branch = {
  id: string;
  name: string;
  code: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  is_active: boolean;
};

type SortKey = "name" | "code" | "phone" | "city" | "country" | "is_active";

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

function safeText(value: string | null | undefined) {
  return value && value !== "null" ? value : "-";
}

function normalize(value: string | null | undefined) {
  return (value ?? "").toString().trim().toLowerCase();
}

function extractEmbedSrc(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes("<iframe")) {
    const match = trimmed.match(/src=["']([^"']+)["']/i);
    return match?.[1] ?? null;
  }
  if (trimmed.startsWith("http")) return trimmed;
  return null;
}

export default function BranchListClient({
  companyId,
  branches,
}: {
  companyId: string;
  branches: Branch[];
}) {
  const [localBranches, setLocalBranches] = useState<Branch[]>(branches);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [statusOverrides, setStatusOverrides] = useState<Record<string, boolean>>({});
  const [statusUpdating, setStatusUpdating] = useState<Record<string, boolean>>({});
  const [statusError, setStatusError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mapModalSrc, setMapModalSrc] = useState<string | null>(null);

  useEffect(() => {
    setLocalBranches(branches);
    setStatusOverrides({});
    setStatusUpdating({});
  }, [branches]);

  useEffect(() => {
    if (branches.length > 0) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(`/api/company/${companyId}/branches?includeInactive=true`);
        if (!res.ok) throw new Error(`Failed to load branches (${res.status})`);
        const data = await res.json();
        const list = data?.branches ?? data?.data ?? data ?? [];
        if (!cancelled) {
          setLocalBranches(Array.isArray(list) ? list : []);
        }
      } catch (err) {
        console.error("Failed to load branches", err);
        if (!cancelled) {
          setLoadError("Failed to load branches. Please refresh.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [branches.length, companyId]);

  function getStatus(branch: Branch) {
    return statusOverrides[branch.id] ?? branch.is_active;
  }

  async function toggleStatus(branch: Branch) {
    const current = getStatus(branch);
    const next = !current;
    setStatusError(null);
    setStatusOverrides((prev) => ({ ...prev, [branch.id]: next }));
    setStatusUpdating((prev) => ({ ...prev, [branch.id]: true }));
    try {
      const res = await fetch(`/api/company/${companyId}/branches/${branch.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      if (!res.ok) {
        throw new Error(`Failed to update status (${res.status})`);
      }
      setLocalBranches((prev) =>
        prev.map((b) => (b.id === branch.id ? { ...b, is_active: next } : b))
      );
    } catch (err) {
      console.error("Failed to update branch status", err);
      setStatusOverrides((prev) => ({ ...prev, [branch.id]: current }));
      setStatusError("Failed to update status. Please try again.");
    } finally {
      setStatusUpdating((prev) => ({ ...prev, [branch.id]: false }));
    }
  }

  const filtered = useMemo(() => {
    const q = normalize(query);
    let rows = localBranches;

    if (statusFilter !== "all") {
      const isActive = statusFilter === "active";
      rows = rows.filter((b) => getStatus(b) === isActive);
    }

    if (!q) return rows;

    return rows.filter((b) => {
      const haystack = [
        b.name,
        b.code,
        b.phone,
        b.city,
        b.country,
      ]
        .map(normalize)
        .join(" ");
      return haystack.includes(q);
    });
  }, [localBranches, query, statusFilter, statusOverrides]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => {
      if (sortKey === "is_active") {
        const diff = Number(getStatus(a)) - Number(getStatus(b));
        return sortDir === "asc" ? diff : -diff;
      }
      const left = normalize(a[sortKey]);
      const right = normalize(b[sortKey]);
      const diff = collator.compare(left, right);
      return sortDir === "asc" ? diff : -diff;
    });
    return rows;
  }, [filtered, sortDir, sortKey, statusOverrides]);

  function toggleSort(nextKey: SortKey) {
    if (nextKey === sortKey) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDir("asc");
  }

  const sortLabel = sortDir === "asc" ? "ASC" : "DESC";

  function resetFilters() {
    setQuery("");
    setStatusFilter("all");
    setSortKey("name");
    setSortDir("asc");
  }

  return (
    <div className="w-full -mx-4 px-4 lg:-mx-8 lg:px-8 py-6 space-y-6">
      {mapModalSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-3xl rounded-xl shadow-xl">
            <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
              <div className="text-sm font-semibold">Branch location</div>
              <button
                type="button"
                onClick={() => setMapModalSrc(null)}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
              >
                Close
              </button>
            </div>
            <div className="p-4">
              <div className="overflow-hidden rounded-lg bg-background shadow-md">
                <iframe
                  title="Branch location map"
                  src={mapModalSrc}
                  width="100%"
                  height="360"
                  style={{ border: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>
          </Card>
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold">Branches list</h1>
          <p className="text-sm text-muted-foreground">See information about all branches</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center rounded-md border border-slate-200 bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-md transition hover:bg-slate-50 hover:shadow-lg"
          >
            <svg viewBox="0 0 24 24" className="-ml-1 mr-2 h-4 w-4" aria-hidden="true">
              <path
                d="M4 6h16M7 12h10M10 18h4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            View All
          </button>
          <Link
            href={`/company/${companyId}/branches/new`}
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
            Add Branch
          </Link>
        </div>
      </div>

      <Card className="rounded-2xl border-x border-border/30 bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/30 px-4 py-3">
          <div className="inline-flex rounded-lg bg-muted/40 p-1 text-xs">
            {(["all", "active", "inactive"] as const).map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setStatusFilter(val)}
                className={`rounded-md px-3 py-1.5 font-medium transition ${
                  statusFilter === val
                    ? "bg-background text-foreground shadow-sm border border-border/40"
                    : "border border-transparent text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {val === "all" ? "All" : val === "active" ? "Active" : "Inactive"}
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
        {statusError && (
          <div className="px-4 pt-3 text-xs text-red-500">{statusError}</div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr className="text-left bg-muted/20">
                <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => toggleSort("name")}
                    className="inline-flex items-center gap-2 hover:text-foreground"
                  >
                    Branch
                    {sortKey === "name" && <span className="text-[10px] text-muted-foreground">{sortLabel}</span>}
                  </button>
                </th>
                <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => toggleSort("city")}
                    className="inline-flex items-center gap-2 hover:text-foreground"
                  >
                    Location
                    {sortKey === "city" && <span className="text-[10px] text-muted-foreground">{sortLabel}</span>}
                  </button>
                </th>
                <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => toggleSort("phone")}
                    className="inline-flex items-center gap-2 hover:text-foreground"
                  >
                    Phone
                    {sortKey === "phone" && <span className="text-[10px] text-muted-foreground">{sortLabel}</span>}
                  </button>
                </th>
                <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
                  Location
                </th>
                <th className="px-4 py-3 sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => toggleSort("is_active")}
                    className="inline-flex items-center gap-2 hover:text-foreground"
                  >
                    Status
                    {sortKey === "is_active" && <span className="text-[10px] text-muted-foreground">{sortLabel}</span>}
                  </button>
                </th>
                <th className="px-4 py-3 text-right sticky top-0 bg-muted/20 backdrop-blur border-b border-border/30 text-xs font-semibold text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td className="px-3 py-6 text-muted-foreground text-center" colSpan={8}>
                    Loading branches...
                  </td>
                </tr>
              )}
              {!loading && loadError && (
                <tr>
                  <td className="px-3 py-6 text-red-500 text-center" colSpan={8}>
                    {loadError}
                  </td>
                </tr>
              )}
              {!loading && !loadError && sorted.length === 0 && (
                <tr>
                  <td className="px-3 py-6 text-muted-foreground text-center" colSpan={8}>
                    No branches found.
                  </td>
                </tr>
              )}
              {sorted.map((branch) => {
                const isActive = getStatus(branch);
                const isUpdating = statusUpdating[branch.id] ?? false;
                return (
                <tr key={branch.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 border-b border-border/30">
                    <div className="font-medium text-foreground">{safeText(branch.name)}</div>
                    <div className="text-xs text-muted-foreground">Code: {safeText(branch.code)}</div>
                  </td>
                  <td className="px-4 py-3 border-b border-border/30">
                    <div className="font-medium text-foreground">{safeText(branch.city)}</div>
                    <div className="text-xs text-muted-foreground">{safeText(branch.country)}</div>
                  </td>
                  <td className="px-4 py-3 border-b border-border/30">
                    {safeText(branch.phone)}
                  </td>
                  <td className="px-4 py-3 border-b border-border/30">
                    {extractEmbedSrc((branch as any).google_location ?? (branch as any).googleLocation) ? (
                      <button
                        type="button"
                        onClick={() =>
                          setMapModalSrc(
                            extractEmbedSrc((branch as any).google_location ?? (branch as any).googleLocation)
                          )
                        }
                        className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
                      >
                        Show location
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 border-b border-border/30">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${
                          isActive
                            ? "bg-emerald-500/15 text-emerald-600"
                            : "bg-amber-500/15 text-amber-600"
                        }`}
                      >
                        {isActive ? "Active" : "Inactive"}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isActive}
                        aria-busy={isUpdating}
                        disabled={isUpdating}
                        onClick={() => toggleStatus(branch)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-60 ${
                          isActive
                            ? "border-emerald-400 bg-emerald-500/30"
                            : "border-border/40 bg-muted/40"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                            isActive ? "translate-x-4" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right border-b border-border/30">
                    <Link
                      href={`/company/${companyId}/branches/${branch.id}/edit`}
                      className="inline-flex items-center rounded-md border border-white/30 bg-primary px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground shadow-sm transition hover:opacity-90 hover:shadow-md"
                    >
                      <svg viewBox="0 0 24 24" className="-ml-1 mr-2 h-4 w-4" aria-hidden="true">
                        <path
                          d="M4 20l4.5-1 9.4-9.4a1.5 1.5 0 0 0 0-2.1l-1.4-1.4a1.5 1.5 0 0 0-2.1 0L5 15.5 4 20Z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Edit
                    </Link>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 text-xs text-muted-foreground">
          <span>
            Page 1 of 1
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              disabled
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
              disabled
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
      </Card>
    </div>
  );
}
