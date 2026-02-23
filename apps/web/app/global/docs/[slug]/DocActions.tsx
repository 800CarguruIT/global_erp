"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function DocActions({ slug, title }: { slug: string; title: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    const ok = window.confirm(`Delete "${title}"?`);
    if (!ok) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/global/docs/${slug}`, { method: "DELETE" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Delete failed.");
      router.push("/global/docs");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-2 text-right">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => window.open(`/global/docs/edit/${slug}`, "_blank", "noopener,noreferrer")}
          className="inline-flex rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:border-white/40"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => void handleDelete()}
          disabled={deleting}
          className="inline-flex rounded-full border border-red-400/40 bg-red-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-red-200 transition hover:border-red-300/60 disabled:opacity-60"
        >
          {deleting ? "Deleting..." : "Delete"}
        </button>
        <Link
          href="/global/docs"
          className="inline-flex rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:border-white/40"
        >
          Back to docs
        </Link>
      </div>
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
