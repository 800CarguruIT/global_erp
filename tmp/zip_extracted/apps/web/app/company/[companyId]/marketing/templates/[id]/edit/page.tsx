"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppLayout } from "@repo/ui";
import { TemplateForm } from "../../_components/TemplateForm";

type TabId = "whatsapp" | "email";

type TemplateRow = {
  id: string;
  type: TabId;
  name: string;
  status: string;
  provider_key: string;
  provider_status: string | null;
  published_at: string | null;
  created_at: string;
  content: Record<string, unknown>;
};

export default function CompanyMarketingTemplatesEditPage() {
  const params = useParams<{ companyId: string; id: string }>();
  const router = useRouter();
  const companyId = params?.companyId ?? "";
  const templateId = params?.id ?? "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<TemplateRow | null>(null);

  useEffect(() => {
    if (!companyId || !templateId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/company/${companyId}/marketing/templates/${templateId}`
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Failed to load template");
        if (!cancelled) setItem(body.item as TemplateRow);
      } catch (err: unknown) {
        console.error(err);
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load template");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [companyId, templateId]);

  const backHref = useMemo(() => {
    const tab = item?.type ?? "whatsapp";
    return companyId
      ? `/company/${companyId}/marketing/templates?tab=${tab}`
      : "/marketing/templates";
  }, [companyId, item?.type]);

  return (
    <AppLayout>
      <div className="space-y-6 py-4">
        <div>
          <h1 className="text-2xl font-semibold">Edit template</h1>
          <p className="text-sm text-muted-foreground">
            Update template details and preview changes before publishing.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            className="rounded-full border border-white/10 px-3 py-1 text-xs hover:border-primary"
            onClick={() => router.push(backHref)}
          >
            Back to templates
          </button>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading template...</div>
        ) : error ? (
          <div className="text-sm text-red-400">{error}</div>
        ) : item ? (
          <TemplateForm
            companyId={companyId}
            type={item.type}
            initial={item}
            onSaved={() => router.push(backHref)}
          />
        ) : (
          <div className="text-sm text-muted-foreground">Template not found.</div>
        )}
      </div>
    </AppLayout>
  );
}
