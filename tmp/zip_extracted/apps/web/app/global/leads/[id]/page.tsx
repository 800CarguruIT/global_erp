"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppLayout, Card, useI18n, useTheme } from "@repo/ui";

type LeadStatus = "open" | "assigned" | "onboarding" | "inprocess" | "completed" | "closed" | "lost";
type LeadType = "sales" | "support" | "complaint";

type LeadDetail = {
  id: string;
  title: string;
  status: LeadStatus;
  type: LeadType;
  customerName: string;
  customerPhone: string;
  companyName?: string | null;
  tradeLicense?: string | null;
  assignedTo?: string | null;
};

type TimelineEntry = { at: string; summary: string; author?: string };
type RemarkEntry = { at: string; author: string; role: "agent" | "customer"; message: string };

function Timeline({ items, formatDate }: { items: TimelineEntry[]; formatDate: (date: string) => string }) {
  if (items.length === 0) {
    return <div className="text-sm text-muted-foreground">-</div>;
  }
  return (
    <div className="space-y-3">
      {items.map((t, idx) => (
        <div key={`${t.at}-${idx}`} className="flex gap-3">
          <div className="w-32 text-xs text-muted-foreground">{formatDate(t.at)}</div>
          <div className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
            <div className="font-semibold">{t.summary}</div>
            {t.author && <div className="text-xs text-muted-foreground">{t.author}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function RemarksThread({
  remarks,
  formatDate,
  t,
  displayAuthor,
}: {
  remarks: RemarkEntry[];
  formatDate: (date: string) => string;
  t: (key: string) => string;
  displayAuthor: (author: string, role: "agent" | "customer") => string;
}) {
  if (remarks.length === 0) {
    return <div className="text-xs text-muted-foreground">{t("lead.detail.noRemarks")}</div>;
  }
  return (
    <div className="space-y-2">
      {remarks.map((r, idx) => (
        <div key={`${r.at}-${idx}`} className={`flex ${r.role === "agent" ? "justify-end" : "justify-start"}`}>
          <div
            className={`max-w-xl rounded-2xl px-3 py-2 text-sm ${
              r.role === "agent" ? "bg-primary text-primary-foreground" : "border border-white/10 bg-white/10"
            }`}
          >
            <div className="text-[11px] opacity-80">
              {displayAuthor(r.author, r.role)} - {formatDate(r.at)}
            </div>
            <div>{r.message}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LeadDetailPage() {
  return (
    <AppLayout>
      <LeadDetailContent />
    </AppLayout>
  );
}

function LeadDetailContent() {
  const params = useParams<{ id: string }>();
  const leadId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const { t, lang } = useI18n();
  const { theme } = useTheme();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [remarks, setRemarks] = useState<RemarkEntry[]>([]);
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [newRemark, setNewRemark] = useState({ role: "agent" as "agent" | "customer", author: "", message: "" });
  const [savingRemark, setSavingRemark] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(lang || "en", {
        timeZone: "UTC",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
    [lang]
  );

  function formatDate(date: string) {
    return dateFormatter.format(new Date(date));
  }

  function statusLabel(status: LeadStatus) {
    return t(`lead.create.status.${status}`);
  }

  function typeLabel(type: LeadType) {
    return t(`lead.create.type.${type}`);
  }

  function roleLabel(role: "agent" | "customer") {
    return role === "agent" ? t("lead.detail.remark.role.agent") : t("lead.detail.remark.role.customer");
  }

  function defaultAuthorForRole(role: "agent" | "customer") {
    if (role === "agent") {
      return assignedTo || lead?.assignedTo || t("lead.detail.remark.author");
    }
    return lead?.customerName || t("lead.detail.remark.author");
  }

  function displayAuthor(author: string, role: "agent" | "customer") {
    const placeholder = (t("lead.detail.remark.author") || "").toLowerCase();
    const cleaned = author?.trim() ?? "";
    if (!cleaned || cleaned.toLowerCase() === "your name" || cleaned.toLowerCase() === placeholder) {
      return defaultAuthorForRole(role);
    }
    return cleaned;
  }

  async function fetchLead() {
    if (!leadId) {
      setError(t("lead.detail.load.idMissing"));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/global/leads/${leadId}`, { cache: "no-store" });
      if (!res.ok) throw new Error(t("lead.detail.load.error"));
      const data = await res.json();
      setLead(data.lead);
      setAssignedTo(data.lead?.assignedTo ?? "");
      setTimeline(data.timeline ?? []);
      setRemarks(data.remarks ?? []);
    } catch (err: any) {
      setError(err?.message ?? t("lead.detail.load.error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetchLead();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  useEffect(() => {
    // Prefill author once lead data or assignedTo is available
    setNewRemark((prev) => {
      if (prev.author?.trim()) return prev;
      return { ...prev, author: defaultAuthorForRole(prev.role) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead, assignedTo]);

  const inputClass = `${theme.input} w-full`;
  const textAreaClass = `${theme.input} w-full min-h-[80px]`;

  if (loading) {
    return <div className="py-6 text-sm text-muted-foreground">{t("lead.detail.loading")}</div>;
  }

  if (error || !lead) {
    return (
      <div className="space-y-2 py-6">
        <p className="text-sm text-destructive">{error ?? t("lead.detail.notFound")}</p>
        <Link href="/global/leads" className="text-sm text-primary hover:underline">
          {t("lead.detail.back")}
        </Link>
      </div>
    );
  }

  async function saveStatus(nextStatus: LeadStatus) {
    if (!leadId) return;
    setUpdatingStatus(true);
    try {
      await fetch(`/api/global/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      setLead((prev) => (prev ? { ...prev, status: nextStatus } : prev));
      fetchLead();
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function postRemark() {
    if (!leadId || !newRemark.message.trim()) return;
    const author = newRemark.author?.trim() || defaultAuthorForRole(newRemark.role);
    setSavingRemark(true);
    try {
      await fetch(`/api/global/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          remark: newRemark.message,
          role: newRemark.role,
          author,
        }),
      });
      setNewRemark((prev) => ({ ...prev, message: "" }));
      fetchLead();
    } finally {
      setSavingRemark(false);
    }
  }

  return (
    <div className="space-y-6 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{lead.title}</h1>
          <p className="text-sm text-muted-foreground">{lead.id}</p>
        </div>
        <Link href="/global/leads" className="text-sm text-primary hover:underline">
          {t("lead.detail.back")}
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <div className="space-y-2">
            <div className="text-lg font-semibold">{t("lead.detail.customer")}</div>
            <div className="text-sm">{lead.customerName}</div>
            <div className="text-sm text-muted-foreground">{lead.customerPhone}</div>
            {lead.companyName && (
              <div className="text-sm text-muted-foreground">
                {t("lead.detail.company")}: {lead.companyName}
              </div>
            )}
            {lead.tradeLicense && (
              <div className="text-sm text-muted-foreground">
                {t("lead.detail.tradeLicense")}: {lead.tradeLicense}
              </div>
            )}
            <div className="text-sm">
              {t("lead.detail.type")}: <span className="capitalize">{typeLabel(lead.type)}</span>
            </div>
            <div className="text-sm space-y-1">
              <div className="flex items-center gap-2">
                <span>{t("lead.detail.status")}:</span>
                <select
                  className={`${theme.input} w-40`}
                  value={lead.status}
                  disabled={updatingStatus}
                  onChange={(e) => saveStatus(e.target.value as LeadStatus)}
                >
                  <option value="open">{statusLabel("open")}</option>
                  <option value="assigned">{statusLabel("assigned")}</option>
                  <option value="onboarding">{statusLabel("onboarding")}</option>
                  <option value="inprocess">{statusLabel("inprocess")}</option>
                  <option value="completed">{statusLabel("completed")}</option>
                  <option value="closed">{statusLabel("closed")}</option>
                  <option value="lost">{statusLabel("lost")}</option>
                </select>
              </div>
            </div>
            <div className="text-sm space-y-1">
              <div>{t("lead.detail.assigned")}:</div>
              <input
                className={inputClass}
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                placeholder={t("lead.detail.assigned.placeholder")}
              />
            </div>
          </div>
        </Card>

        <Card>
          <div className="space-y-3">
            <div className="text-lg font-semibold">{t("lead.detail.timeline")}</div>
            <Timeline items={timeline} formatDate={formatDate} />
          </div>
        </Card>
      </div>

      <Card>
          <div className="space-y-3">
            <div className="text-lg font-semibold">{t("lead.detail.remarks")}</div>
          <RemarksThread remarks={remarks} formatDate={formatDate} t={t} displayAuthor={displayAuthor} />
          <div className="space-y-2">
            <div className="text-sm font-semibold">{t("lead.detail.addRemark")}</div>
            <div className="grid gap-2 md:grid-cols-2">
              <select
                className={inputClass}
                value={newRemark.role}
                onChange={(e) => {
                  const role = e.target.value as "agent" | "customer";
                  setNewRemark((prev) => ({
                    ...prev,
                    role,
                    author: prev.author?.trim() ? prev.author : defaultAuthorForRole(role),
                  }));
                }}
              >
                <option value="agent">{t("lead.detail.remark.role.agent")}</option>
                <option value="customer">{t("lead.detail.remark.role.customer")}</option>
              </select>
            </div>
            <textarea
              className={textAreaClass}
              value={newRemark.message}
              onChange={(e) => setNewRemark({ ...newRemark, message: e.target.value })}
              placeholder={t("lead.detail.remark.placeholder")}
            />
            <button
              type="button"
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              disabled={savingRemark}
              onClick={postRemark}
            >
              {savingRemark ? t("lead.detail.loading") : t("lead.detail.remark.post")}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
