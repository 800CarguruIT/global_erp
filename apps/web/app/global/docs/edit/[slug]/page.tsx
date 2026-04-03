"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppLayout } from "@repo/ui";
import { MarkdownRenderer } from "../../components/MarkdownRenderer";

type DocDetail = {
  slug: string;
  title: string;
  section: string;
  content: string;
  relativePath: string;
  currentVersionLabel?: string;
  currentVersionNo?: number;
};

type DocVersion = {
  id: string;
  versionNo: number;
  versionLabel: string;
  changeType: "major" | "minor" | "patch";
  changelog?: string;
  createdAt: string;
  publishedAt?: string;
  isPublished: boolean;
  isCurrent: boolean;
};

type StylePreset = "readable" | "step-by-step" | "executive";

function applyStylePreset(content: string, preset: StylePreset): string {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (!normalized) return content;

  if (preset === "readable") {
    return normalized
      .replace(/\n{3,}/g, "\n\n")
      .replace(/\n(#{1,6}\s)/g, "\n\n$1")
      .replace(/\n(-\s)/g, "\n$1")
      .trim();
  }

  if (preset === "step-by-step") {
    const hasGuideHeading = /##\s+How to Use/i.test(normalized);
    const stepsBlock = [
      "## How to Use",
      "",
      "1. Open the required module/page.",
      "2. Click the target action button.",
      "3. Fill or update required fields.",
      "4. Save and verify changes.",
      "",
    ].join("\n");
    return `${hasGuideHeading ? "" : `${stepsBlock}`}${normalized}`.trim();
  }

  const hasSummary = /##\s+Executive Summary/i.test(normalized);
  const summaryBlock = [
    "## Executive Summary",
    "",
    "- Purpose: Define the business outcome of this document.",
    "- Scope: Clarify who should use it and when.",
    "- Outcome: State what should happen after execution.",
    "",
  ].join("\n");
  return `${hasSummary ? "" : `${summaryBlock}`}${normalized}`.trim();
}

export default function DocEditWindowPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doc, setDoc] = useState<DocDetail | null>(null);
  const [versions, setVersions] = useState<DocVersion[]>([]);

  const [title, setTitle] = useState("");
  const [section, setSection] = useState("root");
  const [content, setContent] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [stylePreset, setStylePreset] = useState<StylePreset>("readable");
  const [changeType, setChangeType] = useState<"major" | "minor" | "patch">("patch");
  const [changelog, setChangelog] = useState("");

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/global/docs/${slug}`, { cache: "no-store" });
        const json = (await res.json()) as { data?: DocDetail; error?: string };
        if (!res.ok || !json.data) throw new Error(json.error ?? "Failed to load document.");
        if (cancelled) return;
        setDoc(json.data);
        setTitle(json.data.title);
        setSection(json.data.section || "root");
        setContent(json.data.content || "");
        const versionsRes = await fetch(`/api/global/docs/${slug}/versions?limit=30`, { cache: "no-store" });
        const versionsJson = (await versionsRes.json()) as { data?: DocVersion[] };
        if (versionsRes.ok) {
          setVersions(Array.isArray(versionsJson.data) ? versionsJson.data : []);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load document.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const canSave = useMemo(() => Boolean(title.trim()) && Boolean(doc?.slug), [title, doc]);

  const refreshVersions = async (targetSlug: string) => {
    const versionsRes = await fetch(`/api/global/docs/${targetSlug}/versions?limit=30`, { cache: "no-store" });
    const versionsJson = (await versionsRes.json()) as { data?: DocVersion[] };
    if (versionsRes.ok) {
      setVersions(Array.isArray(versionsJson.data) ? versionsJson.data : []);
    }
  };

  const handleSave = async (publish: boolean) => {
    if (!doc?.slug || !title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/global/docs/${doc.slug}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          section: (section || "root").toLowerCase().trim(),
          content,
          changeType,
          changelog: changelog.trim() || undefined,
          publish,
        }),
      });
      const json = (await res.json()) as { data?: { doc?: DocDetail }; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to save document.");
      if (json.data?.doc) {
        setDoc(json.data.doc);
        if (publish && json.data.doc.slug !== doc.slug) {
          window.location.href = `/global/docs/edit/${json.data.doc.slug}`;
          return;
        }
        await refreshVersions(json.data.doc.slug);
      } else {
        await refreshVersions(doc.slug);
      }
      setChangelog("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save document.");
    } finally {
      setSaving(false);
    }
  };

  const handlePublishVersion = async (versionId: string) => {
    if (!doc) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/global/docs/${doc.slug}/publish/${versionId}`, { method: "POST" });
      const json = (await res.json()) as { data?: DocDetail; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to publish version.");
      if (json.data) {
        setDoc(json.data);
        setTitle(json.data.title);
        setSection(json.data.section);
        setContent(json.data.content);
        await refreshVersions(json.data.slug);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to publish version.");
    } finally {
      setSaving(false);
    }
  };

  const handleRevertVersion = async (versionId: string) => {
    if (!doc) return;
    const ok = window.confirm("Revert to this version and publish it?");
    if (!ok) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/global/docs/${doc.slug}/revert/${versionId}`, { method: "POST" });
      const json = (await res.json()) as { data?: DocDetail; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to revert version.");
      if (json.data) {
        setDoc(json.data);
        setTitle(json.data.title);
        setSection(json.data.section);
        setContent(json.data.content);
        await refreshVersions(json.data.slug);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to revert version.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-[1400px] space-y-4 py-4 lg:py-6">
        <header className="rounded-2xl border border-border bg-background/80 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground/90">Documentation</p>
              <h1 className="text-2xl font-semibold text-foreground">Edit Document</h1>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/global/docs"
                className="rounded-lg border border-border bg-card/40 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-foreground/90"
              >
                Back to docs
              </Link>
              <button
                type="button"
                onClick={() => window.close()}
                className="rounded-lg border border-border bg-card/40 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-foreground/90"
              >
                Close window
              </button>
            </div>
          </div>
        </header>

        {loading && <div className="rounded-xl border border-border bg-background/80 p-4 text-sm text-muted-foreground">Loading document...</div>}
        {error && <div className="rounded-xl border border-red-400/30 bg-red-950/20 p-4 text-sm text-red-200">{error}</div>}

        {!loading && doc && (
          <section className="rounded-2xl border border-border bg-background/80 p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground/80">{doc.relativePath}</p>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-emerald-300/40 px-2.5 py-1 text-[10px] uppercase text-emerald-100">
                  Current {doc.currentVersionLabel ? `v${doc.currentVersionLabel}` : "version"}
                </span>
                <span className="rounded-full border border-border px-2.5 py-1 text-[10px] uppercase text-foreground/80">Step {step} / 2</span>
              </div>
            </div>

            {step === 1 ? (
              <div className="space-y-3">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-black/20 px-3 text-sm text-foreground outline-none focus:border-primary/60"
                  placeholder="Document title"
                />
                <input
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-black/20 px-3 text-sm text-foreground outline-none focus:border-primary/60"
                  placeholder="root, global, company, vendors, workshop"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!title.trim()) {
                        setError("Title is required.");
                        return;
                      }
                      setError(null);
                      setStep(2);
                    }}
                    className="rounded-lg border border-primary/60 bg-primary/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={stylePreset}
                    onChange={(e) => setStylePreset(e.target.value as StylePreset)}
                    className="h-9 rounded-lg border border-border bg-black/20 px-3 text-xs font-semibold uppercase tracking-[0.1em] text-foreground/90"
                  >
                    <option value="readable">Readable</option>
                    <option value="step-by-step">Step-by-step</option>
                    <option value="executive">Executive</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setContent((prev) => applyStylePreset(prev, stylePreset))}
                    className="rounded-lg border border-border bg-card/40 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-foreground/90"
                  >
                    Apply style
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-muted-foreground/80">Change type</label>
                    <select
                      value={changeType}
                      onChange={(e) => setChangeType(e.target.value as "major" | "minor" | "patch")}
                      className="h-10 w-full rounded-lg border border-border bg-black/20 px-3 text-sm text-foreground outline-none focus:border-primary/60"
                    >
                      <option value="patch">Patch</option>
                      <option value="minor">Minor</option>
                      <option value="major">Major</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] uppercase tracking-[0.12em] text-muted-foreground/80">Changelog</label>
                    <input
                      value={changelog}
                      onChange={(e) => setChangelog(e.target.value)}
                      placeholder="Short summary of changes"
                      className="h-10 w-full rounded-lg border border-border bg-black/20 px-3 text-sm text-foreground outline-none focus:border-primary/60"
                    />
                  </div>
                </div>
                <div className="grid gap-3 xl:grid-cols-2">
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="min-h-96 w-full rounded-lg border border-border bg-black/20 p-3 text-sm text-foreground outline-none focus:border-primary/60"
                  />
                  <div className="min-h-96 rounded-lg border border-border bg-black/20 p-3">
                    <MarkdownRenderer text={content} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="rounded-lg border border-border px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-foreground/90"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSave(false)}
                    disabled={!canSave || saving}
                    className="rounded-lg border border-amber-300/60 bg-amber-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-amber-100 disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Save Draft"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSave(true)}
                    disabled={!canSave || saving}
                    className="rounded-lg border border-primary/60 bg-primary/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary disabled:opacity-60"
                  >
                    {saving ? "Publishing..." : "Publish"}
                  </button>
                </div>
                <div className="rounded-xl border border-border bg-black/20 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground/90">Version history</p>
                  <div className="max-h-56 space-y-2 overflow-auto pr-1">
                    {versions.map((v) => (
                      <div key={v.id} className="rounded-lg border border-border bg-card/30 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground">
                            v{v.versionLabel} <span className="text-xs font-normal text-muted-foreground">({v.changeType})</span>
                          </p>
                          <div className="flex items-center gap-2">
                            {v.isCurrent ? (
                              <span className="rounded-full border border-emerald-300/50 px-2 py-0.5 text-[10px] uppercase text-emerald-100">Current</span>
                            ) : null}
                            {!v.isPublished ? (
                              <button
                                type="button"
                                onClick={() => void handlePublishVersion(v.id)}
                                className="rounded border border-primary/60 bg-primary/15 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-primary"
                              >
                                Publish
                              </button>
                            ) : null}
                            {!v.isCurrent ? (
                              <button
                                type="button"
                                onClick={() => void handleRevertVersion(v.id)}
                                className="rounded border border-border bg-muted/40 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-foreground/90"
                              >
                                Revert
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">{new Date(v.createdAt).toLocaleString()}</p>
                        {v.changelog ? <p className="mt-1 text-xs text-foreground/85">{v.changelog}</p> : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </AppLayout>
  );
}
