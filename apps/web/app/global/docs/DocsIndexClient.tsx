"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MarkdownRenderer } from "./components/MarkdownRenderer";

type DocSummary = {
  slug: string;
  title: string;
  section: string;
  excerpt: string;
  updatedAt: string;
  relativePath: string;
};

type DocDetail = DocSummary & { content: string };

type DocActionLog = {
  id: string;
  action: "create" | "edit" | "delete" | "draft" | "publish" | "revert";
  slug: string;
  title: string;
  relativePath: string;
  createdAt: string;
  details?: string;
};

type LogTimeframe = "all" | "today" | "7d" | "30d";

const ORDER = ["root", "global", "company", "vendors", "workshop"];

const sectionSort = (a: string, b: string) => {
  const ra = ORDER.indexOf(a);
  const rb = ORDER.indexOf(b);
  const va = ra === -1 ? 999 : ra;
  const vb = rb === -1 ? 999 : rb;
  return va === vb ? a.localeCompare(b) : va - vb;
};

function toSectionTitle(section: string) {
  if (section === "root") return "Overview";
  return section
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeSection(section: string) {
  return (section || "root").toLowerCase().trim() || "root";
}

function inferSection(relativePath: string) {
  const normalized = (relativePath || "").replace(/\\/g, "/");
  return normalized.includes("/") ? normalized.split("/")[0] || "root" : "root";
}

function inTimeframe(iso: string, timeframe: LogTimeframe) {
  if (timeframe === "all") return true;
  const now = new Date();
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return false;
  if (timeframe === "today") return now.toDateString() === at.toDateString();
  const days = timeframe === "7d" ? 7 : 30;
  return now.getTime() - at.getTime() <= days * 86400000;
}

export function DocsIndexClient({ docs }: { docs: DocSummary[] }) {
  const [docsData, setDocsData] = useState<DocSummary[]>(docs);
  const [logs, setLogs] = useState<DocActionLog[]>([]);
  const [query, setQuery] = useState("");
  const [activeSection, setActiveSection] = useState("all");
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createSection, setCreateSection] = useState("root");
  const [createContent, setCreateContent] = useState("# New Documentation\n\n## Overview\n\n");

  const [editing, setEditing] = useState<DocDetail | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSection, setEditSection] = useState("root");
  const [editContent, setEditContent] = useState("");
  const [step, setStep] = useState<1 | 2>(1);

  const [logAction, setLogAction] = useState<"all" | "create" | "edit" | "delete" | "draft" | "publish" | "revert">("all");
  const [logSection, setLogSection] = useState("all");
  const [logTimeframe, setLogTimeframe] = useState<LogTimeframe>("all");

  const sections = useMemo(() => Array.from(new Set(docsData.map((d) => d.section))).sort(sectionSort), [docsData]);

  const filteredDocs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return docsData.filter((d) => {
      if (activeSection !== "all" && d.section !== activeSection) return false;
      if (!q) return true;
      return [d.title, d.excerpt, d.relativePath].some((v) => v.toLowerCase().includes(q));
    });
  }, [docsData, query, activeSection]);

  const grouped = useMemo(() => {
    const m = new Map<string, DocSummary[]>();
    for (const d of filteredDocs) {
      const arr = m.get(d.section) ?? [];
      arr.push(d);
      m.set(d.section, arr);
    }
    return m;
  }, [filteredDocs]);

  const sectionKeys = useMemo(() => Array.from(grouped.keys()).sort(sectionSort), [grouped]);
  const logSections = useMemo(() => Array.from(new Set(logs.map((l) => inferSection(l.relativePath)))).sort(sectionSort), [logs]);

  const filteredLogs = useMemo(
    () =>
      logs.filter((l) => {
        if (logAction !== "all" && l.action !== logAction) return false;
        if (logSection !== "all" && inferSection(l.relativePath) !== logSection) return false;
        return inTimeframe(l.createdAt, logTimeframe);
      }),
    [logs, logAction, logSection, logTimeframe]
  );

  const refresh = async () => {
    const [docsRes, logsRes] = await Promise.all([
      fetch("/api/global/docs", { cache: "no-store" }),
      fetch("/api/global/docs/logs?limit=80", { cache: "no-store" }),
    ]);
    const docsJson = (await docsRes.json()) as { data?: DocSummary[]; error?: string };
    if (!docsRes.ok) throw new Error(docsJson.error ?? "Failed to load docs.");
    setDocsData(docsJson.data ?? []);
    const logsJson = (await logsRes.json()) as { data?: DocActionLog[] };
    if (logsRes.ok) setLogs(logsJson.data ?? []);
  };

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const raw = window.localStorage.getItem("docs-collapsed");
    if (!raw) return;
    try {
      setCollapsed(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      // ignore malformed data
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("docs-collapsed", JSON.stringify(collapsed));
  }, [collapsed]);

  const closeEditor = () => {
    setCreateOpen(false);
    setEditing(null);
    setStep(1);
  };

  const openCreate = () => {
    setEditing(null);
    setCreateOpen(true);
    setStep(1);
  };

  const saveCreate = async () => {
    if (!createTitle.trim()) return setError("Title is required.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/global/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: createTitle.trim(), section: normalizeSection(createSection), content: createContent }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Create failed.");
      setCreateTitle("");
      setCreateSection("root");
      setCreateContent("# New Documentation\n\n## Overview\n\n");
      closeEditor();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed.");
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (slug: string) => {
    window.open(`/global/docs/edit/${slug}`, "_blank", "noopener,noreferrer");
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editTitle.trim()) return setError("Title is required.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/global/docs/${editing.slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle.trim(), section: normalizeSection(editSection), content: editContent }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Update failed.");
      closeEditor();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  };

  const removeDoc = async (slug: string, title: string) => {
    if (!window.confirm(`Delete "${title}"?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/global/docs/${slug}`, { method: "DELETE" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Delete failed.");
      if (editing?.slug === slug) closeEditor();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async (slug: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/global/docs/${slug}`);
    setCopiedSlug(slug);
    window.setTimeout(() => setCopiedSlug((v) => (v === slug ? null : v)), 1400);
  };

  const exportAllPdf = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/global/docs/export/pdf");
      if (!res.ok) {
        let message = "Failed to export PDF.";
        try {
          const json = (await res.json()) as { error?: string };
          if (json?.error) message = json.error;
        } catch {
          // ignore non-json failures
        }
        throw new Error(message);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `global-erp-docs-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to export PDF.");
    } finally {
      setBusy(false);
    }
  };

  const actionLabel = (action: DocActionLog["action"]) => {
    if (action === "create") return "Created";
    if (action === "edit") return "Updated";
    if (action === "delete") return "Deleted";
    if (action === "draft") return "Draft";
    if (action === "publish") return "Published";
    return "Reverted";
  };

  const activeTitle = editing ? editTitle : createTitle;
  const activeSectionInput = editing ? editSection : createSection;
  const activeContent = editing ? editContent : createContent;

  return (
    <div className="mx-auto w-full max-w-[1720px] space-y-4 py-4 lg:py-6">
      <header className="rounded-2xl border border-border bg-background/80 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/95">Documentation</p>
            <h1 className="text-3xl font-semibold text-foreground">Global docs</h1>
          </div>
          <Link href="/global" className="rounded-full border border-border bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground transition hover:border-border">
            Back to dashboard
          </Link>
        </div>
      </header>

      {error && <div className="rounded-2xl border border-red-400/30 bg-red-950/20 p-3 text-sm text-red-200">{error}</div>}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-2xl border border-border bg-background/80 p-4">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button type="button" onClick={openCreate} className="rounded-xl border border-primary/60 bg-primary/15 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary transition hover:bg-primary/20">
              New doc
            </button>
            <button
              type="button"
              onClick={() => void exportAllPdf()}
              disabled={busy}
              className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-foreground transition hover:border-border disabled:opacity-60"
            >
              {busy ? "Exporting..." : "Export PDF"}
            </button>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search docs"
              className="h-9 min-w-56 flex-1 rounded-xl border border-border bg-black/20 px-3 text-sm text-foreground outline-none focus:border-primary/60"
            />
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setActiveSection("all")} className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ${activeSection === "all" ? "border-primary/60 bg-primary/15 text-primary" : "border-border text-foreground/80"}`}>
                All
              </button>
              {sections.map((s) => (
                <button key={s} type="button" onClick={() => setActiveSection(s)} className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ${activeSection === s ? "border-primary/60 bg-primary/15 text-primary" : "border-border text-foreground/80"}`}>
                  {toSectionTitle(s)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {sectionKeys.length === 0 && <p className="text-sm text-muted-foreground/95">No docs found for selected filters.</p>}
            {sectionKeys.map((key) => {
              const sectionDocs = (grouped.get(key) ?? []).sort((a, b) => a.title.localeCompare(b.title));
              const isCollapsed = Boolean(collapsed[key]);
              return (
                <div key={key} className="rounded-xl border border-border bg-card/30">
                  <button
                    type="button"
                    onClick={() => setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }))}
                    className="flex w-full items-center justify-between px-3 py-2 text-left"
                  >
                    <span className="text-sm font-semibold uppercase tracking-[0.12em] text-foreground">{toSectionTitle(key)}</span>
                    <span className="text-xs text-foreground/70">{isCollapsed ? "Expand" : "Collapse"}</span>
                  </button>
                  {!isCollapsed && (
                    <div className="space-y-2 border-t border-border p-2">
                      {sectionDocs.map((doc) => (
                        <div key={doc.slug} className="rounded-lg border border-border bg-black/20 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <Link href={`/global/docs/${doc.slug}`} className="text-sm font-semibold text-foreground hover:text-primary">
                                {doc.title}
                              </Link>
                              <p className="mt-1 text-[11px] text-muted-foreground">{doc.relativePath}</p>
                              <p className="text-[11px] text-muted-foreground">Updated {new Date(doc.updatedAt).toLocaleDateString()}</p>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              <button type="button" onClick={() => copyLink(doc.slug)} className="rounded-full border border-border px-2 py-0.5 text-[10px] text-foreground/80">
                                {copiedSlug === doc.slug ? "Copied" : "Copy"}
                              </button>
                              <button type="button" onClick={() => void startEdit(doc.slug)} className="rounded-full border border-border px-2 py-0.5 text-[10px] text-foreground/80">
                                Edit
                              </button>
                              <button type="button" onClick={() => void removeDoc(doc.slug, doc.title)} className="rounded-full border border-red-400/30 px-2 py-0.5 text-[10px] text-red-200">
                                Delete
                              </button>
                            </div>
                          </div>
                          <p className="mt-2 text-xs text-foreground/70">{doc.excerpt}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-border bg-background/80 p-4">
            <h2 className="text-lg font-semibold text-foreground">Activity</h2>
            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap gap-1">
                {(["all", "create", "edit", "delete", "draft", "publish", "revert"] as const).map((a) => (
                  <button key={a} type="button" onClick={() => setLogAction(a)} className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${logAction === a ? "border-primary/60 bg-primary/15 text-primary" : "border-border text-foreground/80"}`}>
                    {a}
                  </button>
                ))}
              </div>
              <select value={logSection} onChange={(e) => setLogSection(e.target.value)} className="h-8 w-full rounded-lg border border-border bg-black/20 px-2 text-xs text-foreground">
                <option value="all">All sections</option>
                {logSections.map((s) => (
                  <option key={s} value={s}>
                    {toSectionTitle(s)}
                  </option>
                ))}
              </select>
              <select value={logTimeframe} onChange={(e) => setLogTimeframe(e.target.value as LogTimeframe)} className="h-8 w-full rounded-lg border border-border bg-black/20 px-2 text-xs text-foreground">
                <option value="all">All time</option>
                <option value="today">Today</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
              </select>
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {filteredLogs.slice(0, 20).map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-border bg-black/20 p-2">
                    <p className="text-[10px] font-semibold uppercase text-primary">{actionLabel(entry.action)}</p>
                    <p className="text-xs font-semibold text-foreground">{entry.title}</p>
                    <p className="text-[11px] text-muted-foreground">{entry.relativePath}</p>
                  </div>
                ))}
                {filteredLogs.length === 0 && <p className="text-xs text-muted-foreground">No activity for selected filters.</p>}
              </div>
            </div>
          </div>

          {(createOpen || editing) && (
            <div className="rounded-2xl border border-border bg-background/80 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">{editing ? "Edit document" : "Create document"}</h2>
                <span className="rounded-full border border-border px-2.5 py-1 text-[10px] uppercase text-foreground/80">Step {step} / 2</span>
              </div>
              {step === 1 ? (
                <div className="space-y-2">
                  <input value={activeTitle} onChange={(e) => (editing ? setEditTitle(e.target.value) : setCreateTitle(e.target.value))} className="h-9 w-full rounded-lg border border-border bg-black/20 px-2.5 text-sm text-foreground outline-none focus:border-primary/60" placeholder="Document title" />
                  <input value={activeSectionInput} onChange={(e) => (editing ? setEditSection(e.target.value) : setCreateSection(e.target.value))} className="h-9 w-full rounded-lg border border-border bg-black/20 px-2.5 text-sm text-foreground outline-none focus:border-primary/60" placeholder="root, global, company, vendors, workshop" />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { if (!activeTitle.trim()) return setError("Title is required."); setStep(2); }} className="rounded-lg border border-primary/60 bg-primary/15 px-3 py-1.5 text-[11px] font-semibold uppercase text-primary">
                      Next
                    </button>
                    <button type="button" onClick={closeEditor} className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold uppercase text-foreground/90">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea value={activeContent} onChange={(e) => (editing ? setEditContent(e.target.value) : setCreateContent(e.target.value))} className="min-h-48 w-full rounded-lg border border-border bg-black/20 p-2.5 text-sm text-foreground outline-none focus:border-primary/60" />
                  <div className="max-h-56 overflow-y-auto rounded-lg border border-border bg-black/20 p-2.5">
                    <MarkdownRenderer text={activeContent} />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setStep(1)} className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold uppercase text-foreground/90">
                      Back
                    </button>
                    <button type="button" onClick={editing ? saveEdit : saveCreate} disabled={busy} className="rounded-lg border border-primary/60 bg-primary/15 px-3 py-1.5 text-[11px] font-semibold uppercase text-primary disabled:opacity-60">
                      {busy ? "Saving..." : editing ? "Save" : "Create"}
                    </button>
                    <button type="button" onClick={closeEditor} className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold uppercase text-foreground/90">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
