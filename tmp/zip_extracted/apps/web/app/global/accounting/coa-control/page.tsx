"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card } from "@repo/ui";

type Company = { id: string; name: string; display_name?: string; legal_name?: string };
type HeadingRow = {
  id: string;
  headCode: string;
  name: string;
  financialStmt: string;
  enabled: boolean;
  isOverride: boolean;
};
type SubheadingRow = {
  id: string;
  headCode: string;
  headingName: string;
  subheadCode: string;
  name: string;
  enabled: boolean;
  isOverride: boolean;
};

export default function CoaControlPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [headings, setHeadings] = useState<HeadingRow[]>([]);
  const [subheadings, setSubheadings] = useState<SubheadingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadCompanies() {
      try {
        const res = await fetch("/api/master/companies", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load companies");
        const data = await res.json();
        const list: Company[] = data?.data ?? data ?? [];
        if (active) {
          setCompanies(list);
          if (!selectedCompanyId && list.length) setSelectedCompanyId(list[0].id);
        }
      } catch (err: any) {
        if (active) setError(err?.message ?? "Failed to load companies");
      }
    }
    loadCompanies();
    return () => {
      active = false;
    };
  }, [selectedCompanyId]);

  useEffect(() => {
    let active = true;
    async function loadControlData() {
      if (!selectedCompanyId) return;
      setLoading(true);
      setError(null);
      try {
        const [headRes, subRes] = await Promise.all([
          fetch(`/api/global/accounting/coa-headings?companyId=${selectedCompanyId}`, { cache: "no-store" }),
          fetch(`/api/global/accounting/coa-subheadings?companyId=${selectedCompanyId}`, { cache: "no-store" }),
        ]);
        if (!headRes.ok) throw new Error("Failed to load headings");
        if (!subRes.ok) throw new Error("Failed to load subheadings");
        const headJson = await headRes.json();
        const subJson = await subRes.json();
        if (active) {
          setHeadings(headJson.data ?? []);
          setSubheadings(subJson.data ?? []);
        }
      } catch (err: any) {
        if (active) setError(err?.message ?? "Failed to load data");
      } finally {
        if (active) setLoading(false);
      }
    }
    loadControlData();
    return () => {
      active = false;
    };
  }, [selectedCompanyId]);

  const groupedSubheadings = useMemo(() => {
    const map = new Map<string, SubheadingRow[]>();
    for (const s of subheadings) {
      if (!map.has(s.headCode)) map.set(s.headCode, []);
      map.get(s.headCode)?.push(s);
    }
    for (const [key, list] of map) {
      list.sort((a, b) => a.subheadCode.localeCompare(b.subheadCode));
      map.set(key, list);
    }
    return map;
  }, [subheadings]);

  async function toggleHeading(headCode: string, enabled: boolean) {
    if (!selectedCompanyId) return;
    await fetch("/api/global/accounting/coa-headings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: selectedCompanyId, headCode, enabled }),
    });
    setHeadings((prev) =>
      prev.map((h) => (h.headCode === headCode ? { ...h, enabled, isOverride: true } : h))
    );
  }

  async function toggleSubheading(headCode: string, subheadCode: string, enabled: boolean) {
    if (!selectedCompanyId) return;
    await fetch("/api/global/accounting/coa-subheadings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: selectedCompanyId, headCode, subheadCode, enabled }),
    });
    setSubheadings((prev) =>
      prev.map((s) =>
        s.headCode === headCode && s.subheadCode === subheadCode ? { ...s, enabled, isOverride: true } : s
      )
    );
  }

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-semibold">COA Controls</h1>
        <p className="text-sm text-muted-foreground">
          Enable or disable headings and subheadings per company (global admin).
        </p>
      </div>

      <Card className="p-4 space-y-3">
        <div className="text-sm font-semibold">Company</div>
        <select
          className="w-full max-w-md rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white/30"
          value={selectedCompanyId}
          onChange={(e) => setSelectedCompanyId(e.target.value)}
        >
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.display_name || c.legal_name || c.name}
            </option>
          ))}
        </select>
      </Card>

      {error && <div className="text-sm text-destructive">{error}</div>}
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : (
        <div className="space-y-4">
          {headings.map((h) => (
            <Card key={h.headCode} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">
                    {h.headCode} - {h.name}
                  </div>
                  <div className="text-xs text-muted-foreground">{h.financialStmt}</div>
                </div>
                <label className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-white/70">
                  <input
                    type="checkbox"
                    checked={h.enabled}
                    onChange={(e) => toggleHeading(h.headCode, e.target.checked)}
                  />
                  Enabled
                </label>
              </div>
              <div className="space-y-2">
                {(groupedSubheadings.get(h.headCode) ?? []).map((s) => (
                  <div key={`${s.headCode}-${s.subheadCode}`} className="flex items-center justify-between rounded-lg border border-white/5 px-3 py-2">
                    <div className="text-sm">
                      {s.subheadCode} - {s.name}
                    </div>
                    <label className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-white/70">
                      <input
                        type="checkbox"
                        checked={s.enabled}
                        onChange={(e) => toggleSubheading(s.headCode, s.subheadCode, e.target.checked)}
                      />
                      Enabled
                    </label>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
