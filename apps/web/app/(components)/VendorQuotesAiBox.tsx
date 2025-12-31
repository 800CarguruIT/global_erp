"use client";

import React, { useEffect, useState } from "react";

export function VendorQuotesAiBox({ companyId }: { companyId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actions, setActions] = useState<string[]>([]);
  const [appreciation, setAppreciation] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/company/${companyId}/quotes/vendor/ai-summary`);
        if (!res.ok) throw new Error("AI unavailable");
        const json = await res.json();
        if (cancelled) return;
        setActions(Array.isArray(json.suggestions) ? json.suggestions : []);
        setAppreciation(json.appreciation ?? null);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "AI unavailable");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <section className="rounded-lg border p-3">
        <div className="text-sm font-semibold">AI suggestions</div>
        {loading && <div className="text-sm text-muted-foreground">Thinking...</div>}
        {error && <div className="text-sm text-destructive">{error}</div>}
        {!loading && !error && (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {actions.length === 0 && <li>No suggestions yet.</li>}
            {actions.map((s, idx) => (
              <li key={`ai-s-${idx}`}>{s}</li>
            ))}
          </ul>
        )}
      </section>
      <section className="rounded-lg border p-3">
        <div className="text-sm font-semibold">AI appreciation</div>
        <div className="mt-2 text-sm text-muted-foreground">
          {loading ? "Thinking..." : appreciation ?? "No notes yet."}
        </div>
      </section>
    </div>
  );
}
