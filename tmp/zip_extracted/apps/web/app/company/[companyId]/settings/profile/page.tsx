"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppLayout, CompanyForm, CompanyFormValues } from "@repo/ui";

export default function CompanyProfileSettingsPage() {
  const params = useParams();
  const companyId = Array.isArray(params?.companyId) ? params.companyId[0] : (params?.companyId as string | undefined);

  const [initial, setInitial] = useState<CompanyFormValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/company/${companyId}/profile`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load company");
        const data = await res.json().catch(() => ({}));
        if (active) {
          const company = data?.data?.company ?? data?.data ?? data;
          setInitial(company ?? null);
        }
      } catch (err: any) {
        if (active) setError(err?.message ?? "Failed to load company");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [companyId]);

  const handleSubmit = async (values: CompanyFormValues) => {
    if (!companyId) return;
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/company/${companyId}/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      throw new Error(detail?.error || `Failed to save (${res.status})`);
    }
    setMessage("Saved");
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6 py-6">
        <div className="space-y-1">
          <p className="text-xs uppercase text-muted-foreground">Company</p>
          <h1 className="text-2xl font-semibold">Edit Company</h1>
          <p className="text-sm text-muted-foreground">Manage this company profile, documents, and tax settings.</p>
        </div>

        {error && <div className="text-red-400 text-sm">{error}</div>}
        {message && <div className="text-green-400 text-sm">{message}</div>}

        {loading || !initial ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (
          <CompanyForm mode="edit" initialValues={initial} onSubmit={handleSubmit} />
        )}
      </div>
    </AppLayout>
  );
}
