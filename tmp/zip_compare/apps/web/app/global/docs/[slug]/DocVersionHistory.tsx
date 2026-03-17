"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type DocVersion = {
  id: string;
  versionNo: number;
  versionLabel: string;
  changeType: "major" | "minor" | "patch";
  changelog?: string;
  createdAt: string;
  isPublished: boolean;
  isCurrent: boolean;
};

export function DocVersionHistory({ slug }: { slug: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [versions, setVersions] = useState<DocVersion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const loadVersions = async () => {
    setLoading(true);
    setError(null);
    setUnavailable(false);
    try {
      const res = await fetch(`/api/global/docs/${slug}/versions?limit=20`, { cache: "no-store" });
      const json = (await res.json()) as { data?: DocVersion[]; error?: string; unavailable?: boolean };
      if (!res.ok) throw new Error(json.error ?? "Failed to load versions.");
      if (json.unavailable) {
        setUnavailable(true);
        setVersions([]);
        return;
      }
      setVersions(Array.isArray(json.data) ? json.data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load versions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadVersions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const handlePublish = async (versionId: string) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/global/docs/${slug}/publish/${versionId}`, { method: "POST" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to publish.");
      await loadVersions();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to publish.");
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = async (versionId: string) => {
    const ok = window.confirm("Revert to this version?");
    if (!ok) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/global/docs/${slug}/revert/${versionId}`, { method: "POST" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to revert.");
      await loadVersions();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to revert.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-background/80 p-4 shadow-lg">
      <div className="mb-3 border-b border-white/10 pb-2">
        <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-foreground">Versions</h3>
      </div>
      {loading ? <p className="text-sm text-muted-foreground">Loading versions...</p> : null}
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
      {!loading && unavailable ? (
        <p className="text-xs text-muted-foreground">
          Version history is currently unavailable until docs versioning migration is applied.
        </p>
      ) : null}
      {!loading && !unavailable && versions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No versions yet.</p>
      ) : null}
      <div className="space-y-2">
        {versions.map((version) => (
          <div key={version.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">
                v{version.versionLabel}{" "}
                <span className="text-xs font-normal text-muted-foreground">({version.changeType})</span>
              </p>
              <div className="flex items-center gap-2">
                {version.isCurrent ? (
                  <span className="rounded-full border border-emerald-300/50 px-2 py-0.5 text-[10px] uppercase text-emerald-100">
                    Current
                  </span>
                ) : null}
                {!version.isPublished ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handlePublish(version.id)}
                    className="rounded border border-primary/60 bg-primary/15 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-primary disabled:opacity-60"
                  >
                    Publish
                  </button>
                ) : null}
                {!version.isCurrent ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleRevert(version.id)}
                    className="rounded border border-white/30 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-white/90 disabled:opacity-60"
                  >
                    Revert
                  </button>
                ) : null}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{new Date(version.createdAt).toLocaleString()}</p>
            {version.changelog ? <p className="mt-1 text-xs text-foreground/85">{version.changelog}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
