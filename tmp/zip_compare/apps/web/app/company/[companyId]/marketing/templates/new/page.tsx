"use client";

import React, { useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AppLayout } from "@repo/ui";
import { TemplateForm } from "../_components/TemplateForm";

type TabId = "whatsapp" | "email";

export default function CompanyMarketingTemplatesNewPage() {
  const params = useParams<{ companyId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyId = params?.companyId ?? "";

  const type = useMemo<TabId>(() => {
    const val = searchParams.get("type");
    return val === "email" ? "email" : "whatsapp";
  }, [searchParams]);

  const backHref = companyId
    ? `/company/${companyId}/marketing/templates?tab=${type}`
    : "/marketing/templates";

  function switchType(next: TabId) {
    const base = companyId
      ? `/company/${companyId}/marketing/templates/new`
      : "/marketing/templates/new";
    router.replace(`${base}?type=${next}`);
  }

  return (
    <AppLayout>
      <div className="space-y-6 py-4">
        <div>
          <h1 className="text-2xl font-semibold">New template</h1>
          <p className="text-sm text-muted-foreground">
            Create a {type === "whatsapp" ? "WhatsApp" : "Email"} template.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            className="rounded-full border border-white/10 px-3 py-1 text-xs hover:border-primary"
            onClick={() => router.push(backHref)}
          >
            Back to templates
          </button>
          <button
            className={
              type === "whatsapp"
                ? "rounded-full border border-primary px-3 py-1 text-xs text-primary"
                : "rounded-full border border-white/10 px-3 py-1 text-xs hover:border-primary"
            }
            onClick={() => switchType("whatsapp")}
          >
            WhatsApp
          </button>
          <button
            className={
              type === "email"
                ? "rounded-full border border-primary px-3 py-1 text-xs text-primary"
                : "rounded-full border border-white/10 px-3 py-1 text-xs hover:border-primary"
            }
            onClick={() => switchType("email")}
          >
            Email
          </button>
        </div>

        <TemplateForm
          companyId={companyId}
          type={type}
          onSaved={() => router.push(backHref)}
        />
      </div>
    </AppLayout>
  );
}
